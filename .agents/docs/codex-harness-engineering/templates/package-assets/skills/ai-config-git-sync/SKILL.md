---
name: ai-config-git-sync
description: 审计、更新并 fan-out 共享 AI workflow/config 到多个 Git 项目。Use when Claude needs to read or edit `.ai-sync.yml`, `sync-targets.json`, managed mirrors, drift status, sync branches, pushes, or pull requests across multiple repositories.
---

# AI Config Git Sync

## Overview

这个 skill 用于维护“中央 AI 配置仓库 -> 多个项目仓库”的同步链路，支持只读审计和实际写入两种模式。

默认目标：

1. 找到当前变更的 canonical source。
2. 更新 root 脚本、`.ai-sync.yml` 或 package 文档，而不是直接改目标仓库里的 managed 文件。
3. 先把 `agent/` 包和 package-assets 镜像刷齐。
4. 再按 `sync-targets.json` 把改动 fan-out 到多个 Git 项目。
5. 默认走“同步分支 + push + 可选 PR”，不要直推目标仓库主分支。

先读 [references/command-recipes.md](references/command-recipes.md)。

## Repo Canonical Rules

- 共享同步脚本以 repo root 为 canonical：
  - `scripts/ai-workflow/check-ai-sync-drift.ps1`
  - `scripts/ai-workflow/sync-ai-config-to-targets.ps1`
  - `scripts/ai-workflow/sync-targets.example.json`
- `agent/.ai-sync.yml` 是 `agent/` 包的同步声明源。
- `.agents/skills/<name>` 是 repo-local skill 的 canonical source。
- `agent/`、`agent/docs/.../templates/package-assets/...`、`agent/skills/...` 都是镜像或发行面，不应先手工改。

## Workflow

### 1. Snapshot

先确认当前仓库状态：

```powershell
git status --short
git branch --show-current
```

如果只是读状态，停在审计模式；如果用户要真正更新多个项目，再进入写模式。

### 2. Decide the mode

`Audit mode` 适用于：

- 检查 `.ai-sync.yml` / manifest / lock 是否漂移
- 看哪些项目需要同步
- 预览目标列表、verify 命令和 PR 策略

`Write mode` 适用于：

- 更新 root 同步脚本或 skill
- 刷新 `agent/` 包
- 更新 `sync-targets.json`
- 对目标仓库建分支、提交、push、开 PR

### 3. Update canonical source first

如果需求涉及同步逻辑本身：

1. 先改 repo root 的 `scripts/ai-workflow/*`
2. 如果新增 skill，先改 `.agents/skills/<skill-name>`
3. 如果改 `agent` 包声明，再改 `agent/.ai-sync.yml`

不要先改这些路径里的 managed 副本：

- `agent/scripts/ai-workflow/*`
- `agent/skills/*`
- `agent/docs/codex-harness-engineering/templates/package-assets/*`

### 4. Refresh the package mirrors

root canonical 改完后，先刷新当前仓库自己的包面：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\refresh-agent-package.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\refresh-agent-package.ps1 -CheckOnly
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

如果新增/更新的是 skill，还要确认：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\agent\scripts\ai-workflow\check-ai-sync-drift.ps1
```

### 5. Prepare or update sync-targets.json

默认从示例开始：

```powershell
Copy-Item .\scripts\ai-workflow\sync-targets.example.json .\scripts\ai-workflow\sync-targets.json
```

然后补齐：

- `source.repo`
- `source.ref`
- `defaults.baseBranch`
- `defaults.pushBranch`
- `defaults.createPullRequest`
- 每个 `targets[*]` 的 `repo` 或 `localPath`
- 每个目标的 `syncConfigPath`

如果只是本地演练，优先使用 `localPath`、`-NoPush`、`-NoPullRequest`。

### 6. Run fan-out

标准执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json
```

常用变体：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -OnlyTargets your-org/project-a

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -NoPullRequest

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -NoPush -NoPullRequest
```

只有在用户明确接受源仓库未提交状态时，才加：

```powershell
-AllowDirtySource
```

### 7. Validate and report

至少汇报：

- 改了哪些 canonical source
- 是否已刷新 `agent/` 包
- 跑了哪些 drift / verify
- 同步了哪些目标仓库
- 建了哪些分支
- 是否 push
- 是否开 PR

## Guardrails

- 不要直接编辑目标仓库中的 managed 文件来“修同步”。
- 默认不要直推目标仓库 `main` / `master`。
- 源仓库或目标仓库脏工作区默认视为阻塞，除非用户明确要求继续。
- `sync-targets.json` 和 `.ai-sync.yml` 当前按 JSON 兼容格式处理；不要写成只能 YAML 解析器识别、但 `ConvertFrom-Json` 读不了的内容。
- 如果用户只要查看状态，不要顺手 push 或开 PR。
