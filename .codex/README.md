# Codex Control Surface

本目录是 Codex Harness 的项目级控制面模板。安装到目标项目后，它会成为目标项目的 `.codex/` 配置目录。

## 文件职责

- `config.toml`: Codex 项目配置、少量稳定子代理注册、profile 模板。
- `hooks.json`: Codex lifecycle hooks 增强层。driver 仍以 PowerShell 脚本为主链路。
- `task-run-profile.json`: `codex-loop.ps1` 读取的任务会话、子代理和工作区策略。
- `agents/`: 少量可长期复用的辅助角色，包含只读分析角色和 scoped writer roles。
- `prompts/`: driver、worker-role、review、failure triage 使用的提示词模板。

## Agent 边界

`agents/` 只放高价值、低耦合的辅助角色。不要把 `skills/ecc-agent-*` 全量注册进这里。
所有子代理在输出结论或开始写入前，都必须先阅读：

- `AGENTS.md`
- `docs/harness/task-session-strategy.md`
- `.agents/rules/agents.md`
- 当前任务相关的 truth source
- 对应的 `.agents/skills/*/SKILL.md`（如存在）或项目深文档

当前包内推荐并已注册的只读辅助子代理是：

- `explorer`: 只读探索和证据收集。
- `readonly-research`: 通用只读调研与证据归纳。
- `reviewer`: correctness、regression、missing tests 审查。
- `docs-researcher`: API、框架行为和文档事实核验。
- `planner`: 实施计划、依赖和验证顺序梳理。
- `architect`: 架构边界、数据流、集成风险分析。
- `stage1-reviewer`: 规格一致性审查。
- `stage2-reviewer`: 代码质量和回归风险审查。
- `security-reviewer`: 安全专项审查。
- `test-planner`: 测试矩阵和证据路径规划。
- `failure-triage`: 失败归因和 owner 分类。
- `visual-reviewer`: UI 截图、设计稿和视觉回归审查。

当前包内推荐并已注册的 writer 子代理是：

- `harness-writer`: 规则、任务队列、控制面配置、hook、prompt 和 harness 文档资产写入。
- `docs-worker`: README、使用指南、spec、plan 和交付文档写入。
- `frontend-worker`: 前端页面、组件、样式和前端测试写入。
- `backend-worker`: API、数据模型、校验、权限和后端测试写入。
- `test-runner`: 验证证据、测试报告和 failure findings 写入。

执行型工作仍应优先走 `task.json` + `codex-loop.ps1` 的单任务 driver 流程。只有当 controller / 主会话遇到非 driver 的落盘任务时，才转给匹配的 writer 子代理；reviewer、researcher、planner 之类角色仍保持只读。

## Profile 使用

包内 `profiles.*` 是安装后的推荐配置模板，不保证 `codex -C <path> -p <profile>` 在所有调用场景都会自动读取项目 `.codex/config.toml`。

更稳的方式是：

- 使用全局稳定 profile，例如 `yolo`。
- 通过启动命令显式传 `-m <model>`。
- 通过 `-c model_reasoning_effort="<effort>"` 显式传思考强度。

## MCP 边界

不要把需要真实 token 的 MCP 服务直接写入 active config。需要 GitHub、Figma、Browserbase、Firecrawl 等服务时，先确认环境变量，再按项目需要启用。
