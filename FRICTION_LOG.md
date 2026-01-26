# Friction Log - Feedback Triage Copilot

This document maintains a log of friction points encountered while building the Feedback Triage Copilot prototype using Cloudflare Developer Platform. It considers the onboarding and setup experience, documentation, and UI/UX.

---

## 1. R2 Bucket Creation Requires Dashboard Onboarding First

### Title
R2 Bucket Creation Requires Dashboard Onboarding First

### Problem
Running `wrangler r2 bucket create <name>` fails with error code 10042: "Please enable R2 through the Cloudflare Dashboard." This is a hidden prerequisite not mentioned in CLI output, forcing developers to switch from terminal to browser mid-workflow. New developers expect CLI-first workflows to be self-contained, but the lack of a direct link to R2 onboarding in the error message interrupts development flow at a critical moment and blocks rapid prototyping. In CI/CD or quick prototyping scenarios, this mandatory dashboard step breaks the workflow.

### Suggestion
**1. Improve error messages with actionable links:**
```
R2 is not enabled for your account.

Enable R2 now:
→ https://dash.cloudflare.com/<account-id>/r2/overview/onboarding

After enabling, retry: wrangler r2 bucket create <name>
```

**2. Add a pre-flight check command:**
```bash
wrangler r2 check-subscription
# Returns: ✓ R2 enabled | ✗ R2 not enabled (enable at: <link>)
```

**3. Consider auto-open browser option:**
```bash
wrangler r2 bucket create <name> --enable-interactive
# Detects missing subscription → opens browser → waits for confirmation
```

---

## 2. Workflows Local Development Uses Remote Instances

### Title
Workflows Local Development Uses Remote Instances (Unlike Other Bindings)

### Problem
Unlike D1, R2, and KV, Workflows in `wrangler dev` connect to remote deployed instances, not local simulation. Running `env.TRIAGE_WORKFLOW.create()` in local dev returns an instance ID, but `wrangler workflows instances describe <id>` fails with "workflow.not_found" because the Workflow must be deployed first. This is highly counter-intuitive since all other bindings work locally without deployment. The `wrangler dev` output shows "connected to remote resource" but this critical caveat is easy to miss, creating a confusing error loop and adding a mandatory deployment step before local testing.

### Suggestion
**1. Enhance `wrangler dev` output:**
```
⚡ Bindings:
- D1 (feedback_db): using local database
- R2 (CORPUS): using local bucket
- Workflows (TRIAGE_WORKFLOW): ⚠️  REQUIRES DEPLOYMENT
  → Run 'wrangler deploy' first to enable Workflows in local dev
```

**2. Improve error messages:**
```
Workflow 'triage-workflow' not found [code: 10200]

Possible causes:
1. Workflow never deployed → Run: wrangler deploy
2. Workflow name mismatch in wrangler.toml
3. Using wrong account/API token
```

**3. Update documentation with prominent callout:**
> **Warning:** Unlike D1/R2, Workflows require deployment before local testing

---

## 3. Missing R2 Binding Blocks Entire Deployment

### Title
Missing R2 Binding Blocks Entire Deployment (Even for Optional Features)

### Problem
When an R2 bucket binding is added to `wrangler.toml` for an optional feature, `wrangler deploy` fails completely with error code 10085: "R2 bucket not found," even though R2 is optional (app has fallback logic), the code has proper error handling for missing binding, and all critical bindings (D1, AI, Workflows) are correctly configured. This prevents iterative development by forcing an all-or-nothing deployment model. Developers cannot deploy a working MVP first, then add optional features later. This breaks progressive enhancement patterns and wastes time requiring developers to comment out bindings before deployment.

### Suggestion
**1. Add optional binding support:**
```toml
[[r2_buckets]]
binding = "CORPUS"
bucket_name = "feedback-triage-corpus"
required = false  # ← Allow deployment even if bucket doesn't exist
```

**2. Improve deployment error messages:**
```
R2 bucket 'feedback-triage-corpus' not found.

Options:
1. Create bucket: wrangler r2 bucket create feedback-triage-corpus
2. Deploy without R2: Comment out [[r2_buckets]] in wrangler.toml
3. Use existing bucket: Update bucket_name in wrangler.toml
```

**3. Add `--ignore-missing-bindings` flag:**
```bash
wrangler deploy --ignore-missing-bindings=r2,kv
# Validates critical bindings, allows optional ones to be missing
```

---

## 4. Workers AI Structured Output Requires Heavy Prompt Engineering

### Title
Workers AI Structured Output Requires Heavy Prompt Engineering

### Problem
Initial AI prompts produced inconsistent results: urgency returned as "High" instead of "P0-P3" format, category was vague ("General") instead of specific ("Bug", "Feature"), and theme was too generic ("User feedback") instead of actionable ("Wrangler deploy timeout"). After extensive prompt refinement with explicit examples and format constraints, quality improved significantly. However, Workers AI documentation lacks guidance on structuring prompts for structured output. Unlike OpenAI's function calling, Workers AI requires manual JSON parsing and validation. Trial and error is expensive in both time and AI tokens, and debugging failures is difficult.

### Suggestion
**1. Add Workers AI Cookbook for structured output:**
- Provide prompt templates for common use cases (classification, extraction, summarization)
- Show how to enforce JSON schema in prompts
- Include retry strategies for malformed outputs

**2. Add JSON Schema validation helper:**
```typescript
const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
  messages: [...],
  response_format: {  // ← New parameter
    type: "json_object",
    schema: { 
      urgency: { type: "string", enum: ["P0", "P1", "P2", "P3"] }
    }
  }
});
```

**3. Better error messages from AI runtime:**
- Show partial output when JSON parsing fails
- Suggest prompt improvements based on common failure patterns

**What worked:**
```typescript
// Before: Generic prompt
"Analyze this feedback and extract key information"

// After: Specific format + examples
const prompt = `Analyze feedback and return JSON with exact fields:
{
  "urgency": "P0|P1|P2|P3",  // P0=critical, P1=major, P2=minor, P3=low
  "category": "Bug|Feature|Docs|Performance",
  "theme": "short actionable phrase"
}

Examples:
- "Deploy keeps timing out" → urgency: P1, category: Bug
- "Add dark mode please" → urgency: P3, category: Feature

Feedback: ${text}`;
```

---

## 5. AI Search Setup Requires Manual R2 Corpus Population

### Title
AI Search Setup Requires Manual R2 Corpus Population

### Problem
AI Search documentation focuses on querying but lacks guidance on initial corpus setup. File format requirements for R2 documents are unclear, there are no built-in utilities for bulk-uploading structured data, and developers must discover optimal document structure through trial and error. This slows down development significantly as developers need to experiment with different formats to understand what works best for semantic search indexing. There's no clear guidance on optimal file sizes, metadata usage, or chunking strategies for long documents.

### Suggestion
**1. Provide R2 corpus setup examples:**
```typescript
// Bulk upload structured data for AI Search
const documents = await db.query("SELECT id, title, body FROM feedback");
for (const doc of documents) {
  await env.CORPUS.put(`feedback-${doc.id}.txt`, doc.body, {
    customMetadata: { title: doc.title, id: doc.id }
  });
}
```

**2. Add wrangler command for AI Search setup:**
```bash
wrangler ai-search sync --bucket=CORPUS --ai-search=instance-name
# Auto-syncs R2 bucket to AI Search instance
```

**3. Document best practices:**
- Optimal file size for semantic search
- Metadata usage for filtering
- Chunking strategies for long documents

---

## Summary

These friction points represent real developer experience issues encountered during prototype development. Each suggestion aims to reduce friction, improve error messages, and provide better documentation to help developers build faster and more confidently on the Cloudflare Developer Platform.
