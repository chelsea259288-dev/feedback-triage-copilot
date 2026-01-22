# FeedbackHub - Cloudflare 产品反馈智能分析平台

基于 Cloudflare Developer Platform 构建的智能反馈聚合和分析工具。

## 🏗️ 架构

### Cloudflare 产品使用

- **Cloudflare Workers**: 托管前端和 API
- **D1 Database**: 存储反馈数据（SQLite）
- **Workers AI**: Llama 3 模型进行情感分析、分类、摘要生成
- **KV (可选)**: 缓存分析结果

### 技术栈

- TypeScript
- Vanilla JavaScript (前端)
- SQL (D1 Database)

## 🚀 快速开始

### 1. 安装依赖

```bash
cd feedback-hub
npm install
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create feedback_db
```

复制输出中的 `database_id`，更新 `wrangler.toml` 中的 `database_id`。

### 3. (可选) 创建 KV 命名空间

```bash
npx wrangler kv:namespace create CACHE
```

复制输出中的 `id`，更新 `wrangler.toml` 中的 KV `id`。

### 4. 初始化数据库 Schema

```bash
npx wrangler d1 execute feedback_db --local --file=./migrations/0001_initial_schema.sql
```

### 5. 本地开发

```bash
npx wrangler dev
```

访问 `http://localhost:8787`

### 6. 生成测试数据

访问 `http://localhost:8787/api/seed` 生成 150 条 Mock 数据。

### 7. 部署到生产

```bash
# 先初始化远程数据库
npx wrangler d1 execute feedback_db --remote --file=./migrations/0001_initial_schema.sql

# 部署 Worker
npx wrangler deploy

# 生成生产数据
curl https://your-worker.workers.dev/api/seed
```

## 📡 API 端点

### GET /
返回 Dashboard HTML 页面

### GET /api/feedback
获取反馈列表

**查询参数**:
- `source`: 过滤来源 (discord, github, twitter, support)
- `sentiment`: 过滤情感 (positive, neutral, negative)
- `category`: 过滤分类 (bug, feature, performance, documentation, other)
- `product_area`: 过滤产品线 (workers, d1, pages, etc.)
- `limit`: 限制数量 (默认 50)

### POST /api/feedback
创建新反馈并触发 AI 分析

**请求体**:
```json
{
  "content": "反馈内容",
  "source": "discord",
  "author": "username"
}
```

### GET /api/analytics
获取汇总分析数据

### POST /api/analyze-batch
批量分析未分析的反馈（最多 20 条）

### GET /api/seed
生成 Mock 数据（仅开发用）

## 🎨 核心功能

### AI 自动分析
- ✅ 情感分析 (positive/neutral/negative + 分数)
- ✅ 分类识别 (bug/feature/performance/documentation)
- ✅ 产品线识别 (19 种 Cloudflare 产品)
- ✅ 紧急程度评分 (1-10)
- ✅ 智能摘要生成
- ✅ 关键词提取 (5-10 个)

### Dashboard 可视化
- 📊 统计概览卡片
- 📦 产品线分布图
- 🔥 热门关键词云
- 💬 反馈列表（支持过滤）

## 📊 数据库 Schema

### feedback 表
主要字段包括：content, source, sentiment, category, urgency_score, product_area, summary, keywords 等。

### product_areas 表
预填充 19 种 Cloudflare 产品参考数据。

## 🔧 常用命令

```bash
# 本地开发
npm run dev

# 部署
npm run deploy

# 创建数据库
npm run db:create

# 初始化 schema
npm run db:migrate

# 本地 schema 初始化
npm run db:migrate:local

# 创建 KV
npm run kv:create
```

## 📝 项目结构

```
feedback-hub/
├── src/
│   ├── index.ts              # Worker 主入口
│   ├── types.ts              # TypeScript 类型定义
│   ├── router.ts             # API 路由处理
│   ├── mock-data.ts          # Mock 数据生成器
│   └── services/
│       ├── ai-analyzer.ts    # Workers AI 分析服务
│       ├── analytics.ts      # 数据统计服务
│       └── db-queries.ts     # D1 查询封装
├── public/
│   └── index.html            # Dashboard 前端
├── migrations/
│   └── 0001_initial_schema.sql
├── wrangler.toml
├── package.json
└── README.md
```

## 📄 License

MIT
