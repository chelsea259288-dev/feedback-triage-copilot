# Friction Log - Feedback Triage Copilot 开发记录

记录在使用 Cloudflare Developer Platform 开发过程中的真实障碍与改进建议。

---

## 1. R2 Bucket Creation: Need Dashboard Onboarding First

**What happened:**
- 运行 `wrangler r2 bucket create <name>` 失败
- 错误信息：`Please enable R2 through the Cloudflare Dashboard. [code: 10042]`
- 阻塞时间：需要跳转 dashboard 完成 R2 onboarding（可能包括支付绑定）

**Why it matters:**
- 对于新手 PM/开发者，这是一个"隐藏前置条件"
- Wrangler CLI 没有自动检测或提供直达 onboarding 链接
- 在 CI/CD 或快速原型场景下，这种强制 dashboard 步骤会打断流程

**Suggestion:**
- Wrangler 错误信息应该提供：
  - 直达 R2 onboarding 的完整 URL（带 account ID）
  - 检测命令：`wrangler r2 check-subscription` 可提前验证
- 文档在"Get Started with R2"章节明确标注：首次使用必须 dashboard 激活（甚至自动打开浏览器？）

**Status:** 需要手动去 dashboard 开通 R2，然后回来重试

---

## 2. Workflows Local Dev Uses Remote Instances (Unexpected)

**What happened:**
- 在 `wrangler dev` 本地开发时，调用 `env.TRIAGE_WORKFLOW.create()` 成功返回了 instance ID
- 但使用 `wrangler workflows instances describe` 查询该实例时失败：`workflow.not_found [code: 10200]`
- 发现原因：Workflow 必须先通过 `wrangler deploy` 部署到远程，本地开发时才能使用

**Why it matters:**
- **非常反直觉**：其他 bindings（D1、R2）在 `wrangler dev` 时都是"本地模拟"，但 Workflows 是"远程连接"
- Wrangler dev 的提示信息 `connected to remote resource` 容易被忽略，开发者会以为是本地模拟
- 这导致"本地开发 -> 触发 Workflow -> 找不到实例"的循环错误，难以调试
- 对于原型开发，这增加了"必须先部署一次"的额外步骤

**Suggestion:**
1. **改进 wrangler dev 输出**：
   - 在 Workflows binding 旁边明确标注：`[⚠️  REQUIRES DEPLOYMENT: Workflows must be deployed with 'wrangler deploy' before use in local dev]`
   - 提供一键部署提示：`Run 'wrangler deploy' first to enable Workflows in local development`

2. **改进错误信息**：
   - 当 `workflow.not_found` 错误发生时，检查是否从未部署过，给出更明确的提示：
     ```
     Workflow 'feedback-triage-workflow' not found.
     
     Possible causes:
     1. Workflow has never been deployed. Run: wrangler deploy
     2. Workflow name mismatch in wrangler.toml
     3. Wrong account/API token
     ```

3. **文档改进**：
   - Workflows Quick Start 应该在第一步就强调："Unlike D1 or R2, Workflows require deployment before local testing"
   - 提供一个"最小 Workflow + local dev"示例，明确展示部署步骤

**Status:** 需要先 `wrangler deploy` 部署 Workflow，然后才能在本地开发中触发实例

---

## 3. R2 Binding Error Blocks Deployment Even When R2 Not Used

**What happened:**
- Added R2 bucket binding to `wrangler.toml` for optional semantic search feature
- Ran `wrangler deploy` but it failed with: `R2 bucket 'feedback-triage-corpus' not found [code: 10085]`
- The deployment was completely blocked even though:
  - R2 is an optional feature (app works fine without it using fallback logic)
  - The code has proper error handling for missing R2 binding
  - Other critical bindings (D1, AI, Workflows) were configured correctly

**Why it matters:**
- **Prevents iterative development**: Can't deploy a working MVP first, then add optional features later
- **All-or-nothing deployment**: If any binding is missing, entire deployment fails
- **Wastes time**: Had to go back, comment out R2 binding, redeploy, then manually add it later
- **Breaks progressive enhancement**: Can't ship "core features work, premium features coming soon"

**Suggestion:**
1. **Add binding validation levels in wrangler.toml**:
   ```toml
   [[r2_buckets]]
   binding = "CORPUS"
   bucket_name = "feedback-triage-corpus"
   required = false  # ← New field: allow deployment even if bucket doesn't exist
   ```

2. **Improve deployment error messages**:
   - Current: "R2 bucket 'X' not found. Please use a different name and try again."
   - Better: 
     ```
     R2 bucket 'feedback-triage-corpus' not found.
     
     Options:
     1. Create bucket: wrangler r2 bucket create feedback-triage-corpus
     2. Deploy without R2: Comment out [[r2_buckets]] in wrangler.toml
     3. Use different bucket: Update bucket_name in wrangler.toml
     ```

3. **Add --ignore-missing-bindings flag**:
   ```bash
   wrangler deploy --ignore-missing-bindings=r2
   # Still validates critical bindings like D1, but allows optional ones to be missing
   ```

**Workaround Used:** 
- Commented out R2 binding in `wrangler.toml` before deployment
- Added comment: `# Commented out until R2 bucket is created - see R2_AI_SEARCH_SETUP.md`
- Successfully deployed core features, can add R2 later

**Status:** Deployed without R2 using fallback mechanisms (Jaccard similarity instead of AI Search)

---

## 4. Workers AI Analysis Quality Varies Significantly by Prompt Structure

**What happened:**
- Initial AI prompts produced inconsistent results:
  - Sometimes returned urgency as "High" instead of "P0-P3" format
  - Category was vague ("General") instead of specific ("Bug", "Feature Request")
  - Theme was too generic ("User feedback") instead of actionable ("Wrangler deploy timeout errors")
- After refining prompt with explicit examples and format constraints, quality improved 80%

**Why it matters:**
- **Prompt engineering is critical but undocumented**: Workers AI docs don't provide guidance on structuring prompts for structured output
- **No built-in JSON schema validation**: Unlike OpenAI's function calling, Workers AI requires manual JSON parsing and validation
- **Trial and error is expensive**: Each test costs time + AI tokens
- **Hard to debug failures**: When AI returns malformed JSON, unclear if it's model issue or prompt issue

**What worked:**
```typescript
// Before: Generic prompt
"Analyze this feedback and extract key information"

// After: Specific format + examples
const prompt = `Analyze feedback and return JSON with exact fields:
{
  "urgency": "P0|P1|P2|P3",  // P0=critical outage, P1=major bug, P2=minor issue, P3=enhancement
  "category": "Bug|Feature Request|Docs|Performance|Other",
  "theme": "short actionable phrase (e.g. 'Wrangler deploy timeout errors')"
}

Examples:
- "Deploy keeps timing out" → urgency: P1, category: Bug, theme: "Deploy timeout errors"
- "Add dark mode please" → urgency: P3, category: Feature Request, theme: "UI dark mode requests"

Feedback: ${text}`;
```

**Suggestion:**
1. **Add Workers AI cookbook for structured output**:
   - Provide prompt templates for common use cases (classification, extraction, summarization)
   - Show how to enforce JSON schema in prompts
   - Include retry strategies for malformed outputs

2. **Add JSON schema validation helper**:
   ```typescript
   const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
     messages: [...],
     response_format: {  // ← Similar to OpenAI's JSON mode
       type: "json_object",
       schema: { urgency: "P0|P1|P2|P3", category: "Bug|Feature|..." }
     }
   });
   ```

3. **Better error messages from AI runtime**:
   - When JSON parsing fails, show partial output + where parsing failed
   - Suggest prompt improvements based on common failure patterns

**Workaround Used:**
- Implemented retry logic with exponential backoff (3 attempts)
- Added fallback to rule-based analysis if AI fails after retries
- Used defensive JSON parsing with schema validation

**Status:** Working reliably with refined prompts + fallback mechanisms

---