# Speckit Requirements Gate

本文件固化“模糊需求先澄清，再进入 spec / plan / task”的项目流程。

## 1. 目标

避免把 Agent 的推测写成项目真相源。用户只给出愿景、方向或不完整需求时，主会话必须进入 Speckit 需求澄清模式，而不是直接创建业务文档、测试矩阵或 `task.json` 实现任务。

## 2. 触发条件

满足任一条件即触发：

- 用户只给出一句高层需求，例如“做一个跨端宠物商城 App”。
- 平台、技术约束、MVP 范围、用户角色、核心流程、数据源或验收标准缺失。
- 存在多个合理方向，且不同选择会影响页面、架构、测试或任务拆分。
- 用户没有明确说明这是“先做原型 / spike / demo”，还是要按既定系统、既定开源栈和真实环境做正式集成。
- 用户表达“先看看方案”“帮我规划”“需求还没想清楚”等探索意图。

## 3. 清晰度分级

| Level | 判定 | 允许动作 | 禁止动作 |
| --- | --- | --- | --- |
| `CLEAR` | 平台、范围、角色、主流程、数据源、验收标准都明确 | 运行 `speckit-specify`，进入 spec 验证和 plan | 跳过 spec 直接写实现任务 |
| `PARTIAL` | 大方向明确，但仍有少量不影响主路径的缺口 | 生成 spec 草案，保留最多 3 个 `[NEEDS CLARIFICATION]` | 把草案同步成正式项目 docs |
| `AMBIGUOUS` | 需求只有愿景或存在多个合理产品方向 | 进入 `speckit-clarify`，一次只问一个高影响问题 | 创建业务 docs、测试矩阵或 `task.json` 实现任务 |
| `CONFLICTING` | 用户描述中存在互相冲突的目标、范围或约束 | 先让用户裁决冲突点 | 使用 Agent 假设消解冲突 |

## 4. 必须使用的 Skill

- `speckit-specify`: 从自然语言需求生成 feature spec 草案，允许最多 3 个 `[NEEDS CLARIFICATION]`。
- `speckit-clarify`: 在进入 plan 前识别关键不确定点，一次只问一个问题，最多 5 个高影响澄清问题，并把答案写回 spec。
- `speckit-plan`: 只有 spec 已确认且关键澄清完成后才能使用，用于技术计划与设计产物。

## 5. Speckit 产物边界

Speckit 产物和项目 Harness 产物必须分层：

- `specs/<feature>/spec.md`: 需求草案和用户确认后的 feature spec。
- `specs/<feature>/plan.md`: 技术计划和研究结论。
- `specs/<feature>/research.md`: 主控自动查找的最佳实践、技术选择依据和替代方案。
- `specs/<feature>/data-model.md` / `contracts/` / `quickstart.md`: plan 阶段派生设计产物。
- `docs/product/*`、`docs/design/*`、`docs/testing/*`、`docs/context/*`: 只有用户确认 spec / plan 后，才允许从 Speckit 产物同步出的正式项目真相源。

草案 spec 不得直接作为 driver 真相源。只有用户确认后的 spec / plan，以及由其同步出的项目 docs，才能进入 `task.json.context_files`。

## 6. 允许与禁止

允许：

- 输出澄清选项。
- 给出推荐选项及理由。
- 维护临时草案或明确标注 `[NEEDS CLARIFICATION]` 的 spec。
- 在用户回答后更新 spec 草案。
- 在进入 `/speckit.plan` 前，先锁定当前 feature 的交付模式：`prototype` / `spike` / `integration` / `production`。

禁止：

- 在用户确认前创建 `docs/product/*`、`docs/design/*`、`docs/context/*` 作为正式真相源。
- 在用户确认前把测试矩阵填成具体业务需求。
- 在用户确认前新增 `task.json` 代码实现任务。
- 把技术栈、页面范围、支付方式、后端模式等主观推测伪装成用户已确认需求。
- 当需求里明确提到既定开源栈、外部系统或真实环境时，未获用户明确降级前，不得把本地 mock / sample adapter / 假数据方案当成正式集成默认值。

## 7. 标准交互格式

每次只问一个高影响问题。多选问题使用以下格式：

```text
**Recommended:** Option A - 选择它的原因。

| Option | Choice | Impact |
| --- | --- | --- |
| A | 推荐方案 | 影响说明 |
| B | 替代方案 | 影响说明 |
| C | 替代方案 | 影响说明 |
```

如果需要一次性给用户预览全局选项，只能作为“下一步会逐项确认的选项地图”，不能视为已确认答案。

## 8. 用户确认语义

只有以下表达或同等明确授权，才视为用户确认 spec / plan：

- “确认”
- “按这个执行”
- “进入下一步”
- “生成任务”
- “跑 driver”
- “开始实现”

以下表达不视为确认：

- “看起来不错”
- “继续聊聊”
- “可以参考”
- “再完善下”
- “还有没有问题”

如果确认语义不明确，主会话只允许继续完善 spec / plan，不得生成 `task.json` 实现任务。

## 9. 交付模式锁定

在 `/speckit.plan` 之前，必须把当前 feature 明确归入以下其中一种模式，并写入 `spec.md`：

- `prototype`: 目标是本地原型或可演示界面，不承诺真实外部依赖已接通。
- `spike`: 目标是探索性验证，用来缩小不确定性，不承诺正式需求完成。
- `integration`: 目标是按既定开源栈、既定平台或真实下游完成集成。
- `production`: 目标是正式交付，除真实集成外，还要满足生产级验证、证据和回归要求。

锁定规则：

- 只要用户明确提到既定开源栈、既有平台、第三方系统、真实 endpoint、RBAC、dashboard/panel、报警链路或环境接入，默认按 `integration` 理解，除非用户明确说“先只做原型 / demo / exploratory”。
- `prototype` / `spike` 路径可以创建 `PROTO-*`、`SPIKE-*`、`INTEGRATION-*` 类交付，不得直接冒充正式 `FR-*` 完成。
- `integration` / `production` 路径必须在 `plan.md` 里补齐开源项目复用矩阵、connector 边界、前置阻塞 `TBD-*`、证据文件路径和验证分层，缺一不可。

## 10. Spec 确认后的自动补齐规则

用户确认 spec 后，后续问题默认不再回问用户。主控必须自动查找最佳实践、官方文档、项目约束和现有代码，补齐技术计划、设计细节、测试矩阵和任务拆分。

为节省主控上下文，自动补齐不得默认由主控单线程完成。主控必须把 research、技术选型比较、测试规划、设计细化、审查和失败归因等上下文密集工作委派给子代理或拆成 driver 任务；主控只接收结构化摘要、决策依据、文件路径和验证命令。

自动补齐优先级：

1. 已确认的 `specs/<feature>/spec.md`。
2. 用户在 Clarifications 中给出的答案。
3. 项目规则：`AGENTS.md`、`docs/harness/*`、`.codex/task-run-profile.json`。
4. 已存在代码、配置和测试约定。
5. 官方文档、框架最佳实践和安全/可访问性通用规范。

只有以下情况允许重新询问用户：

- 需要业务裁决，且多个选择会改变产品范围或收费/合规/品牌承诺。
- 需要真实外部凭据、账号、密钥、支付商户号或第三方服务授权。
- 用户之前确认的 spec 与后续新增要求发生冲突。
- 自动查到的最佳实践之间存在重大取舍，且取舍会影响用户业务目标。

如果只是技术实现细节、目录结构、测试工具、默认 UI 状态、错误处理策略或工程最佳实践，主控应自行决策并在 `research.md` / `plan.md` 中记录依据。

推荐委派边界：

- `readonly-research`: 官方文档、框架最佳实践、安全/可访问性通用规范。
- `requirements-trace-analyst`: spec 到页面、状态、数据、验收的追溯。
- `test-runner` / `test-planner`: test matrix、E2E plan、seed data、failure triage。
- `visual-reviewer` / `design-lead`: design brief、component map、screen states、visual parity plan。
- `stage1-reviewer` / `stage2-reviewer`: spec 一致性和质量门禁。

子代理只返回高密度结果，不返回完整阅读材料。主控不得把子代理的完整 transcript 重新塞回主上下文。

## 11. 跳过澄清与原型例外

如果用户要求跳过澄清，必须在回复和 spec 中记录：

- 用户选择跳过澄清。
- 哪些高影响问题仍未确认。
- 后续实现可能返工的范围。

跳过澄清后只能创建 `spike` / `prototype` / `exploratory` 类任务，不能创建 production-ready 实现任务，除非用户明确接受范围不稳定和返工风险。

如果用户明确说“直接做原型 / 先出 demo / 不要问”，允许进入原型路径，但任务必须标注：

- `task_kind`: `prototype` 或 `spike`
- `gate_profile`: `exploratory`
- acceptance 中明确“不代表生产范围已确认”
- 不得把演示型 deliverable 直接记为正式 `FR-*` 完成；要么改成 `PROTO-*` / `SPIKE-*` / `INTEGRATION-*`，要么明确记录哪些 `FR-*` 仍处于未完成集成态

## 12. Demo-first 默认路径

对有界面、流程或客户演示价值的产品，用户确认 spec / plan 后默认走 Demo-first 路径：

1. 先完成 `ANALYSIS-001`，把 P0/P1 需求映射到页面、状态、数据和验收。
2. 再完成 `DESIGN-001` 和 `DESIGN-ASSET-001`，把界面规格、状态矩阵和 UI 参考图落成可编码真相源。
3. `PLAN-001` 必须先锁定 `DEMO-001` 的范围、运行命令、mock 数据边界和人工介入点。
4. `DEMO-001` 用 mock 数据跑通可点击体验，记录启动命令、访问地址、已知问题和不接真实环境的边界。
5. 正式 foundation / domain / verify 任务必须依赖 `DEMO-001`，不能跳过 Demo 直接进入后端、支付、推送、真实登录或生产级部署。

`DEMO-001` 通过不代表生产就绪。它只证明核心流程能被用户体验和评审；真实接口、真实支付、真实设备、上架审核、安全合规仍要在后续正式任务中验证。

## 13. 写入 task.json 前检查

生成真实实现任务前必须全部满足：

- `specs/<feature>/spec.md` 存在。
- spec 中无会影响范围、架构、测试或 UX 的未解决 `[NEEDS CLARIFICATION]`。
- 用户确认语义明确，或已记录跳过澄清的风险和原型降级。
- `speckit-plan` 已生成 plan / research，或项目 docs 中已有等价技术计划。
- 正式项目真相源已从确认后的 spec / plan 同步。
- P0/P1 需求已映射到页面、状态、数据、验收和测试。
- 对既定开源栈或外部系统的需求，已明确锁定 `prototype` / `spike` / `integration` / `production` 模式。
- 若模式为 `integration` / `production`，`plan.md` 已包含开源项目复用矩阵、前置阻塞 `TBD-*`、connector 分层和证据路径。
- `task.json` 新任务只引用确认后的 truth sources。
- 对 UI / App / Web / 小程序 / 客户演示类项目，任务队列包含 `DEMO-001`，且正式实现任务依赖它。

## 14. 状态流转

```text
模糊需求
  -> 读取 speckit-specify / speckit-clarify skill
  -> 判定 CLEAR / PARTIAL / AMBIGUOUS / CONFLICTING
  -> 识别缺口与高影响决策
  -> 若涉及既定 OSS / 外部系统，先锁定 prototype vs real integration
  -> 一次一个问题收集用户选择
  -> 更新 specs/<feature>/spec.md 与 Clarifications
  -> 用户确认 spec
  -> 主控委派子代理查找最佳实践并执行 speckit-plan
  -> 从确认后的 spec / plan 同步项目设计与测试文档
  -> 先写入 Demo-first 队列并跑通 DEMO-001
  -> 写入 task.json
  -> codex-loop.ps1
```

## 15. 完成标准

进入 `task.json` 前必须满足：

- spec 中没有会影响范围、架构、测试或用户体验的未解决 `[NEEDS CLARIFICATION]`。
- 用户已明确确认 spec 或明确接受跳过澄清的返工风险。
- P0/P1 需求能映射到页面、状态、数据、验收和测试。
- plan 已说明技术栈、验证命令、依赖和任务边界。
- 若需求涉及既定开源栈或真实外部系统，spec 已锁定交付模式，plan 已补齐复用矩阵、阻塞项和证据路径。
- 若项目有界面或客户演示价值，任务队列已明确 Demo-first 依赖：`DESIGN-ASSET-001` -> `PLAN-001` -> `DEMO-001` -> 正式实现。
