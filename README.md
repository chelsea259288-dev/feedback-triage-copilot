# Feedback Triage Copilot

> AI-powered feedback aggregation and intelligent triage dashboard built on Cloudflare Developer Platform

[![Deployed on Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-F38020?logo=cloudflare&logoColor=white)](https://feedback-triage.chelsea259288.workers.dev)

## 🌟 Overview

Feedback Triage Copilot is a production-ready feedback management system that demonstrates deep integration across Cloudflare's Developer Platform. It automatically ingests, analyzes, and organizes user feedback using AI, providing product teams with actionable insights through semantic search and intelligent categorization.

**Live Demo:** https://feedback-triage.chelsea259288.workers.dev

## 🏗️ Architecture

### Cloudflare Products Used

- **Cloudflare Workers**: Edge compute for API and frontend hosting
- **D1 Database**: Serverless SQL database for structured feedback storage
- **Workflows**: Durable execution for reliable async processing pipeline
- **Workers AI**: On-demand inference with Llama 3.3 70B for analysis
- **R2 Object Storage**: Unlimited storage for full-text corpus
- **AI Search (AutoRAG)**: Semantic search and RAG-based question answering

### Technology Stack

- Opencode
- Claude Sonnet 4.5 --Build
- GPT-5.2 --Plan

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers paid plan
- Wrangler CLI installed (`npm install -g wrangler`)

### 1. Clone and Install

```bash
git clone https://github.com/chelsea259288-dev/feedback-triage-copilot.git
cd feedback-triage-copilot
npm install
```

### 2. Create D1 Database

```bash
npx wrangler d1 create feedback_db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "feedback_db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 3. Initialize Database Schema

```bash
# Local database
npx wrangler d1 execute feedback_db --local --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute feedback_db --local --file=./migrations/0002_triage_schema.sql

# Remote database (for production)
npx wrangler d1 execute feedback_db --remote --file=./migrations/0001_initial_schema.sql
npx wrangler d1 execute feedback_db --remote --file=./migrations/0002_triage_schema.sql
```

### 4. (Optional) Create R2 Bucket for AI Search

```bash
# Enable R2 in dashboard first: https://dash.cloudflare.com/r2
npx wrangler r2 bucket create feedback-triage-corpus
```

### 5. (Optional) Create AI Search Instance

Follow the [R2_AI_SEARCH_SETUP.md](./R2_AI_SEARCH_SETUP.md) guide to set up AI Search for semantic search capabilities.

### 6. Local Development

```bash
npm run dev
```

Visit `http://localhost:8787`

### 7. Generate Test Data

Visit `http://localhost:8787/api/seed` to generate 150 mock feedback entries.

### 8. Deploy to Production

```bash
npm run deploy
```

After deployment, seed production data:

```bash
curl https://feedback-triage.YOUR_SUBDOMAIN.workers.dev/api/seed
```

## 📡 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard HTML page |
| `GET` | `/api/inbox` | Get filtered feedback list |
| `GET` | `/api/feedback/:id` | Get feedback details with AI analysis |
| `POST` | `/api/ingest` | Ingest new feedback and trigger workflow |
| `GET` | `/api/themes` | Get aggregated themes |
| `GET` | `/api/digest` | Get summary digest by time range |

### Search & AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search?q=...` | Semantic search over feedback |
| `POST` | `/api/ask` | RAG-based Q&A with source attribution |
| `GET` | `/api/feedback/:id/similar` | Find similar feedback items |

### Utility Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/seed` | Generate mock data (dev only) |
| `GET` | `/api/corpus/sync` | Sync D1 to R2 corpus for AI Search |

## 🎨 Core Features

### AI-Powered Analysis

Automatically analyzes each feedback entry for:

- ✅ **Sentiment:** Positive/Neutral/Negative with confidence score
- ✅ **Urgency:** P0 (critical) to P3 (enhancement)
- ✅ **Category:** Bug, Feature Request, Docs, Performance
- ✅ **Product Area:** Auto-detects 19 Cloudflare products
- ✅ **Theme:** Actionable short phrase (e.g., "Wrangler deploy timeout errors")
- ✅ **Summary:** 1-2 sentence summary
- ✅ **Next Action:** Recommended triage action

### Dashboard Features

- 📊 **Stat Cards:** Total feedback, P0 count, today's submissions, unanalyzed count
- 🔍 **Advanced Filters:** Source, product area, category, urgency
- 📦 **Theme Aggregation:** Automatic grouping by common themes
- 💬 **Inbox View:** Sortable, filterable feedback list
- 🔎 **Semantic Search:** Natural language querying
- 🤖 **Ask (RAG):** Question answering with source citations

### Workflow Pipeline

```
Ingest → Deduplicate → AI Analyze → Persist → Aggregate → Write Corpus
```

Each step is:
- **Idempotent:** Safe to retry
- **Isolated:** Errors don't break the entire pipeline
- **Observable:** Trackable with Workflows API

## 📊 Database Schema

### `raw_feedback`
Stores original feedback submissions with metadata (source, URL, author, timestamps).

### `ai_triage`
Stores AI analysis results (sentiment, urgency, category, theme, summary, next action).

### `duplicates`
Links duplicate feedback entries based on content similarity.

### `theme_aggregates`
Materialized view for theme-based analytics (count, P0 count, sentiment ratio, last seen).

## 🔧 NPM Scripts

```bash
# Development
npm run dev                 # Start local dev server

# Deployment
npm run deploy              # Deploy to production

# Database
npm run db:migrate:local    # Apply migrations locally
npm run db:migrate:remote   # Apply migrations to production
npm run db:query:local      # Interactive local SQL shell
npm run db:query:remote     # Interactive remote SQL shell

# TypeScript
npm run build               # Compile TypeScript
npm run check               # Type check
```

## 📁 Project Structure

```
feedback-triage-copilot/
├── src/
│   ├── index.ts                # Worker entry point
│   ├── router.ts               # API route handlers
│   ├── workflow.ts             # Workflows pipeline definition
│   ├── types.ts                # TypeScript type definitions
│   ├── mock-data.ts            # Mock data generator
│   └── services/
│       ├── ai-analyzer.ts      # Workers AI integration
│       ├── ai-search.ts        # AI Search integration
│       ├── analytics.ts        # Aggregation and stats
│       └── db-queries.ts       # D1 query helpers
├── public/
│   └── index.html              # Dashboard frontend
├── migrations/
│   ├── 0001_initial_schema.sql # Base schema
│   └── 0002_triage_schema.sql  # Triage tables
├── docs/
│   └── bindings-screenshot.png # Architecture diagram
├── wrangler.toml               # Cloudflare configuration
├── SUBMISSION.md               # Challenge submission doc
├── FRICTION_LOG.md             # Developer friction points
└── README.md                   # This file
```

## 🐛 Troubleshooting

### Workflows Not Working in Local Dev

**Issue:** `env.TRIAGE_WORKFLOW.create()` works but instances are not found.

**Solution:** Unlike D1/R2, Workflows require deployment before local testing:
```bash
npm run deploy
# Then run local dev
npm run dev
```

### R2 Bucket Creation Fails

**Issue:** `wrangler r2 bucket create` fails with "Please enable R2 through dashboard"

**Solution:** 
1. Visit https://dash.cloudflare.com/r2
2. Complete R2 onboarding (may require payment method)
3. Retry bucket creation

### AI Search Not Returning Results

**Issue:** Search returns fallback keyword results instead of semantic results.

**Solution:** 
1. Ensure R2 corpus is populated: `curl https://YOUR_WORKER.workers.dev/api/corpus/sync`
2. Verify AI Search binding in `wrangler.toml`
3. Check AI Search instance name matches deployed instance

## 📝 Documentation

- [Submission Document](./SUBMISSION.md) - Full challenge submission with architecture and friction points
- [Friction Log](./FRICTION_LOG.md) - Detailed developer experience feedback (English version in SUBMISSION.md)
- [AI Search Setup Guide](./R2_AI_SEARCH_SETUP.md) - Step-by-step AI Search configuration

## 🤝 Contributing

This is a challenge submission project, but feedback and suggestions are welcome! Please open an issue to discuss potential improvements.

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

---

**Built with ❤️ on Cloudflare Developer Platform**

[Live Demo](https://feedback-triage.chelsea259288.workers.dev) • [GitHub](https://github.com/chelsea259288-dev/feedback-triage-copilot) • [Submission Doc](./SUBMISSION.md)
