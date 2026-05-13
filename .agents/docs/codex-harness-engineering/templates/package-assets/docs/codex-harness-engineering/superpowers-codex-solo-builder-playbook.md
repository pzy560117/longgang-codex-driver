# Superpowers + Codex 单人全流程研发实战手册

**日期**: 2026-04-22  
**定位**: 补足 `AI_Codex_pipeline_v1_2_deep_audit.md` 偏方法论、偏理想化的问题。  
**目标**: 回答一个更实际的问题: 在上下文有限、只有 1 个人主导、AI 全程辅助的前提下，怎么把 `需求 -> 文档 -> UI 设计 -> 设计转前端 -> 后端 -> 联调 -> 测试` 跑通，并且让每一阶段都有明确输入、输出、闸门和可替换工具。

## 1. 先说结论

### 1.1 真正可落地的模式

在今天这个阶段，最稳的不是“AI 一口气从一句话做完整个项目”，而是:

1. 人负责定义阶段闸门和最终判断。
2. AI 负责在每个阶段内批量产出候选方案、文档、代码和测试。
3. 仓库负责把这些候选物变成可验证产物。

如果没有结构化文档、状态矩阵、设计 token、接口 contract、自动验证链路，那么 AI 只是在高速输出草稿，不是在交付工程。

### 1.2 你现在这套链路里，Superpowers 和 Codex 分别应该做什么

- `Superpowers` 负责流程纪律: 需求澄清、设计、计划、代码审查、验证前置、子代理分工。
- `Codex` 负责仓库内落地: 读文档、改文件、生成代码、跑验证、回写文档。
- `AI 生图` 只负责探索视觉方向，不能直接作为生产级前端输入真相源。
- `Figma / 设计 token / screen states / component map` 才是 1:1 还原代码的真相源。

### 1.3 最关键的一条判断

**纯“图片 -> 前端代码”路径，适合原型，不适合直接进生产。**  
真正能接近 1:1 的路径是:

```text
需求文档
  -> 验收示例 + 追溯矩阵 + 测试数据 / 回归范围
  -> 页面/状态矩阵
  -> 设计 token + component map + screen states
  -> Figma / Code Connect / Storybook
  -> Codex 实现组件和页面
  -> visual regression / e2e 回归
```

### 1.4 这份手册现在按 `vb4.md` 的完整流程重排

`vb4.md` 给出的不是普通“研发阶段列表”，而是一套完整的 Agent Harness:

- 8 个前馈 Skill
- 4 类执行 Sub-Agent
- 6 类反馈 Hook / Sensor
- 两阶段 Code Review
- 反馈沉淀和规则进化

所以你后面看这份手册时，不要把它理解成单纯的“项目流程建议”，而要理解成:

```text
Guides: 先定义怎么做
  -> Builders: 再让 AI 去做
  -> Sensors: 做完马上检查
  -> Steering Loop: 把反复出现的问题升级成规则
```

## 2. GitHub 实践取样结论

这次只取对你目标最有用的 6 类 GitHub 实践，不做泛搜。

| 仓库 | 看的重点 | 对你的启发 |
| --- | --- | --- |
| `OpenHands/software-agent-sdk` | agent 可以跑在本地工作区，也可以跑在 ephemeral workspace；仓库里直接给了 GitHub workflow 示例 | AI 自动化不要只停在聊天。低风险、重复性高的任务可以直接变成 workflow |
| `Aider-AI/aider` | repo map 不是口号，而是压缩全仓库上下文的核心手段 | 大仓库里必须有 `repo-map`/`feature-pack` 这类中间上下文文件 |
| `figma/code-connect` | 把 Figma Dev Mode 里的代码片段替换成真实生产代码 | 设计转代码不该靠截图猜，而要靠设计组件与代码组件绑定 |
| `figma/sds` | Figma Variables、Styles、Components、Code Connect、Storybook、tokens 脚本放在同一仓库 | 真正可持续的 1:1 还原，依赖 token、组件、stories、设计文件一起维护 |
| `orval-labs/orval` + `stoplightio/prism` | OpenAPI 生成类型安全 client / mocks；mock server + validation proxy | 前后端并行开发前，先把 contract 固化，再生成 client 和 mock |
| `UiPath/apollo-ui` | 设计系统仓库里有 design tokens、Storybook、测试、Copilot instructions、visual regression 规则 | UI 的真相源不是一张图，而是组件库、tokens、stories、tests、instructions |

另一个必须单独说的仓库是 `abi/screenshot-to-code`:

- 它证明了“截图 / mockup / Figma -> 代码”这条路确实能跑。
- 它也反向证明了这条路天然更适合**原型和首稿**，因为生成结果仍然需要再走组件化、状态补齐、测试和重构。

## 3. 先把 `vb4` 的完整 Harness 映射成 `Superpowers + Codex` 版本

### 3.1 八个 Skill 的对应关系

| `vb4` 阶段 Skill | `vb4` 的职责 | 当前推荐实现 | 必须落盘的真相源 |
| --- | --- | --- | --- |
| `product-spec-builder` | 通过多轮追问把模糊想法收敛成 Product Spec | `Superpowers: brainstorming` + `docs/product/*` 模板 | `prd-lite.md`、`page-inventory.md`、`state-matrix.yaml`、`acceptance-criteria.md`、`ACCEPTANCE_EXAMPLES.md`、`TRACEABILITY_MATRIX.md` |
| `design-brief-builder` | 把“深色、极简”这种口头偏好量化成设计标准 | 设计 brief 文档 + 设计问题清单 | `design-brief.md`、视觉原则、交互原则 |
| `design-maker` | 直接在设计工具中产出页面原型图 | Figma MCP / 设计工具 + AI 生图做方向探索 | Figma 页面、关键组件、页面状态图 |
| `dev-planner` | 先调研技术栈，再拆 Phase 和 Task | `Superpowers: writing-plans` + feature plan | `DEV-PLAN.md`、`feature-pack.md`、`repo-map.md` |
| `dev-builder` | 按 Task 逐项编码，每项先编译验证再推进 | Codex + `codex-loop.ps1` / 任务队列 | task 文档、代码、测试、trace |
| `bug-fixer` | 四阶段系统调试，不猜不试 | `systematic-debugging` 思路 + bug fix workflow | 证据、假设、验证记录、修复说明 |
| `code-review` | 两阶段审查: 先 Spec 合规，再代码质量 | reviewer 会话 / code-review skill / PR 审查 | 审查记录、风险列表、缺口列表 |
| `release-builder` | 构建、打包、发布、回写发布信息 | verify + release checklist + workflow | 发布清单、回滚说明、验收报告 |

### 3.2 这 8 个 Skill 里，哪些是你当前最该补的

如果按 `vb4` 的完整顺序看，你当前 `.agents` 里已经比较强的是:

- `dev-planner`
- `dev-builder`
- `code-review`
- `部分 release / verification`

真正还不够落地的是前半段:

- `product-spec-builder`
- `design-brief-builder`
- `design-maker`

也就是说，你现在不是“后端或测试不够”，而是**需求与设计的前馈控制还不够重**。这正是用户前面感觉“还是太理想化”的根因。

## 4. `vb4` 最有价值的不是阶段，而是控制环

### 4.1 两阶段 Code Review 必须保留

`vb4` 里最值得直接继承的是“两阶段审查”:

1. Stage 1: 功能完整性
2. Stage 2: 代码质量

在你的链路里，建议固定成:

```text
Stage 1:
- 对照 Product Spec / Design Brief / 设计稿 / DEV-PLAN
- 看有没有漏功能、少状态、多实现、错优先级

Stage 2:
- 看命名、类型、安全、结构、测试缺口、回归风险
```

这两阶段不要合并。  
因为很多 AI 产物最先出的问题不是“代码丑”，而是“实现的东西根本不是 Spec 要的”。

### 4.2 Hook / Sensor 在 Codex 侧的对应实现

`vb4` 基于 Claude hooks，但你当前仓库主要跑在 Codex / PowerShell / `.agents` 上，所以要做等价映射，而不是照搬名字。

| `vb4` Sensor | 在 Codex / Hermes 侧的等价物 |
| --- | --- |
| `pre-commit-check` | `verify.ps1`、`test_command`、`git diff --check`、driver commit 前检查 |
| `auto-push` | GitHub Actions / 发布 workflow / 可选的推送脚本，不建议默认本地无脑自动 push |
| `stop-gate` | completion gate: 有代码变更但没审查、没验证，不允许结束 |
| `detect-feedback-signal` | 在 `feedback/` 或回顾文档里记录“用户反复纠正”的信号 |
| `mark-review-needed` | 代码文件变更后自动进入“待审查”状态；可由 task/progress/PR 检查承接 |
| `check-evolution` | session 开始时检查历史反馈、回归规则和待升级约束 |

结论不是“你一定要把 Hook 名字做出来”，而是**这些传感器背后的检查语义必须存在**。

### 4.3 Review -> Fix 闭环要自动，而不是靠人记

`vb4` 最对的一点是：  
不是“写完代码 -> 人想起来再去 review”，而是:

```text
实现
  -> Stage 1 review
  -> 不过就修
  -> Stage 2 review
  -> 不过就修
  -> verify
  -> 才允许完成 / 提交 / 发布
```

如果这条闭环不能自动推进，后面还是会退回到“AI 写一堆，人手动盯每一步”的老路。

### 4.4 Sub-Agent 隔离必须保留

`vb4` 里另一条很关键的规则是: **每个 Task 用全新实例，不继承前一任务的执行历史。**

这个在你当前 Codex 体系里同样成立:

- 一个 feature 可以有长期 DEV-PLAN
- 但每个 task 实现和审查，最好是 fresh session
- 允许共享的是结构化上下文
- 不允许共享的是上一轮的错误假设和聊天噪音

共享的应该是:

- Product Spec
- Design Brief
- 设计稿 / 组件映射
- DEV-PLAN
- 当前 task 的 `context_files`

不该共享的应该是:

- 上一轮失败的长聊天
- 大量无关 trace
- 与当前 task 无关的猜测过程

### 4.5 `vb4` 的设计优先级必须保留

`vb4` 有一条非常值钱的原则:

```text
设计稿 > Design Brief > Product Spec
```

也就是:

- 功能逻辑以 Product Spec 为准
- 视觉与交互优先级以设计稿为准
- Design Brief 是设计稿没写清时的补充标准

这条规则会直接影响 review:

- 如果设计稿里没有这个交互，代码加了，必须解释为什么
- 如果 Product Spec 改了 UI，设计稿没更新，应该阻断进入后续实现

### 4.6 `DEV-PLAN` 不是附属文档，而是跨 session 锚点

`vb4` 对 DEV-PLAN 的定位很准: 它不是普通计划，而是跨 session 继续开发的锚点。

对于 Codex 来说，这意味着:

- 新 session 不该从头猜项目状态
- Phase 开始时应该重新读 `DEV-PLAN`
- Task 开始时应该重新读当前 phase 的目标、交付物和限制

所以后面你如果继续沉淀模板，`DEV-PLAN` 应该成为一级入口，而不是“可有可无”。

## 5. 各阶段痛点与推荐打法

### 5.1 总览表

| 阶段 | AI 自动化可行性 | 最大痛点 | 推荐主模型 / 工具 | 必须落盘的文档/文件 | 进入下一阶段的闸门 |
| --- | --- | --- | --- | --- | --- |
| 需求分析 | 高 | 需求模糊、范围漂移 | `gpt-5.4`，`Superpowers: brainstorming` | `prd-lite.md`、`page-inventory.md`、`acceptance-criteria.md`、`state-matrix.yaml`、`ACCEPTANCE_EXAMPLES.md`、`TRACEABILITY_MATRIX.md` | 页面、角色、状态、验收标准和追溯入口不再口头化 |
| 需求到实施计划 | 高 | 任务切分粗，AI 一次吞太多 | `gpt-5.4` 或 `gpt-5.4-mini`，`Superpowers: writing-plans` | `feature-pack.md`、`repo-map.md`、feature plan、任务清单 | 每个 task 都能单会话完成 |
| AI 生图探索 UI | 中 | 只有正常态，没有异常态和结构 | `gpt-image-1.5` 或其他图像模型 | moodboard、风格参考、页面清单补充 | 只把图当参考，不把图当最终规范 |
| 设计规范化 | 高 | 从视觉稿到代码缺中间层 | Figma、Code Connect、SDS 思路、`gpt-5.4` 做设计 QA | `information-architecture.md`、`screen-states.md`、`component-map.md`、`design-tokens.json` | 每个页面的 default / empty / loading / error / disabled / mobile 都补齐 |
| 设计转前端代码 | 中到高 | 纯图片转代码不稳定；状态缺失；交互缺失 | Codex、`gpt-5.2-codex` 思路、Storybook、Code Connect | stories、组件实现、页面实现、视觉验收清单 | stories、typecheck、build、交互验收通过 |
| 后端设计与实现 | 高 | 接口漂移、错误码不一致、权限漏掉 | `gpt-5.4`、OpenAPI、Orval、Prism | `contracts/openapi.yaml`、错误码规范、DTO/Schema | client / mock / contract 三方一致 |
| 前后端联调 | 中到高 | 双方各写一份类型；本地环境不一致 | generated client、mock server、devtools MCP | 联调记录、异常态清单、真实接口映射 | 主要业务流和异常流跑通 |
| 测试与回归 | 高 | AI 不会主动补全测试矩阵 | Playwright、Storybook、Vitest、visual regression | `verify-matrix.md`、affected tests、P0/P1 regression、e2e-plan、unit/integration/e2e、visual baseline | 不是“能用”，而是 fresh evidence 和回归通过 |

## 6. 每一阶段到底怎么做

### 6.1 阶段 A: 需求分析与边界收敛

#### 主要痛点

- 用户需求会混着业务目标、页面想法、实现偏好、验收标准一起说。
- 如果这一阶段不强制结构化，后面每个 agent 都会自己脑补。
- 1 个人最容易在这里被 AI 带着越做越大。

#### 推荐打法

- 用 `Superpowers: brainstorming` 先把需求拆成单功能 spec，而不是直接让 Codex 写代码。
- 用高推理模型先做范围收敛，再用 Codex 只负责回写文档。
- 这一步不要急着画 UI，也不要急着写 API。
- 参考 `vb4`，这一步结束时应该有**面向 AI 的 Product Spec**，不是只给人看的需求摘要。

#### 推荐模型

- 主模型: `gpt-5.4`  
  OpenAI 当前模型总览建议默认从 `gpt-5.4` 开始，定位是复杂推理和编码的旗舰模型。
- 成本优化: `gpt-5.4-mini`  
  适合需求改写、文档补全、子任务拆分这类高频但较稳定的工作。

#### 最低输出物

- `docs/product/prd-lite.md`
- `docs/product/page-inventory.md`
- `docs/product/acceptance-criteria.md`
- `docs/product/state-matrix.yaml`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/TEST_DATA_MATRIX.md`
- `docs/testing/test-matrix.md`

#### 这一阶段的实操示例

```text
输入: “做一个企业工单后台，支持筛选、保存视图、批量分派、审计日志”

AI 第一轮输出不应该是代码，而应该是:
- 角色: 客服、主管、管理员
- 页面: 列表页、详情页、保存视图弹窗、批量操作抽屉
- 状态: 默认/空/加载/错误/无权限/长列表/移动端折叠
- 验收: 保存视图后刷新仍在；无权限用户看不到批量分派
```

如果这些验收示例、Requirement IDs 和追溯矩阵还没落盘，就不该进入 Design Brief、任务拆分或正式实现阶段。

### 6.2 阶段 B: AI 生图与设计探索

#### 主要痛点

- AI 生图只擅长“风格感”，不擅长精确布局、组件复用和状态全覆盖。
- 一张图里通常只有 happy path，没有 error / empty / disabled / responsive。
- 文本渲染、对齐、表格密度、业务组件一致性都容易失真。

#### 推荐打法

- 把 AI 生图定位为**视觉方向探索**，不是直接给前端开发的生产资产。
- 输出不应该只有图片，还要有“页面清单 + 状态缺口清单”。
- 每轮出图后，必须追问: 缺了哪些界面？缺了哪些状态？哪些元素必须组件化？
- 参考 `vb4`，这里应该先经过 `design-brief-builder`，再进入 `design-maker`，而不是直接从需求跳到出图。

#### 推荐模型

- 探索视觉方向: `gpt-image-1.5`
- 多轮修改: 用 Responses API 里的图像工具做迭代编辑，而不是每次全量重画

#### 必须补的文档

- `docs/design/information-architecture.md`
- `docs/design/screen-states.md`
- `docs/design/component-map.md`

#### 关键判断

如果你手上只有 AI 生成的 JPG/PNG，没有 token、没有状态矩阵、没有组件映射，那么这还不能进“前端实现”阶段。

### 6.3 阶段 C: 把视觉稿变成可编码设计规范

#### 主要痛点

- 开发拿到图，不知道哪些是组件、哪些是一次性布局。
- 设计稿里颜色、字号、间距、断点没有结构化表示。
- 同一个组件在多个页面上表现不一致，AI 容易越写越散。

#### 推荐打法

- 借鉴 `figma/sds` 的方式，把这一步拆成 4 份资产:
  - `design-tokens.json`
  - `component-map.md`
  - `screen-states.md`
  - Figma 与代码组件绑定
- 借鉴 `figma/code-connect` 的做法，让设计稿里看到的不是“自动生成 HTML”，而是真实的生产组件代码片段。

#### 最低输出物

- `docs/design/design-tokens.json`
- `docs/design/component-map.md`
- `docs/design/screen-states.md`
- `figma.config.json` 或等价的 Figma 到代码映射配置

#### 什么时候这一步算完成

- 每个页面都知道由哪些组件组成。
- 每个组件都知道有哪些状态。
- token 可被前端直接消费，而不是还要人工再翻译一次。
- 设计和代码之间存在“引用关系”，不是两套平行宇宙。

### 6.4 阶段 D: 设计稿 1:1 还原为前端代码

#### 三条路线的可行性判断

| 路线 | 可行性 | 适用场景 | 不适合什么 |
| --- | --- | --- | --- |
| 纯截图 / 纯图片 -> 代码 | 低到中 | 原型、首稿、探索版 demo | 生产级后台、复杂状态、多页面一致性 |
| Figma / 设计稿 -> 代码首稿 | 中 | 页面骨架、静态布局、首版组件 | 缺 stories、缺 tokens、缺交互定义时 |
| 设计 token + component map + screen states + Code Connect -> 代码 | 高 | 生产级、长期维护、多人协作 | 前期没有做结构化设计时 |

#### 实际推荐

1. 可以用 `screenshot-to-code` 这类工具先出第一版页面骨架。
2. 但第二步必须立刻把它拆回组件库、stories、tokens、状态矩阵。
3. 真正交给 Codex 实现时，输入应该是规范化设计，不是单张图片。
4. 真正发生冲突时，遵循 `vb4` 的优先级: 设计稿 > Design Brief > Product Spec。

#### 推荐模型 / 工具

- in-repo 实现: Codex
- 编码模型: `gpt-5.2-codex` 思路适合长链路 agentic coding；如果直接走 OpenAI 当前主线，也可以用 `gpt-5.4` / `gpt-5.4-mini`
- UI 组件真相源: Storybook + design tokens + component map
- 视觉绑定: Figma Code Connect

#### 前端阶段最低交付物

- `packages/ui/*` 或等价组件目录
- `stories/*.stories.tsx`
- 页面代码
- `docs/design/component-map.md` 回写
- 视觉验收 checklist

#### 这一阶段最常见的错误

- 只看默认态，不补 empty/loading/error
- 直接从图生成整页，不先抽组件
- 没有 stories，后续无法视觉回归
- 文本、表格、列表、弹窗全部硬编码

### 6.5 阶段 E: 后端与 contract-first

#### 主要痛点

- AI 同时写前后端时，最容易出现 contract 漂移。
- 错误码、分页、枚举、权限边界经常前后不一致。
- 联调阶段才发现字段名、类型、空值语义对不上。

#### 推荐打法

- 先让 AI 生成 `OpenAPI`，再生成 client、types、mock。
- 借鉴 `orval` 生成前端 client、hooks、mocks。
- 借鉴 `prism` 做 mock server 和 validation proxy。

#### 推荐模型

- 复杂 schema / error model 设计: `gpt-5.4`
- 大量 DTO/测试补全: `gpt-5.4-mini`

#### 最低输出物

- `contracts/openapi.yaml`
- `packages/api-client/*` 或等价 generated client
- `mocks/` 或 `prism` 配置
- 错误码 / 权限矩阵

#### 判断是否可以进联调

- 前端和后端都只围绕同一份 contract 工作。
- mock 场景可以覆盖正常、空态、异常、超时、无权限。
- generated client 已替代手写 API 调用。

### 6.6 阶段 F: 联调

#### 主要痛点

- 本地环境不一致。
- 前端还在调样式，后端还在调字段。
- 联调时才第一次跑完整业务流。

#### 推荐打法

- 先跑 mock 联调，再切真实后端。
- 生成 client 后，前端禁止再手写一套 request schema。
- 联调用 devtools MCP 或真实浏览器，不靠“代码看起来没问题”。

#### 最低交付物

- 联调清单
- 异常流清单
- 真实接口切换记录
- 与 contract 不一致的问题列表

### 6.7 阶段 G: 测试与回归

#### 主要痛点

- AI 生成代码后，很少主动补齐完整测试矩阵。
- 视觉回归最容易被省掉，结果“1:1”无法证明。
- 单元测得过，但真实页面交互仍然可能坏。

#### 推荐打法

- 组件层: stories + component tests
- 前端层: typecheck + build + Playwright
- 后端层: unit + integration + auth/permission tests
- 联调层: contract validation + e2e
- 视觉层: visual regression
- 参考 `vb4`，这一阶段不只是一轮“跑测试”，而是 `Review -> Fix -> Review -> Verify` 的闭环。
- Stage 17 / 最终 verify 只负责 fresh evidence、affected tests、P0/P1 regression 和契约/视觉确认，不负责第一次定义测试范围。

#### 最低输出物

- `docs/testing/verify-matrix.md`
- `docs/testing/RISK_BASED_TEST_PLAN.md`
- `docs/testing/REGRESSION_PLAN.md`
- `docs/testing/EVIDENCE_PROTOCOL.md`
- affected tests 清单和对应执行证据
- failure findings / repair 记录

#### 借鉴的 GitHub 实践

- `UiPath/apollo-ui` 的 `.github/copilot-instructions.md` 明确写了: library code 需要单测和 visual regression，demo 代码不需要。
- 这类做法非常适合你: 把“什么必须测、什么可以不测”写进仓库，让 AI 按仓库规则工作。

## 7. Superpowers 在这条链路里怎么用

### 7.1 推荐映射

| 阶段 | 推荐 Superpowers / 技能 |
| --- | --- |
| 需求澄清 | `brainstorming` |
| Design Brief 收敛 | 继续走 `brainstorming`，但输出转向视觉规则而不是业务规则 |
| 设计冻结后转实施 | `writing-plans` |
| 任务并行拆分 | `subagent-driven-development` |
| Bug 修复 | `systematic-debugging` |
| 实现后代码审查 | `requesting-code-review` |
| 收到评审意见后 | `receiving-code-review` |
| 验证交付前 | `verification-before-completion` |

### 7.2 正确使用姿势

- Superpowers 不应该替代产品文档、设计文档、contract 文档。
- 它负责的是“流程 discipline”，不是“业务真相源”。
- 真相源必须落在仓库文件里，并且被 Codex 读取。
- 如果要贴近 `vb4`，可以把它理解成: Superpowers 更接近 `Guides`，而 `.agents` driver / review / CI 更接近 `Sensors`。

## 8. 用 Codex 跑一个真实功能的示例

这里用“工单列表筛选与保存视图”举例。

### Step 1: 需求与状态

产出:

- `docs/product/prd-lite.md`
- `docs/product/page-inventory.md`
- `docs/product/state-matrix.yaml`
- `docs/product/acceptance-criteria.md`

最低要求:

- 页面: 列表、筛选条、保存视图弹窗
- 状态: default / empty / loading / error / dirty / permission denied

### Step 2: Design Brief + 设计规范

产出:

- `docs/design/design-brief.md`
- `docs/design/component-map.md`
- `docs/design/screen-states.md`
- `docs/design/design-tokens.json`

最低要求:

- 筛选条拆成可复用组件
- 表格列密度、按钮层级、筛选标签状态都被定义
- 保存视图弹窗的校验态明确

### Step 2.5: DEV-PLAN

产出:

- `plans/features/ticket-filter.dev-plan.md`

最低要求:

- Phase 划分明确
- 每个 Task 都能在 fresh session 中完成
- 明确哪些文件是上下文真相源

### Step 3: 前端施工

Codex 输入不应该是“按这张图做一个工单页”，而应该是:

```text
阅读:
- docs/product/prd-lite.md
- docs/product/state-matrix.yaml
- docs/testing/ACCEPTANCE_EXAMPLES.md
- docs/testing/TRACEABILITY_MATRIX.md
- docs/design/component-map.md
- docs/design/screen-states.md
- packages/ui/*

只实现:
- 列表页筛选条
- 保存视图弹窗

必须补:
- 对应 Requirement IDs 的测试映射
- 对应 stories
- typecheck / build / e2e 验证
```

### Step 4: 后端与 contract

产出:

- `contracts/openapi.yaml`
- generated client
- mock server 配置

接口至少包括:

- `GET /ticket-views`
- `POST /ticket-views`
- `GET /tickets`

### Step 5: 联调与回归

最低验证:

- `typecheck`
- `lint`
- `build`
- 组件 stories
- e2e: 创建视图、应用视图、无权限失败
- visual: 列表页、空态、弹窗

还要补一条 `vb4` 风格的闭环:

```text
实现完成
  -> Stage 1: 对照 Product Spec / 设计稿审查
  -> 修复偏差
  -> Stage 2: 对照代码质量 / 测试缺口审查
  -> 修复问题
  -> affected tests + verify + fresh evidence
```

## 9. 这一套方案的可行性边界

### 9.1 高可行

- 后台系统
- SaaS 管理端
- 表单流
- 审批流
- 数据看板
- 标准 CRUD

### 9.2 中可行

- 复杂交互的专业工具
- 图形编辑器
- 带大量自定义画布的应用

### 9.3 低可行

- 只靠 AI 生图，直接做高精度生产前端
- 没有设计系统、没有状态矩阵、没有 contract，就要求 AI 一次做完整工程

## 10. 对你当前仓库最有价值的落地动作

下面这些基础模板已经补进 `templates/`：

- `templates/design/design-brief.md`
- `templates/context/dev-plan.md`
- `templates/docs/spec-to-ui-to-code-workflow.md`
- `templates/testing/ACCEPTANCE_EXAMPLES.md`
- `templates/testing/TRACEABILITY_MATRIX.md`
- `templates/testing/verify-matrix.md`
- `templates/contracts/openapi.yaml`
- `templates/contracts/orval.config.ts`
- `templates/contracts/prism-usage.md`
- `templates/prompts/review-stage1-spec.md`
- `templates/prompts/review-stage2-quality.md`
- `templates/governance/feedback-evolution-loop.md`

在这个基础上，如果你现在要继续沉淀到 `hermes/.agents`，下一步最值得补的是:

1. 把 `templates/product/*`、`templates/design/*`、`templates/context/*` 串成一个标准前置阶段工作流。
2. 新增 UI 交付检查表，强制页面状态和 visual regression 成为闸门。
3. 让 driver / CI 真正消费 Stage 1 / Stage 2 review 模板，而不是只把模板放在仓库里。
4. 把 feedback / evolution loop 接到实际 session 启动检查或回顾流程里。
5. 把 `spec-to-ui-to-code` 与 `contracts/*` 模板进一步接进具体示例项目，而不是只停留在模板层。

## 11. 推荐默认选型

基于 OpenAI 当前公开模型页和你这个单人项目场景，推荐默认配置如下:

| 用途 | 推荐 |
| --- | --- |
| 复杂需求分析 / 方案评审 | `gpt-5.4` |
| 高频文档改写 / 子任务拆分 / 批量补测试 | `gpt-5.4-mini` |
| Codex 式长链路编码 | Codex + `gpt-5.2-codex` 思路，或直接使用当前 Codex 默认编码模型 |
| UI 视觉探索 | `gpt-image-1.5` |
| UI 代码首稿 | Codex + 结构化设计输入，不建议纯图片直转生产代码 |

## 12. 参考链接

### OpenAI 官方

- Models overview: https://developers.openai.com/api/docs/models
- GPT-5.4: https://developers.openai.com/api/docs/models/gpt-5.4
- GPT-5.4 mini: https://developers.openai.com/api/docs/models/gpt-5.4-mini
- GPT-5.2-Codex: https://developers.openai.com/api/docs/models/gpt-5.2-codex
- Image generation guide: https://developers.openai.com/api/docs/guides/image-generation

### GitHub 实践

- OpenHands SDK: https://github.com/OpenHands/software-agent-sdk
- Aider: https://github.com/Aider-AI/aider
- Figma Code Connect: https://github.com/figma/code-connect
- Figma SDS: https://github.com/figma/sds
- screenshot-to-code: https://github.com/abi/screenshot-to-code
- Orval: https://github.com/orval-labs/orval
- Prism: https://github.com/stoplightio/prism
- UiPath Apollo UI: https://github.com/UiPath/apollo-ui
