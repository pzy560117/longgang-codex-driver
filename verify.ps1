param(
  [string]$ProjectRoot = "",
  [string[]]$Commands = @("git diff --check"),
  [string[]]$HookConfigPaths = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = $PSScriptRoot
}

function Invoke-VerificationCommand {
  param(
    [string]$Command,
    [string]$Root
  )

  Push-Location $Root
  try {
    Write-Output "Running: $Command"
    powershell -NoProfile -Command $Command
    if ($LASTEXITCODE -ne 0) {
      throw "验证失败，退出码 $($LASTEXITCODE): $Command"
    }
  }
  finally {
    Pop-Location
  }
}

function Get-CodexHookCommand {
  param(
    [object]$Node,
    [string]$Path = "$"
  )

  if ($null -eq $Node -or $Node -is [string]) {
    return
  }

  if ($Node -is [System.Collections.IEnumerable] -and $Node -isnot [System.Collections.IDictionary]) {
    $index = 0
    foreach ($item in $Node) {
      Get-CodexHookCommand -Node $item -Path "${Path}[$index]"
      $index += 1
    }
    return
  }

  foreach ($property in $Node.PSObject.Properties) {
    $childPath = "$Path.$($property.Name)"
    if ($property.Name -eq "command" -and $property.Value -is [string]) {
      [pscustomobject]@{
        Path = $childPath
        Command = $property.Value
      }
    }

    Get-CodexHookCommand -Node $property.Value -Path $childPath
  }
}

function Get-CandidateHookConfigPaths {
  param(
    [string]$Root,
    [string[]]$AdditionalPaths
  )

  return @(
    (Join-Path $HOME ".codex\hooks.json"),
    (Join-Path $Root ".codex\hooks.json"),
    (Join-Path $Root "docs\codex-harness-engineering\templates\hooks\hooks.json"),
    (Join-Path $Root "agent\docs\codex-harness-engineering\templates\hooks\hooks.json")
  ) + $AdditionalPaths
}

function Resolve-HookScriptReference {
  param(
    [string]$Root,
    [string]$Command
  )

  $expanded = $Command.Replace('$(git rev-parse --show-toplevel)', $Root.Replace('\', '/'))
  $scriptPath = $null

  if ($expanded -match '"([^"]*hook-stop-verify\.ps1)"') {
    $scriptPath = $Matches[1]
  }
  elseif ($expanded -match '(\S*hook-stop-verify\.ps1)') {
    $scriptPath = $Matches[1]
  }

  if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    return $null
  }

  $scriptPath = $scriptPath.Replace('/', '\')
  if ([System.IO.Path]::IsPathRooted($scriptPath)) {
    return $scriptPath
  }

  return (Join-Path $Root $scriptPath)
}

function Test-HookScriptInstallMapping {
  param(
    [string]$Root,
    [string]$ResolvedScriptPath
  )

  if (Test-Path -LiteralPath $ResolvedScriptPath) {
    return $true
  }

  $relativeExpectedPath = "scripts\harness\hook-stop-verify.ps1"
  $normalized = $ResolvedScriptPath.Replace("/", "\")
  if (-not $normalized.EndsWith($relativeExpectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $false
  }

  $templateScript = Join-Path $Root "docs\codex-harness-engineering\templates\hooks\hook-stop-verify.ps1"
  $bootstrapScript = Join-Path $Root "bootstrap-codex-harness.ps1"
  if (-not ((Test-Path -LiteralPath $templateScript) -and (Test-Path -LiteralPath $bootstrapScript))) {
    return $false
  }

  $bootstrapText = Get-Content -LiteralPath $bootstrapScript -Raw
  return $bootstrapText.Contains('hooks\hook-stop-verify.ps1') -and $bootstrapText.Contains('scripts\harness\hook-stop-verify.ps1')
}

function Test-CodexHookCommandCompatibility {
  param(
    [string]$Root,
    [string[]]$AdditionalPaths
  )

  $seen = @{}
  foreach ($path in Get-CandidateHookConfigPaths -Root $Root -AdditionalPaths $AdditionalPaths) {
    if ([string]::IsNullOrWhiteSpace($path) -or $seen.ContainsKey($path)) {
      continue
    }
    $seen[$path] = $true

    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $hookConfig = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    foreach ($entry in Get-CodexHookCommand -Node $hookConfig) {
      if ($entry.Command -match '^\s*"[^"]*\\PowerShell\\[^"]*\\pwsh(?:\.exe)?"\s+') {
        throw "高风险 Codex hook command: $path $($entry.Path)。带空格的 quoted PowerShell executable 在 PowerShell 外层解释时会被当作字符串。请改用 pwsh、C:\Progra~1\PowerShell\7\pwsh.exe，或在确认外层是 PowerShell 时使用 & 调用。"
      }

      $scriptReference = Resolve-HookScriptReference -Root $Root -Command $entry.Command
      if ($null -ne $scriptReference -and -not (Test-HookScriptInstallMapping -Root $Root -ResolvedScriptPath $scriptReference)) {
        throw "Codex hook command 指向的脚本不可解析或未被 bootstrap 安装: $path $($entry.Path) -> $scriptReference"
      }
    }
  }
}

function Test-PowerShellSyntax {
  param([string]$Root)

  $paths = @(
    "bootstrap-codex-harness.ps1",
    "codex-loop.ps1",
    "env-check.ps1",
    "install-agent.ps1",
    "install-agent-here.ps1",
    "verify.ps1",
    "docs\codex-harness-engineering\templates\bootstrap-codex-harness.ps1",
    "docs\codex-harness-engineering\templates\hooks\hook-stop-verify.ps1"
  )

  foreach ($relativePath in $paths) {
    $path = Join-Path $Root $relativePath
    if (-not (Test-Path -LiteralPath $path)) {
      continue
    }

    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
      $messages = ($errors | ForEach-Object { $_.Message }) -join "; "
      throw "PowerShell 语法检查失败: $relativePath - $messages"
    }
  }
}

function Get-RelativePathCompat {
  param(
    [string]$Root,
    [string]$Path
  )

  $rootFull = ([System.IO.Path]::GetFullPath($Root)).TrimEnd('\', '/') + '\'
  $pathFull = [System.IO.Path]::GetFullPath($Path)
  if ($pathFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $pathFull.Substring($rootFull.Length)
  }

  return $pathFull
}

function Test-NoStaleFeedbackMcpReferences {
  param([string]$Root)

  $scanRoots = @(
    "docs\harness",
    "docs\codex-harness-engineering"
  )

  $blockedPatterns = @(
    "interactive_feedback",
    "mcp-feedback-enhanced"
  )

  foreach ($scanRoot in $scanRoots) {
    $fullScanRoot = Join-Path $Root $scanRoot
    if (-not (Test-Path -LiteralPath $fullScanRoot)) {
      continue
    }

    foreach ($file in Get-ChildItem -LiteralPath $fullScanRoot -Recurse -File -Include *.md,*.toml,*.json,*.ps1) {
      $relativePath = Get-RelativePathCompat -Root $Root -Path $file.FullName
      if ($relativePath.EndsWith("templates\runtime\verify.ps1", [System.StringComparison]::OrdinalIgnoreCase)) {
        continue
      }

      $content = Get-Content -LiteralPath $file.FullName -Raw
      $text = if ($null -eq $content) { "" } else { [string]$content }
      foreach ($pattern in $blockedPatterns) {
        if ($text.Contains($pattern)) {
          throw "发现已移除的 feedback MCP 引用: $relativePath contains '$pattern'"
        }
      }
    }
  }
}

function Invoke-AgentPackageFreshnessCheck {
  param([string]$Root)

  $packageRoot = Join-Path $Root "agent"
  $packageConfig = Join-Path $packageRoot ".ai-sync.yml"
  $refreshScript = Join-Path $Root "refresh-agent-package.ps1"
  $packageSourceMarker = Join-Path $Root "docs\codex-harness-engineering\templates\package-assets\root\install-agent.ps1"

  if (-not (Test-Path -LiteralPath $packageConfig -PathType Leaf)) {
    return
  }

  $hasRefreshScript = Test-Path -LiteralPath $refreshScript -PathType Leaf
  $hasPackageSourceMarker = Test-Path -LiteralPath $packageSourceMarker -PathType Leaf

  if ($hasPackageSourceMarker -and -not $hasRefreshScript) {
    throw "检测到 agent package source repo 标记，但缺少 refresh-agent-package.ps1，无法校验 freshness。"
  }

  if (-not ($hasRefreshScript -and $hasPackageSourceMarker)) {
    return
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File $refreshScript -RepoRoot $Root -PackageRoot $packageRoot -CheckOnly | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "agent package freshness 检查失败。"
  }
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path

foreach ($command in $Commands) {
  Invoke-VerificationCommand -Command $command -Root $resolvedProjectRoot
}

Test-CodexHookCommandCompatibility -Root $resolvedProjectRoot -AdditionalPaths $HookConfigPaths
Test-PowerShellSyntax -Root $resolvedProjectRoot
Test-NoStaleFeedbackMcpReferences -Root $resolvedProjectRoot
Invoke-AgentPackageFreshnessCheck -Root $resolvedProjectRoot

Write-Output "Verification passed."
