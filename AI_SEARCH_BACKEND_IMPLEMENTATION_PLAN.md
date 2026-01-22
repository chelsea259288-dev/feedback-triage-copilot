# AI Search Backend Implementation Plan

This doc describes how to enable and operate Cloudflare AI Search (AutoRAG) for Feedback Triage Copilot.

Scope: backend + infra wiring (Worker config, R2 corpus, AI Search instance, API behavior) + frontend integration plan (Dashboard UX wiring to the existing endpoints).

## Current State (Baseline)

- Worker endpoints already exist:
  - `GET /api/search` (semantic search; falls back to D1 LIKE)
  - `GET /api/feedback/:id/similar` (similar issues; falls back to Jaccard)
  - `POST /api/ask` (RAG; falls back to a static message)
- Workflow Step C writes a JSON corpus object to R2 when `env.CORPUS` exists:
  - key format: `feedback/<product_area>/<raw_id>.json`
  - and updates `feedback_raw.r2_key`
- R2 bucket: `feedback-triage-corpus`
- AI Search instance (Dashboard-created): `delicate-leaf-e8d2` (indexed 42 objects)

## Goal

Make the production Worker use AI Search instance `delicate-leaf-e8d2` for search/similar/ask, with clear verification and safe fallbacks.

## Step 1: Infrastructure Setup (Dashboard)

### 1.1 R2

- Ensure R2 is enabled on the account.
- Ensure the bucket exists:
  - bucket name: `feedback-triage-corpus`

### 1.2 AI Search (AutoRAG) instance

- Create (or reuse) an AI Search instance.
- If using R2 as the source:
  - bucket: `feedback-triage-corpus`
  - path filter include: `feedback/**` (no leading slash)
  - exclude: empty

Acceptance criteria:
- Dashboard shows `Indexed > 0` and `Errors = 0`.
- Playground query returns results.

## Step 2: Worker Configuration Wiring

### 2.1 Bindings

Ensure the Worker has:
- `R2 Buckets` binding:
  - `CORPUS -> feedback-triage-corpus`
- `Vars`:
  - `AI_SEARCH_NAME -> delicate-leaf-e8d2`

Implementation detail:
- Set `AI_SEARCH_NAME` in `wrangler.toml` so it persists across deployments.

Example `wrangler.toml` change:

```toml
[vars]
ENVIRONMENT = "development"
AI_SEARCH_NAME = "delicate-leaf-e8d2"
```

Deploy:

```bash
cd /Users/chelseaxiao/Documents/cloudflare/feedback-hub
npx wrangler deploy
```

Acceptance criteria:
- `wrangler deploy` output lists `AI_SEARCH_NAME: "delicate-leaf-e8d2"`.
- `wrangler deploy` output lists `CORPUS: feedback-triage-corpus`.

## Step 3: Corpus Completeness (Backfill Strategy)

Problem:
- Feedback items ingested before R2 was enabled will not have been written to R2 (and thus won’t be indexed).

Approach:

### 3.1 Backfill via Workflow replay (recommended)

- Identify rows where `duplicate_of IS NULL` and `r2_key IS NULL`.
- Enqueue the workflow for those rows.
- Workflow must be idempotent when rerun:
  - Reuse existing `feedback_ai` if already present.
  - Do not double-count `theme_daily` aggregation.
  - Still write the corpus object to R2.

Acceptance query:

```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN r2_key IS NULL THEN 1 ELSE 0 END) AS missing_r2
FROM feedback_raw
WHERE duplicate_of IS NULL;
```

Target:
- `missing_r2 = 0`

## Step 4: API Behavior Verification (No Frontend Needed)

### 4.1 Search

```bash
curl -s "https://<worker-domain>/api/search?q=wrangler%20deploy%20timeout&top_k=5"
```

Expected when AI Search is active:
- result scores are not all identical
- `snippet` may be present (depends on AI Search response)

### 4.2 Similar Issues

```bash
curl -s "https://<worker-domain>/api/feedback/1/similar?top_k=8"
```

Expected:
- results include semantic matches even if keywords differ

### 4.3 Ask (RAG)

```bash
curl -s -X POST "https://<worker-domain>/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question":"What are the top urgent issues?"}'
```

Expected:
- `answer` is generated
- `sources` array includes raw_ids + titles

## Step 5: Operational Hardening (Recommended for Demo)

### 5.1 Add a health endpoint

Add an endpoint like `GET /api/ai-search/health` that:
- returns the configured instance name
- runs a lightweight search query (`max_num_results: 1`)
- returns whether AI Search succeeded or fallback was used

Why:
- makes demo/debug straightforward
- reduces time spent guessing whether the system is in fallback mode

### 5.2 Add basic observability

- Log when AI Search is used vs fallback (counts)
- Log AI Search errors with a short message

## Step 6: Common Failure Modes + Fixes

1) Results always look like fallback
- Fix: ensure `AI_SEARCH_NAME` matches the instance name (`delicate-leaf-e8d2`).
- Fix: ensure Worker still has `CORPUS` binding.

2) AI Search has 0 indexed docs
- Fix: path filter should be `feedback/**`, not `/feedback/**`.
- Fix: ensure objects exist in bucket under that prefix.

3) Ask returns fallback message
- Fix: verify AI Search is enabled and indexed; `aiSearch()` depends on successful retrieval.

---

## Frontend Integration Plan

The frontend is a single static file (`public/index.html`) with 3 tabs today: Inbox, Themes, Search.

Goal: make the UI visibly demonstrate AI Search value by integrating:

- Semantic search results (already partially implemented)
- Similar issues (semantic clustering) from detail view
- Ask (RAG) question answering with citations

### Frontend Step 0: Inventory of existing UI

- Search tab already calls `GET /api/search?q=...`.
- Clicking an item calls `viewDetail(rawId)` but currently shows an alert.
- CSS exists for `.similar-list` / `.similar-item*` but it is not used.

Acceptance criteria:
- No new frameworks; keep as a single HTML file.
- Works on desktop and mobile.

### Frontend Step 1: Add a Feedback Detail Modal

Implement a modal overlay instead of routing to a new page. When a user clicks a feedback item (Inbox/Search), open a modal that shows:

- Raw content: title, source, created_at, url (if any), full body
- AI analysis: urgency/category/sentiment/theme/summary/next_action
- Similar issues panel (added in Step 3)

Implementation details:
- Add modal HTML markup near the end of `public/index.html`.
- Add minimal CSS for:
  - overlay
  - modal layout
  - scroll behavior (disable background scroll)
- Add JS helpers:
  - `openModal()`, `closeModal()`
  - ESC-to-close and click-outside-to-close

Acceptance criteria:
- Clicking any item opens modal.
- Modal is keyboard accessible and mobile-friendly.

### Frontend Step 2: Wire `viewDetail(rawId)` to backend

Replace the placeholder `alert()` with:

- `GET /api/feedback/:id` to fetch detail
- Render a loading state immediately
- Render the returned JSON into the modal

Implementation details:
- Add a small `fetchJson(url, options)` helper for consistent error handling.
- Use `escapeHtml()` for all user-controlled strings.
- If `ai` is missing (still analyzing), render a clear state:
  - "Analyzing... refresh in a few seconds"
  - optional "Refresh" button

Acceptance criteria:
- Modal renders both raw and AI fields correctly.
- Errors are displayed in-modal (no silent failure).

### Frontend Step 3: Similar Issues Panel (AI Search showcase)

Inside the detail modal, fetch and render:

- `GET /api/feedback/:id/similar?top_k=8`

Render each similar item with:
- Title
- Score (2 decimals)
- Snippet (if provided)
- Metadata (source, date)

Interaction:
- Clicking a similar item calls `viewDetail(similar.raw_id)` (modal updates in place).

Acceptance criteria:
- Similar list shows non-empty results for known clusterable issues.
- Scores vary when AI Search is active.

### Frontend Step 4: Upgrade Search Tab to support Ask (RAG)

The Search tab currently behaves like a standard search. Add an Ask mode:

UI:
- Add a two-state toggle:
  - "Search" (default): calls `GET /api/search`
  - "Ask" : calls `POST /api/ask`

Ask mode behavior:
- Use the same input as a question.
- Render an answer card containing:
  - generated answer text
  - sources list (title + optional URL)
- Clicking a source opens the detail modal via `viewDetail(source.raw_id)`.

Acceptance criteria:
- Asking a question returns an answer and sources.
- Sources are clickable and open the detail modal.

### Frontend Step 5: Make it obvious when AI Search is active vs fallback

Because the backend has fallbacks, add a lightweight visual hint:

- If all returned search results have the same score (e.g. `0.5`), display a small note:
  - "Keyword fallback" vs "Semantic (AI Search)"

Optional: if you add a backend health endpoint later (`/api/ai-search/health`), the UI can show a small status pill in the header.

Acceptance criteria:
- Demo viewers can tell when semantic search is active.

### Frontend Step 6: Testing Checklist

1) Inbox
- Click item -> detail modal loads
- Similar list loads
- Clicking similar opens new detail

2) Search (semantic)
- Query -> results show; click result -> detail modal loads

3) Ask
- Ask question -> answer rendered + sources
- Click source -> detail modal loads

4) Mobile
- Modal scroll works; close button visible; background doesn’t scroll
