# Command Recipes

## 1. 检查当前 `agent/` 包是否已同步

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\refresh-agent-package.ps1 -CheckOnly
```

## 2. 检查已安装包的 managed 漂移

在目标项目根目录：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\check-ai-sync-drift.ps1
```

在当前仓库检查 `agent/` 包：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\agent\scripts\ai-workflow\check-ai-sync-drift.ps1
```

## 3. 刷新当前仓库的 `agent/` 包

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\refresh-agent-package.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

## 4. 生成多项目同步配置

```powershell
Copy-Item .\scripts\ai-workflow\sync-targets.example.json .\scripts\ai-workflow\sync-targets.json
```

最小配置骨架：

```json
{
  "source": {
    "repo": "your-org/ai-workflow-kit",
    "ref": "main"
  },
  "defaults": {
    "baseBranch": "main",
    "branchPrefix": "chore/ai-kit-sync",
    "pushBranch": true,
    "createPullRequest": true,
    "syncConfigPath": ".ai-sync.yml"
  },
  "targets": [
    {
      "repo": "your-org/project-a",
      "baseBranch": "main",
      "syncConfigPath": ".ai-sync.yml"
    }
  ]
}
```

## 5. Fan-out 到多个目标仓库

标准模式：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json
```

只跑单个目标：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -OnlyTargets your-org/project-a
```

只建分支和提交，不开 PR：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -NoPullRequest
```

本地演练，不 push：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\ai-workflow\sync-ai-config-to-targets.ps1 -ConfigPath .\scripts\ai-workflow\sync-targets.json -NoPush -NoPullRequest
```

## 6. 常见判断

- 要改同步逻辑：先改 root `scripts/ai-workflow/*`
- 要改 skill：先改 `.agents/skills/<name>`
- 要改安装包映射：改 `agent/.ai-sync.yml`
- 要把改动发到多个项目：先 `refresh-agent-package.ps1`，再 `sync-ai-config-to-targets.ps1`
