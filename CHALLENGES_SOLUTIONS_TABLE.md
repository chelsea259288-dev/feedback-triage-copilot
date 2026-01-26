# Challenges & Solutions — Video Presentation

**Context:** Key technical and product challenges encountered while building Feedback Triage Copilot on Cloudflare Developer Platform.

---

## Overview (3 challenges in 60 seconds)

| # | Challenge | Why it matters | Solution (what I built) | Cloudflare products used |
|:-:|-----------|----------------|-------------------------|--------------------------|
| **1** | **Async reliability**<br/>(AI can be slow/flaky) | • PM UI can't wait on model inference<br/>• Need retries + observability for production reliability<br/>• Fast user experience is critical | • **Workflows pipeline:** Deduplicate → AI Analyze → Write back to D1 (+ aggregate themes)<br/>• UI stays fast; workflow handles retries + durability<br/>• Async processing decouples UX from AI latency | • Workflows<br/>• Workers AI<br/>• D1 Database |
| **2** | **Structured output consistency**<br/>(LLM outputs aren't naturally consistent) | • If model returns "High" instead of "P1", filters and analytics break<br/>• Inconsistent categories/themes reduce trust<br/>• Need database-ready structured fields | • **Strict prompt schema + examples**<br/>• Validate output + retry on malformed JSON<br/>• Graceful fallback when AI is unavailable<br/>• Defensive parsing + schema validation | • Workers AI<br/>• D1 Database |
| **3** | **Developer experience friction**<br/>(Setup behaviors were surprising) | • Hidden prerequisites (R2 dashboard onboarding) slow prototyping<br/>• Local dev mental model breaks when behavior differs by product<br/>• Optional bindings block deployment | • **Maintained Friction Log** with specific product suggestions:<br/>  - Actionable error messages with links<br/>  - Clearer docs and dev output<br/>  - Optional binding handling (`required=false`)<br/>• Built fallbacks for optional features | • Wrangler CLI<br/>• R2<br/>• Workflows local dev |

---

## Talking points (while showing this table)

### 2:40–2:50 (10 sec) — Transition
> "Now, the most important part: what was hard, and what I learned building on Cloudflare."

### 2:50–3:05 (15 sec) — Challenge 1: Async reliability
(Point at row 1 in the table)

> "Challenge one: AI can be slow or flaky. I didn't want the UI to wait on model inference. Solution: I used Cloudflare Workflows to run analysis asynchronously—deduplicate, analyze with AI, then write results back to the database. The user gets a fast UI, and the pipeline stays reliable with retries."

### 3:05–3:15 (10 sec) — Challenge 2: Structured output
(Point at row 2 in the table)

> "Challenge two: LLM outputs aren't naturally consistent. If the model returns 'High' instead of 'P1', filters break. Solution: a strict prompt schema with examples, plus validation and retry logic to keep the output usable."

### 3:15–3:30 (15 sec) — Challenge 3: Dev experience friction
(Point at row 3 in the table)

> "Challenge three: a few setup behaviors were surprising—like certain resources requiring dashboard onboarding, and Workflows local dev behavior. I documented these in a friction log with very specific product suggestions: better error messages, clearer docs, and optional binding handling."

---

## How to use in video presentation

### Option 1: GitHub Markdown Preview (Recommended - cleanest rendering)
1. Push this file to your repo
2. Open it on GitHub: `https://github.com/chelsea259288-dev/feedback-triage-copilot/blob/main/CHALLENGES_SOLUTIONS_TABLE.md`
3. GitHub will render the table beautifully
4. Screen share and scroll to the table
5. Use your cursor to point at each row as you speak

### Option 2: VS Code Markdown Preview
1. Open this file in VS Code
2. Press `Cmd+Shift+V` (Mac) or `Ctrl+Shift+V` (Windows) to preview
3. Screen share the preview pane
4. Point at each row while narrating

### Option 3: Google Docs / Notion
1. Copy the table from the markdown preview
2. Paste into Google Docs or Notion
3. Clean up formatting if needed
4. Share screen and present

---

## Visual tips for recording

**Camera movement:**
- Start with full table visible (all 3 challenges at once)
- As you narrate each challenge, move cursor to that row
- Highlight the "Solution" column when explaining what you built
- Point to "Cloudflare products used" to emphasize platform integration

**Pacing:**
- Don't read every word—the table is backup context
- Focus on speaking naturally while using the table as a visual anchor
- Each challenge = ~10-15 seconds of talking

**Screen setup:**
- Zoom browser to 125-150% so text is readable in video
- Use a clean browser window (close other tabs)
- Consider using browser Reader Mode for even cleaner display

---

## Key takeaways (for viewers)

1. **Technical depth:** Shows you understand async patterns, LLM reliability, and production-grade error handling
2. **Product thinking:** Demonstrates PM mindset—you captured friction points and proposed specific improvements
3. **Platform integration:** Uses 5 Cloudflare products cohesively (not just a toy demo)

---

## Alternative: Single-slide version

If you want to create a PowerPoint/Keynote slide instead, use this layout:

**Slide title:** Challenges & Solutions

**3 cards (horizontal layout):**

**Card 1 - Async Reliability**
- Problem: AI is slow/flaky, UI can't wait
- Solution: Workflows pipeline (dedupe → AI → write back)
- Result: Fast UI + reliable processing
- Tech: Workflows, Workers AI, D1

**Card 2 - Structured Output**
- Problem: Inconsistent LLM output breaks filters
- Solution: Strict prompts + validation + retries
- Result: Database-ready structured fields
- Tech: Workers AI, D1

**Card 3 - Dev Experience**
- Problem: Setup surprises slow prototyping
- Solution: Friction log with actionable suggestions
- Result: Better errors, clearer docs, optional bindings
- Tech: Wrangler, R2, Workflows
