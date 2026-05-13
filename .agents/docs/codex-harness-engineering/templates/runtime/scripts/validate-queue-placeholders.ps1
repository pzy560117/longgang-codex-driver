param(
  [string]$TaskId = "",
  [string]$ProjectRoot = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$taskLabel = if ([string]::IsNullOrWhiteSpace($TaskId)) { "当前实现任务" } else { $TaskId }

throw @"
$taskLabel 仍在使用默认占位验证 `scripts/validate-queue-placeholders.ps1`。
这表示 PLAN-001 还没有把实现阶段 test_command 重写成真实项目命令。

需要至少补齐与 verify-matrix 一致的真实命令，例如:
- lint
- typecheck
- unit / integration test
- build
- E2E / visual parity

完成重写后，再重新运行 codex-loop.ps1。
"@
