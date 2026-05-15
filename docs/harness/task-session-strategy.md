# Task 会话策略

## 默认策略

- 每个任务默认使用 fresh process。
- 子代理默认采用 guided 模式；主控 / 主会话不直接写仓库文件。
- 当前版本只支持单任务 driver，不提供额外执行工作区。
- runtime 脚本会继续负责 `progress.txt`、`traces/` 和 Git 状态推进；除此之外的仓库写入由匹配的 writer 子代理执行。

## 运行模式边界

| 模式 | 触发方式 | 边界 |
| --- | --- | --- |
| driver 自动执行模式 | `codex-loop.ps1` 从 `task.json` 选择任务 | 外层 runtime 负责任务推进、验证、trace 和 commit |
| single task | 内层 `codex exec` 处理当前任务 | 只处理当前任务直接要求的代码或文档改动 |
| 交互开发模式 | 人工要求分析、规划、创建任务或实现功能 | 负责收敛输入；需要落盘时委派 writer 或转成 driver 任务 |

交互开发模式在 spec / plan 明确后，默认下一步是初始化真实 `task.json` 并运行 `codex-loop.ps1`。除非用户明确要求继续在当前会话直接开发，否则不要长期停留在聊天推进阶段。

如果 spec 和 architecture 已完成，应先让合适的 writer 子代理同步项目规则文件，再初始化任务队列，避免后续 driver 建立在过期的 `AGENTS.md`、`docs/harness/*` 或 `docs/context/*` 之上。

## Hooks 边界

- `.codex/hooks.json` 的 `Stop` hook 是交互会话结束前的增强层，不是 driver 主链路。
- `codex-loop.ps1` 调用内层 `codex exec` 时会传入 `--disable hooks`，因此实现阶段、Stage 1 和 Stage 2 的子 Codex 会话不会触发 Stop hook。
- Windows 当前仍以 PowerShell driver 作为确定性控制点；是否继续任务、是否允许停止、是否提交，以 `codex-loop.ps1` 的验证、trace、progress 和 commit gate 为准。
- 如果需要记录 Stop hook 没有触发，先检查 driver 日志里是否出现 `--disable hooks`；若出现，这是预期行为，不应按 hook 脚本失败处理。
- 外层交互会话的 Stop hook 只有在当前 Codex 客户端确实加载 `.codex/hooks.json` 且未被命令行禁用时才会运行；API/工具驱动的当前对话不应依赖它兜底。

## 任务文件规则

- `task.json` 使用 `{ "runtime": {...}, "tasks": [...] }` 结构；新任务默认 `passes: false`。
- 标准交接入口是 `project-task-template.json`，首个任务固定为 `INIT-001`，用于锁定 spec 输入、任务依赖、验证矩阵、`execution.mode` 和 owned paths。
- 如果 `task.json` 为空文件，先初始化为合法 JSON；如果仍是 smoke 模板或示例任务，先替换为当前项目真实任务。
- 交互开发模式可以决定新增或更新哪些待办任务，但实际写入必须委派给 `harness-writer` 等匹配 writer。
- 不得删除或改写已有任务描述，除非用户明确要求替换模板示例或重建任务队列。
- `spec` 定义做什么，`plan` 定义怎么拆，`task.json` 是主控唯一执行入口。

## 自动任务规则

- 每次只处理一个 `passes: false` 的任务。
- 优先级数字越小越先执行。
- 所有依赖任务必须已经通过。
- 如果仍有 `passes: false` 任务，但当前没有依赖已满足的 runnable task，Stop hook 应允许停止；历史 failed trace 继续作为 release blocker evidence，而不是强制续跑依据。
- `execution.mode` 缺省为 `single`，当前只允许 `single`。
- 修改后必须运行当前任务的 `test_command`。
- 测试失败时禁止提交，禁止把 `passes` 改为 `true`。
- 阻塞时必须追加 `progress.txt`，输出 `BLOCKED - 需要人工介入`，然后停止。

## 工作区规则

- 启动前 Git 工作区必须干净，除非用户明确说明哪些改动属于本任务。
- 如需忽略 smoke 残留、历史 trace 或其他已声明的运行产物，只允许通过 `runtime.git.non_blocking_dirty_paths` 明确列白名单。
- `non_blocking_dirty_paths` 只允许包含可再生运行产物，例如 `progress.txt`、`SMOKE-RESULT.md`、`traces/`、`artifacts/`；不要把源码、配置或业务文档加入白名单。
- 不要修改与当前任务无关的文件。
- 所有任务相关变更必须和 `task.json`、`progress.txt` 同一个 commit。

## 推荐做法

- 先收敛 truth source，再进入实现。
- 大任务先拆成多个 `single` 任务，再交给 driver 顺序执行。
- 当主控遇到文档、规则、任务队列、前端、后端或测试相关写入时，分别委派 `docs-worker`、`harness-writer`、`frontend-worker`、`backend-worker`、`test-runner` 等 writer 角色处理。
- 并行分析只允许发生在只读调研层；如需并行写入，不允许多个角色同时写同一路径。
- 任何子代理在开始前，先读 `AGENTS.md`、本文件、`.agents/rules/agents.md`、当前 truth source 和对应 `.agents/skills/*/SKILL.md`（如存在）。
- 如果当前轮次是被 stop hook 强制继续后的续跑，先重新阅读上述文档，再决定是否真的需要子代理。

## 模型策略

- 默认模型和思考强度定义在 `.codex/task-run-profile.json`。
- 如需任务级覆盖，使用 `task.execution.modelPolicy`。
