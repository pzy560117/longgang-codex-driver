# Codex 全局规则配置示例

**定位**: 给 `~/.codex/AGENTS.md` 和 `~/.codex/config.toml` 一个可落地示例，说明哪些内容应该放全局，哪些必须留在项目规则或 Harness 文档中。

本文件和 `global-rules-and-bootstrap.md` 的分工:

- `global-rules-and-bootstrap.md`: 解释全局规则、新项目接入、新环境初始化的整体流程。
- 本文件: 直接给出推荐配置样例和分层判断标准。

---

## 1. 总原则

Codex 全局规则要短、稳、跨项目成立。它应该管“行为边界”和“机器环境”，不应该管某个项目的业务流程。

推荐分层:

| 层级 | 文件 | 应放内容 | 不应放内容 |
| --- | --- | --- | --- |
| 全局行为规则 | `~/.codex/AGENTS.md` | 输出语言、工具查找、Git 安全、验证习惯、Windows 注意事项 | 具体项目的目录结构、业务规则、任务队列、多 Agent 阶段细节 |
| 全局运行配置 | `~/.codex/config.toml` | 默认模型、sandbox、approval、shell environment、全局 features | token、项目专属 MCP、项目私有环境变量 |
| 项目入口规则 | `<repo>/AGENTS.md` | 本仓库任务规则、提交规则、目录边界、driver 规则 | 跨项目通用工具路径、个人偏好长文 |
| 项目运行配置 | `<repo>/.codex/config.toml` | 项目专属 MCP、项目 profile、可信项目 sandbox 策略 | 个人全局习惯、其他项目路径 |
| 长文档 | `<repo>/docs/` | 19 阶段流程、测试矩阵、架构、trace、CI、回归策略 | 简短必须遵守的入口规则 |

判断标准:

- 换一个项目仍然成立，放全局。
- 只对当前仓库成立，放项目 `AGENTS.md`。
- 需要长篇解释或模板，放项目 `docs/`。
- 会影响 Codex CLI 行为，放 `config.toml`。
- 包含 token、cookie、密码、私钥，不放任何仓库文档。

---

## 2. 推荐的 `~/.codex/AGENTS.md`

下面是 Windows 环境的全局示例。它可以作为个人机器的默认规则使用。

```markdown
# Codex 全局规则（Windows）

## 作用范围

- 本文件只放跨项目稳定成立的规则。
- 某个仓库专属的任务流、目录结构、提交规范和业务规则，不放这里。
- 项目规则放项目根 `AGENTS.md`，长文档放项目 `docs/`。

## 工具绝对路径速查

| 工具 | 绝对路径 |
| --- | --- |
| git | `D:\Program Files\Git\cmd\git.exe` |
| gh | `C:\Program Files\GitHub CLI\gh.exe` |
| node | `C:\Program Files\nodejs\node.exe` |
| python | `C:\Users\<user>\AppData\Local\Programs\Python\Python312\python.exe` |
| pwsh | `C:\Program Files\PowerShell\7\pwsh.exe` |
| rg | `C:\Users\<user>\AppData\Local\Microsoft\WinGet\Links\rg.exe` |
| curl | `C:\Windows\System32\curl.exe` |

## 工具规则

1. 工具查找顺序：`Get-Command` -> 已知绝对路径 -> 明确报错停止。
2. `npm`、`pnpm`、`yarn` 在 Windows 下优先通过 PowerShell 调用。
3. 如果 PATH 已在 `~/.codex/config.toml` 中固化，命令仍找不到时优先使用绝对路径，不盲目重装。
4. 搜索优先用 `rg` 或 `rg --files`。
5. 非交互自动化优先使用 `codex exec`。

## 验证规则

- 没有 fresh verification evidence，不要声称任务已完成。
- 提交、合并、交付前必须运行与结论直接对应的验证命令。
- 文档改动至少运行 `git diff --check`。

## Git 与安全规则

- dirty workspace 默认视为阻塞，除非用户明确说明哪些改动属于当前任务。
- 禁止在未确认时使用破坏性命令，如 `git reset --hard`、`git checkout --`、递归删除。
- 不把 token、cookie、私钥、密码写入仓库、trace 或文档。
- 不在不可信环境使用高权限 sandbox。

## Windows 环境规则

- Windows 主链路优先使用 PowerShell driver。
- Codex hooks 可作为增强层启用；Windows 仍不把 hooks 当主链路。
- 需要内联多步验证时，不要让前一个命令失败被后一个命令的退出码掩盖，应显式检查 `$LASTEXITCODE`。

## 分层规则

- 跨项目稳定习惯放 `~/.codex/AGENTS.md`。
- 当前仓库规则放 `<repo>/AGENTS.md`。
- 详细架构、回归规则、trace 格式、CI 策略放 `<repo>/docs/`。
```

### 不要放进全局 AGENTS 的内容

- `task.json`、`progress.txt`、`codex-loop.ps1` 的具体 workflow。
- 具体产品需求，例如“宠物商城”“订单系统”“后台管理”。
- 某个仓库的目录所有权，例如 `apps/frontend/` 归 frontend worker。
- 某个项目的 19 阶段产物路径。
- 真实 token、cookie、私钥、密码。
- 项目专属 MCP server、数据库 URL、API base URL。

---

## 3. 推荐的 `~/.codex/config.toml`

全局 `config.toml` 应保持保守，适合大多数项目默认启动。高权限、项目 MCP 和特殊 profile 留给项目 `.codex/config.toml` 或命令行显式指定。

```toml
model = "gpt-5.4"
model_reasoning_effort = "medium"
personality = "pragmatic"
sandbox_mode = "workspace-write"

[approvals]
approval_policy = "on-request"

[shell_environment_policy]
inherit = "all"
ignore_default_excludes = true

[features]
codex_hooks = true

# 全局只放跨项目稳定设置。
# 项目专属 MCP、env、trust、danger-full-access profile 放 `<repo>/.codex/config.toml`。
```

### 全局 config 的边界

建议放全局:

- 默认模型和默认思考深度。
- 默认 sandbox 和 approval 策略。
- shell environment 继承策略。
- 是否启用 hooks 这类跨项目 feature。

不建议放全局:

- 项目私有 MCP server。
- 真实 API key、数据库密码、cookie。
- 某个项目专用的 `danger-full-access` 默认策略。
- 某个仓库的绝对路径。
- 只服务一个项目的 profile。

---

## 4. 项目 `.codex/config.toml` 示例

项目配置用于补充当前仓库的运行策略。对于 Harness 项目，建议从 `templates/config/codex-config.toml` 复制，再按项目删减。

```toml
model = "gpt-5.4"
model_reasoning_effort = "medium"
sandbox_mode = "workspace-write"
project_doc_max_bytes = 65536
project_doc_fallback_filenames = ["TEAM_GUIDE.md", ".agents.md"]

[approvals]
approval_policy = "on-request"

[features]
codex_hooks = true

[agents]
max_threads = 4
max_depth = 2
job_max_runtime_seconds = 1800

[profiles.automation]
model = "gpt-5.4"
model_reasoning_effort = "medium"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.controller-5-5-medium]
model = "gpt-5.5"
model_reasoning_effort = "medium"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.product-analyst-5-5-high]
model = "gpt-5.5"
model_reasoning_effort = "high"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.frontend-worker-5-4-medium]
model = "gpt-5.4"
model_reasoning_effort = "medium"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.backend-worker-5-4-high]
model = "gpt-5.4"
model_reasoning_effort = "high"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.test-runner-5-4-mini-medium]
model = "gpt-5.4-mini"
model_reasoning_effort = "medium"
approval_policy = "never"
sandbox_mode = "workspace-write"

[profiles.visual-reviewer-5-5-high]
model = "gpt-5.5"
model_reasoning_effort = "high"
approval_policy = "never"
sandbox_mode = "workspace-write"
```

项目 profile 只提供 Codex CLI 的执行配置；真正的阶段到 agent 路由仍以这些文件为准:

- `.agents/rules/agents.md`

---

## 5. 推荐初始化命令

新机器或新环境上先创建全局配置目录:

```powershell
New-Item -ItemType Directory -Force -Path "$HOME\.codex" | Out-Null
```

复制模板:

```powershell
Copy-Item ".\docs\codex-harness-engineering\templates\config\global-AGENTS.md" "$HOME\.codex\AGENTS.md"
Copy-Item ".\docs\codex-harness-engineering\templates\config\global-config.toml" "$HOME\.codex\config.toml"
```

如果已有全局文件，先备份:

```powershell
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item "$HOME\.codex\AGENTS.md" "$HOME\.codex\AGENTS.md.bak-$Stamp" -ErrorAction SilentlyContinue
Copy-Item "$HOME\.codex\config.toml" "$HOME\.codex\config.toml.bak-$Stamp" -ErrorAction SilentlyContinue
```

检查工具是否存在:

```powershell
Get-Command git, rg, node, python, pwsh -ErrorAction Continue
```

---

## 6. 检查清单

修改全局规则后，至少检查:

- [ ] `~/.codex/AGENTS.md` 没有项目业务规则。
- [ ] `~/.codex/AGENTS.md` 没有 token、cookie、私钥、密码。
- [ ] `~/.codex/config.toml` 没有真实密钥。
- [ ] 默认 sandbox 不是无条件 `danger-full-access`。
- [ ] hooks 在 Windows 环境中只作为增强层，不替代 PowerShell driver 主链路。
- [ ] 项目根 `AGENTS.md` 仍负责项目专属规则。
- [ ] 文档改动已运行 `git diff --check`。

---

## 7. 和多 Agent Harness 的关系

全局规则只告诉 Codex “应该怎么安全工作”。它不负责决定 19 个阶段用哪个 agent。

多 Agent 阶段路由放在项目或 Harness 层:

- Stage 02 需求分析: `product-analyst`，同时产出可执行验收示例和可测试需求边界
- Stage 03 需求追溯: `requirements-trace-analyst`，把 Requirement IDs 固化到 `TRACEABILITY_MATRIX`
- Stage 09 多 Agent 派发: `orchestrator`
- Stage 10 前端实现: `frontend-worker`
- Stage 13 后端实现: `backend-worker`
- Stage 17 验证回归: `test-runner`，只运行 fresh evidence、affected tests 和 P0 回归，不在本阶段第一次补测试范围
- Stage 19 合并提交: `release-manager`

这样分层后，全局规则可以长期稳定，项目 Harness 可以按业务和阶段持续演进。
