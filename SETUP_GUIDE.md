# Cloudflare 设置和部署指南

## 🎯 当前状态

✅ **已完成**:
- Node.js 安装 (v24.13.0 via Volta)
- npm 安装 (v11.6.2)
- 项目依赖安装 (wrangler, typescript 等)
- 所有源代码文件创建完成

🔄 **待完成**:
- Cloudflare 账户登录
- D1 数据库创建
- 本地开发测试

---

## 📋 完整设置步骤

### 步骤 1: Cloudflare 账户登录

#### 方法 A: OAuth 登录（推荐）

在终端中运行：

```bash
cd feedback-hub
npx wrangler login
```

这会：
1. 自动打开浏览器
2. 跳转到 Cloudflare OAuth 授权页面
3. 点击「Allow」授权
4. 浏览器显示成功后回到终端

#### 方法 B: API Token 登录（备选）

如果 OAuth 不工作，可以使用 API Token：

1. 访问: https://dash.cloudflare.com/profile/api-tokens
2. 点击「Create Token」
3. 使用「Edit Cloudflare Workers」模板
4. 创建 Token 后复制
5. 设置环境变量：

```bash
export CLOUDFLARE_API_TOKEN="你的_token"
```

#### 验证登录

```bash
npx wrangler whoami
```

应该显示你的账户信息。

---

### 步骤 2: 创建 D1 数据库

```bash
npx wrangler d1 create feedback_db
```

**重要**: 复制输出中的信息，例如：

```toml
[[d1_databases]]
binding = "DB"
database_name = "feedback_db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

然后**更新 `wrangler.toml` 文件**，将 `database_id` 替换为实际的 ID：

```bash
# 编辑 wrangler.toml
nano wrangler.toml

# 或使用你喜欢的编辑器
code wrangler.toml
```

找到这一行：
```toml
database_id = "placeholder-will-be-generated"
```

替换为实际的 database_id。

---

### 步骤 3: (可选) 创建 KV 命名空间

```bash
npx wrangler kv:namespace create CACHE
```

复制输出的 `id`，同样更新到 `wrangler.toml`：

```toml
id = "你的_kv_namespace_id"
```

---

### 步骤 4: 初始化数据库 Schema

```bash
# 本地数据库初始化
npx wrangler d1 execute feedback_db --local --file=./migrations/0001_initial_schema.sql
```

这会：
- 创建 `feedback` 表
- 创建 `product_areas` 表
- 插入 19 种 Cloudflare 产品数据
- 创建性能优化索引

---

### 步骤 5: 本地开发测试

```bash
npx wrangler dev
```

成功后会显示：
```
⛅️ wrangler 3.114.17
------------------
[b] open a browser, [d] open devtools, [l] turn off local mode, [c] clear console, [x] to exit
```

访问: **http://localhost:8787**

---

### 步骤 6: 生成测试数据

在浏览器中访问:
```
http://localhost:8787/api/seed
```

或使用 curl:
```bash
curl http://localhost:8787/api/seed
```

这会生成 **150 条 Mock 反馈数据**。

---

### 步骤 7: 测试功能

#### 查看 Dashboard
```
http://localhost:8787/
```

应该看到：
- 统计概览卡片
- 产品线分布图
- 反馈列表

#### 测试 API

**获取所有反馈**:
```bash
curl http://localhost:8787/api/feedback | jq
```

**按产品过滤**:
```bash
curl "http://localhost:8787/api/feedback?product_area=workers" | jq
```

**获取统计数据**:
```bash
curl http://localhost:8787/api/analytics | jq
```

**创建新反馈（触发 AI 分析）**:
```bash
curl -X POST http://localhost:8787/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Workers 部署速度太慢了，需要优化",
    "source": "discord",
    "author": "test_user"
  }' | jq
```

---

### 步骤 8: 部署到生产环境

#### 8.1 初始化远程数据库

```bash
npx wrangler d1 execute feedback_db --remote --file=./migrations/0001_initial_schema.sql
```

#### 8.2 部署 Worker

```bash
npx wrangler deploy
```

成功后会显示：
```
Published feedback-hub (1.23 sec)
  https://feedback-hub.your-account.workers.dev
```

#### 8.3 生成生产数据

```bash
curl https://feedback-hub.your-account.workers.dev/api/seed
```

---

## 🎨 功能验证清单

测试以下功能以确保一切正常：

- [ ] Dashboard 正常显示
- [ ] 统计数据正确（总数、今日、未分析、紧急）
- [ ] 产品线分布图显示
- [ ] 反馈列表加载
- [ ] 过滤功能工作（按来源、情感、产品）
- [ ] AI 分析功能（创建新反馈时）
- [ ] 批量分析 API 工作

---

## 📸 截图 Bindings 配置

部署成功后，需要截图 Bindings 配置页用于最终提交：

1. 访问: https://dash.cloudflare.com/
2. 进入「Workers & Pages」
3. 点击「feedback-hub」
4. 进入「Settings」→「Bindings」
5. 截图显示：
   - D1 Database: feedback_db
   - AI: (自动绑定)
   - KV: CACHE (如果创建了)

---

## 🐛 常见问题排查

### 问题 1: Wrangler 版本警告

如果看到「update available」警告，可以更新：

```bash
npm install --save-dev wrangler@latest
```

### 问题 2: 登录失败

尝试：
1. 清除缓存: `rm -rf ~/.wrangler`
2. 重新登录: `npx wrangler login`
3. 或使用 API Token 方式

### 问题 3: D1 数据库连接失败

确保：
1. `wrangler.toml` 中的 `database_id` 正确
2. 已运行 schema 初始化
3. 使用 `--local` 标志进行本地测试

### 问题 4: AI 分析失败

Workers AI 在本地开发时可能不可用。解决方法：
1. 代码已包含降级机制（基于规则分析）
2. 部署到生产环境后测试完整 AI 功能

### 问题 5: Assets (HTML) 不显示

如果 Dashboard 不显示：
1. 确保 `public/index.html` 存在
2. 检查 `wrangler.toml` 中的 `[assets]` 配置
3. 可能需要手动内嵌 HTML 到 `router.ts`

---

## 📝 Product Insights 记录

在使用过程中，记录你遇到的问题：

### 模板

**Title**: [问题名称]

**Problem**: 
- 遇到了什么问题？
- 如何影响你的开发流程？
- 花费了多少时间解决？

**Suggestion**: 
- 作为 PM，你会如何改进？
- 是 UI 改进、文档补充还是新功能？

### 示例

**Title**: D1 Database ID 配置需要手动复制粘贴

**Problem**: 
创建 D1 数据库后，CLI 输出了 database_id，但需要手动复制并粘贴到 wrangler.toml 文件中。这个过程容易出错（复制错 ID、忘记更新配置等），对新手不友好。在开发过程中，我花费了 5 分钟来确认 ID 是否正确粘贴。

**Suggestion**: 
增加 `wrangler d1 link` 命令，自动将创建的数据库绑定到项目配置文件中。类似于：
```bash
npx wrangler d1 create feedback_db --link
```
这会自动更新 wrangler.toml，减少手动操作和错误。

---

## 🎯 最终提交清单

部署成功后，准备以下内容：

- [ ] GitHub Repository URL
- [ ] 部署的 Worker URL (e.g., feedback-hub.xxx.workers.dev)
- [ ] Bindings 配置截图
- [ ] 3-5 条 Product Insights
- [ ] Architecture 说明（使用的 Cloudflare 产品）
- [ ] (可选) Vibe-coding 提示词示例

---

## 🚀 快速命令参考

```bash
# 登录
npx wrangler login

# 创建数据库
npx wrangler d1 create feedback_db

# 本地开发
npx wrangler dev

# 部署
npx wrangler deploy

# 查看日志
npx wrangler tail

# 数据库查询（本地）
npx wrangler d1 execute feedback_db --local --command "SELECT COUNT(*) FROM feedback"

# 数据库查询（生产）
npx wrangler d1 execute feedback_db --remote --command "SELECT COUNT(*) FROM feedback"
```

---

**祝你成功完成这个项目！🎉**
