---
name: Auto Review and Commit
description: 检查当前工作区、补齐必要同步与验证、生成提交信息，并在缺少远程仓库时使用 GitHub CLI 自动建仓后提交推送
---

# Auto Review and Commit

## Overview

这个 skill 用于把“收尾检查 -> 必要修补 -> 提交 -> 推送”收敛成一次完整动作。

默认目标：

1. 检查当前工作区和分支状态。
2. 发现并补齐当前仓库需要的镜像同步或收尾修改。
3. 跑最小必要验证，避免把明显错误提交上去。
4. 生成清晰的 Conventional Commits 提交信息。
5. 如果没有远程仓库，使用 GitHub CLI 创建 GitHub 仓库并绑定 `origin`。
6. 提交并推送当前分支。

## When To Use

适用于：

- 功能、文档、模板、规则或 skill 修改已经完成，准备收尾提交
- 需要自动检查当前工作区是否还有漏同步、漏验证、漏暂存内容
- 本地仓库还没有 `origin`，希望直接用 `gh` 创建 GitHub 仓库后推送
- 当前仓库是 Codex Harness 类仓库，修改分布在 `.agents/`、`agent/`、`templates/`、`package-assets/`、`skills/` 等多处镜像

不适用于：

- 需求还没稳定、代码还在大改阶段
- 明显混入了多件互不相关的变更但用户还没确认要一起提交
- 存在未修复的测试失败、敏感信息泄露或明显错误

## Current Repo Rule

当前仓库不是普通应用仓库，而是带有多层镜像的 harness/package 仓库。

如果改动涉及这些区域：

- `.agents/`
- `agent/`
- `docs/harness/`
- `docs/testing/`
- `agent/docs/codex-harness-engineering/templates/`
- `agent/docs/codex-harness-engineering/templates/package-assets/`
- `.agents/docs/codex-harness-engineering/templates/`
- `.agents/skills/`

提交前必须先检查 canonical source 和镜像是否一致。优先参考：

- `.agents/skills/harness-surface-sync/SKILL.md`
- `.agents/skills/harness-surface-sync/references/current-repo-sync-matrix.md`
- `.agents/skills/harness-surface-sync/references/stale-patterns.md`

如果工作区里只是“改了一个 canonical file，但没把镜像补齐”，这个 skill 的默认行为应该是先补齐，再提交，而不是把半成品直接推上去。

## Workflow

### 1. Snapshot the repo

先确认当前仓库状态：

```powershell
git status --short
git diff --stat
git branch --show-current
git remote -v
& 'C:\Program Files\GitHub CLI\gh.exe' auth status
```

检查点：

- 当前分支是什么
- 是否已经有远程 `origin`
- 是否有未跟踪文件
- 是否存在明显混杂的无关改动
- `gh` 是否已经登录

### 2. Decide whether sync/fix is still needed

如果改动命中了当前仓库的镜像面，先不要急着提交。

最小判断规则：

- 如果只改了 `.agents/skills/<name>`，要同步到 `agent/skills/<name>` 和两套 `package-assets/skills/<name>`
- 如果改了 `docs/testing/*` 或 `docs/harness/*`，要检查 `agent/`、`.agents/`、templates、package-assets 是否缺同步
- 如果改了 `agent/docs/codex-harness-engineering/templates/*`，要同步到 `.agents/docs/codex-harness-engineering/templates/*`
- 如果改了说明文档、skill 入口或 skill 索引，相关镜像也要同步

必要时用 `rg` 快速扫旧表述、漏同步和 stale wording，而不是盲目全量改动。

### 3. Run safety and quality checks

至少做这些检查：

- 敏感信息
- 大文件
- 调试残留
- 最小格式/语法/结构验证

常用命令：

```powershell
git diff --check
rg -n "API_KEY|SECRET|PASSWORD|TOKEN|console\.log|TODO|FIXME" .
```

按文件类型补充：

- JSON:

```powershell
Get-Content <file>.json -Raw | ConvertFrom-Json | Out-Null
```

- PowerShell:

```powershell
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path <file>.ps1), [ref]$null, [ref]$null) | Out-Null
```

- 镜像同步核对：

```powershell
(Get-FileHash <left>).Hash -eq (Get-FileHash <right>).Hash
```

- 代码仓库应补充项目要求的测试、lint、build 或 verify

如果验证失败，先修复，不进入提交。

### 4. Stage only the intended result

不要无脑 `git add .`，除非当前工作区已经明确只有本次要提交的内容。

优先：

```powershell
git status --short
git add <intentional files>
git diff --cached --stat
```

只有在确认当前工作树就是一次完整交付时，才允许整体暂存：

```powershell
git add -A
```

### 5. Generate the commit message

提交信息仍然优先使用 Conventional Commits：

- `feat`: 新功能
- `fix`: 缺陷修复
- `refactor`: 重构
- `test`: 测试
- `docs`: 文档
- `chore`: 配置、脚本、仓库维护

当前仓库常见场景：

- 改规则、模板、workflow、skill：通常是 `docs(...)`、`chore(...)` 或 `refactor(...)`
- 改 runtime 脚本、driver、doctor、verify：通常是 `feat(...)`、`fix(...)` 或 `chore(...)`
- 新增或升级 repo-local skill：通常是 `feat(skills)`、`chore(skills)` 或 `docs(skills)`

### 6. Ensure a GitHub remote exists

如果没有远程仓库，默认使用 GitHub CLI 创建。

先检查：

```powershell
git remote -v
& 'C:\Program Files\GitHub CLI\gh.exe' auth status
```

如果没有 `origin`：

1. 用 `gh api user --jq .login` 取当前登录账号
2. 以当前目录名作为默认仓库名
3. 默认创建私有仓库

常用流程：

```powershell
$owner = & 'C:\Program Files\GitHub CLI\gh.exe' api user --jq .login
$repo = Split-Path -Leaf (Get-Location)
& 'C:\Program Files\GitHub CLI\gh.exe' repo create "$owner/$repo" --private --source=. --remote=origin
```

如果本地仓库还没有任何提交，先完成首次提交，再执行 push。

### 7. Commit

正常优先：

```powershell
git commit -m "<type>(<scope>): <subject>"
```

如果需要 body：

```powershell
git commit -m "<type>(<scope>): <subject>" -m "<body line 1>`n<body line 2>"
```

如果 `git commit` 因 hook 卡住或外部检查长时间不返回，不要立刻重复提交。先做诊断：

```powershell
git config --get core.hooksPath
Get-Process git, pwsh -ErrorAction SilentlyContinue
```

只有在确认是 hook 阻塞、并且当前任务目标就是完成仓库初始化或推送时，才允许使用：

```powershell
git commit --no-verify -m "<type>(<scope>): <subject>"
```

使用 `--no-verify` 后，必须在最终汇报里明确说明原因。

### 8. Push

如果远程和上游已经存在：

```powershell
git push
```

如果当前分支还没有上游：

```powershell
$branch = git branch --show-current
git push -u origin $branch
```

如果是首次建仓，也可以直接用：

```powershell
& 'C:\Program Files\GitHub CLI\gh.exe' repo create "<owner>/<repo>" --private --source=. --remote=origin --push
```

禁止默认行为：

- 不 force push 公共分支
- 不创建 public repo，除非用户明确要求
- 不把未确认的混合改动一次性推上去

### 9. Verify the published result

推送后至少确认：

```powershell
git status --short
git branch -vv
git remote -v
& 'C:\Program Files\GitHub CLI\gh.exe' repo view --json name,visibility,url,defaultBranchRef
```

期望结果：

- 工作树干净
- 当前分支已追踪远程分支
- 仓库 URL 可访问
- 仓库可见性符合预期

## Auto Mode vs Review Mode

### Auto Mode

适合：

- 改动边界清楚
- 镜像同步已经补齐或很容易自动补齐
- 验证结果明确通过
- 没有敏感信息和明显风险

默认行为：

1. 检查
2. 补齐必要同步
3. 暂存
4. 提交
5. 建仓或推送

### Review Mode

适合：

- 改动跨多个模块
- 有警告但未必阻塞
- 远程仓库策略不明确
- 有多组不相关修改

默认行为：

1. 先给出发现项
2. 说明哪些需要先修
3. 修完后再进入提交推送

## Output Requirements

完成后应汇报：

- 本次提交 hash
- 提交信息
- 推送的分支
- 远程仓库 URL
- 是否新建了 GitHub 仓库
- 是否使用了 `--no-verify`
- 是否还存在未处理风险

## Guardrails

- 不提交敏感信息、密钥或密码
- 不提交明显失败的验证结果
- 不覆盖用户未确认的无关改动
- 不 force push
- 不跳过镜像同步直接提交半成品
- 不把 `gh` 未登录、远程创建失败等问题假装成功
