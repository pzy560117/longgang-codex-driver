# AGENTS.md

本文件只保留每次会话都必须知道的 Harness 入口规则。细节按需读取下方深文档，不把长期协议全部塞进入口文件。

## 核心入口

- 本仓库默认采用 `driver-first`：真实任务进入 `task.json`，由 `codex-loop.ps1` 逐个执行。
- `single task` 是当前唯一自动执行模式；每轮 driver 只处理一个 `passes: false` 且依赖已通过的任务。
- 交互开发模式只负责需求收敛、分析、规划和任务输入；方案确认后，默认回到 `task.json -> codex-loop.ps1`。
- 主控会话不直接维护仓库状态文件；`task.json`、`progress.txt`、`traces/` 和 Git 提交由 runtime 链路推进。
- 需要落盘规则、任务、文档、前端、后端或测试内容时，先确认 truth source，再委派匹配的 writer 子代理或进入 driver 任务。

## 硬约束

- 启动前 Git 工作区必须干净，除非用户明确说明哪些改动属于本任务；可再生运行产物只能通过 `runtime.git.non_blocking_dirty_paths` 列白名单。
- 不要伪造完成状态：不得手工把未验证任务标记为 `passes: true`，不得绕过 `test_command`、review gate 或 commit gate。
- 不要删除或改写已有任务描述，除非用户明确要求替换模板示例或重建任务队列。
- 修改后必须运行与改动直接对应的验证；文档改动至少运行 `git diff --check`。
- 测试范围从需求收敛阶段开始定义；P0/P1 需求进入实现前必须有可追溯验收、测试数据和证据路径。
- 外部系统、开源栈、第三方平台或真实环境集成需求，完成声明必须包含真实依赖接入、成功态证据和失败态证据。
- 需求分析或编码前必须先形成 Architecture Constraints Packet：至少明确交付形态、API 边界、数据持久化、异步/worker 边界、测试替身策略、禁止实现和 Definition of Done。
- `feature_impl` 任务必须携带可执行的 `architecture_constraints`、`forbidden_implementations` 和对应验证命令；禁止把测试替身、内存实现或领域原型伪装成生产路径完成，除非任务明确标记为 `domain-prototype`。
- Stage 1 Review 必须先审查架构约束符合性，再审查业务规格；若交付形态、API/DB/worker/部署入口或测试替身策略与约束冲突，必须直接 FAIL。
- 阻塞时追加 `progress.txt`，输出 `BLOCKED - 需要人工介入`，然后停止。

## 必读索引

- Harness 架构：`docs/harness/architecture.md`
- 架构约束包：`docs/architecture/constraints.md`
- 新项目使用：`docs/harness/new-project-usage.md`
- Task 会话与 `task.json` 细则：`docs/harness/task-session-strategy.md`
- 规则治理与 AGENTS.md 分层：`docs/harness/rule-governance.md`
- 回归与验证策略：`docs/harness/regression-rules.md`
- Trace 格式：`docs/harness/trace-format.md`
- 权限策略：`docs/harness/sandbox-policy.md`
- Prompt 与知识集成：`docs/harness/prompt-knowledge-integration.md`
