# Codex 全局规则与环境接入教程

本教程回答三个问题：

1. 全局规则应该写什么？
2. 新项目应该怎么接入 Codex Harness？
3. 新环境或新电脑应该怎么初始化？

如果只需要可复制的 `~/.codex/AGENTS.md` 和 `~/.codex/config.toml` 示例，先看 `codex-global-rules-example.md`。

## 1. 先分清三层规则

不要把所有规则都塞进一个 `AGENTS.md`。推荐拆成三层：

| 层级     | 位置                         | 应该放什么                                               | 不应该放什么                           |
| -------- | ---------------------------- | -------------------------------------------------------- | -------------------------------------- |
| 全局层   | `~/.codex/AGENTS.md`       | 跨项目稳定习惯、危险命令策略、默认输出风格、工具查找规则 | 某个项目的业务术语、目录结构、接口规则 |
| 项目层   | `<repo>/AGENTS.md`         | 当前仓库的任务规则、测试要求、目录约束、提交要求         | 只在某个子目录成立的细节               |
| 深文档层 | `<repo>/docs/harness/*.md` | 详细架构、回归规则、trace 格式、CI 策略                  | 高频入口规则                           |

判断标准很简单：

- **换项目后仍然成立**，放全局层。
- **只在当前仓库成立**，放项目层。
- **太长，不适合每次都塞进上下文**，放深文档层。

## 2. 全局规则怎么写

全局规则应该短、稳、工程化。建议控制在 50-150 行。

推荐包含：

1. 默认语言和输出风格。
2. 工具查找策略，例如先 `Get-Command`，再用绝对路径。
3. 危险命令策略，例如禁止 `git reset --hard`、禁止在未确认时删文件。
4. 验证原则，例如“没有 fresh verification evidence 不宣布完成”。
5. dirty workspace 处理原则。
6. 跨项目通用的环境约束，例如 Windows、PowerShell、PATH、代理设置。

不推荐包含：

- 某个仓库的目录名。
- 某个产品的业务规则。
- 某个项目专属的 API key 名称。
- 很长的逐步实现流程。
- `task.json`、`progress.txt`、`codex-loop.ps1` 这类项目 workflow 细节。

可复制模板：

- 全局 AGENTS: `templates/config/global-AGENTS.md`

## 2.1 如果现有全局 AGENTS 已经很重，怎么清理

清理原则是：**先备份，再瘦身，不直接把所有内容删空。**

推荐分三类处理：

### 保留在全局的内容

- 工具查找策略
- Windows / PowerShell 通用规则
- 危险命令和 dirty workspace 原则
- 验证优先原则
- 全局输出语言和通用协作风格

### 迁出到项目层的内容

- 两阶段 spec / 自动实现工作流
- `task.json`、`progress.txt`、`codex-loop.ps1` 约定
- BLOCKED 固定格式
- 提交规则
- 项目专用 skill 使用方式

### 直接删除的内容

- 只对某个项目成立的目录名和业务术语
- 已经过时的命令入口
- 与当前 Codex 行为不符的旧规则

## 2.2 config.toml 为什么不和 AGENTS 一起重写

`AGENTS.md` 和 `config.toml` 不是一类东西：

- `AGENTS.md` 是行为规则和工作约定。
- `config.toml` 是模型、sandbox、approval、MCP、PATH、trust 等运行配置。

如果 `config.toml` 当前还能正常工作，不应该在重写全局规则时顺手一起改。正确做法是：

1. 先单独清理全局 `AGENTS.md`。
2. 再评估 `config.toml` 里哪些是运行配置、哪些是敏感信息、哪些该迁到环境变量。

所以本次建议是：**重写全局 AGENTS，但不自动改 `config.toml`。**

## 3. 项目规则怎么写

项目 `AGENTS.md` 负责把 Codex 绑定到当前仓库的真实执行方式。

最少应包含：

- 任务入口文件，例如 `task.json`。
- driver 命令，例如 `powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1`。
- 实现前 testing truth source 要求，例如验收示例、追溯矩阵、验证矩阵。
- 测试要求。
- 阻塞格式。
- 提交要求。
- 深文档索引。

可复制模板：

- 项目 AGENTS: `templates/runtime/AGENTS.md`

## 4. 新项目接入步骤

### Step 1: 确认项目是 Git 仓库

```powershell
git rev-parse --show-toplevel
```

如果失败，先初始化：

```powershell
git init
```

### Step 2: 复制最小组合

至少复制以下文件到项目根目录：

```text
AGENTS.md
task.json
codex-loop.ps1
doctor.ps1
verify.ps1
progress.txt
```

并额外复制默认运行策略文件：

```text
.codex/task-run-profile.json
```

如果这是新项目第一次接入，建议额外复制：

```text
smoke-task.json
```

同时复制以下文档到 `docs/harness/`：

```text
harness-architecture.md
new-project-usage.md
regression-rules.md
spec-to-ui-to-code-workflow.md
task-session-strategy.md
trace-format.md
```

并复制或初始化以下 `docs/testing/` 真相源：

```text
ACCEPTANCE_CRITERIA.md
ACCEPTANCE_EXAMPLES.md
TRACEABILITY_MATRIX.md
TEST_STRATEGY.md
TEST_DATA_MATRIX.md
RISK_BASED_TEST_PLAN.md
REGRESSION_PLAN.md
EVIDENCE_PROTOCOL.md
test-matrix.md
verify-matrix.md
failure-triage.md
test-data-plan.md
e2e-plan.md
```

### Step 3: 配置项目 `.codex/config.toml`

按需从模板复制：

- `templates/config/codex-config.toml`
- `templates/config/mcp-config.toml`

项目配置只放项目特有内容。能在全局复用的项放到 `~/.codex/config.toml`。

### Step 4: 初始化任务

编辑 `task.json`：

- 写入任务 id。
- 写入依赖。
- 写入 `test_command`。
- 写入验收标准。
- 为实现任务写入 `requirement_ids`、affected tests 和 owned paths。
- 按需为单任务补 `context_files` 和 `execution` 覆盖策略。

如果只是验证接入链路，不要直接写业务任务。先使用 `templates/runtime/smoke-task.json` 做一轮 smoke test，确认 driver、trace、progress 和自动提交都正常，再切回真实 `task.json`。

如果目标是正式业务任务，不要在 testing truth source 还缺失时就急着生成真实任务队列。至少先补齐：

- `ACCEPTANCE_CRITERIA.md`
- `ACCEPTANCE_EXAMPLES.md`
- `TRACEABILITY_MATRIX.md`
- `TEST_DATA_MATRIX.md`
- `test-matrix.md`
- `verify-matrix.md`

如果目标仓库是刚 `git init` 的 brand new 仓库，bootstrap 和任务初始化完成后，先做一次基线提交，再启动 driver：

```powershell
git add --all
git commit -m "chore: bootstrap codex harness baseline"
```

这样可以让 clean workspace 检查针对“真正的任务改动”生效，而不是把 bootstrap 入口文件本身当成脏工作区。

### Step 5: 跑环境检查和验证

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\doctor.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

如果需要先做环境诊断，再额外运行模板里的：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\docs\codex-harness-engineering\templates\config\env-check.ps1
```

### Step 6: 首次运行 driver

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
全自动完成所有task
 powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1 -RunUntilDone
```

## 5. 新环境初始化步骤

这里指新电脑、新 runner、WSL、新 CI 环境。

### Step 1: 安装基础工具

至少需要：

- Git
- PowerShell 或对应 shell
- Node.js
- Codex CLI

Windows 下建议先确认：

```powershell
Get-Command git
Get-Command pwsh
Get-Command node
Get-Command codex
```

### Step 2: 准备全局配置目录

Codex 全局配置通常放在：

```text
~/.codex/
```

建议至少准备：

```text
~/.codex/AGENTS.md
~/.codex/config.toml
```

可复制模板：

- `templates/config/global-AGENTS.md`
- `templates/config/global-config.toml`

### Step 3: 配置 API key 和环境变量

禁止把真实密钥提交进仓库。推荐用：

- 用户级环境变量
- CI secret
- `.env.local` 这类本地文件

可复制模板：

- `templates/config/env.example`

### Step 4: 配置 PATH 和 trust

如果是 Windows 环境，优先保证 `config.toml` 里的 shell environment policy 与本机实际工具路径一致。

项目首次接入时，按需加入信任项目：

```toml
[projects.'E:\\path\\to\\repo']
trust_level = "trusted"
```

### Step 5: 按环境选择执行模式

| 环境       | 推荐模式                                      |
| ---------- | --------------------------------------------- |
| 本地开发   | `workspace-write` 或 `danger-full-access` |
| CI 审查    | `workspace-write`                           |
| 不可信输入 | `read-only` 或受限 `workspace-write`      |

### Step 6: hooks 只做增强，不做主链路

Codex hooks 当前可作为增强层启用。Windows 环境不要把 hooks 当主链路，优先使用 driver；如需结束前 continuation / feedback gate，可再参考：

- `templates/hooks/hooks.json`
- `templates/hooks/hook-stop-verify.ps1`

## 6. 推荐的全局与项目拆分

### 放在全局 `~/.codex/AGENTS.md`

- 输出语言
- 工具查找原则
- 危险命令原则
- 验证优先原则
- dirty workspace 原则

### 放在项目 `<repo>/AGENTS.md`

- 当前项目任务入口
- 当前项目测试命令
- 当前项目目录边界
- 当前项目阻塞格式
- 当前项目提交要求

### 放在项目 `docs/harness/*.md`

- 回归规则
- trace 格式
- sandbox 策略
- CI 工作流
- 架构说明

## 7. 最常见错误

1. 把项目规则写进全局 AGENTS，导致换仓库就错。
2. 把所有长文档都塞进 AGENTS，导致上下文挤爆。
3. 新环境只复制项目模板，不准备全局 config。
4. 没有 `doctor.ps1` 和 `verify.ps1` 就直接跑 driver。
5. 在 dirty workspace 中自动提交。
6. 把 hooks 当成 Windows 主链路。
7. 没补验收示例和追溯矩阵就创建正式 `task.json`。
8. 把 Stage 17 当成第一次定义测试范围的地方。

## 8. 推荐复制路径

| 目标         | 复制模板                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| 全局规则     | `templates/config/global-AGENTS.md`                                                                          |
| 全局配置     | `templates/config/global-config.toml`                                                                        |
| 项目规则     | `templates/runtime/AGENTS.md`                                                                                 |
| 项目任务流   | `templates/runtime/task.json`, `templates/runtime/codex-loop.ps1`, `templates/runtime/doctor.ps1`, `templates/runtime/verify.ps1` |
| 项目文档     | `templates/docs/harness-architecture.md`, `templates/docs/new-project-usage.md`, `templates/docs/regression-rules.md`, `templates/docs/spec-to-ui-to-code-workflow.md`, `templates/docs/task-session-strategy.md`, `templates/docs/trace-format.md` |
| 项目测试真相源 | `templates/testing/ACCEPTANCE_CRITERIA.md`, `templates/testing/ACCEPTANCE_EXAMPLES.md`, `templates/testing/TRACEABILITY_MATRIX.md`, `templates/testing/TEST_STRATEGY.md`, `templates/testing/TEST_DATA_MATRIX.md`, `templates/testing/RISK_BASED_TEST_PLAN.md`, `templates/testing/REGRESSION_PLAN.md`, `templates/testing/EVIDENCE_PROTOCOL.md`, `templates/testing/test-matrix.md`, `templates/testing/verify-matrix.md` |
| 项目工具配置 | `templates/config/codex-config.toml`, `templates/config/mcp-config.toml`                                          |
