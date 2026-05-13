# Agent Implementation Flow

本文从 `agent/` 包的真实文件结构出发，说明当前 Codex Harness Agent 的整体实现流程。它不是新的流程规范，而是对现有安装、模板、driver、验证、知识归档和同步机制的结构化说明。

## 1. 包的职责边界

`agent/` 是一个可分发的 full driver-first 能力包，核心职责是把目标项目初始化成可重复执行的 Codex Harness 项目。

| 层级 | 主要文件 | 职责 |
| --- | --- | --- |
| 安装入口 | `install-agent-here.ps1`、`install-agent.ps1` | 把 `agent/` 安装到目标项目 `.agents/`，并触发 bootstrap |
| 项目 runtime | `codex-loop.ps1`、`verify.ps1`、`env-check.ps1`、`trace.schema.json` | 在目标项目根目录执行任务、验证、trace 和提交 |
| 项目规则 | `AGENTS.md`、`rules/*.md` | 约束主控会话、driver、子代理和项目规则边界 |
| Codex 配置 | `.codex/config.toml`、`.codex/agents/*.toml`、`.codex/prompts/*.md` | 定义模型、角色、prompt、hook 和 task run profile |
| Harness 文档 | `docs/harness/*.md` | 解释架构、任务策略、知识、回归、sandbox、trace 和新项目使用方式 |
| 测试左移 | `docs/testing/*.md` | 在实现前固定验收、示例、追溯、测试数据、风险、证据和回归计划 |
| 任务模板 | `project-task-template.json`、`smoke-task.json` | 提供正式任务队列和安装 smoke 的起点 |
| 扩展能力 | `skills/`、`workflows/`、`.specify/` | 提供 SpecKit、skills、规则分发和工程辅助能力 |
| 分发镜像 | `docs/codex-harness-engineering/templates/`、`templates/package-assets/` | 保存安装复制源和 package 自描述文档 |

当前包只保留 `full` 模式。SpecKit 仍随包安装，但它只服务于 spec、plan 和 tasks 输入生成；方案确认后必须回到 `task.json + codex-loop.ps1`。

## 2. 从包到项目的安装流程

安装的实际链路如下：

```text
agent/install-agent-here.ps1
  -> agent/install-agent.ps1 -ProjectRoot <target>
  -> 复制 package-assets 到 <target>/.agents/
  -> 调用 <target>/.agents/bootstrap-codex-harness.ps1
  -> bootstrap 把 runtime/docs/testing/.codex 模板落到项目根
  -> 可选 InitSmoke / baseline commit
```

关键点：

- `install-agent-here.ps1` 只负责推断目标项目根，并转调 `install-agent.ps1`。
- `install-agent.ps1` 会拒绝在已有 `.agents/` 上静默覆盖，除非显式传入 `-Force`。
- 如果目标目录不是 Git 仓库，只有传入 `-InitGitIfNeeded` 才会初始化 Git。
- 安装前工作区不干净时，不会自动 baseline commit，避免把无关改动混入安装提交。
- 自更新场景下，如果脚本从已安装的 `.agents/` 内运行，会先复制到临时目录，避免边复制边删除源目录。

## 3. Bootstrap 落盘流程

`bootstrap-codex-harness.ps1` 是安装后真正把目标项目变成 Harness 项目的脚本。

它负责落盘：

- 根入口：`AGENTS.md`、`codex-loop.ps1`、`verify.ps1`、`env-check.ps1`、`trace.schema.json`
- Codex 配置：`.codex/config.toml`、`.codex/hooks.json`、`.codex/task-run-profile.json`、`.codex/agents/`、`.codex/prompts/`
- 任务入口：`task.json`、`smoke-task.json`、`project-task-template.json`
- Harness 文档：`docs/harness/*`
- Testing truth sources：`docs/testing/*`
- Knowledge 初始索引：`docs/knowledge/knowledge-catalog.md`、`docs/knowledge/catalog.md`
- hook 脚本：`scripts/harness/hook-stop-verify.ps1`

`task.json` 已存在时，bootstrap 不会盲目覆盖；它只确保 `runtime.driver` 存在。正式任务队列应从 `project-task-template.json` 裁剪生成，而不是长期使用 smoke 或示例任务。

## 4. 新项目实施流程

目标项目安装后，推荐实施顺序是：

```text
bootstrap baseline
  -> smoke task
  -> product/design/context/testing truth sources
  -> project-task-template.json -> task.json
  -> codex-loop.ps1 -RunUntilDone
  -> release verify
  -> archive knowledge
```

每一步的职责：

| 阶段 | 输入 | 输出 | 通过条件 |
| --- | --- | --- | --- |
| Bootstrap | `agent/` 包和目标 Git 仓库 | 根 runtime、`.codex/`、`.agents/`、docs 模板 | `verify.ps1` 通过，工作区有清晰 baseline |
| Smoke | `smoke-task.json` | `progress.txt`、`traces/*.json`、一次 driver 提交 | driver、trace、progress、commit 链路可用 |
| 需求收敛 | spec、PRD、访谈、现有代码 | `docs/product/`、`docs/context/`、`docs/design/` | P0/P1 需求有 Requirement IDs 和验收边界 |
| 测试左移 | 需求、设计、风险 | `docs/testing/*` | 验收示例、追溯矩阵、测试数据、证据路径齐备 |
| 任务队列 | `project-task-template.json` | 真实 `task.json` | 无 smoke 占位，依赖、owned paths、test_command 可执行 |
| 实现执行 | `task.json` 当前未完成任务 | 代码/文档改动、测试输出、trace、commit | Stage 1、test_command、Stage 2 全部通过 |
| Release | 已完成用户故事 | affected tests、P0/P1 回归、视觉/契约证据 | fresh evidence 可追溯 |
| Archive | trace、progress、review、failure triage | `docs/knowledge/*`、候选报告 | 可复用经验归档，不越权提升规则 |

## 5. Driver 单任务执行流程

`codex-loop.ps1` 每次只处理一个 `passes: false` 且依赖已满足的任务。核心流程是：

```text
读取 task.json
  -> 选择下一个可执行任务
  -> 合并 runtime / task-run-profile / task execution policy
  -> 检查 truth sources
  -> 创建 task_session_id 和 traces/<task-id>-<session>/
  -> codex exec 实现阶段
  -> Stage 1 需求/设计一致性审查
  -> 运行 task.test_command
  -> Stage 2 代码质量/测试风险审查
  -> commit path ownership gate
  -> task.passes=true
  -> 写 progress.txt 和 trace
  -> git commit
```

失败时的处理：

- truth source 缺失：不进入实现，写 `progress.txt` 和 failed trace。
- Codex 实现失败或输出 BLOCKED：不跑后续 gate。
- Stage 1 失败：先修需求、设计、状态或范围偏差。
- `test_command` 失败：禁止标记 `passes=true`。
- Stage 2 失败：先修代码质量、测试缺口或维护性风险。
- commit path ownership gate 失败：说明改动超出 `owned_paths` 或 runtime allowlist，需要拆任务或修正任务边界。

## 6. Task.json 的实现契约

`task.json` 是 driver 的唯一任务状态源。正式任务至少应明确：

- `id`、`description`、`priority`、`dependencies`
- `passes: false`
- `task_kind`、`phase`、`gate_profile`
- `required_truth_sources`
- `context_files`
- `owned_paths`
- `requirement_ids`
- `test_command`
- `acceptance`
- `execution.mode: single`

`project-task-template.json` 目前按 full 链路组织为：

```text
INIT-001
  -> ANALYSIS-001
  -> DESIGN-001
  -> PLAN-001
  -> US1/US2/US3
  -> RELEASE-001
  -> ARCHIVE-001
```

模板只是交接骨架。真实项目必须替换占位的 feature slug、用户故事、Requirement IDs、owned paths、context files 和验证命令。

## 7. Prompt、角色与子代理

执行时，driver 通过 `.codex/prompts/implement-one-task.md` 生成单任务实现 prompt，并把当前 task、truth source、owned paths、test command、知识读取要求注入给 Codex。

子代理不是默认并行机制，而是受控辅助能力：

- 只读角色适合探索、研究、审查、失败归因和测试规划。
- writer 角色适合明确授权的文档、前端、后端、测试和 harness 文件写入。
- 主控会话需要更新 `task.json`、`AGENTS.md`、`.codex/*`、`.agents/rules/*`、`docs/harness/*` 或 prompt 时，应委派匹配 writer。
- 子代理启动前必须读取 `AGENTS.md`、`docs/harness/task-session-strategy.md`、`.agents/rules/agents.md` 和相关 skill。

这套设计的目标是避免主控会话和子代理同时伪造 driver 状态，所有完成状态仍回到 `task.json`、`progress.txt`、`traces/` 和 Git commit。

## 8. 验证与证据链

当前包把完成定义压到三类证据上：

| 证据 | 文件或命令 | 用途 |
| --- | --- | --- |
| 命令证据 | `task.test_command`、`verify.ps1`、`git diff --check` | 判断当前任务是否真的通过 |
| 过程证据 | `progress.txt`、`traces/*.json`、task session log | 记录失败阶段、命令退出码、review verdict 和文件改动 |
| 需求证据 | `docs/testing/*`、Requirement IDs、acceptance examples | 证明实现范围和测试覆盖不是事后猜测 |

`verify.ps1` 是包级 sanity check，默认至少运行 `git diff --check`，并检查 package freshness、hook 配置兼容性、PowerShell 语法和过时引用。具体项目的业务验证仍由每个 task 的 `test_command` 决定。

## 9. 知识闭环

知识系统不是独立产品，而是 driver 执行后的归档层：

```text
实现任务读取 docs/knowledge/
  -> 最终输出 knowledge_references / knowledge_outputs
  -> trace 保留 knowledge_references / knowledge_outputs / archive_summary
  -> ARCHIVE-001 更新 docs/knowledge/
  -> knowledge lint 检查索引、冲突、重复、衰减
  -> 可选 team knowledge sync 输出跨项目候选
```

约束：

- `draft` 知识只能辅助判断，不作为强阻塞依据。
- 单次任务经验不得直接升级为 `AGENTS.md` 规则。
- `verified -> proven` 需要多任务/多项目证据或 maintainer 审批。
- 团队知识库不可用时，只输出候选报告，不阻塞本地 driver。

## 10. Agent 包自身同步流程

本仓库中，root 是开发源，`agent/` 是独立可推送包。同步由 `refresh-agent-package.ps1` 和 `agent/.ai-sync.yml` 管理。

典型同步方向：

```text
root runtime/docs/testing/.codex
  -> agent/runtime/docs/templates
  -> agent package-assets
  -> .agents template mirrors
```

新增或修改内容时应先判断 canonical：

- runtime 和 driver truth source：优先改 root。
- human-facing package docs：优先改 `agent/docs/codex-harness-engineering/*.md`。
- active skills：优先改 `.agents/skills/<name>`，再同步到 `agent/skills/` 和 package-assets。
- template package assets：优先改 `agent/docs/codex-harness-engineering/templates/...`，再同步 `.agents/...`。

完成后至少运行：

```powershell
git diff --check
powershell -NoProfile -ExecutionPolicy Bypass -Command "& .\refresh-agent-package.ps1 -RepoRoot . -PackageRoot .\agent -CheckOnly -Surface @('docs','runtime','package-assets')"
```

如果改了 JSON 或 PowerShell，还要分别做 JSON parse 和 PowerShell parser 检查。

## 11. 关键不变量

- `task.json` 是任务状态源；不在聊天里伪造任务完成。
- `codex-loop.ps1` 是自动执行入口；不要引入第二套 runtime 状态机。
- driver 每次只处理一个可执行任务。
- `execution.mode` 当前只支持 `single`。
- 测试范围必须前置到 `docs/testing/*`，release 阶段只确认 fresh evidence 和回归。
- 业务代码、文档、`task.json`、`progress.txt`、trace 和 commit 必须形成同一条证据链。
- 归档沉淀知识，但不重新定义需求范围。
- `agent/` 可以远程推送；root 仓库如果没有远程，就只做本地提交。
