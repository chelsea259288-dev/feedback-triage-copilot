-- ============================================
-- Feedback Triage Copilot - New Schema
-- 专为 Triage + AI Search + Workflows 优化
-- ============================================

-- 清理旧表（如果从头开始）
-- DROP TABLE IF EXISTS feedback;
-- DROP TABLE IF EXISTS product_areas;

-- 1. 反馈原始数据表（存结构化元信息 + R2 引用）
CREATE TABLE IF NOT EXISTS feedback_raw (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL CHECK(source IN ('discord', 'github', 'support', 'twitter')),
    url TEXT,  -- 原始链接（用于强去重）
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    product_hint TEXT,  -- 用户提供的产品提示
    created_at TEXT NOT NULL,  -- ISO-8601 timestamp
    
    -- R2 语料库引用
    r2_key TEXT,  -- R2 对象路径（e.g., feedback/workers/123.json）
    
    -- 去重相关
    content_hash TEXT,  -- title+body 的 hash（用于近似去重）
    duplicate_of INTEGER,  -- 指向主反馈 ID（NULL 表示非重复）
    
    -- 元数据
    ingested_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (duplicate_of) REFERENCES feedback_raw(id)
);

-- 2. AI 分析结果表（所有结构化字段）
CREATE TABLE IF NOT EXISTS feedback_ai (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_id INTEGER NOT NULL UNIQUE,  -- 与 feedback_raw 1:1
    
    -- 情绪分析
    sentiment_label TEXT CHECK(sentiment_label IN ('positive', 'neutral', 'negative')),
    sentiment_score REAL CHECK(sentiment_score BETWEEN 0 AND 1),
    
    -- 分类与紧急度
    urgency TEXT CHECK(urgency IN ('P0', 'P1', 'P2', 'P3')),
    category TEXT CHECK(category IN ('Bug', 'Docs', 'UX', 'Pricing', 'Feature', 'Performance', 'Other')),
    product_area TEXT,  -- Workers/D1/Workflows/R2/AI Search/...
    
    -- 主题与总结
    theme TEXT,  -- 一句话主题标签（用于聚合）
    summary TEXT,  -- AI 生成的一句话总结
    next_action TEXT,  -- 建议的下一步动作
    
    -- 模型元数据
    model_meta TEXT,  -- JSON 字符串（model name, version, confidence, etc.）
    
    -- 时间戳
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (raw_id) REFERENCES feedback_raw(id)
);

-- 3. 主题每日聚合表（趋势分析）
CREATE TABLE IF NOT EXISTS theme_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,  -- YYYY-MM-DD
    theme TEXT NOT NULL,
    product_area TEXT,
    
    -- 统计指标
    count INTEGER DEFAULT 0,
    p0_count INTEGER DEFAULT 0,  -- 该主题中有多少 P0
    neg_ratio REAL DEFAULT 0.0,  -- 负面情绪占比
    
    -- 时间戳
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(date, theme, product_area)
);

-- ============================================
-- 索引优化（保证查询性能）
-- ============================================

-- feedback_raw 索引
CREATE INDEX IF NOT EXISTS idx_raw_source ON feedback_raw(source);
CREATE INDEX IF NOT EXISTS idx_raw_url ON feedback_raw(url);
CREATE INDEX IF NOT EXISTS idx_raw_created_at ON feedback_raw(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_duplicate ON feedback_raw(duplicate_of);
CREATE INDEX IF NOT EXISTS idx_raw_content_hash ON feedback_raw(content_hash);
CREATE INDEX IF NOT EXISTS idx_raw_product_hint ON feedback_raw(product_hint);

-- feedback_ai 索引
CREATE INDEX IF NOT EXISTS idx_ai_raw_id ON feedback_ai(raw_id);
CREATE INDEX IF NOT EXISTS idx_ai_theme ON feedback_ai(theme);
CREATE INDEX IF NOT EXISTS idx_ai_urgency ON feedback_ai(urgency);
CREATE INDEX IF NOT EXISTS idx_ai_category ON feedback_ai(category);
CREATE INDEX IF NOT EXISTS idx_ai_product_area ON feedback_ai(product_area);
CREATE INDEX IF NOT EXISTS idx_ai_sentiment ON feedback_ai(sentiment_label);

-- theme_daily 索引
CREATE INDEX IF NOT EXISTS idx_theme_date ON theme_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_theme_theme ON theme_daily(theme);
CREATE INDEX IF NOT EXISTS idx_theme_product ON theme_daily(product_area);

-- ============================================
-- Cloudflare 产品参考数据（保留以便 AI 识别）
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
