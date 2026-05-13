# Codex Agent Roles

## 当前定位

Hermes 当前偏向项目级主控中心，强调 `task.json`、PowerShell driver、验证证据和 staged delivery。主控负责调度和路由，不直接写仓库文件；子代理分成只读辅助角色和可写 worker 角色。

## 原则

- 角色用于帮助拆解职责，不自动创建额外执行工作区。
- 主控仍是唯一调度者，但不是写入者；凡是需要落盘的非 driver 内容，都必须委派给匹配的 writer 子代理。
- 只读辅助子代理通过 `.codex/agents/*.toml` 注册，适用于调研、规划、评审和失败归因。
- 可写 worker 子代理通过 `.codex/agents/*.toml` 注册，适用于规则、任务队列、文档、前端、后端和测试相关写入。
- 任何子代理开始前都要先读 `AGENTS.md`、`docs/harness/task-session-strategy.md`、`.agents/rules/agents.md` 和对应 `.agents/skills/*/SKILL.md`（如存在）。
- 涉及需求、实现或验证的任务，额外优先读取 `docs/testing/ACCEPTANCE_EXAMPLES.md`、`docs/testing/TRACEABILITY_MATRIX.md` 和 `docs/testing/verify-matrix.md`。
- 只读辅助子代理不直接写业务代码，只返回结构化结论和证据路径。
- 业务实现优先走 `task.json` + `codex-loop.ps1` 的单任务流程；主控侧的规则、文档、任务队列和控制面改动优先走 `harness-writer` 或 `docs-worker`。

## 推荐写入路由

- `harness-writer`：`AGENTS.md`、`task.json`、`.codex/*`、`.agents/rules/*`、`docs/harness/*`、hook、prompt、runtime policy 等编排资产。
- `docs-worker`：README、使用指南、spec、plan、设计说明、交付文档等人类文档。
- `frontend-worker`：页面、组件、样式、前端测试和视觉资产。
- `backend-worker`：API、数据模型、校验、权限和后端测试。
- `test-runner`：affected tests、fresh evidence、测试报告和 failure findings 整理。
