// ============================================
// Analytics Service
// ============================================

import type { Env, AnalyticsSummary } from '../types';

export async function getAnalytics(env: Env): Promise<AnalyticsSummary> {
    // Total count
    const totalResult = await env.DB.prepare('SELECT COUNT(*) as count FROM feedback').first();
    const total_feedback = totalResult?.count as number || 0;
    
    // Today's count
    const todayResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM feedback 
        WHERE DATE(created_at) = DATE('now')
    `).first();
    const today_count = todayResult?.count as number || 0;
    
    // Unanalyzed count
    const unanalyzedResult = await env.DB.prepare(`
        SELECT COUNT(*) as count FROM feedback WHERE analyzed = 0
    `).first();
    const unanalyzed_count = unanalyzedResult?.count as number || 0;
    
    // Sentiment distribution
    const sentimentDist = await env.DB.prepare(`
        SELECT sentiment, COUNT(*) as count 
        FROM feedback 
        WHERE analyzed = 1 
        GROUP BY sentiment
    `).all();
    
    const sentiment_distribution = {
        positive: 0,
        neutral: 0,
        negative: 0
    };
    sentimentDist.results.forEach((row: any) => {
        if (row.sentiment in sentiment_distribution) {
            sentiment_distribution[row.sentiment as keyof typeof sentiment_distribution] = row.count;
        }
    });
    
    // Category distribution
    const categoryDist = await env.DB.prepare(`
        SELECT category, COUNT(*) as count 
        FROM feedback 
        WHERE analyzed = 1 
        GROUP BY category
    `).all();
    
    const category_distribution: any = {};
    categoryDist.results.forEach((row: any) => {
        category_distribution[row.category] = row.count;
    });
    
    // Product area distribution
    const productDist = await env.DB.prepare(`
        SELECT product_area, COUNT(*) as count 
        FROM feedback 
        WHERE analyzed = 1 
        GROUP BY product_area 
        ORDER BY count DESC
    `).all();
    
    const product_area_distribution: any = {};
    productDist.results.forEach((row: any) => {
        product_area_distribution[row.product_area] = row.count;
    });
    
    // Top keywords (simplified version)
    const top_keywords: Array<{ keyword: string; count: number }> = [];
    
    // Urgent feedback
    const urgentResult = await env.DB.prepare(`
        SELECT id, summary, urgency_score, product_area
        FROM feedback
        WHERE urgency_score >= 8 AND analyzed = 1
        ORDER BY urgency_score DESC, created_at DESC
        LIMIT 10
    `).all();
    
    const urgent_feedback = urgentResult.results.map((row: any) => ({
        id: row.id,
        summary: row.summary,
        urgency_score: row.urgency_score,
        product_area: row.product_area
    }));
    
    return {
        total_feedback,
        today_count,
        unanalyzed_count,
        sentiment_distribution,
        category_distribution,
        product_area_distribution,
        top_keywords,
        urgent_feedback
    };
}
