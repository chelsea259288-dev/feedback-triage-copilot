// ============================================
// Database Queries Service
// ============================================

import type { Env, Feedback, APIResponse } from '../types';

export async function getAllFeedback(
    env: Env,
    filters?: {
        source?: string;
        sentiment?: string;
        category?: string;
        product_area?: string;
        limit?: number;
        offset?: number;
    }
): Promise<APIResponse<Feedback[]>> {
    try {
        let query = 'SELECT * FROM feedback WHERE 1=1';
        const params: any[] = [];
        
        if (filters?.source) {
            query += ' AND source = ?';
            params.push(filters.source);
        }
        if (filters?.sentiment) {
            query += ' AND sentiment = ?';
            params.push(filters.sentiment);
        }
        if (filters?.category) {
            query += ' AND category = ?';
            params.push(filters.category);
        }
        if (filters?.product_area) {
            query += ' AND product_area = ?';
            params.push(filters.product_area);
        }
        
        query += ' ORDER BY created_at DESC';
        
        if (filters?.limit) {
            query += ' LIMIT ?';
            params.push(filters.limit);
        }
        if (filters?.offset) {
            query += ' OFFSET ?';
            params.push(filters.offset);
        }
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        return {
            success: true,
            data: result.results as Feedback[]
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

export async function createFeedback(
    env: Env,
    feedback: Feedback
): Promise<APIResponse<{ id: number }>> {
    try {
        const result = await env.DB.prepare(`
            INSERT INTO feedback (content, source, author, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
            feedback.content,
            feedback.source,
            feedback.author || 'anonymous'
        ).run();
        
        return {
            success: true,
            data: { id: result.meta.last_row_id }
        };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

export async function updateFeedbackAnalysis(
    env: Env,
    id: number,
    analysis: {
        sentiment: string;
        sentiment_score: number;
        category: string;
        urgency_score: number;
        product_area: string;
        summary: string;
        keywords: string;
    }
): Promise<APIResponse> {
    try {
        await env.DB.prepare(`
            UPDATE feedback
            SET sentiment = ?,
                sentiment_score = ?,
                category = ?,
                urgency_score = ?,
                product_area = ?,
                summary = ?,
                keywords = ?,
                analyzed = 1,
                analyzed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).bind(
            analysis.sentiment,
            analysis.sentiment_score,
            analysis.category,
            analysis.urgency_score,
            analysis.product_area,
            analysis.summary,
            analysis.keywords,
            id
        ).run();
        
        return { success: true };
    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}
