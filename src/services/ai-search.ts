// ============================================
// AI Search Service (with Fallback to Keyword Similarity)
// ============================================

import type { Env, SimilarResult, SearchResult, AskResponse } from '../types';
import { jaccardSimilarity } from '../utils/hash';

/**
 * Find similar feedback using AI Search (or fallback to keyword similarity)
 */
export async function findSimilar(
    env: Env,
    rawId: number,
    topK: number = 8
): Promise<SimilarResult[]> {
    // Get current feedback
    const current = await env.DB.prepare(`
        SELECT r.title, r.body, r.source, r.created_at, a.theme, a.summary, a.product_area, a.category
        FROM feedback_raw r
        LEFT JOIN feedback_ai a ON r.id = a.raw_id
        WHERE r.id = ?
    `).bind(rawId).first<any>();

    if (!current) {
        return [];
    }

    // Try AI Search first (if AI_SEARCH_NAME is configured and CORPUS exists)
    if (env.AI_SEARCH_NAME && env.CORPUS) {
        try {
            const searchQuery = `${current.title}\n${current.body}\nTheme: ${current.theme || ''}\nCategory: ${current.category || ''}`;
            
            const aiSearchResult = await env.AI.autorag(env.AI_SEARCH_NAME).search({
                query: searchQuery,
                rewrite_query: true,
                max_num_results: topK + 3,  // Get extra to filter out self
                ranking_options: {
                    score_threshold: 0.3,
                },
                reranking: {
                    enabled: true,
                    model: '@cf/baai/bge-reranker-base',
                },
            });

            // Parse AI Search results
            const results: SimilarResult[] = [];
            for (const item of (aiSearchResult as any).data || []) {
                // Extract raw_id from filename: feedback/{product_area}/{raw_id}.json
                const match = item.filename?.match(/feedback\/[^/]+\/(\d+)\.json$/);
                if (!match) continue;

                const itemRawId = parseInt(match[1]);
                if (itemRawId === rawId) continue;  // Skip self

                // Get additional info from D1
                const dbRow = await env.DB.prepare(
                    'SELECT r.title, r.source, r.created_at FROM feedback_raw r WHERE r.id = ?'
                ).bind(itemRawId).first<any>();

                if (dbRow) {
                    results.push({
                        raw_id: itemRawId,
                        title: dbRow.title,
                        source: dbRow.source,
                        created_at: dbRow.created_at,
                        score: item.score || 0,
                        snippet: item.content?.[0]?.text?.substring(0, 200),
                    });
                }

                if (results.length >= topK) break;
            }

            if (results.length > 0) {
                return results;
            }
        } catch (aiSearchError) {
            console.warn('AI Search failed, falling back to keyword similarity:', aiSearchError);
        }
    }

    // Fallback: Keyword-based similarity
    return await keywordSimilarityFallback(env, current, rawId, topK);
}

/**
 * Fallback: Use Jaccard similarity on title + body
 */
async function keywordSimilarityFallback(
    env: Env,
    current: any,
    rawId: number,
    topK: number
): Promise<SimilarResult[]> {
    const currentText = `${current.title} ${current.body}`;

    // Get candidates from same product_area or category
    const candidates = await env.DB.prepare(`
        SELECT r.id, r.title, r.body, r.source, r.created_at
        FROM feedback_raw r
        LEFT JOIN feedback_ai a ON r.id = a.raw_id
        WHERE r.id != ?
          AND r.duplicate_of IS NULL
          AND (a.product_area = ? OR a.category = ?)
        LIMIT 50
    `).bind(rawId, current.product_area, current.category).all();

    // Compute similarity scores
    const scored: SimilarResult[] = [];
    for (const row of (candidates.results || [])) {
        const candidateText = `${row.title} ${row.body}`;
        const score = jaccardSimilarity(currentText, candidateText);

        if (score > 0.1) {  // Minimum threshold
            scored.push({
                raw_id: row.id as number,
                title: row.title as string,
                source: row.source as string,
                created_at: row.created_at as string,
                score,
                snippet: (row.body as string).substring(0, 200),
            });
        }
    }

    // Sort by score and return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

/**
 * Global semantic search (with fallback)
 */
export async function globalSearch(
    env: Env,
    query: string,
    topK: number = 20,
    productArea?: string
): Promise<SearchResult[]> {
    // Try AI Search first
    if (env.AI_SEARCH_NAME && env.CORPUS) {
        try {
            const aiSearchResult = await env.AI.autorag(env.AI_SEARCH_NAME).search({
                query: productArea ? `${query} Product: ${productArea}` : query,
                rewrite_query: true,
                max_num_results: topK,
                ranking_options: {
                    score_threshold: 0.2,
                },
                reranking: {
                    enabled: true,
                    model: '@cf/baai/bge-reranker-base',
                },
            });

            const results: SearchResult[] = [];
            for (const item of (aiSearchResult as any).data || []) {
                const match = item.filename?.match(/feedback\/[^/]+\/(\d+)\.json$/);
                if (!match) continue;

                const itemRawId = parseInt(match[1]);
                const dbRow = await env.DB.prepare(`
                    SELECT r.title, r.source, r.created_at, a.product_area
                    FROM feedback_raw r
                    LEFT JOIN feedback_ai a ON r.id = a.raw_id
                    WHERE r.id = ?
                `).bind(itemRawId).first<any>();

                if (dbRow) {
                    results.push({
                        raw_id: itemRawId,
                        title: dbRow.title,
                        source: dbRow.source,
                        product_area: dbRow.product_area || 'unknown',
                        created_at: dbRow.created_at,
                        score: item.score || 0,
                        snippet: item.content?.[0]?.text?.substring(0, 200),
                    });
                }
            }

            if (results.length > 0) {
                return results;
            }
        } catch (error) {
            console.warn('AI Search failed, falling back to D1 LIKE query:', error);
        }
    }

    // Fallback: D1 LIKE query
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (keywords.length === 0) {
        return [];
    }

    let sqlQuery = `
        SELECT r.id as raw_id, r.title, r.source, r.created_at, a.product_area
        FROM feedback_raw r
        LEFT JOIN feedback_ai a ON r.id = a.raw_id
        WHERE r.duplicate_of IS NULL
          AND (
    `;

    const bindings: any[] = [];
    const conditions: string[] = [];

    keywords.forEach(keyword => {
        conditions.push('LOWER(r.title) LIKE ?');
        conditions.push('LOWER(r.body) LIKE ?');
        bindings.push(`%${keyword}%`, `%${keyword}%`);
    });

    sqlQuery += conditions.join(' OR ') + ')';

    if (productArea && productArea !== 'all') {
        sqlQuery += ' AND a.product_area = ?';
        bindings.push(productArea);
    }

    sqlQuery += ' LIMIT ?';
    bindings.push(topK);

    const result = await env.DB.prepare(sqlQuery).bind(...bindings).all();

    return (result.results || []).map((row: any) => ({
        raw_id: row.raw_id,
        title: row.title,
        source: row.source,
        product_area: row.product_area || 'unknown',
        created_at: row.created_at,
        score: 0.5,  // Default score for fallback
    }));
}

/**
 * Ask the feedback (RAG)
 */
export async function askFeedback(
    env: Env,
    question: string
): Promise<AskResponse> {
    // Try AI Search aiSearch() method (retrieval + generation)
    if (env.AI_SEARCH_NAME && env.CORPUS) {
        try {
            const ragResult = await env.AI.autorag(env.AI_SEARCH_NAME).aiSearch({
                query: question,
                model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
                rewrite_query: true,
                max_num_results: 5,
                stream: false,
            });

            const sources: AskResponse['sources'] = [];
            for (const item of (ragResult as any).data || []) {
                const match = item.filename?.match(/feedback\/[^/]+\/(\d+)\.json$/);
                if (match) {
                    const rawId = parseInt(match[1]);
                    const dbRow = await env.DB.prepare(
                        'SELECT title, url FROM feedback_raw WHERE id = ?'
                    ).bind(rawId).first<any>();
                    
                    if (dbRow) {
                        sources.push({
                            raw_id: rawId,
                            title: dbRow.title,
                            url: dbRow.url,
                        });
                    }
                }
            }

            return {
                answer: (ragResult as any).response || 'No answer generated',
                sources,
            };
        } catch (error) {
            console.warn('AI Search aiSearch() failed, using fallback:', error);
        }
    }

    // Fallback: Simple aggregation
    return {
        answer: 'AI Search is not available. Please configure R2 and AI Search to use this feature. See R2_AI_SEARCH_SETUP.md for instructions.',
        sources: [],
    };
}
