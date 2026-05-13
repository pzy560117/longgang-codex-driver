# Codex Harness Engineering 最佳实践

## 1. 总原则

Codex Harness 的目标不是让 Codex “更自由”，而是让 Codex 在明确边界内持续交付。

本目录已经为当前推荐分层提供了可复制模板。先看 `README.md` 和 `templates/README.md`，再按项目成熟度复制 `templates/` 下的最小组合。

实践优先级如下：

1. **结构化任务优先于口头指令**：任务必须有 id、描述、步骤、依赖、验收和测试命令。
2. **确定性验证优先于模型自评**：任务是否完成由 lint、build、test、e2e、eval 和 Git 状态判断。
3. **测试左移优先于末端补测**：实现前先补齐验收示例、追溯矩阵、测试数据和回归范围。
4. **短入口文档优先于巨型规则文档**：`AGENTS.md` 只放硬规则和索引，细节放 `docs/`。
5. **隔离执行优先于共享脏工作区**：自动任务启动前必须检查 Git 工作区。
6. **回归约束优先于经验提醒**：失败后优先补测试、lint、driver 校验或 eval，最后才写文档提醒。

## 2. 任务设计

一个合格任务必须包含：

| 字段 | 要求 |
| --- | --- |
| `id` | 稳定、唯一、可用于提交信息和 trace 文件名 |
| `description` | 一句话描述业务目标，不写实现细枝末节 |
| `priority` | 数字越小优先级越高 |
| `dependencies` | 依赖任务全部通过后才能执行 |
| `passes` | 只有验证通过后才能改成 `true` |
| `requirement_ids` | 关联的需求编号，必须能回到追溯矩阵和验收示例 |
| `steps` | 2-8 个执行步骤，足够具体但不过度限定实现 |
| `owned_paths` | 当前任务允许接管的代码或文档范围 |
| `test_command` | 单任务必须运行的验证命令 |
| `acceptance` | 可验证的验收标准 |

不要把多个独立功能塞进一个任务。单个 `codex exec` 会话只处理一个任务，这样失败时可以清晰定位。

对 `feature_impl` 类任务，还应额外满足：

- 实现前能从 `TRACEABILITY_MATRIX.md` 和 `ACCEPTANCE_EXAMPLES.md` 找到对应 Requirement IDs。
- 任务描述能说清 affected tests、验证层级和证据路径。
- 不能把“先写实现，最后再补测试范围”当成默认策略。

## 3. 上下文组织

Codex 会在启动时读取 `AGENTS.md` 链。官方文档说明，Codex 会从全局、项目根到当前目录逐层合并指导文件，并受 `project_doc_max_bytes` 限制。因此推荐：

```text
AGENTS.md                  # 入口规则和索引
docs/harness/*.md          # 自动化规则
docs/architecture/*.md     # 架构说明
docs/testing/*.md          # 测试策略
```

`AGENTS.md` 推荐结构：

```markdown
# AGENTS.md

## 当前工程规则

- 每次只处理 `task.json` 中一个 `passes: false` 的任务。
- 修改代码后必须运行任务指定的 `test_command`。
- 测试失败时禁止把任务标记为通过。
- 阻塞时必须写入 `progress.txt` 并输出 BLOCKED。

## 深文档索引

- Harness 规则: `docs/harness/architecture.md`
- 回归规则: `docs/harness/regression-rules.md`
- Trace 格式: `docs/harness/trace-format.md`
- 验收示例: `docs/testing/ACCEPTANCE_EXAMPLES.md`
- 需求追溯: `docs/testing/TRACEABILITY_MATRIX.md`
- 验证矩阵: `docs/testing/verify-matrix.md`
```

## 4. 执行控制

Windows 不应依赖 Codex hooks 作为主链路。Codex hooks 可以作为结束前 stop-gate、feedback-gate 这类增强层；确定性控制仍由 PowerShell driver 承担：

- 选择一个任务。
- 检查依赖。
- 检查 Git 工作区。
- 生成 prompt。
- 调用 `codex exec`。
- 检测 `BLOCKED`。
- 运行测试命令。
- 更新 `task.json` 和 `progress.txt`。
- 生成 trace。
- 提交 Git commit。

要明确区分两层职责：

- 内层 `codex exec` 会话只负责当前任务直接要求的代码或文档改动。
- 外层 driver 负责 `task.json`、`progress.txt`、`traces/*.json` 和 Git 提交。

如果把这两层职责混在一起，常见后果是状态文件重复写入、二次 trace、dirty workspace 回流，以及 driver 已提交后又被后续会话写脏。

推荐命令：

```powershell
codex exec --full-auto --sandbox danger-full-access -C <ProjectRoot> -
```

只在隔离、干净、可审计的工作区使用 `danger-full-access`。普通 CI 或审查任务优先使用 `workspace-write` 或只读模式。

## 5. 权限与安全

权限策略按最小化原则选择：

| 场景 | 推荐 sandbox | 说明 |
| --- | --- | --- |
| 只读审查 | `read-only` | 不允许改文件 |
| 常规修复 | `workspace-write` | 只允许写工作区 |
| 本地无人值守实现 | `danger-full-access` | 仅用于可信机器和干净工作区 |
| CI PR 审查 | GitHub Action + `workspace-write` | 限制触发者和 secret 暴露 |

禁止把 secret、token、cookie、私钥写入 prompt、trace 或 progress。GitHub Action 中必须限制触发者，避免把不可信 issue 或 PR 文本直接喂给 Codex。

## 6. 验证策略

验证不是只发生在任务结束时。实现前至少要先有：

- `ACCEPTANCE_CRITERIA.md`
- `ACCEPTANCE_EXAMPLES.md`
- `TRACEABILITY_MATRIX.md`
- `TEST_DATA_MATRIX.md`
- `test-matrix.md`
- 必要时的 `RISK_BASED_TEST_PLAN.md`、`REGRESSION_PLAN.md`、`EVIDENCE_PROTOCOL.md`

推荐验证顺序：

```text
格式检查
  -> 静态检查
  -> 类型检查
  -> 单元测试
  -> 集成测试
  -> E2E
  -> 业务 eval
```

最小任务可以只跑 `git diff --check` 或 `npm run build`，但跨模块改动必须扩大验证范围。PowerShell 中不要用普通分号串联多个会失败的命令，否则前一个命令失败可能被后一个命令的退出码掩盖。需要显式检查 `$LASTEXITCODE`，或者把多个检查封装成项目内 `npm run verify`、`make verify` 这类单一命令。

对 smoke/self-check 类任务，`test_command` 不能只校验“文件存在”。如果结果文件还承担语义说明作用，例如必须写出“内层 Codex 自动实现会话生成结果文件”，那么测试命令也必须检查关键文本内容和基本文件质量，否则 Stage 2 review 应该把它判为测试覆盖缺口。

同时，不要把**外层 driver 才会在 Stage 2 之后写入的状态产物**直接放进 smoke task 的任务验收里，例如：

- `task.json` 中 `passes=true`
- `progress.txt` 完成记录
- `traces/` 目录和 trace 文件
- 自动提交

这些应改为 smoke run 完成后的外层检查清单，否则两阶段审查会在外层产物落盘前就把任务判失败。

Stage 17 的职责也要收窄：

- 运行 fresh evidence。
- 运行 affected tests 和 P0/P1 regression。
- 校验 verify matrix、契约验证和端到端证据是否仍然成立。

不要在 Stage 17 第一次补需求测试范围、第一次写验收示例，或第一次决定应该测什么。

验收不要写成“实现良好”“用户体验好”这种主观描述，应写成：

- `npm run lint` 退出码为 0。
- `/api/orders` 对缺失参数返回 400。
- `progress.txt` 包含任务 id 和测试结果。
- `task.json` 中对应任务 `passes` 为 `true`。

## 7. 阻塞处理

遇到以下情况必须 BLOCKED：

- 缺少 API key、账号、权限或外部服务。
- 任务描述互相矛盾。
- 测试命令持续失败且无法确认根因。
- 工作区启动时已有未解释的未提交改动。
- 需要人工产品决策。

阻塞输出必须包含：

```text
BLOCKED - 需要人工介入

当前任务: <task-id> <description>

已完成的工作:
- ...

阻塞原因:
- ...

需要人工操作:
1. ...

解除阻塞后请运行:
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
```

阻塞时禁止提交、禁止把 `passes` 改为 `true`、禁止继续处理下一个任务。

## 8. 进度与 trace

`progress.txt` 面向人类，记录任务摘要、测试结果和后续提示。`traces/*.json` 面向机器，记录命令、退出码、文件改动、状态和失败原因。

模板层面有两个推荐约定：

- `templates/runtime/progress.txt` 保持空白初始状态，不要预填演示记录。
- 新项目第一次接入先跑 `templates/runtime/smoke-task.json`，不要一上来就用真实业务任务验证 Harness。

推荐 trace 字段：

| 字段 | 说明 |
| --- | --- |
| `task_id` | 当前任务 |
| `agent` | `codex`、`claude-code` 或其他 |
| `started_at` / `ended_at` | 时间范围 |
| `status` | `passed`、`failed`、`blocked` |
| `commands` | 命令和退出码 |
| `files_changed` | Git 检测到的文件 |
| `blocked_reason` | 阻塞原因 |
| `final_message` | Codex 最终消息摘要 |

## 9. 提交规则

自动任务的提交必须满足：

- 启动前工作区干净，或只有当前任务明确接管的改动。
- 代码、文档、`task.json`、`progress.txt`、trace 在同一 commit。
- 测试全部通过后才允许 `passes=true`。
- commit message 包含任务 id。

推荐格式：

```text
feat: <task description> - completed <task-id>
```

## 10. 回归沉淀

每次失败都要问：下次怎么让机器自动发现？

| 失败类型 | 优先沉淀方式 |
| --- | --- |
| 构建失败 | build/test 命令加入 `test_command` |
| 类型遗漏 | 增加 typecheck 或单测 |
| 格式问题 | 增加 formatter/lint/diff check |
| 文件误改 | driver 增加路径白名单或启动前 dirty 检查 |
| 重复需求误解 | 改 `task.json` 模板和 prompt |
| 外部服务缺失 | 增加环境变量检查 |
| 隐蔽业务错误 | 增加 E2E 或业务 eval |

不要只把失败写进“注意事项”。能自动化的必须自动化。
