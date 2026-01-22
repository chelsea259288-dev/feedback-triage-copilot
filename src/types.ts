// ============================================
// Type Definitions for Feedback Triage Copilot
// ============================================

// Cloudflare Workers Environment Bindings
export interface Env {
    DB: D1Database;
    AI: Ai;
    CORPUS?: R2Bucket;  // Optional: R2 for corpus storage
    TRIAGE_WORKFLOW: Workflow;
    ENVIRONMENT: string;
    AI_SEARCH_NAME: string;
}

// ============================================
// Database Models
// ============================================

export interface FeedbackRaw {
    id: number;
    source: 'discord' | 'github' | 'support' | 'twitter';
    url?: string;
    title: string;
    body: string;
    product_hint?: string;
    created_at: string;  // ISO-8601
    r2_key?: string;
    content_hash?: string;
    duplicate_of?: number;
    ingested_at: string;
}

export interface FeedbackAI {
    id: number;
    raw_id: number;
    sentiment_label: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;  // 0-1
    urgency: 'P0' | 'P1' | 'P2' | 'P3';
    category: 'Bug' | 'Docs' | 'UX' | 'Pricing' | 'Feature' | 'Performance' | 'Other';
    product_area: string;
    theme: string;
    summary: string;
    next_action: string;
    model_meta: string;  // JSON
    created_at: string;
}

export interface ThemeDaily {
    id: number;
    date: string;  // YYYY-MM-DD
    theme: string;
    product_area?: string;
    count: number;
    p0_count: number;
    neg_ratio: number;
    updated_at: string;
}

export interface ProductArea {
    id: number;
    name: string;
    display_name: string;
    category: string;
}

// ============================================
// Workflow Types
// ============================================

export interface TriageWorkflowParams {
    rawId: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface IngestRequest {
    source: 'discord' | 'github' | 'support' | 'twitter';
    url?: string;
    title: string;
    body: string;
    product_hint?: string;
    created_at?: string;  // Optional, defaults to now
}

export interface IngestResponse {
    success: boolean;
    data?: {
        raw_id: number;
        duplicate_of?: number;
        workflow_instance_id?: string;
        r2_key?: string;
    };
    error?: string;
}

export interface FeedbackListItem {
    raw_id: number;
    title: string;
    source: string;
    product_area: string;
    created_at: string;
    ai?: {
        urgency: string;
        sentiment: {
            label: string;
            score: number;
        };
        category: string;
        summary: string;
        theme: string;
        dup_count?: number;
    };
}

export interface FeedbackDetail {
    raw: FeedbackRaw;
    ai?: FeedbackAI;
}

export interface ThemeAggregation {
    theme: string;
    product_area?: string;
    count: number;
    p0_count: number;
    neg_ratio: number;
    last_seen: string;
    trend?: number;  // Delta vs yesterday
}

export interface DigestData {
    top_themes: ThemeAggregation[];
    top_urgent: FeedbackListItem[];
    top_repeated: {
        duplicate_of: number;
        count: number;
        title: string;
        product_area: string;
    }[];
}

// ============================================
// AI Search Types
// ============================================

export interface SimilarResult {
    raw_id: number;
    title: string;
    source: string;
    created_at: string;
    score: number;
    snippet?: string;
}

export interface SearchResult {
    raw_id: number;
    title: string;
    source: string;
    product_area: string;
    created_at: string;
    score: number;
    snippet?: string;
}

export interface AskResponse {
    answer: string;
    sources: {
        raw_id: number;
        title: string;
        url?: string;
    }[];
}

// ============================================
// R2 Corpus Object Schema
// ============================================

export interface CorpusObject {
    raw_id: number;
    source: string;
    product_area: string;
    title: string;
    body: string;
    url?: string;
    created_at: string;
    ai?: {
        theme: string;
        summary: string;
        category: string;
        urgency: string;
        sentiment: {
            label: string;
            score: number;
        };
        next_action: string;
    };
}

// ============================================
// AI Analysis Types
// ============================================

export interface AIAnalysisResult {
    sentiment_label: 'positive' | 'neutral' | 'negative';
    sentiment_score: number;
    urgency: 'P0' | 'P1' | 'P2' | 'P3';
    category: 'Bug' | 'Docs' | 'UX' | 'Pricing' | 'Feature' | 'Performance' | 'Other';
    product_area: string;
    theme: string;
    summary: string;
    next_action: string;
}
