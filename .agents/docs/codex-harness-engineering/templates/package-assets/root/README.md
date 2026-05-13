# Codex Harness Agent Package

本包只保留 `full` 安装模式。安装后目标项目使用 `task.json + codex-loop.ps1` 作为唯一自动执行入口，driver 负责选择任务、运行验证、写 trace、更新进度和提交结果。

SpecKit 相关 `.specify/`、`workflows/speckit.*` 和 `speckit-*` skills 仍随 full 包安装，但它们用于需求、计划和任务输入生成；方案确认后应转入 `task.json`，再交给 full driver 执行。

## 安装

从包含 `agent/` 包目录的项目父目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\agent\install-agent-here.ps1 -InitGitIfNeeded
```

从已安装的 `.agents/` 自更新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.agents\install-agent.ps1 -ProjectRoot . -Mode full -Force
```

## 安装产物

- 项目根 `AGENTS.md`
- 项目根 `codex-loop.ps1`、`doctor.ps1`、`verify.ps1`、`env-check.ps1`
- 项目根 `task.json`、`smoke-task.json`、`project-task-template.json`
- 项目根 `.codex/`
- 项目根 `docs/harness/`、`docs/testing/`
- 项目根 `.agents/` 完整能力包，包括 rules、skills、workflows、`.specify/` 和模板复制源

## 使用顺序

1. 读取项目根 `AGENTS.md`。
2. 用 `docs/harness/new-project-usage.md`、`docs/harness/architecture.md` 和 `docs/testing/*` 收敛项目上下文。
3. 必要时使用 SpecKit workflow 生成 spec / plan / tasks 输入。
4. 将确认后的任务写入 `task.json`。
5. 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
```

## 验证安装包

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\harness\test-install-modes.ps1
```

该脚本现在只验证 full 安装形状。
