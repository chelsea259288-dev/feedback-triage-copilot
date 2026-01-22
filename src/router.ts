// ============================================
// API Router for Feedback Triage Copilot
// ============================================

import type { Env, IngestRequest, IngestResponse, FeedbackListItem, FeedbackDetail, ThemeAggregation, DigestData } from './types';
import { findSimilar, globalSearch, askFeedback } from './services/ai-search';
import { generateMockFeedback } from './mock-data';

async function backfillCorpus(env: Env, limit: number): Promise<{ scanned: number; enqueued: number }> {
    // Find rows that have AI analysis but were not written to R2 yet
    const result = await env.DB.prepare(`
        SELECT r.id as raw_id
        FROM feedback_raw r
        JOIN feedback_ai a ON r.id = a.raw_id
        WHERE r.duplicate_of IS NULL
          AND r.r2_key IS NULL
        ORDER BY r.id ASC
        LIMIT ?
    `).bind(limit).all();

    const rows = (result.results || []) as any[];
    let enqueued = 0;

    for (const row of rows) {
        try {
            const instance = await env.TRIAGE_WORKFLOW.create({
                params: { rawId: row.raw_id },
            });
            if (instance?.id) enqueued++;
        } catch (err) {
            console.error('Backfill workflow enqueue failed:', err);
        }
    }

    return { scanned: rows.length, enqueued };
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
        // ============================================
        // POST /api/ingest - Ingest new feedback
        // ============================================
        if (path === '/api/ingest' && method === 'POST') {
            const body = await request.json<IngestRequest>();
            
            // Validate required fields
            if (!body.source || !body.title || !body.body) {
                return jsonResponse({ success: false, error: 'Missing required fields' }, 400);
            }

            const now = new Date().toISOString();
            const createdAt = body.created_at || now;

            // Check for URL-based duplicate
            let duplicateOf: number | undefined;
            if (body.url) {
                const dup = await env.DB.prepare(
                    'SELECT id FROM feedback_raw WHERE url = ? LIMIT 1'
                ).bind(body.url).first<{ id: number }>();
                
                if (dup) {
                    duplicateOf = dup.id;
                }
            }

            // Insert into feedback_raw
            const insertResult = await env.DB.prepare(`
                INSERT INTO feedback_raw (source, url, title, body, product_hint, created_at, duplicate_of, ingested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                body.source,
                body.url || null,
                body.title,
                body.body,
                body.product_hint || null,
                createdAt,
                duplicateOf || null,
                now
            ).run();

            const rawId = insertResult.meta.last_row_id;

            // Trigger workflow (async analysis)
            let workflowInstanceId: string | undefined;
            try {
                const instance = await env.TRIAGE_WORKFLOW.create({
                    params: { rawId },
                });
                workflowInstanceId = instance.id;
            } catch (workflowError) {
                console.error('Workflow trigger failed:', workflowError);
                // Don't fail the request - workflow can be retried manually
            }

            const response: IngestResponse = {
                success: true,
                data: {
                    raw_id: rawId,
                    duplicate_of: duplicateOf,
                    workflow_instance_id: workflowInstanceId,
                },
            };

            return jsonResponse(response, 201);
        }

        // ============================================
        // GET /api/inbox - List feedbacks with filters
        // ============================================
        if (path === '/api/inbox' && method === 'GET') {
            const source = url.searchParams.get('source');
            const productArea = url.searchParams.get('product_area');
            const category = url.searchParams.get('category');
            const urgency = url.searchParams.get('urgency');
            const sentiment = url.searchParams.get('sentiment');
            const limit = parseInt(url.searchParams.get('limit') || '50');
            const offset = parseInt(url.searchParams.get('offset') || '0');

            let query = `
                SELECT 
                    r.id as raw_id,
                    r.title,
                    r.source,
                    r.created_at,
                    a.urgency,
                    a.sentiment_label,
                    a.sentiment_score,
                    a.category,
                    a.product_area,
                    a.summary,
                    a.theme,
                    (SELECT COUNT(*) FROM feedback_raw WHERE duplicate_of = r.id) as dup_count
                FROM feedback_raw r
                LEFT JOIN feedback_ai a ON r.id = a.raw_id
                WHERE r.duplicate_of IS NULL
            `;

            const bindings: any[] = [];
            
            if (source) {
                query += ` AND r.source = ?`;
                bindings.push(source);
            }
            if (productArea && productArea !== 'all') {
                query += ` AND a.product_area = ?`;
                bindings.push(productArea);
            }
            if (category && category !== 'all') {
                query += ` AND a.category = ?`;
                bindings.push(category);
            }
            if (urgency && urgency !== 'all') {
                query += ` AND a.urgency = ?`;
                bindings.push(urgency);
            }
            if (sentiment && sentiment !== 'all') {
                query += ` AND a.sentiment_label = ?`;
                bindings.push(sentiment);
            }

            query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
            bindings.push(limit, offset);

            const stmt = env.DB.prepare(query);
            const result = await stmt.bind(...bindings).all();

            const items: FeedbackListItem[] = (result.results || []).map((row: any) => ({
                raw_id: row.raw_id,
                title: row.title,
                source: row.source,
                product_area: row.product_area || 'unknown',
                created_at: row.created_at,
                ai: row.urgency ? {
                    urgency: row.urgency,
                    sentiment: {
                        label: row.sentiment_label,
                        score: row.sentiment_score,
                    },
                    category: row.category,
                    summary: row.summary,
                    theme: row.theme,
                    dup_count: row.dup_count,
                } : undefined,
            }));

            return jsonResponse({ success: true, data: items });
        }

        // ============================================
        // GET /api/themes - Theme aggregations
        // ============================================
        if (path === '/api/themes' && method === 'GET') {
            const range = url.searchParams.get('range') || '7d';
            const daysAgo = range === '24h' ? 1 : range === '7d' ? 7 : 30;
            const sinceDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const query = `
                SELECT 
                    theme,
                    product_area,
                    SUM(count) as total_count,
                    SUM(p0_count) as total_p0,
                    AVG(neg_ratio) as avg_neg_ratio,
                    MAX(date) as last_seen
                FROM theme_daily
                WHERE date >= ?
                GROUP BY theme, product_area
                ORDER BY total_count DESC
                LIMIT 20
            `;

            const result = await env.DB.prepare(query).bind(sinceDate).all();

            const themes: ThemeAggregation[] = (result.results || []).map((row: any) => ({
                theme: row.theme,
                product_area: row.product_area,
                count: row.total_count,
                p0_count: row.total_p0,
                neg_ratio: row.avg_neg_ratio,
                last_seen: row.last_seen,
            }));

            return jsonResponse({ success: true, data: themes });
        }

        // ============================================
        // GET /api/feedback/:id - Feedback detail
        // ============================================
        const detailMatch = path.match(/^\/api\/feedback\/(\d+)$/);
        if (detailMatch && method === 'GET') {
            const rawId = parseInt(detailMatch[1]);

            const raw = await env.DB.prepare(
                'SELECT * FROM feedback_raw WHERE id = ?'
            ).bind(rawId).first();

            if (!raw) {
                return jsonResponse({ success: false, error: 'Feedback not found' }, 404);
            }

            const ai = await env.DB.prepare(
                'SELECT * FROM feedback_ai WHERE raw_id = ?'
            ).bind(rawId).first();

            const detail: FeedbackDetail = {
                raw: raw as any,
                ai: ai as any,
            };

            return jsonResponse({ success: true, data: detail });
        }

        // ============================================
        // GET /api/digest - Daily digest
        // ============================================
        if (path === '/api/digest' && method === 'GET') {
            const range = url.searchParams.get('range') || '24h';
            const hoursAgo = range === '24h' ? 24 : 168;  // 7 days
            const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

            // Top themes
            const themesResult = await env.DB.prepare(`
                SELECT theme, product_area, COUNT(*) as count, 
                       SUM(CASE WHEN urgency = 'P0' THEN 1 ELSE 0 END) as p0_count,
                       AVG(CASE WHEN sentiment_label = 'negative' THEN 1.0 ELSE 0.0 END) as neg_ratio
                FROM feedback_ai
                JOIN feedback_raw ON feedback_ai.raw_id = feedback_raw.id
                WHERE feedback_raw.created_at >= ?
                GROUP BY theme, product_area
                ORDER BY count DESC
                LIMIT 10
            `).bind(since).all();

            // Top urgent
            const urgentResult = await env.DB.prepare(`
                SELECT r.id as raw_id, r.title, r.source, r.created_at,
                       a.urgency, a.summary, a.product_area
                FROM feedback_raw r
                JOIN feedback_ai a ON r.id = a.raw_id
                WHERE r.created_at >= ? AND a.urgency IN ('P0', 'P1')
                ORDER BY 
                    CASE a.urgency WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 END,
                    r.created_at DESC
                LIMIT 10
            `).bind(since).all();

            // Top repeated
            const repeatedResult = await env.DB.prepare(`
                SELECT dup.duplicate_of AS duplicate_of, COUNT(*) as count,
                       r.title, a.product_area
                FROM feedback_raw dup
                JOIN feedback_raw r ON dup.duplicate_of = r.id
                LEFT JOIN feedback_ai a ON r.id = a.raw_id
                WHERE dup.duplicate_of IS NOT NULL
                GROUP BY dup.duplicate_of
                ORDER BY count DESC
                LIMIT 5
            `).bind().all();

            const digest: DigestData = {
                top_themes: (themesResult.results || []) as any,
                top_urgent: (urgentResult.results || []) as any,
                top_repeated: (repeatedResult.results || []) as any,
            };

            return jsonResponse({ success: true, data: digest });
        }

        // ============================================
        // GET /api/feedback/:id/similar - Similar issues (AI Search)
        // ============================================
        const similarMatch = path.match(/^\/api\/feedback\/(\d+)\/similar$/);
        if (similarMatch && method === 'GET') {
            const rawId = parseInt(similarMatch[1]);
            const topK = parseInt(url.searchParams.get('top_k') || '8');

            const similar = await findSimilar(env, rawId, topK);
            return jsonResponse({ success: true, data: similar });
        }

        // ============================================
        // GET /api/search - Global semantic search
        // ============================================
        if (path === '/api/search' && method === 'GET') {
            const query = url.searchParams.get('q');
            if (!query) {
                return jsonResponse({ success: false, error: 'Missing query parameter' }, 400);
            }

            const topK = parseInt(url.searchParams.get('top_k') || '20');
            const productArea = url.searchParams.get('product_area') || undefined;

            const results = await globalSearch(env, query, topK, productArea);
            return jsonResponse({ success: true, data: results, query });
        }

        // ============================================
        // POST /api/ask - Ask the feedback (RAG)
        // ============================================
        if (path === '/api/ask' && method === 'POST') {
            const body = await request.json<{ question: string }>();
            if (!body.question) {
                return jsonResponse({ success: false, error: 'Missing question' }, 400);
            }

            const answer = await askFeedback(env, body.question);
            return jsonResponse({ success: true, data: answer });
        }

        // ============================================
        // GET /api/seed - Seed mock data
        // ============================================
        if (path === '/api/seed' && method === 'GET') {
            const mockData = generateMockFeedback();
            const results: any[] = [];

            for (const item of mockData) {
                try {
                    // Ingest via API (which will trigger workflow)
                    const now = new Date().toISOString();
                    const createdAt = item.created_at || now;

                    // Check for URL-based duplicate
                    let duplicateOf: number | undefined;
                    if (item.url) {
                        const dup = await env.DB.prepare(
                            'SELECT id FROM feedback_raw WHERE url = ? LIMIT 1'
                        ).bind(item.url).first<{ id: number }>();
                        
                        if (dup) {
                            duplicateOf = dup.id;
                        }
                    }

                    // Insert into feedback_raw
                    const insertResult = await env.DB.prepare(`
                        INSERT INTO feedback_raw (source, url, title, body, product_hint, created_at, duplicate_of, ingested_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        item.source,
                        item.url || null,
                        item.title,
                        item.body,
                        item.product_hint || null,
                        createdAt,
                        duplicateOf || null,
                        now
                    ).run();

                    const rawId = insertResult.meta.last_row_id;

                    // Trigger workflow (async)
                    try {
                        const instance = await env.TRIAGE_WORKFLOW.create({
                            params: { rawId },
                        });
                        results.push({ raw_id: rawId, workflow_id: instance.id, duplicate_of: duplicateOf });
                    } catch (workflowError) {
                        results.push({ raw_id: rawId, workflow_error: String(workflowError) });
                    }
                } catch (error) {
                    console.error('Seed error:', error);
                }
            }

            return jsonResponse({
                success: true,
                message: `Seeded ${results.length} feedback entries`,
                results: results.slice(0, 10),  // Show first 10 for brevity
            });
        }

        // ============================================
        // POST /api/backfill-corpus - Enqueue workflows to write missing R2 objects
        // ============================================
        if (path === '/api/backfill-corpus' && method === 'POST') {
            if (!env.CORPUS) {
                return jsonResponse({
                    success: false,
                    error: 'R2 CORPUS binding not configured. Enable R2 binding and redeploy first.',
                }, 400);
            }

            const body = await request.json<{ limit?: number }>().catch(() => ({} as any));
            const limit = Math.max(1, Math.min(500, Number(body.limit || 200)));

            const res = await backfillCorpus(env, limit);
            return jsonResponse({
                success: true,
                data: {
                    ...res,
                    note: 'This enqueues workflows; R2 writes happen asynchronously in workflow step C.',
                },
            });
        }

        // ============================================
        // GET / - Dashboard HTML
        // ============================================
        if (path === '/' && method === 'GET') {
            // Will be handled by assets binding
            return new Response('Dashboard loading...', {
                headers: { 'Content-Type': 'text/html' },
            });
        }

        // 404
        return jsonResponse({ success: false, error: 'Not found' }, 404);

    } catch (error) {
        console.error('API Error:', error);
        return jsonResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        }, 500);
    }
}

function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}
