param(
  [string[]]$RequiredCommands = @("git", "codex"),
  [string[]]$RequiredEnvVars = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-CommandExists {
  <#
    检查命令是否存在。
  #>
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "缺少必需命令: $Name"
  }
}

function Assert-EnvVarExists {
  <#
    检查环境变量是否存在且非空。
  #>
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "缺少必需环境变量: $Name"
  }
}

foreach ($command in $RequiredCommands) {
  Assert-CommandExists -Name $command
}

foreach ($envVar in $RequiredEnvVars) {
  Assert-EnvVarExists -Name $envVar
}

Write-Output "Environment check passed."
