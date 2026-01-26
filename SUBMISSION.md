# Feedback Triage Copilot 

> An AI-powered feedback aggregation and intelligent triage dashboard built entirely on Cloudflare's Developer Platform

---

## Project Links

### Live Demo
Deployed Application: https://feedback-triage.chelsea259288.workers.dev

### Source Code
GitHub Repository: https://github.com/chelsea259288-dev/feedback-triage-copilot

---

##  Product Insights: Friction Points & Suggestions

Based on hands-on experience building this prototype, here are the key friction points encountered and actionable suggestions for improving the Cloudflare Developer Platform:

### 1. R2 Bucket Creation Requires Dashboard Onboarding First

**Friction Point:**
- Running `wrangler r2 bucket create <name>` fails with: `Please enable R2 through the Cloudflare Dashboard [code: 10042]`
- This is a "hidden prerequisite" not mentioned in CLI output
- Forces context-switching from terminal to browser mid-workflow
- Blocks CI/CD and rapid prototyping scenarios

**Why It Matters:**
- New developers expect CLI-first workflows to be self-contained
- No direct link to R2 onboarding in error message
- Interrupts the development flow at a critical moment

**Suggestions:**
1. **Improve Error Messages:**
   ```
   R2 is not enabled for your account.
   
   Enable R2 now:
   → https://dash.cloudflare.com/<account-id>/r2/overview/onboarding
   
   After enabling, retry: wrangler r2 bucket create <name>
   ```

2. **Add Pre-flight Check Command:**
   ```bash
   wrangler r2 check-subscription
   # Returns: ✓ R2 enabled | ✗ R2 not enabled (enable at: <link>)
   ```

3. **Auto-open Browser (Optional):**
   ```bash
   wrangler r2 bucket create <name> --enable-interactive
   # Detects missing subscription → asks to open browser → waits for confirmation
   ```

---

### 2. Workflows Local Development Uses Remote Instances (Counter-Intuitive)

**Friction Point:**
- Unlike D1/R2/KV, Workflows in `wrangler dev` connect to **remote deployed instances**, not local simulation
- Running `env.WORKFLOW.create()` in local dev returns an instance ID, but `wrangler workflows instances describe <id>` fails with `workflow.not_found`
- Root cause: Workflow must be deployed (`wrangler deploy`) before it can be used in local development

**Why It Matters:**
- **Highly counter-intuitive:** All other bindings (D1, R2) work locally without deployment
- `wrangler dev` output shows `connected to remote resource` but this critical caveat is easy to miss
- Creates a confusing "local dev → trigger workflow → instance not found" error loop
- Adds mandatory deployment step before local testing

**Suggestions:**
1. **Enhance `wrangler dev` Output:**
   ```
   ⚡ Bindings:
   - D1 (feedback_db): using local database
   - R2 (CORPUS): using local bucket
   - Workflows (TRIAGE_WORKFLOW): REQUIRES DEPLOYMENT
     → Run 'wrangler deploy' first to enable Workflows in local dev
   ```

2. **Improve Error Messages:**
   ```
   Workflow 'triage-workflow' not found [code: 10200]
   
   Possible causes:
   1. Workflow never deployed → Run: wrangler deploy
   2. Workflow name mismatch in wrangler.toml
   3. Using wrong account/API token
   ```

3. **Documentation Update:**
   - Add prominent callout in Workflows Quick Start:
     > **Unlike D1/R2, Workflows require deployment before local testing**
   - Provide "minimal Workflow + local dev" example with deployment step highlighted

---

### 3. Missing R2 Binding Blocks Entire Deployment (Even for Optional Features)

**Friction Point:**
- Added R2 bucket binding in `wrangler.toml` for optional AI Search feature
- `wrangler deploy` fails with: `R2 bucket 'feedback-triage-corpus' not found [code: 10085]`
- **Deployment is completely blocked** even though:
  - R2 is optional (app has fallback logic)
  - Code has proper error handling for missing binding
  - All critical bindings (D1, AI, Workflows) are correctly configured

**Why It Matters:**
- **Prevents iterative development:** Can't deploy a working MVP first, then add optional features later
- **All-or-nothing deployment:** Missing any binding blocks the entire deployment
- **Breaks progressive enhancement:** Can't ship "core features work, premium features coming soon"
- **Wastes time:** Forced to comment out binding, deploy, then manually add it back

**Suggestions:**
1. **Add Optional Binding Support in wrangler.toml:**
   ```toml
   [[r2_buckets]]
   binding = "CORPUS"
   bucket_name = "feedback-triage-corpus"
   required = false  # ← New field: allow deployment even if bucket doesn't exist
   ```

2. **Improve Deployment Error Messages:**
   ```
   R2 bucket 'feedback-triage-corpus' not found.
   
   Options:
   1. Create bucket: wrangler r2 bucket create feedback-triage-corpus
   2. Deploy without R2: Comment out [[r2_buckets]] in wrangler.toml
   3. Use existing bucket: Update bucket_name in wrangler.toml
   ```

3. **Add `--ignore-missing-bindings` Flag:**
   ```bash
   wrangler deploy --ignore-missing-bindings=r2,kv
   # Still validates critical bindings (D1, AI), allows optional ones to be missing
   ```

**Workaround Used:**
- Commented out R2 binding before deployment
- Deployed core features with keyword-based fallback search
- Can add R2 + AI Search later without breaking existing functionality

---

### 4. Workers AI Structured Output Requires Heavy Prompt Engineering

**Friction Point:**
- Initial AI prompts produced inconsistent results:
  - Urgency returned as "High" instead of "P0-P3" format
  - Category was vague ("General") instead of specific ("Bug", "Feature")
  - Theme was too generic ("User feedback") instead of actionable ("Wrangler deploy timeout")
- After extensive prompt refinement with explicit examples and format constraints, quality improved ~80%

**Why It Matters:**
- **Prompt engineering is critical but undocumented:** Workers AI docs lack guidance on structuring prompts for structured output
- **No built-in JSON schema validation:** Unlike OpenAI's function calling, Workers AI requires manual JSON parsing and validation
- **Trial and error is expensive:** Each test costs time + AI tokens
- **Hard to debug failures:** When AI returns malformed JSON, unclear if it's model or prompt issue

**What Worked:**
```typescript
// Before: Generic prompt
"Analyze this feedback and extract key information"

// After: Specific format + examples
const prompt = `Analyze feedback and return JSON with exact fields:
{
  "urgency": "P0|P1|P2|P3",  // P0=critical outage, P1=major bug, P2=minor, P3=enhancement
  "category": "Bug|Feature|Docs|Performance",
  "theme": "short actionable phrase (e.g. 'Wrangler deploy timeout errors')"
}

Examples:
- "Deploy keeps timing out" → urgency: P1, category: Bug, theme: "Deploy timeout errors"
- "Add dark mode please" → urgency: P3, category: Feature, theme: "UI dark mode requests"

Feedback: ${text}`;
```

**Suggestions:**
1. **Add Workers AI Cookbook for Structured Output:**
   - Provide prompt templates for common use cases (classification, extraction, summarization)
   - Show how to enforce JSON schema in prompts
   - Include retry strategies for malformed outputs

2. **Add JSON Schema Validation Helper (similar to OpenAI's JSON mode):**
   ```typescript
   const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
     messages: [...],
     response_format: {  // ← New parameter
       type: "json_object",
       schema: { 
         urgency: { type: "string", enum: ["P0", "P1", "P2", "P3"] },
         category: { type: "string", enum: ["Bug", "Feature", "Docs", "Performance"] }
       }
     }
   });
   ```

3. **Better Error Messages from AI Runtime:**
   - When JSON parsing fails, show partial output + where parsing failed
   - Suggest prompt improvements based on common failure patterns

**Workaround Used:**
- Implemented retry logic with exponential backoff (3 attempts)
- Added fallback to rule-based analysis if AI fails
- Used defensive JSON parsing with Zod schema validation

---

### 5. AI Search Setup Requires Manual R2 Corpus Population (Hidden Complexity)

**Friction Point:**
- AI Search documentation focuses on querying, not on initial corpus setup
- Unclear file format requirements for R2 documents
- No built-in utilities for bulk-uploading structured data to R2 for indexing
- Trial and error to discover optimal document structure for semantic search

**Suggestions:**
1. **Provide R2 Corpus Setup Examples:**
   ```typescript
   // Example: Bulk upload structured data for AI Search
   const documents = await db.query("SELECT id, title, body FROM feedback");
   for (const doc of documents) {
     await env.CORPUS.put(`feedback-${doc.id}.txt`, doc.body, {
       customMetadata: { title: doc.title, id: doc.id }
     });
   }
   ```

2. **Add Wrangler Command for AI Search Setup:**
   ```bash
   wrangler ai-search sync --bucket=CORPUS --ai-search=delicate-leaf-e8d2 --format=json
   # Auto-syncs R2 bucket to AI Search instance
   ```

3. **Document Best Practices for Document Structure:**
   - Optimal file size (tokens) for semantic search
   - Metadata usage for filtering results
   - Chunking strategies for long documents

---

## 🏗️ Architecture Overview

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

## 🤖 Vibe-Coding Context (Optional)

### Platform Used
**OpenCode (Anomaly AI)** - AI-powered coding assistant with deep Cloudflare platform integration

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
