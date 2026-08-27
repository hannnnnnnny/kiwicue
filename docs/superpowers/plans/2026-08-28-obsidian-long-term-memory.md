# Obsidian Long-Term Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the KiwiCue repository to `D:\obsidian` so Codex retrieves concise project memory before each task and updates durable knowledge after each task.

**Architecture:** Keep source code and memory separate. The Obsidian vault stores curated Markdown notes linked from one index; a repository-root `AGENTS.md` points Codex at that index and defines the read-before/write-after protocol. Current repository files and test results remain the source of truth when memory is stale.

**Tech Stack:** Obsidian Markdown/Wikilinks, repository-level `AGENTS.md`, PowerShell validation, Git.

## Global Constraints

- Scope only `C:\Users\harry\OneDrive\文档\nz news center`; do not index `C:\project719A1` or other projects.
- Use `D:\obsidian` as the vault; do not copy source code into it.
- Do not install third-party Obsidian plugins or create a background synchronization service.
- Never store passwords, API keys, tokens, connection strings, private keys, `.env` values, or sensitive personal data.
- Store only durable information that affects future work; exclude chat transcripts, complete command output, full diffs, duplicate content, and transient details.
- Treat the current repository, tests, and Git state as authoritative when they conflict with memory.
- Preserve the unrelated untracked `skills-lock.json`; do not stage or edit it.

---

## File Map

**Create in the vault:**

- `D:\obsidian\00-首页\长期记忆索引.md` — single entry point for memory retrieval.
- `D:\obsidian\10-项目\nz-news-center\项目总览.md` — stable identity, product scope, stack, routes, and source path.
- `D:\obsidian\10-项目\nz-news-center\当前状态.md` — concise current branch, latest verified state, and blockers.
- `D:\obsidian\10-项目\nz-news-center\关键决策.md` — dated architectural and product decisions with rationale.
- `D:\obsidian\10-项目\nz-news-center\技术方案.md` — current data boundaries, validation, privacy, and testing architecture.
- `D:\obsidian\10-项目\nz-news-center\已完成内容.md` — durable delivered milestones.
- `D:\obsidian\10-项目\nz-news-center\踩坑与失败方案.md` — failures, root causes, rejected approaches, and safer alternatives.
- `D:\obsidian\10-项目\nz-news-center\下一步计划.md` — only active, evidence-backed follow-up work.
- `D:\obsidian\20-偏好\长期工作偏好.md` — stable collaboration, security, quality, and UI preferences.
- `D:\obsidian\90-系统\长期记忆维护规则.md` — inclusion, retrieval, update, deduplication, and safety policy.

**Create in the repository:**

- `C:\Users\harry\OneDrive\文档\nz news center\AGENTS.md` — project-scoped memory workflow for future Codex tasks.

---

### Task 1: Create the Vault Navigation and Governance Notes

**Files:**
- Create: `D:\obsidian\00-首页\长期记忆索引.md`
- Create: `D:\obsidian\20-偏好\长期工作偏好.md`
- Create: `D:\obsidian\90-系统\长期记忆维护规则.md`

**Interfaces:**
- Consumes: the approved design at `docs/superpowers/specs/2026-08-28-obsidian-long-term-memory-design.md`.
- Produces: stable Wikilink targets and the rules used by every later memory update.

- [ ] **Step 1: Verify the vault before writing**

Run:

```powershell
$vaultPath = 'D:\obsidian'
if (-not (Test-Path -LiteralPath (Join-Path $vaultPath '.obsidian'))) {
  throw 'D:\obsidian is not an initialized Obsidian vault.'
}
Get-ChildItem -LiteralPath $vaultPath -Force
```

Expected: `.obsidian` exists and no existing Markdown file will be overwritten.

- [ ] **Step 2: Create the three directories and notes with `apply_patch`**

Create `长期记忆索引.md` with this content:

```markdown
---
type: memory-index
updated: 2026-08-28
---

# 长期记忆索引

## 项目

- [[10-项目/nz-news-center/项目总览|KiwiCue / nz news center]]

## 长期规则

- [[20-偏好/长期工作偏好]]
- [[90-系统/长期记忆维护规则]]
```

Create `长期工作偏好.md` with this content:

```markdown
---
type: durable-preferences
updated: 2026-08-28
---

# 长期工作偏好

- 开始实现前先理解边界、现有架构和相关历史决定。
- 交付前运行与风险相称的测试，并说明验证结果。
- UI 采用移动端优先设计，覆盖加载、空数据和错误状态。
- TypeScript 保持严格类型，避免无理由使用 `any`。
- 所有外部输入都要验证和规范化；敏感配置只通过环境变量传递。
- 关键实现记录理由与影响，不保存聊天流水或临时细节。
```

Create `长期记忆维护规则.md` with this content:

```markdown
---
type: memory-policy
updated: 2026-08-28
---

# 长期记忆维护规则

## 任务开始前

1. 读取 [[00-首页/长期记忆索引]] 与当前项目的 `项目总览`。
2. 按任务主题只读取最相关的状态、决策、技术方案或踩坑笔记。
3. 用当前源码、测试和 Git 状态核验笔记；冲突时以可验证的仓库状态为准。

## 任务完成后

只有信息会影响未来决策、避免重复调查、描述重要状态变化或表达长期偏好时才写入。把内容合并进现有主题；不要为每轮对话创建新笔记。完成项从 `下一步计划` 移到 `已完成内容`，过时决定标记为已取代并链接到新决定。

## 禁止记录

- 密码、API Key、Token、连接字符串、私钥、`.env` 值或敏感个人信息。
- 聊天全文、完整命令输出、完整 diff、构建缓存、依赖内容和一次性临时信息。
- 未经验证的猜测；不确定信息必须注明来源和不确定性。

## 写作标准

- 先更新已有条目，避免重复。
- 写清日期、结论、原因、影响和验证证据。
- 代码变更只记录结果、理由、关键文件和验证结论。
- `当前状态` 与 `下一步计划` 保持短小并及时清理失效内容。
```

- [ ] **Step 3: Validate the navigation files**

Run:

```powershell
$required = @(
  'D:\obsidian\00-首页\长期记忆索引.md',
  'D:\obsidian\20-偏好\长期工作偏好.md',
  'D:\obsidian\90-系统\长期记忆维护规则.md'
)
$missing = $required | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missing) { throw "Missing notes: $($missing -join ', ')" }
Select-String -LiteralPath $required[0] -Pattern '\[\[10-项目/nz-news-center/项目总览\|KiwiCue / nz news center\]\]'
```

Expected: no missing paths and one index-link match.

---

### Task 2: Seed the KiwiCue Project Memory

**Files:**
- Create: `D:\obsidian\10-项目\nz-news-center\项目总览.md`
- Create: `D:\obsidian\10-项目\nz-news-center\当前状态.md`
- Create: `D:\obsidian\10-项目\nz-news-center\关键决策.md`
- Create: `D:\obsidian\10-项目\nz-news-center\技术方案.md`
- Create: `D:\obsidian\10-项目\nz-news-center\已完成内容.md`
- Create: `D:\obsidian\10-项目\nz-news-center\踩坑与失败方案.md`
- Create: `D:\obsidian\10-项目\nz-news-center\下一步计划.md`

**Interfaces:**
- Consumes: `README.md`, `package.json`, `next.config.ts`, `docs/security-movie-data-audit.md`, `docs/specs/*.md`, `docs/plans/*.md`, and recent Git history.
- Produces: the project note targets referenced by the index and `AGENTS.md`.

- [ ] **Step 1: Re-check safe source metadata without reading secret files**

Run:

```powershell
git branch --show-current
git status --short
git log -12 --date=short --pretty=format:'%h`t%ad`t%s'
Get-Content -Raw -LiteralPath 'README.md'
Get-Content -Raw -LiteralPath 'package.json'
```

Expected: branch `main`; `skills-lock.json` remains the only unrelated untracked file; product name `KiwiCue`; Next.js 16, React 19, TypeScript 5; no `.env.local` read.

- [ ] **Step 2: Create `项目总览.md`**

Use `apply_patch` with this content:

```markdown
---
type: project-overview
project: nz-news-center
status: active
updated: 2026-08-28
source: C:\Users\harry\OneDrive\文档\nz news center
---

# KiwiCue 项目总览

KiwiCue 是一个面向奥克兰的中英双语活动与电影发现平台，线上地址为 <https://kiwicue.vercel.app/>。它聚合近期活动、经过核实的本地市场信息、电影元数据、影院场次状态和官方来源链接。

## 核心原则

- 优先展示仍来得及安排的活动。
- 不把电影上映元数据冒充奥克兰实时场次。
- 最终活动与购票信息以官方来源为准。
- 收藏和可选定位数据保留在浏览器端。

## 技术栈

- Next.js 16 App Router、React 19、TypeScript 5。
- Vitest、Testing Library、jsdom 与 Playwright。
- Vercel 部署；Node.js 20+ 与 npm。

## 主要目录

- `app/`：页面和服务端 API 路由。
- `components/`：共享与交互组件。
- `lib/`：外部 API、验证和领域逻辑。
- `tests/`：单元、组件和集成测试。
- `e2e/`：Playwright 端到端场景。
- `docs/`：设计、实施计划和安全审计。

## 关联记忆

- [[当前状态]]
- [[关键决策]]
- [[技术方案]]
- [[已完成内容]]
- [[踩坑与失败方案]]
- [[下一步计划]]
```

- [ ] **Step 3: Create the six focused project notes**

Use `apply_patch` to create the notes with these exact durable facts:

`当前状态.md`:

```markdown
---
type: project-status
project: nz-news-center
updated: 2026-08-28
---

# 当前状态

- 当前默认分支：`main`。
- 电影体验已区分实时覆盖、无覆盖和上游不可用状态。
- Open Cinema 在 2026-08-23 的奥克兰覆盖检查返回空覆盖；产品必须表述为“未覆盖”，不能声称奥克兰没有场次。
- 最近完成影院品牌标识、降级对比度和影院目录动作的视觉修正。
- 工作树中已有未跟踪的 `skills-lock.json`，它不属于长期记忆接入工作，不应提交。
```

`关键决策.md`:

```markdown
---
type: decision-log
project: nz-news-center
updated: 2026-08-28
---

# 关键决策

## 2026-08-23：电影数据来源边界

- TMDB 只提供电影元数据、图片、评分、上映日期和预告片，不能证明奥克兰当前有场次。
- Open Cinema Project 是当前唯一获准接入的机器可读实时场次来源；没有覆盖时必须失败关闭验证状态。
- 影院官网只作为人工导航入口；没有书面许可时不抓取或再发布排片。

## 2026-08-23：公开只读电影 API 例外

电影查询端点保持公开只读，使无账户网站可用。风险通过输入边界、重复参数拒绝、固定上游查询、缓存、解析验证和受控错误响应降低。

## 2026-08-12：市场数据采用人工策展

市场类别使用主办方公开的基本日程事实、KiwiCue 自写摘要和官方链接，不复制第三方创意内容，不引入付费基础设施。

## 2026-08-28：长期记忆独立存放

项目源码留在 Git 仓库，提炼后的长期记忆存放在 `D:\obsidian`；Codex 通过项目级规则执行任务前检索和任务后回写。
```

`技术方案.md`:

```markdown
---
type: technical-memory
project: nz-news-center
updated: 2026-08-28
---

# 技术方案

## 数据流

外部 Ticketmaster、TMDB 和 Open Cinema 数据先进入 Next.js 服务端路由，再经过验证与规范化后交给 UI。凭据只在服务端环境变量中使用。

## 电影验证

- 实时覆盖状态为 `covered`、`not-covered` 或 `unavailable`。
- 只有经过验证的未来奥克兰场次才能获得实时验证标识。
- 用户搜索词不转发给 Open Cinema；服务端请求固定目录并在本地过滤。
- 外部购票地址只允许 HTTPS，且主机必须匹配已知影院或 Veezi 域名。

## 隐私与安全

- 定位必须由用户主动触发，在浏览器内计算距离，不上传或持久化坐标。
- 收藏只保存公开活动信息到浏览器 localStorage，并对大小、数量和嵌套字段做验证。
- 全站使用 CSP、HSTS、点击劫持防护、MIME 嗅探防护和限制性 Permissions Policy。
- 公共 API 为只读例外；任何未来写入端点默认需要身份验证。

## 验证命令

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```
```

`已完成内容.md`:

```markdown
---
type: completed-work
project: nz-news-center
updated: 2026-08-28
---

# 已完成内容

- 已交付中英双语活动浏览、搜索、分类、时间窗口、详情、地图、官方来源和浏览器收藏。
- 已交付人工策展的奥克兰市场目录与访客预览内容。
- 已交付电影发现、电影详情、TMDB 元数据与预告片、奥克兰影院目录和实时覆盖状态。
- 已完成电影数据、API 凭据、定位、收藏和浏览器安全头审计。
- 已完善影院品牌资源、影院目录动作和图片失败时的视觉降级。
```

`踩坑与失败方案.md`:

```markdown
---
type: lessons-learned
project: nz-news-center
updated: 2026-08-28
---

# 踩坑与失败方案

## 空上游响应不等于没有场次

- 表现：空结果可能被用户理解为“奥克兰没有电影场次”。
- 根因：上游可能没有本地覆盖，而不是本地确实没有活动。
- 做法：明确区分 `not-covered` 与真实零结果，并保留官方影院入口。

## 不把用户搜索词转发给上游场次服务

- 风险：产生高基数请求、消耗配额并披露用户输入。
- 做法：请求固定日期目录、缓存结果并在服务器本地过滤。

## 不抓取未授权影院排片

- 失败原因：网页结构脆弱，而且没有确认再发布许可。
- 做法：只提供官方链接；获得影院令牌或书面授权后再增加适配器。

## 不伪造视觉或业务数据

- 不用上映日期推断实时场次，不编造价格、坐标或关闭信息。
- 图片失败时使用有意义的文本降级，不显示误导性的占位品牌。
```

`下一步计划.md`:

```markdown
---
type: next-actions
project: nz-news-center
updated: 2026-08-28
---

# 下一步计划

- 定期复核人工维护的影院和市场官方链接，移除失效链接，但不自动抓取内容。
- 发布前重新运行依赖安全检查以及单元、lint、build 和端到端验证。
- 若未来加入分析、服务端定位存储、账户、支付或用户生成内容，先进行新的隐私与威胁模型审查。
- 若获得影院书面授权或正式 API 凭据，再评估 Veezi 或 movieXchange/Vista 适配器。
```

- [ ] **Step 4: Validate project-note presence and Wikilink targets**

Run:

```powershell
$projectMemory = 'D:\obsidian\10-项目\nz-news-center'
$requiredNames = @('项目总览.md','当前状态.md','关键决策.md','技术方案.md','已完成内容.md','踩坑与失败方案.md','下一步计划.md')
$missing = $requiredNames | Where-Object { -not (Test-Path -LiteralPath (Join-Path $projectMemory $_)) }
if ($missing) { throw "Missing project notes: $($missing -join ', ')" }
$overview = Get-Content -Raw -LiteralPath (Join-Path $projectMemory '项目总览.md')
foreach ($name in $requiredNames | Where-Object { $_ -ne '项目总览.md' }) {
  $target = [IO.Path]::GetFileNameWithoutExtension($name)
  if ($overview -notmatch [regex]::Escape("[[$target]]")) { throw "Missing overview link: $target" }
}
'All project notes and overview links are present.'
```

Expected: `All project notes and overview links are present.`

---

### Task 3: Add the Repository Memory Protocol

**Files:**
- Create: `C:\Users\harry\OneDrive\文档\nz news center\AGENTS.md`

**Interfaces:**
- Consumes: `D:\obsidian\00-首页\长期记忆索引.md` and the project note set from Task 2.
- Produces: mandatory project-scoped instructions for future Codex tasks.

- [ ] **Step 1: Create `AGENTS.md` with `apply_patch`**

Use this exact content:

```markdown
# Project Instructions

## Obsidian long-term memory

This repository uses `D:\obsidian` as its curated long-term memory store.

Before starting any task:

1. Read `D:\obsidian\00-首页\长期记忆索引.md`.
2. Read `D:\obsidian\10-项目\nz-news-center\项目总览.md`.
3. Search only the project notes relevant to the task. For bugs, prioritize `当前状态.md`, `踩坑与失败方案.md`, and `技术方案.md`. For features and planning, prioritize `关键决策.md`, `技术方案.md`, and `下一步计划.md`.
4. Verify remembered claims against current source code, tests, and Git state. The repository is authoritative when they disagree, and stale notes must be corrected after the task.

After completing a task:

1. Update the existing project notes only when new information will affect future decisions, prevent repeated investigation, describe a meaningful status change, or record a durable user preference.
2. Merge and deduplicate content instead of creating per-conversation notes. Move finished work from `下一步计划.md` to `已完成内容.md`.
3. Record code changes as outcomes, rationale, key files, and verification results; do not copy full diffs, command transcripts, or temporary details.
4. Never store passwords, API keys, tokens, connection strings, private keys, `.env` values, sensitive personal data, or suspected secrets in Obsidian.
5. If the vault is unavailable, continue the project task and explicitly report that memory synchronization did not occur.
```

- [ ] **Step 2: Verify the protocol contains every mandatory control**

Run:

```powershell
$agents = Get-Content -Raw -LiteralPath 'AGENTS.md'
$requiredPatterns = @(
  'D:\\obsidian\\00-首页\\长期记忆索引\.md',
  'Before starting any task',
  'After completing a task',
  'repository is authoritative',
  'Never store passwords',
  'vault is unavailable'
)
foreach ($pattern in $requiredPatterns) {
  if ($agents -notmatch $pattern) { throw "AGENTS.md missing control: $pattern" }
}
'AGENTS.md memory protocol is complete.'
```

Expected: `AGENTS.md memory protocol is complete.`

- [ ] **Step 3: Commit only the repository rule**

Run:

```powershell
git add -- 'AGENTS.md'
git diff --cached --check
git commit -m 'chore: connect project to Obsidian memory'
git status --short
```

Expected: commit succeeds; `skills-lock.json` remains untracked and unstaged.

---

### Task 4: Run End-to-End Memory Validation

**Files:**
- Verify: `D:\obsidian\00-首页\长期记忆索引.md`
- Verify: `D:\obsidian\10-项目\nz-news-center\*.md`
- Verify: `C:\Users\harry\OneDrive\文档\nz news center\AGENTS.md`

**Interfaces:**
- Consumes: every artifact created in Tasks 1–3.
- Produces: evidence that retrieval, links, safety controls, and update routing work together.

- [ ] **Step 1: Resolve every explicit Wikilink in the project overview and vault index**

Run:

```powershell
$vault = 'D:\obsidian'
$files = @(
  (Join-Path $vault '00-首页\长期记忆索引.md'),
  (Join-Path $vault '10-项目\nz-news-center\项目总览.md')
)
foreach ($file in $files) {
  $content = Get-Content -Raw -LiteralPath $file
  $links = [regex]::Matches($content, '\[\[([^\]|]+)(?:\|[^\]]+)?\]\]')
  foreach ($link in $links) {
    $target = $link.Groups[1].Value
    if ($target -match '/') {
      $candidate = Join-Path $vault ($target + '.md')
    } else {
      $candidate = Get-ChildItem -LiteralPath $vault -Recurse -File -Filter ($target + '.md') | Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) { throw "Broken Wikilink in $file`: $target" }
  }
}
'All explicit Wikilinks resolve.'
```

Expected: `All explicit Wikilinks resolve.`

- [ ] **Step 2: Scan the new notes for common secret-value signatures**

Run:

```powershell
$notes = Get-ChildItem -LiteralPath 'D:\obsidian' -Recurse -File -Filter '*.md'
$secretPatterns = @(
  'sk-[A-Za-z0-9_-]{16,}',
  'ghp_[A-Za-z0-9]{20,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
  '(?im)^\s*(TICKETMASTER_API_KEY|TMDB_READ_ACCESS_TOKEN|OPEN_CINEMA_API_KEY)\s*=\s*[^\s]+\s*$'
)
foreach ($pattern in $secretPatterns) {
  $matches = Select-String -LiteralPath $notes.FullName -Pattern $pattern
  if ($matches) { throw "Potential secret found for pattern: $pattern" }
}
'No common secret-value signatures found.'
```

Expected: `No common secret-value signatures found.`

- [ ] **Step 3: Simulate task retrieval and update routing without adding noise**

Run:

```powershell
$index = Get-Content -Raw -LiteralPath 'D:\obsidian\00-首页\长期记忆索引.md'
$overview = Get-Content -Raw -LiteralPath 'D:\obsidian\10-项目\nz-news-center\项目总览.md'
$lessons = Get-Content -Raw -LiteralPath 'D:\obsidian\10-项目\nz-news-center\踩坑与失败方案.md'
if ($index -notmatch 'KiwiCue' -or $overview -notmatch 'Open Cinema' -or $lessons -notmatch '空上游响应不等于没有场次') {
  throw 'Bug-task retrieval simulation lacks required context.'
}
'Bug-task retrieval route is usable; no write is needed because no new durable fact was produced.'
```

Expected: the success message confirms relevant context can be retrieved and that a no-op task does not create duplicate memory.

- [ ] **Step 4: Final repository verification**

Run:

```powershell
git log -3 --oneline
git status --short
```

Expected: the design, plan, and project-rule commits are present; `skills-lock.json` remains the only unrelated untracked item. Vault notes are visible in Obsidian under `D:\obsidian`.
