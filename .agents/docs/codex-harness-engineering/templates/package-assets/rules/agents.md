---
trigger: always_on
---

# 通用 Agent 编排规则

## 作用范围

本文件定义跨项目可复用的 agent 角色、阶段映射和派发规则。这里的 `agent` 是职责角色，不一定要求每个角色都有独立进程；主控可以通过以下三种方式执行角色：

- 通过 `.codex/agents/*.toml` 调起只读辅助子代理或 scoped writer 子代理。
- 复用现有 skill，例如 `prd-writer`、`architect`、`frontend-design`、`api-design`、`tdd-guide`、`code-reviewer`。
- 在当前主控会话中按该角色的规则完成窄范围分析，但主控会话只做分析和路由，不直接写仓库文件。

如果某个阶段没有项目专属 agent，按本文的“阶段到默认 Agent 映射”选择默认角色。

## 角色清单

| Agent Role | 主要职责 | 推荐技能 / Prompt | 何时使用 |
| --- | --- | --- | --- |
| `controller` | 主控、阶段推进、任务排序、合并决策 | `controller-loop.md` | 全流程常驻，不直接写仓库文件 |
| `bootstrap-operator` | 新项目接入、模板复制、smoke、环境检查 | `project-setup`, `bootstrap-codex-harness.ps1` | Stage 01 初始化 |
| `product-analyst` | 需求分析、PRD、用户角色、业务规则、验收标准和可执行验收示例 | `prd-writer`, `business-rule-spec`, `requirements-design-template` | Stage 02 需求收敛 |
| `requirements-trace-analyst` | 需求到页面、状态、字段、接口、测试的追溯 | `consistency-checklist`, `spec-review` | Stage 03 追溯矩阵和缺口分析 |
| `architect` | 架构边界、数据流、模块拆分、技术风险 | `architect`, `api-design`, `data-flow-spec` | 架构、契约、跨模块影响和高风险决策 |
| `design-lead` | 设计规范、信息架构、组件规则、视觉 token | `frontend-design`, `ui-ux-pro-max`, `brand-design-md` | Stage 04 设计规范和复杂 UI 决策 |
| `image-prompt-writer` | AI 生图 brief、页面状态、禁止事项、参考图要求 | `ai-ui-prompts` | Stage 05 生图输入 |
| `ui-image-reviewer` | 设计图是否满足 PRD 和 Design Brief | `frontend-design`, `spec-based-review` | Stage 07 UI Image Review |
| `frontend-spec-writer` | 把设计图翻译成组件、状态、事件、测试选择器和视觉断言 | `frontend-first-workflow`, `page-spec-template` | Stage 08 Image To Frontend Spec |
| `planner` | DEV-PLAN、任务拆分、依赖、验证顺序 | `planner`, `plan` | 实施计划和任务拆解 |
| `harness-writer` | `AGENTS.md`、任务队列、控制面配置、hook、prompt、harness 文档等编排资产写入 | `harness-writer.md` | 主控遇到非 driver 编排写入时 |
| `frontend-worker` | 前端页面、组件、样式、stories、前端测试 | `frontend-patterns`, `typescript`, `vue-arco` 或项目栈技能 | 前端实现 |
| `visual-reviewer` | 浏览器截图和设计图对比、视觉还原报告 | `browser-e2e-testing`, `midscene-fix-review` | Visual Parity |
| `contract-designer` | OpenAPI、mock、client 生成、字段和错误码契约 | `api-contract-template`, `api-design` | Contract First |
| `backend-worker` | API、数据库、权限、异常流、后端测试 | `backend-patterns`, `database`, 项目后端技能 | 后端实现 |
| `integration-worker` | 前后端联调、mock 切真实服务、主流程 E2E | `api-integration`, `fullstack-workflow` | Integration |
| `test-planner` | 从需求阶段开始定义可测试需求、验收示例、追溯矩阵、测试数据、分层测试计划和证据路径 | `qa-e2e-planner`, `test-coverage`, `tdd` | 测试设计与测试左移 |
| `test-runner` | 运行确定性验证、汇总失败、写测试报告 | `e2e-runner`, `qa-e2e-runner`, `verify` | Verify / Regression |
| `stage1-reviewer` | 产品、设计、计划一致性审查 | `spec-based-review`, `spec-review` | Stage 1 Review |
| `stage2-reviewer` | 代码质量、测试覆盖、回归风险审查 | `code-reviewer`, `security-reviewer` | Stage 2 Review |
| `failure-triage` | 失败归因、owner 分类、Repair Queue | `build-error-resolver`, `failure-triage.md` | 测试、构建、视觉或 review 失败后 |
| `repair-worker` | 按 finding 定点修复并复验 | 原开发 agent + `repair-one-finding.md` | 修复闭环 |
| `docs-worker` | 文档、索引、使用指南、模板同步 | `doc-updater`, `update-docs` | 文档更新和交付归档 |
| `security-reviewer` | 权限、认证、支付、密钥、敏感数据和 sandbox 风险 | `security-reviewer`, `security-review` | 高风险功能 |
| `release-manager` | diff 检查、验证证据、提交、push、最终报告 | `auto-commit`, `git-workflow` | 合并、提交和交付 |

## 阶段到默认 Agent 映射

| 阶段 | 主责 Agent | 协作 Agent | 说明 |
| --- | --- | --- | --- |
| 01 初始化 | `bootstrap-operator` | `docs-worker` | 接入模板、检查 Git、跑 smoke |
| 02 需求收敛 | `product-analyst` | `requirements-trace-analyst`, `test-planner` | 把聊天需求转成 PRD、页面清单、状态矩阵、验收标准和可执行验收示例；所有 P0/P1 需求必须通过需求可测试性检查 |
| 03 追溯与难点预研 | `requirements-trace-analyst` | `test-planner`, `architect` | 建立需求到 UI/API/数据/状态/测试/证据的追溯矩阵，识别高风险路径和测试数据缺口 |
| 04 Design Brief | `design-lead` | `product-analyst` | 把主观审美变成可编码设计规则 |
| 05 AI Image Brief | `image-prompt-writer` | `design-lead` | 生成稳定的 AI 生图输入 |
| 06 UI 设计图 | `design-lead` | `image-prompt-writer` | 生成或编辑页面多状态参考图 |
| 07 UI Image Review | `ui-image-reviewer` | `product-analyst`, `design-lead` | 设计图不通过时回到上一步 |
| 08 Image To Frontend Spec | `frontend-spec-writer` | `frontend-worker`, `test-planner`, `visual-reviewer` | 把图片元素映射到组件、数据、事件、状态、测试选择器、视觉断言和 E2E 场景 |
| 09 DEV-PLAN / 任务拆分 | `planner` | `controller`, `architect`, `test-planner` | 生成依赖、owned paths、验证顺序和真实任务；每个任务都要携带测试层级、验证命令和证据路径 |
| 10 Frontend Build | `frontend-worker` | `test-planner` | 先对照验收示例和前端测试规格实现，再输出最小相关测试和证据 |
| 11 Visual Parity | `visual-reviewer` | `frontend-worker` | 除视觉还原外，还检查状态覆盖和关键交互可用性；失败后由原 frontend worker 修 |
| 12 Contract First | `contract-designer` | `architect`, `backend-worker`, `frontend-worker`, `test-planner` | 先定义 OpenAPI、错误码、mock 和契约测试，再进入后端实现 |
| 13 Backend / API | `backend-worker` | `contract-designer`, `test-planner` | 按契约实现 API、数据和权限 |
| 14 Integration | `integration-worker` | `frontend-worker`, `backend-worker`, `test-runner` | mock 切真实接口，跑主流程 |
| 15 Stage 1 Review | `stage1-reviewer` | `product-analyst`, `design-lead` | 审实现是否符合产品、设计和计划 |
| 16 Stage 2 Review | `stage2-reviewer` | `security-reviewer`, `test-planner` | 审代码质量、测试缺口和风险 |
| 17 Verify / Regression | `test-runner` | `controller`, `test-planner` | 运行 fresh evidence、affected tests、P0 regression 和契约验证；不得在本阶段第一次补齐需求测试范围 |
| 18 修复闭环 | `failure-triage` | `repair-worker`, 原 reviewer/tester | 归因、派修、复验 |
| 19 合并 / 提交 / Push | `release-manager` | `controller`, `docs-worker` | 只合并本任务改动，提交前检查 diff 和证据 |

## 路由规则

1. 需求分析阶段默认使用 `product-analyst`，不是 `frontend-worker`、`backend-worker` 或 `test-runner`。
2. 需求追溯阶段默认使用 `requirements-trace-analyst`，测试映射由 `test-planner` 协作。
3. 架构、契约、数据流、权限、支付、安全、迁移等高风险问题必须加入 `architect` 或 `security-reviewer`。
4. UI 相关链路按 `design-lead -> image-prompt-writer -> ui-image-reviewer -> frontend-spec-writer -> frontend-worker -> visual-reviewer` 顺序推进。
5. 实现失败由原实现 agent 修复；评审或测试失败由提出 finding 的原 reviewer/tester 复验。

## 并行规则

- Stage 02-08 以真相源稳定为主，可以并行调研，但不能让多个 agent 同时改同一份 PRD、Design Brief 或视觉规格。
- 同一时刻不要让多个角色写同一组可写路径。
- 任何并行结论都必须回到 `task.json`、验证命令和证据路径上，不接收口头“已完成”。

## 子代理前置读取规则

- 任何只读辅助子代理或 writer 子代理在开始判断前，必须先读 `AGENTS.md`、`docs/harness/task-session-strategy.md` 和本文件。
- 子代理必须再读取该角色对应的 `.agents/skills/*/SKILL.md`（如存在）、项目 truth source 和必要的深文档，再输出结论。
- 如果当前轮次是被 stop hook / continuation gate 强制继续后的续跑，先重新阅读上面这些文档，再决定是否真的需要子代理。
- 只读辅助子代理默认只读，不直接写业务代码，不修改 `task.json`、`progress.txt`、`traces/`。
- writer 子代理只能修改父会话明确分配的路径；主控会话自身不直接写仓库文件。
- `progress.txt`、`traces/` 和 Git 状态默认仍由 runtime 脚本处理；除这些脚本产物外，仓库写入必须通过匹配的 writer 子代理落盘。

## 模型和思考深度

- `product-analyst`、`requirements-trace-analyst`、`architect`、`design-lead`、`visual-reviewer`、`stage1-reviewer`、`stage2-reviewer` 默认使用更强模型和较高思考深度。
- `frontend-worker`、`backend-worker`、`integration-worker` 默认使用工作型模型，中高思考深度。
- `docs-worker`、`test-runner` 可以使用较低成本模型，但失败归因和最终验收不得只靠低强度判断。

## 交接格式

```markdown
Verdict: PASS | FAIL | BLOCKED
Role: <agent-role>
Stage: <stage-id>
Report: <relative/path/to/report.md>
Changed paths:
- <path>
Verification:
- <command> -> PASS | FAIL | NOT_RUN
Open issues:
- <issue or none>
Next recommended stage: <stage-id>
```
