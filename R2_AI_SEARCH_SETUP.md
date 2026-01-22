# R2 和 AI Search 配置指南

本项目的完整版使用 R2 + AI Search 实现语义检索功能。由于这些功能需要手动在 Dashboard 配置，本文档提供详细步骤。

## 当前状态

- ✅ D1 Database: 已配置
- ✅ Workers AI: 已配置  
- ✅ Workflows: 已配置
- ⏳ R2: **需要手动开通**
- ⏳ AI Search: **需要手动配置**

## 方案选择

### 方案 A: 完整版（R2 + AI Search）- 推荐用于最终 demo

包含语义相似检索、全局语义搜索、Ask功能

### 方案 B: 简化版（仅 D1 + Workers AI + Workflows）

使用关键词相似度代替语义检索（当前代码已支持 fallback）

---

## 方案 A 配置步骤

### 1. 开通 R2 Subscription

1. 访问：`https://dash.cloudflare.com/{{account_id}}/r2/overview`
2. 点击 "Purchase R2" 或 "Enable R2"
3. 绑定支付方式（如需要）
4. 等待激活完成（通常几秒）

### 2. 创建 R2 Bucket

```bash
cd /Users/chelseaxiao/Documents/cloudflare/feedback-hub
npx wrangler r2 bucket create feedback-triage-corpus
```

验证：
```bash
npx wrangler r2 bucket list
# 应该能看到 feedback-triage-corpus
```

### 3. 创建 AI Search 实例

**方式 1: Dashboard（推荐）**

1. 访问：`https://dash.cloudflare.com/{{account_id}}/ai/ai-search`
2. 点击 "Create AI Search"
3. 配置：
   - Name: `feedback-triage`
   - Data source: `R2`
   - Bucket: `feedback-triage-corpus`
   - Path filtering:
     - Include: `/feedback/**`
     - Exclude: (留空)
4. 点击 "Create"
5. 等待初始索引完成（可能需要5-15分钟，即使bucket是空的）

**方式 2: API**

```bash
# 获取 account ID
ACCOUNT_ID=$(npx wrangler whoami | grep "Account ID" | awk '{print $4}')

# 创建 AI Search（需要 API token）
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/autorag" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "feedback-triage",
    "data_source": {
      "type": "r2",
      "bucket_name": "feedback-triage-corpus",
      "path_filters": {
        "include": ["/feedback/**"]
      }
    }
  }'
```

### 4. 验证配置

**检查 R2 binding:**
```bash
npx wrangler dev
# 应该能看到 "R2 Buckets: CORPUS: feedback-triage-corpus"
```

**测试 AI Search:**
```typescript
// 在 Worker 代码中
const result = await env.AI.autorag("feedback-triage").search({
  query: "test",
  max_num_results: 1
});
console.log(result);
```

---

## 方案 B：不使用 R2/AI Search

如果你暂时无法配置 R2/AI Search，代码已经内置 fallback 机制：

### 当前 Fallback 行为

1. **Workflow Step C**: 
   - 如果 `env.CORPUS` 不存在，跳过 R2 写入（不报错）
   - AI 分析结果仍然写入 D1

2. **Similar Issues API**（需要实现）:
   - 使用 Jaccard 相似度（基于关键词）
   - 从 D1 读取同产品/同类别反馈
   - 计算文本相似度并排序

3. **Search API**（需要实现）:
   - 使用 D1 全文搜索（LIKE）
   - 或使用简单关键词匹配

### 如何切换

在 `wrangler.toml` 中注释掉 R2 binding：

```toml
# [[r2_buckets]]
# binding = "CORPUS"
# bucket_name = "feedback-triage-corpus"
```

---

## 下一步

### 如果选择方案 A（完整版）:
1. 完成上述步骤 1-4
2. 运行 `npx wrangler dev` 验证所有 bindings
3. 继续实现 AI Search 相关 API

### 如果选择方案 B（简化版）:
1. 注释掉 R2 binding
2. 实现 fallback 版本的 similar/search API
3. 可以稍后升级到方案 A

---

## 常见问题

### Q: R2 收费吗？
A: R2 有免费额度（10 GB 存储 + 每月 100万 Class A 操作）。本项目预计用量 < 1 MB。

### Q: AI Search 收费吗？
A: AI Search 按查询次数收费。本项目开发阶段预计 < 100 queries。

### Q: 索引需要多久？
A: 初始创建 AI Search 实例：5-15分钟。后续新对象索引：1-5分钟（异步）。

### Q: 本地开发时 AI Search 怎么办？
A: 本地开发会代理到远程 AI Search 实例（需要已部署）。

---

## 记录到 Friction Log

- ✅ **已记录**: R2 需要 dashboard 开通，CLI 无法自动激活
- 待记录: AI Search 创建流程的可改进点
- 待记录: R2 binding 缺失时的错误提示质量
