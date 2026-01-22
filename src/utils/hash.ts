// ============================================
// Hash Utilities for Deduplication
// ============================================

/**
 * Compute a simple hash of title + body for near-duplicate detection
 * Uses a basic implementation that works in Workers environment
 */
export async function computeContentHash(title: string, body: string): Promise<string> {
    // Normalize text: lowercase, trim, collapse whitespace
    const normalized = `${title} ${body}`
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .substring(0, 2000);  // Limit length

    // Use Web Crypto API (available in Workers)
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Return first 16 chars for storage efficiency
    return hashHex.substring(0, 16);
}

/**
 * Compute Jaccard similarity between two sets of words
 * Used for keyword-based similarity when AI Search is unavailable
 */
export function jaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
}
