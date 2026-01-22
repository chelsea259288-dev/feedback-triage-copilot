// ============================================
// Triage Workflow: 3-Step Analysis Pipeline
// ============================================

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env, TriageWorkflowParams, FeedbackRaw, AIAnalysisResult, CorpusObject } from './types';
import { analyzeWithAI, buildAIPrompt } from './services/ai-analyzer';
import { computeContentHash } from './utils/hash';

export class TriageWorkflow extends WorkflowEntrypoint<Env, TriageWorkflowParams> {
    async run(event: WorkflowEvent<TriageWorkflowParams>, step: WorkflowStep) {
        const { rawId } = event.payload;

        // ============================================
        // Step A: Dedupe & Normalize
        // ============================================
        const rawData = await step.do(
            'dedupe-and-normalize',
            async () => {
                // Fetch raw feedback from D1
                const result = await this.env.DB.prepare(
                    'SELECT * FROM feedback_raw WHERE id = ?'
                ).bind(rawId).first<FeedbackRaw>();

                if (!result) {
                    throw new Error(`Feedback ${rawId} not found`);
                }

                // If already marked as duplicate, skip AI analysis
                if (result.duplicate_of) {
                    return { ...result, skip_ai: true };
                }

                // Compute content hash if not exists
                if (!result.content_hash) {
                    const hash = await computeContentHash(result.title, result.body);
                    await this.env.DB.prepare(
                        'UPDATE feedback_raw SET content_hash = ? WHERE id = ?'
                    ).bind(hash, rawId).run();
                    result.content_hash = hash;
                }

                // Check for duplicates by content_hash
                const dupCheck = await this.env.DB.prepare(
                    'SELECT id FROM feedback_raw WHERE content_hash = ? AND id < ? LIMIT 1'
                ).bind(result.content_hash, rawId).first<{ id: number }>();

                if (dupCheck) {
                    // Mark as duplicate
                    await this.env.DB.prepare(
                        'UPDATE feedback_raw SET duplicate_of = ? WHERE id = ?'
                    ).bind(dupCheck.id, rawId).run();
                    return { ...result, duplicate_of: dupCheck.id, skip_ai: true };
                }

                return { ...result, skip_ai: false };
            }
        );

        // Skip AI analysis for duplicates
        if (rawData.skip_ai) {
            return { success: true, skipped: true, reason: 'duplicate' };
        }

        // If we already have AI analysis for this raw_id, reuse it.
        // This enables non-destructive re-processing (e.g. backfilling R2 corpus) without
        // double-counting theme aggregation or hitting UNIQUE(raw_id) constraints.
        const existingAI = await this.env.DB.prepare(
            'SELECT * FROM feedback_ai WHERE raw_id = ?'
        ).bind(rawId).first<any>();
        const hasExistingAI = Boolean(existingAI);

        // ============================================
        // Step B: AI Structure (with retry)
        // ============================================
        const aiResult: AIAnalysisResult & { model_meta: string } = hasExistingAI
            ? {
                sentiment_label: existingAI.sentiment_label,
                sentiment_score: existingAI.sentiment_score,
                urgency: existingAI.urgency,
                category: existingAI.category,
                product_area: existingAI.product_area,
                theme: existingAI.theme,
                summary: existingAI.summary,
                next_action: existingAI.next_action,
                model_meta: existingAI.model_meta || '',
            }
            : await step.do(
                'ai-structure',
                {
                    retries: {
                        limit: 3,
                        delay: '5 seconds',
                        backoff: 'exponential',
                    },
                    timeout: '2 minutes',
                },
                async () => {
                    const prompt = buildAIPrompt(
                        rawData.title,
                        rawData.body,
                        rawData.source,
                        rawData.product_hint
                    );

                    try {
                        const analysis = await analyzeWithAI(this.env.AI, prompt);
                        return {
                            ...analysis,
                            model_meta: JSON.stringify({
                                model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
                                timestamp: new Date().toISOString(),
                                version: '1.0',
                            }),
                        };
                    } catch (error) {
                        console.error('AI analysis failed, using fallback:', error);
                        // Fallback to rule-based analysis
                        return {
                            sentiment_label: 'neutral' as const,
                            sentiment_score: 0.5,
                            urgency: 'P2' as const,
                            category: 'Other' as const,
                            product_area: rawData.product_hint || 'other',
                            theme: 'General feedback',
                            summary: rawData.title.substring(0, 100),
                            next_action: 'Manual review needed',
                            model_meta: JSON.stringify({
                                model: 'fallback',
                                timestamp: new Date().toISOString(),
                                error: String(error),
                            }),
                        };
                    }
                }
            );

        // ============================================
        // Step C: Write Back & Aggregate
        // ============================================
        await step.do(
            'write-back-and-aggregate',
            {
                retries: {
                    limit: 5,
                    delay: '3 seconds',
                    backoff: 'exponential',
                },
            },
            async () => {
                const now = new Date().toISOString();

                // 1. Insert AI analysis into feedback_ai + update theme aggregation
                // Only do this on the first successful analysis. If AI already exists, we might be
                // rerunning the workflow for backfill and should not duplicate rows or double-count.
                if (!hasExistingAI) {
                    await this.env.DB.prepare(`
                        INSERT INTO feedback_ai (
                            raw_id, sentiment_label, sentiment_score,
                            urgency, category, product_area,
                            theme, summary, next_action, model_meta, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        rawId,
                        aiResult.sentiment_label,
                        aiResult.sentiment_score,
                        aiResult.urgency,
                        aiResult.category,
                        aiResult.product_area,
                        aiResult.theme,
                        aiResult.summary,
                        aiResult.next_action,
                        aiResult.model_meta,
                        now
                    ).run();

                    // 2. Update theme_daily aggregation
                    const today = now.split('T')[0];  // YYYY-MM-DD
                    const p0Count = aiResult.urgency === 'P0' ? 1 : 0;
                    const negRatio = aiResult.sentiment_label === 'negative' ? 1.0 : 0.0;

                    await this.env.DB.prepare(`
                        INSERT INTO theme_daily (date, theme, product_area, count, p0_count, neg_ratio, updated_at)
                        VALUES (?, ?, ?, 1, ?, ?, ?)
                        ON CONFLICT(date, theme, product_area) DO UPDATE SET
                            count = count + 1,
                            p0_count = p0_count + ?,
                            neg_ratio = (neg_ratio * count + ?) / (count + 1),
                            updated_at = ?
                    `).bind(
                        today,
                        aiResult.theme,
                        aiResult.product_area,
                        p0Count,
                        negRatio,
                        now,
                        p0Count,
                        negRatio,
                        now
                    ).run();
                }

                // 3. Write to R2 corpus (if available)
                if (this.env.CORPUS) {
                    try {
                        const r2Key = `feedback/${aiResult.product_area}/${rawId}.json`;
                        const corpusObj: CorpusObject = {
                            raw_id: rawId,
                            source: rawData.source,
                            product_area: aiResult.product_area,
                            title: rawData.title,
                            body: rawData.body,
                            url: rawData.url,
                            created_at: rawData.created_at,
                            ai: {
                                theme: aiResult.theme,
                                summary: aiResult.summary,
                                category: aiResult.category,
                                urgency: aiResult.urgency,
                                sentiment: {
                                    label: aiResult.sentiment_label,
                                    score: aiResult.sentiment_score,
                                },
                                next_action: aiResult.next_action,
                            },
                        };

                        await this.env.CORPUS.put(r2Key, JSON.stringify(corpusObj, null, 2), {
                            httpMetadata: {
                                contentType: 'application/json',
                            },
                        });

                        // Update R2 key in feedback_raw
                        await this.env.DB.prepare(
                            'UPDATE feedback_raw SET r2_key = ? WHERE id = ?'
                        ).bind(r2Key, rawId).run();
                    } catch (r2Error) {
                        console.error('R2 write failed (non-critical):', r2Error);
                        // Don't throw - R2 is optional
                    }
                }

                return { success: true };
            }
        );

        return {
            success: true,
            raw_id: rawId,
            theme: aiResult.theme,
            urgency: aiResult.urgency,
        };
    }
}
