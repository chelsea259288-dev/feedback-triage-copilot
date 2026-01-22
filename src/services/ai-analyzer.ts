// ============================================
// AI Analyzer Service (Workers AI Integration)
// ============================================

import type { Ai } from '@cloudflare/workers-types';
import type { AIAnalysisResult } from '../types';

/**
 * Build AI prompt for feedback analysis
 */
export function buildAIPrompt(
    title: string,
    body: string,
    source: string,
    productHint?: string
): string {
    return `You are a PM triage assistant for Cloudflare products. Analyze the following user feedback and extract structured information.

**Feedback Details:**
- Source: ${source}
- Title: ${title}
- Body: ${body}
${productHint ? `- Product Hint: ${productHint}` : ''}

**Your Task:**
Analyze this feedback and return a JSON object with the following fields:

1. **sentiment_label**: "positive", "neutral", or "negative"
2. **sentiment_score**: float between 0 (most negative) and 1 (most positive)
3. **urgency**: "P0" (critical), "P1" (high), "P2" (medium), or "P3" (low)
4. **category**: "Bug", "Docs", "UX", "Pricing", "Feature", "Performance", or "Other"
5. **product_area**: Cloudflare product name (workers, d1, workflows, r2, ai-search, pages, kv, durable-objects, workers-ai, cdn, waf, queues, hyperdrive, vectorize, ai-gateway, stream, images, analytics, logs, dns, turnstile, waiting-room, or "other")
6. **theme**: A concise 3-8 word theme label (e.g., "Deploy timeout errors", "Missing docs for API")
7. **summary**: A one-sentence summary (max 150 chars)
8. **next_action**: Suggested action from: "Eng triage", "Docs update", "SRE investigate", "Design review", "Pricing review", "Collect more info", "Community response"

**Guidelines:**
- P0: Production broken, data loss, security issue
- P1: Major functionality broken, widespread impact
- P2: Feature request, minor bugs, UX issues
- P3: Nice-to-have, documentation, clarifications
- Theme should be specific enough to group similar issues
- Summary should capture the core problem/request

Return ONLY valid JSON, no markdown formatting.`;
}

/**
 * Call Workers AI to analyze feedback
 */
export async function analyzeWithAI(ai: Ai, prompt: string): Promise<AIAnalysisResult> {
    const response = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
            {
                role: 'system',
                content: 'You are a helpful PM assistant that outputs valid JSON only.',
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        temperature: 0.3,  // Lower for more consistent structured output
        max_tokens: 500,
    });

    // Parse AI response
    let aiText = '';
    if (typeof response === 'object' && 'response' in response) {
        aiText = (response as any).response;
    } else if (typeof response === 'string') {
        aiText = response;
    } else {
        throw new Error('Unexpected AI response format');
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize
    return {
        sentiment_label: validateSentiment(parsed.sentiment_label),
        sentiment_score: Math.max(0, Math.min(1, parseFloat(parsed.sentiment_score) || 0.5)),
        urgency: validateUrgency(parsed.urgency),
        category: validateCategory(parsed.category),
        product_area: (parsed.product_area || 'other').toLowerCase(),
        theme: (parsed.theme || 'General feedback').substring(0, 100),
        summary: (parsed.summary || '').substring(0, 150),
        next_action: (parsed.next_action || 'Collect more info').substring(0, 100),
    };
}

// ============================================
// Validation Helpers
// ============================================

function validateSentiment(value: any): 'positive' | 'neutral' | 'negative' {
    const normalized = String(value).toLowerCase();
    if (normalized.includes('pos')) return 'positive';
    if (normalized.includes('neg')) return 'negative';
    return 'neutral';
}

function validateUrgency(value: any): 'P0' | 'P1' | 'P2' | 'P3' {
    const str = String(value).toUpperCase();
    if (str.includes('P0') || str.includes('CRITICAL')) return 'P0';
    if (str.includes('P1') || str.includes('HIGH')) return 'P1';
    if (str.includes('P3') || str.includes('LOW')) return 'P3';
    return 'P2';
}

function validateCategory(value: any): 'Bug' | 'Docs' | 'UX' | 'Pricing' | 'Feature' | 'Performance' | 'Other' {
    const str = String(value).toLowerCase();
    if (str.includes('bug')) return 'Bug';
    if (str.includes('doc')) return 'Docs';
    if (str.includes('ux') || str.includes('ui')) return 'UX';
    if (str.includes('pric')) return 'Pricing';
    if (str.includes('feature') || str.includes('request')) return 'Feature';
    if (str.includes('perf') || str.includes('slow')) return 'Performance';
    return 'Other';
}
