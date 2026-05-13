# Codex Harness Package

## Mode Policy

当前包只支持 `full` 模式。旧的非完整安装分支已移除，避免维护多套状态源、提交责任和验证入口。

保留的完整链路：

- `task.json`
- `codex-loop.ps1`
- `doctor.ps1`
- `verify.ps1`
- `progress.txt`
- `traces/*.json`
- `docs/harness/*`
- `docs/testing/*`
- `.agents/rules/*`
- `.agents/workflows/*`
- `.agents/.specify/*`
- `.agents/skills/*`

SpecKit 仍作为 full 链路里的需求、计划和任务输入能力存在；不再作为独立 stop hook 轻量运行时存在。

## Install

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\agent\install-agent-here.ps1 -InitGitIfNeeded
```

或从已安装包刷新：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.agents\install-agent.ps1 -ProjectRoot . -Mode full -Force
```

## Smoke

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\harness\test-install-modes.ps1
```

该 smoke 只检查 full 安装产物。
