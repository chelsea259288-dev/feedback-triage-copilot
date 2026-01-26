# Feedback Triage Copilot 

> An AI-powered feedback aggregation and intelligent triage dashboard built entirely on Cloudflare's Developer Platform

---

## Project Links

### Live Demo
Deployed Application: https://feedback-triage.chelsea259288.workers.dev

### Source Code
GitHub Repository: https://github.com/chelsea259288-dev/feedback-triage-copilot

---

## Product Insights: Friction Points & Suggestions 

### 1) Title: R2 Enablement Is a Hidden Account Gate for CLI Workflows

**Problem:**
`wrangler r2 bucket create <name>` fails with `Please enable R2 through the Cloudflare Dashboard [code: 10042]`. This is an account-level prerequisite surfaced too late and without a direct path to resolve. It breaks CLI-first expectations, forces a terminal→dashboard context switch mid-setup, and makes automation/CI provisioning non-starters on first run.

**Suggestion:**

* **MVP:** Upgrade the error to include a direct onboarding deep-link + clear next command.
* **Next:** Add `wrangler r2 status` (or `check-subscription`) as a preflight.
* **Longer-term:** Optional interactive flow: `wrangler r2 bucket create --enable-interactive` that opens onboarding and resumes once enabled.

---

### 2) Title: Workflows “Local Dev” Isn’t Local — Deployment Dependency Is Under-signaled

**Problem:**
In `wrangler dev`, Workflows behaves differently from D1/R2/KV: creating an instance can return an ID, but describing it fails (`workflow.not_found`). Root cause is that Workflows must be deployed before it can be exercised even during local iteration. This creates a confusing “dev loop” where users think they are testing locally but are blocked by undeployed remote state.

**Suggestion:**

* **MVP:** Make the constraint explicit in `wrangler dev` binding summary: “Workflows requires deploy.”
* **Next:** Improve the runtime error to include a ranked checklist (not deployed, name mismatch, wrong account/token).
* **Longer-term:** Provide a true local simulator or a “dev-mode remote sandbox” with clearer semantics + tooling parity.

---

### 3) Title: Missing Optional Binding Hard-Blocks Deploy (No Progressive Enhancement Path)

**Problem:**
Adding an R2 binding for an optional feature (AI Search corpus) causes `wrangler deploy` to fail if the bucket doesn’t exist (`[code: 10085]`). Even when the app has fallback logic and core features are functional, deploy becomes all-or-nothing. This punishes iterative prototyping and prevents shipping an MVP first and layering optional features later.

**Suggestion:**

* **MVP:** Improve deploy error text to offer explicit options: create bucket / use existing bucket / temporarily disable binding.
* **Next:** Add optional binding semantics in config (e.g., `required=false`) or a deploy flag like `--ignore-missing-bindings=r2`.
* **Longer-term:** First-class “progressive enhancement” in Wrangler: validate critical bindings, warn on optional ones, and surface feature availability at runtime.

---

### 4) Title: Structured Output on Workers AI Requires Too Much Prompt + Validation Plumbing

**Problem:**
To extract `urgency (P0–P3)`, `category`, and an actionable `theme`, I had to iterate heavily on prompts; early outputs were inconsistent (“High” urgency, vague categories, generic themes). When output is malformed JSON, developers must build their own parsing/validation/retry logic. This is friction-heavy for a common PM use case (classification/extraction) and slows down time-to-first-success.

**Suggestion:**

* **MVP:** Publish a “Structured Output Cookbook” with strict JSON patterns, examples, and retry/fallback guidance for classification/extraction tasks.
* **Next:** Add a supported `response_format` / schema enforcement option (JSON object + enums), plus better parse-failure diagnostics (partial output, error location).
* **Longer-term:** Provide a higher-level “extract” API for common fields (sentiment/priority/category) with opinionated defaults and evaluation tips.

---

### 5) Title: AI Search Success Depends on Corpus Prep, but Setup Guidance Is Query-Centric

**Problem:**
AI Search is compelling in demos (“find similar issues across channels”), but the hardest part is actually corpus preparation in R2: file formats, chunking, and metadata practices aren’t clearly guided. There are no built-in utilities for bulk syncing a dataset into R2 for indexing, so users discover best practices via trial-and-error, delaying the “aha moment” and degrading retrieval quality early.

**Suggestion:**

* **MVP:** Add a dedicated “Corpus Prep” section: recommended formats, token/file sizing, chunking patterns, and metadata conventions.
* **Next:** Provide a Wrangler helper command to sync/export structured data into R2 keys for indexing (e.g., `wrangler ai-search sync --bucket=...`).
* **Longer-term:** Offer an end-to-end “AI Search starter pipeline” template: D1 → export → R2 → index → query, with an index health/status surface developers can display in-app.

---

## Architecture Overview

### Cloudflare Products Used

This prototype demonstrates deep integration across 6 Cloudflare Developer Platform products:

#### 1. **Cloudflare Workers** (Edge Compute)
- **Why:** Hosts entire application (API + static frontend) at the edge for global low-latency access
- **Usage:** 
  - Serves static HTML dashboard
  - Handles all REST API endpoints (`/api/inbox`, `/api/themes`, `/api/search`, `/api/ask`)
  - Orchestrates Workflows for async processing
  - Integrates all other bindings (D1, R2, AI, AI Search)

#### 2. **D1 Database** (Serverless SQL)
- **Why:** Stores structured feedback data with complex queries for filtering, aggregation, and theme detection
- **Usage:**
  - **`raw_feedback` table:** Stores incoming feedback with source, URL, author metadata
  - **`ai_triage` table:** Stores AI analysis results (urgency, sentiment, category, theme, summary)
  - **`duplicates` table:** Links duplicate feedback items
  - **`theme_aggregates` table:** Materialized view for theme-based analytics
  - Complex SQL queries for:
    - Duplicate detection using content hashing
    - Theme aggregation with counts and sentiment ratios
    - Time-range filtering for digests

#### 3. **Workflows** (Durable Execution)
- **Why:** Ensures reliable, idempotent processing of feedback analysis pipeline
- **Usage:**
  - **Pipeline:** Ingest → Deduplicate → AI Analyze → Persist → Aggregate Themes → Write Corpus
  - **Idempotency:** Uses content hash as workflow ID to prevent duplicate processing
  - **Error Handling:** Retries transient failures, isolates step errors
  - **Observability:** Tracks workflow status for debugging (`wrangler workflows instances describe`)

#### 4. **Workers AI** (On-demand Inference)
- **Why:** Performs real-time AI analysis without managing infrastructure
- **Usage:**
  - **Model:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  - **Tasks:**
    - Sentiment classification (positive/neutral/negative + score)
    - Urgency prioritization (P0-P3)
    - Category detection (Bug/Feature/Docs/Performance)
    - Theme extraction (actionable short phrases)
    - Summary generation (1-2 sentences)
    - Next-action recommendation
  - **Optimization:** Batched prompts to reduce API calls

#### 5. **R2 Object Storage** (Unlimited Storage)
- **Why:** Stores full-text corpus for semantic search indexing
- **Usage:**
  - **Document Format:** Each analyzed feedback saved as `feedback-{id}.txt`
  - **Metadata:** Includes `raw_id`, `title`, `product_area` for result enrichment
  - **Integration:** Feeds AI Search for semantic retrieval

#### 6. **AI Search** (Semantic Search + RAG)
- **Why:** Enables natural language querying over feedback corpus with source attribution
- **Usage:**
  - **Instance Name:** `delicate-leaf-e8d2`
  - **API Endpoints:**
    - `/api/search?q=...` → Semantic similarity search
    - `/api/ask` (POST) → RAG-based question answering with sources
    - `/api/feedback/{id}/similar` → Find similar feedback items
  - **Fallback:** Keyword-based search when AI Search unavailable

---

### Data Flow Architecture

```
1. Feedback Ingestion
   User → Worker API (/api/ingest) → D1 (raw_feedback)
                                   ↓
                            Workflow.create()

2. Async Processing (Workflow)
   Step 1: Deduplicate     → Check content hash in D1
   Step 2: AI Analyze      → Workers AI (Llama 3.3)
   Step 3: Persist Results → D1 (ai_triage + duplicates)
   Step 4: Aggregate       → D1 (theme_aggregates)
   Step 5: Write Corpus    → R2 (feedback-{id}.txt)

3. Semantic Search
   User query → AI Search → R2 corpus → Ranked results → Worker API → UI

4. RAG (Ask)
   User question → AI Search.ask() → Retrieve sources → LLM synthesis → Answer + citations
```

---

### Workers Bindings Configuration

<img width="3394" height="1706" alt="image" src="https://github.com/user-attachments/assets/4dbc9fbe-4969-4c0b-a55a-359a85066844" />


**Configured Bindings:**
```toml
[env.production]
name = "feedback-triage"

[[d1_databases]]
binding = "DB"
database_name = "feedback_db"
database_id = "..."

[[workflows]]
binding = "TRIAGE_WORKFLOW"
name = "feedback-triage-workflow"
class_name = "FeedbackTriageWorkflow"

[ai]
binding = "AI"

[[r2_buckets]]
binding = "CORPUS"
bucket_name = "feedback-triage-corpus"

[ai_search]
binding = "AI_SEARCH"
AI_SEARCH_NAME = "delicate-leaf-e8d2"
```

---

## Feature → Product Mapping

* **Ingest + Dashboard UI** → **Workers** (routes + static assets)
* **Fast filtering / sorting / analytics (Inbox, Themes, Digest)** → **D1**
* **Durable async triage pipeline (retries + idempotency)** → **Workflows** (`TRIAGE_WORKFLOW`)
* **Structured extraction (urgency, sentiment, category, theme, summary, next_action)** → **Workers AI** (`AI`)
* **Raw corpus storage for long-form feedback** → **R2** (`CORPUS`)
* **Semantic Similar Issues + Natural-language search + Ask retrieval** → **AI Search** (instance via `AI_SEARCH_NAME`) + **R2 corpus**

---

**How to verify quickly:**

1. Open **Inbox** → click any item → see **Similar Issues** on Detail (AI Search + R2)
2. Go to **Search** → type a natural-language query → see ranked results
3. Trigger ingest → confirm item appears → workflow populates AI fields (D1 + Workflows + Workers AI)

---

## Vibe-Coding Context 

### Platform Used
**OpenCode** - AI-powered coding assistant with deep Cloudflare platform integration

### Key Prompts Used

1. **Initial Architecture Design:**
   ```
   Design a feedback triage system using Cloudflare Workers, D1, and AI. 
   Include async processing for AI analysis and semantic search capabilities.
   Focus on scalability and cost-efficiency.
   ```

2. **Workflows Implementation:**
   ```
   Implement a Workflows pipeline for feedback processing:
   1. Deduplicate using content hashing
   2. Analyze with Workers AI (sentiment, urgency, theme)
   3. Store results in D1
   4. Aggregate themes
   5. Write to R2 corpus for AI Search
   Ensure idempotency and error handling.
   ```

3. **AI Search Integration:**
   ```
   Integrate AI Search for:
   - Semantic similarity search over feedback
   - RAG-based question answering with source attribution
   - Similar feedback detection
   Add fallback to keyword search if AI Search unavailable.
   ```

4. **Frontend Dashboard:**
   ```
   Build a single-page dashboard with:
   - Stat cards (total, P0 count, today's feedback, unanalyzed)
   - Filterable inbox (source, product, category, urgency)
   - Theme aggregation view
   - Search tab with semantic search and Ask (RAG) modes
   Use vanilla JS, no frameworks. Clean, modern UI.
   ```

5. **Friction Point Documentation:**
   ```
   Document all developer friction encountered during development:
   - R2 onboarding requirements
   - Workflows local dev behavior
   - Missing binding deployment blockers
   - AI prompt engineering challenges
   Provide actionable suggestions for each.
   ```

**Built with ❤️ using Cloudflare Developer Platform**
