-- ============================================
-- FeedbackHub Database Schema
-- ============================================

-- 反馈主表
CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('discord', 'github', 'twitter', 'support')),
    author TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- AI 分析结果
    sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative')),
    sentiment_score REAL CHECK(sentiment_score BETWEEN 0 AND 1),
    category TEXT CHECK(category IN ('bug', 'feature', 'performance', 'documentation', 'other')),
    urgency_score INTEGER CHECK(urgency_score BETWEEN 1 AND 10),
    
    -- 产品和内容分析
    product_area TEXT,
    summary TEXT,
    keywords TEXT,  -- 逗号分隔的关键词列表
    
    -- 元数据
    analyzed BOOLEAN DEFAULT 0,
    analyzed_at TIMESTAMP
);

-- Cloudflare 产品线参考表
CREATE TABLE IF NOT EXISTS product_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL
);

-- 预填充产品数据
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

-- 性能优化索引
CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback(sentiment);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_product_area ON feedback(product_area);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON feedback(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_analyzed ON feedback(analyzed);
