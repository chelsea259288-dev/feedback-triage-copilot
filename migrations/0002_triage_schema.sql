-- ============================================
-- Feedback Triage Copilot - New Schema
-- Optimized for Triage + AI Search + Workflows
-- ============================================

-- Clean up old tables (if starting fresh)
-- DROP TABLE IF EXISTS feedback;
-- DROP TABLE IF EXISTS product_areas;

-- 1. Raw feedback data table (stores structured metadata + R2 reference)
CREATE TABLE IF NOT EXISTS feedback_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL CHECK(source IN ('discord', 'github', 'support', 'twitter')),
    url TEXT,  -- Original URL (used for strong deduplication)
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    product_hint TEXT,  -- User-provided product hint
    created_at TEXT NOT NULL,  -- ISO-8601 timestamp
    
    -- R2 corpus reference
    r2_key TEXT,  -- R2 object path (e.g., feedback/workers/123.json)
    
    -- Deduplication fields
    content_hash TEXT,  -- Hash of title+body (for near-duplicate detection)
    duplicate_of INTEGER,  -- Points to primary feedback ID (NULL means not a duplicate)
    
    -- Metadata
    ingested_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (duplicate_of) REFERENCES feedback_raw(id)
);

-- 2. AI analysis results table (all structured fields)
CREATE TABLE IF NOT EXISTS feedback_ai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_id INTEGER NOT NULL UNIQUE,  -- 1:1 relationship with feedback_raw
    
    -- Sentiment analysis
    sentiment_label TEXT CHECK(sentiment_label IN ('positive', 'neutral', 'negative')),
    sentiment_score REAL CHECK(sentiment_score BETWEEN 0 AND 1),
    
    -- Classification and urgency
    urgency TEXT CHECK(urgency IN ('P0', 'P1', 'P2', 'P3')),
    category TEXT CHECK(category IN ('Bug', 'Docs', 'UX', 'Pricing', 'Feature', 'Performance', 'Other')),
    product_area TEXT,  -- Workers/D1/Workflows/R2/AI Search/...
    
    -- Theme and summary
    theme TEXT,  -- Concise theme label for aggregation
    summary TEXT,  -- AI-generated one-sentence summary
    next_action TEXT,  -- Suggested next action
    
    -- Model metadata
    model_meta TEXT,  -- JSON string (model name, version, confidence, etc.)
    
    -- Timestamp
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (raw_id) REFERENCES feedback_raw(id)
);

-- 3. Daily theme aggregation table (for trend analysis)
CREATE TABLE IF NOT EXISTS theme_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,  -- YYYY-MM-DD
    theme TEXT NOT NULL,
    product_area TEXT,
    
    -- Statistical metrics
    count INTEGER DEFAULT 0,
    p0_count INTEGER DEFAULT 0,  -- Number of P0 issues in this theme
    neg_ratio REAL DEFAULT 0.0,  -- Negative sentiment ratio
    
    -- Timestamp
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(date, theme, product_area)
);

-- ============================================
-- Index optimization (for query performance)
-- ============================================

-- feedback_raw indexes
CREATE INDEX IF NOT EXISTS idx_raw_source ON feedback_raw(source);
CREATE INDEX IF NOT EXISTS idx_raw_url ON feedback_raw(url);
CREATE INDEX IF NOT EXISTS idx_raw_created_at ON feedback_raw(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_duplicate ON feedback_raw(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_raw_content_hash ON feedback_raw(content_hash);
CREATE INDEX IF NOT EXISTS idx_raw_product_hint ON feedback_raw(product_hint);

-- feedback_ai indexes
CREATE INDEX IF NOT EXISTS idx_ai_raw_id ON feedback_ai(raw_id);
CREATE INDEX IF NOT EXISTS idx_ai_theme ON feedback_ai(theme);
CREATE INDEX IF NOT EXISTS idx_ai_urgency ON feedback_ai(urgency);
CREATE INDEX IF NOT EXISTS idx_ai_category ON feedback_ai(category);
CREATE INDEX IF NOT EXISTS idx_ai_product_area ON feedback_ai(product_area);
CREATE INDEX IF NOT EXISTS idx_ai_sentiment ON feedback_ai(sentiment_label);

-- theme_daily indexes
CREATE INDEX IF NOT EXISTS idx_theme_date ON theme_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_theme_theme ON theme_daily(theme);
CREATE INDEX IF NOT EXISTS idx_theme_product ON theme_daily(product_area);

-- ============================================
-- Cloudflare product reference data (for AI recognition)
-- ============================================
CREATE TABLE IF NOT EXISTS product_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL
);

INSERT OR IGNORE INTO product_areas (name, display_name, category) VALUES
    ('workers', 'Cloudflare Workers', 'compute'),
    ('pages', 'Cloudflare Pages', 'compute'),
    ('d1', 'D1 Database', 'storage'),
    ('r2', 'R2 Object Storage', 'storage'),
    ('kv', 'Workers KV', 'storage'),
    ('durable-objects', 'Durable Objects', 'compute'),
    ('workflows', 'Workflows', 'compute'),
    ('workers-ai', 'Workers AI', 'ai'),
    ('vectorize', 'Vectorize', 'ai'),
    ('ai-gateway', 'AI Gateway', 'ai'),
    ('ai-search', 'AI Search', 'ai'),
    ('cdn', 'CDN/Cache', 'network'),
    ('dns', 'DNS', 'network'),
    ('waf', 'WAF/Security', 'security'),
    ('stream', 'Stream', 'media'),
    ('images', 'Images', 'media'),
    ('analytics', 'Analytics', 'observability'),
    ('logs', 'Logs/Logpush', 'observability'),
    ('waiting-room', 'Waiting Room', 'network'),
    ('turnstile', 'Turnstile', 'security'),
    ('queues', 'Queues', 'messaging'),
    ('pubsub', 'Pub/Sub', 'messaging'),
    ('hyperdrive', 'Hyperdrive', 'database'),
    ('other', 'Other/General', 'other');
