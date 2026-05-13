param(
  [ValidateSet("full")]
  [string]$Mode = "full",
  [switch]$Force,
  [switch]$InitSmoke,
  [switch]$CommitBaseline,
  [switch]$SkipBaselineCommit,
  [switch]$InitGitIfNeeded
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$packageRoot = $PSScriptRoot
$projectRoot = Split-Path -Parent $packageRoot
$installScript = Join-Path $packageRoot "install-agent.ps1"

if (-not (Test-Path -LiteralPath $installScript)) {
  throw "找不到 install-agent.ps1: $installScript"
}

if ([System.IO.Path]::GetFileName($packageRoot) -eq ".agents") {
  throw "当前脚本位于已安装的 .agents 根目录，不是可移植 agent 包目录。请从独立的 agent/ 包目录运行，或直接调用 install-agent.ps1 并显式传入 -ProjectRoot。"
}

if ([System.IO.Path]::GetFileName($projectRoot) -eq ".agents") {
  throw "当前脚本位于 .agents/agent 下，这是源包目录，不是目标项目根目录。请改用 install-agent.ps1 并显式传入 -ProjectRoot。"
}

Write-Host "[install-agent-here] Target project root: $projectRoot"

$arguments = @{
  ProjectRoot = $projectRoot
  Mode = $Mode
}

if ($Force.IsPresent) {
  $arguments["Force"] = $true
}

if ($InitSmoke.IsPresent) {
  $arguments["InitSmoke"] = $true
}

if ($CommitBaseline.IsPresent) {
  $arguments["CommitBaseline"] = $true
}

if ($SkipBaselineCommit.IsPresent) {
  $arguments["SkipBaselineCommit"] = $true
}

if ($InitGitIfNeeded.IsPresent) {
  $arguments["InitGitIfNeeded"] = $true
}

& $installScript @arguments
