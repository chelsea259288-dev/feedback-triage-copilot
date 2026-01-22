-- ============================================
-- FeedbackHub Database Schema
-- ============================================

-- Main feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('discord', 'github', 'twitter', 'support')),
    author TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- AI analysis results
    sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative')),
    sentiment_score REAL CHECK(sentiment_score BETWEEN 0 AND 1),
    category TEXT CHECK(category IN ('bug', 'feature', 'performance', 'documentation', 'other')),
    urgency_score INTEGER CHECK(urgency_score BETWEEN 1 AND 10),
    
    -- Product area and content analysis
    product_area TEXT,
    summary TEXT,
    keywords TEXT,  -- Comma-separated list of keywords
    
    -- Metadata
    analyzed BOOLEAN DEFAULT 0,
    analyzed_at TIMESTAMP
);

-- Cloudflare product areas reference table
CREATE TABLE IF NOT EXISTS product_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL
);

-- Pre-populate product data
INSERT OR IGNORE INTO product_areas (name, display_name, category) VALUES
    ('workers', 'Cloudflare Workers', 'compute'),
    ('pages', 'Cloudflare Pages', 'compute'),
    ('d1', 'D1 Database', 'storage'),
    ('r2', 'R2 Object Storage', 'storage'),
    ('kv', 'Workers KV', 'storage'),
    ('durable-objects', 'Durable Objects', 'compute'),
    ('workers-ai', 'Workers AI', 'ai'),
    ('vectorize', 'Vectorize', 'ai'),
    ('ai-gateway', 'AI Gateway', 'ai'),
    ('cdn', 'CDN/Cache', 'network'),
    ('dns', 'DNS', 'network'),
    ('waf', 'WAF/Security', 'security'),
    ('stream', 'Stream', 'media'),
    ('images', 'Images', 'media'),
    ('analytics', 'Analytics', 'observability'),
    ('logs', 'Logs/Logpush', 'observability'),
    ('waiting-room', 'Waiting Room', 'network'),
    ('turnstile', 'Turnstile', 'security'),
    ('other', 'Other/General', 'other');

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_product_area ON feedback(product_area);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON feedback(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_analyzed ON feedback(analyzed);
