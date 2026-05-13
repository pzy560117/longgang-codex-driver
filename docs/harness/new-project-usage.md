# 新项目 Codex Harness 使用指南

本文面向刚创建或刚接入 Harness 的项目。当前版本先跑通单 driver 闭环，不再提供额外执行工作区或外部 worker 编排流程；主控会话负责判断和派发，不直接写仓库文件，需要落盘时转给包内匹配的 writer 子代理。

## 使用路线总览

| 场景 | 推荐入口 | 说明 |
| --- | --- | --- |
| 第一次接入 Harness | `bootstrap-codex-harness.ps1` | 补齐 `AGENTS.md`、`codex-loop.ps1`、`doctor.ps1`、`.codex/`、`docs/harness/` 等文件 |
| spec / plan 已确认，准备切主控 | `project-task-template.json` -> `task.json` -> `codex-loop.ps1 -RunUntilDone` | 交互模式在这里结束，后续默认由 driver 接管 |
| 单个需求串行实现 | `codex-loop.ps1 -RunUntilDone` | 一个 Git 工作区里按 `task.json` 优先级逐个完成任务 |
| 需要沉淀项目经验 | `docs/knowledge/knowledge-catalog.md` -> `ARCHIVE-001` | 任务结束后把可复用经验归档为知识条目 |
| 既有项目冷启动知识库 | `docs/harness/knowledge-import.md` | 从 README、docs、代码结构、issue/review 中提取 draft 条目 |
| 维护知识库健康 | `docs/harness/knowledge-lint.md` | 检查索引、孤儿条目、重复、冲突、成熟度和长期未引用条目 |
| 连接团队知识库 | `docs/harness/team-knowledge-sync.md` | 把 verified/proven 跨项目候选输出到独立团队知识库的贡献暂存区 |

## 1. 初始化

```powershell
git status --short
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap-codex-harness.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\doctor.ps1
```

## 2. 创建任务

```powershell
Copy-Item .\project-task-template.json .\task.json
```

建议 `runtime.git` 使用：

```json
{
  "require_clean_workspace": true,
  "non_blocking_dirty_paths": []
}
```

## 3. 运行 Driver

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1 -RunUntilDone
```

Windows 下如果 `Get-Command codex` 命中的是 npm PowerShell shim（例如 `codex.ps1`），`Start-Process` 可能报 `%1 is not a valid Win32 application`。这时不要重装，先显式指定可被 `Start-Process` 启动的 `.cmd` 或真实可执行文件：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1 -CodexCommand "C:\Users\pzy666\AppData\Roaming\npm\codex.cmd"
```

记录一次 driver 运行经验时，按下面顺序落到文档或运行状态：

- 当前任务的具体执行结果、失败原因、验证命令和下一步，写入 `progress.txt`。
- 可复用的运行命令、Windows 环境差异、hooks 边界，写入本文或 `docs/harness/task-session-strategy.md`。
- 已经跨任务验证、值得长期复用的经验，在 `ARCHIVE-001` 阶段沉淀到 `docs/knowledge/`，不要直接提升为 `AGENTS.md` 硬规则。

- `.codex/agents/*.toml` 同时提供只读辅助子代理和写入型 worker 子代理。
- 这些子代理开始前必须先读 `AGENTS.md`、`docs/harness/task-session-strategy.md`、`.agents/rules/agents.md` 和对应 `.agents/skills/*/SKILL.md`（如存在）。
- 如果是被 stop hook 拦下后继续执行的下一轮，也先按上面这组文档重读一遍，再决定是否启用子代理。
- 如果主控需要更新 `task.json`、`AGENTS.md`、`.codex/*`、`.agents/rules/*`、`docs/harness/*`、prompt 或其他非 driver 内容，必须委派 `harness-writer`、`docs-worker` 或匹配的实现 worker，不能由主控会话自己写。
- 目标项目的 `.agents/` 默认不再复制项目运行时用的 `.codex/` 或 `docs/harness/`；这些内容直接安装到项目根。为了支持安装后的再次 bootstrap，`.agents/docs/codex-harness-engineering/templates/` 会保留模板复制源。
- `docs/knowledge/` 是项目级知识层；实现会话按 `knowledge-catalog.md`、`catalog.md`、具体条目的顺序按需读取，归档任务负责更新索引。
- 已有项目接入时，可先按 `docs/harness/knowledge-import.md` 冷启动 5-13 条 draft 知识；导入过程用 `import-state.json` 或导入报告记录 processed/pending/skipped/low_confidence 来源和 resume cursor，后续任务通过引用和验证逐步提升成熟度。
- 每隔一段任务后，按 `docs/harness/knowledge-lint.md` 检查索引一致、重复、冲突和长期未引用条目。
- 如果团队维护独立知识库，按 `docs/harness/team-knowledge-sync.md` 把跨项目候选写入 `contributions/pending/`；该同步失败只能降级为候选报告，不能阻塞本地实现验证。

## 4. UI 项目要求

- 保存设计参考图。
- 保存真实浏览器截图。
- 输出视觉对比报告。
