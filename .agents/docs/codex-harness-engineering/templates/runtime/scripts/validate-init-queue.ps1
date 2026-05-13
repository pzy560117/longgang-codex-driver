param(
  [string]$ProjectRoot = (Get-Location).Path,
  [string]$TaskFile = "task.json",
  [string]$TemplateFile = "project-task-template.json",
  [string]$VerifyMatrixFile = "docs\testing\verify-matrix.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Get-JsonDocument {
  param([string]$Path)

  Assert-Condition -Condition (Test-Path -LiteralPath $Path) -Message "文件不存在: $Path"
  $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  Assert-Condition -Condition (-not [string]::IsNullOrWhiteSpace($content)) -Message "文件为空: $Path"
  return ($content | ConvertFrom-Json)
}

function ConvertTo-StringArray {
  param([object]$Value)

  if ($null -eq $Value) {
    return @()
  }

  if ($Value -is [string]) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
      return @()
    }

    return @($Value)
  }

  $items = @()
  foreach ($item in $Value) {
    if ($null -ne $item) {
      $items += [string]$item
    }
  }

  return $items
}

function Test-ExactArray {
  param(
    [string[]]$Actual,
    [string[]]$Expected
  )

  if ($Actual.Count -ne $Expected.Count) {
    return $false
  }

  for ($index = 0; $index -lt $Expected.Count; $index++) {
    if ($Actual[$index] -ne $Expected[$index]) {
      return $false
    }
  }

  return $true
}

function Test-ContainsPath {
  param(
    [object]$Task,
    [string]$RequiredPath
  )

  $normalizedRequiredPath = $RequiredPath.Replace("/", "\")
  $normalizedContextPaths = @(ConvertTo-StringArray -Value $Task.context_files | ForEach-Object { ([string]$_).Replace("/", "\") })
  return $normalizedContextPaths -contains $normalizedRequiredPath
}

function Assert-TaskExists {
  param(
    [hashtable]$TaskMap,
    [string]$TaskId
  )

  Assert-Condition -Condition $TaskMap.ContainsKey($TaskId) -Message "task.json 缺少任务: $TaskId"
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$taskPath = Join-Path $resolvedProjectRoot $TaskFile
$templatePath = Join-Path $resolvedProjectRoot $TemplateFile
$verifyMatrixPath = Join-Path $resolvedProjectRoot $VerifyMatrixFile

$taskDocument = Get-JsonDocument -Path $taskPath
$templateDocument = Get-JsonDocument -Path $templatePath

$normalizedTask = $taskDocument | ConvertTo-Json -Depth 20
$normalizedTemplate = $templateDocument | ConvertTo-Json -Depth 20
Assert-Condition -Condition ($normalizedTask -eq $normalizedTemplate) -Message "task.json 与 project-task-template.json 不一致。请先同步标准入口模板。"

$taskMap = @{}
foreach ($task in @($taskDocument.tasks)) {
  $taskMap[[string]$task.id] = $task
  Assert-Condition -Condition (-not ([string]$task.id).StartsWith("SMOKE", [System.StringComparison]::OrdinalIgnoreCase)) -Message "正式任务队列中仍包含 SMOKE 任务: $($task.id)"
}

$expectedDirtyPaths = @("progress.txt", "traces/")
$actualDirtyPaths = ConvertTo-StringArray -Value $taskDocument.runtime.git.non_blocking_dirty_paths
Assert-Condition -Condition (Test-ExactArray -Actual $actualDirtyPaths -Expected $expectedDirtyPaths) -Message "runtime.git.non_blocking_dirty_paths 必须精确等于: progress.txt, traces/"

Assert-Condition -Condition (Test-Path -LiteralPath $verifyMatrixPath) -Message "缺少 verify matrix: $verifyMatrixPath"
$verifyMatrixText = Get-Content -LiteralPath $verifyMatrixPath -Raw -Encoding UTF8
$requiredVerifyPhrases = @(
  "handoff / analysis / design / plan 当前只跑文档级验证",
  "runtime preflight 由 driver 负责",
  "PLAN-001 负责把实现阶段验证替换成真实命令",
  "scripts/validate-queue-placeholders.ps1"
)
foreach ($phrase in $requiredVerifyPhrases) {
  Assert-Condition -Condition ($verifyMatrixText.Contains($phrase)) -Message "verify-matrix 缺少关键边界说明: $phrase"
}

foreach ($taskId in @("INIT-001", "ANALYSIS-001", "DESIGN-001", "PLAN-001")) {
  Assert-TaskExists -TaskMap $taskMap -TaskId $taskId
}

$initTask = $taskMap["INIT-001"]
Assert-Condition -Condition ([string]$initTask.phase -eq "handoff") -Message "INIT-001.phase 必须为 handoff"
Assert-Condition -Condition (@(ConvertTo-StringArray -Value $initTask.dependencies).Count -eq 0) -Message "INIT-001 不能依赖其他任务"
Assert-Condition -Condition (Test-ExactArray -Actual (ConvertTo-StringArray -Value $initTask.required_truth_sources) -Expected @("plan")) -Message "INIT-001.required_truth_sources 必须只依赖 plan"
Assert-Condition -Condition ([string]$initTask.test_command -match 'scripts\\validate-init-queue\.ps1') -Message "INIT-001.test_command 必须使用 scripts/validate-init-queue.ps1"
foreach ($requiredPath in @("AGENTS.md", "task.json", "project-task-template.json", "docs\context\dev-plan.md", "docs\testing\verify-matrix.md")) {
  Assert-Condition -Condition (Test-ContainsPath -Task $initTask -RequiredPath $requiredPath) -Message "INIT-001.context_files 缺少: $requiredPath"
}

$analysisTask = $taskMap["ANALYSIS-001"]
Assert-Condition -Condition ([string]$analysisTask.phase -eq "analysis") -Message "ANALYSIS-001.phase 必须为 analysis"
Assert-Condition -Condition (Test-ExactArray -Actual (ConvertTo-StringArray -Value $analysisTask.dependencies) -Expected @("INIT-001")) -Message "ANALYSIS-001 必须只依赖 INIT-001"

$designTask = $taskMap["DESIGN-001"]
Assert-Condition -Condition ([string]$designTask.phase -eq "design") -Message "DESIGN-001.phase 必须为 design"
Assert-Condition -Condition (Test-ExactArray -Actual (ConvertTo-StringArray -Value $designTask.dependencies) -Expected @("ANALYSIS-001")) -Message "DESIGN-001 必须只依赖 ANALYSIS-001"
Assert-Condition -Condition (-not ((ConvertTo-StringArray -Value $designTask.required_truth_sources) -contains "design")) -Message "DESIGN-001 不能把 design 配成前置 truth source"
Assert-Condition -Condition (Test-ContainsPath -Task $designTask -RequiredPath "docs\context\dev-plan.md") -Message "DESIGN-001.context_files 必须包含 docs/context/dev-plan.md"

$planTask = $taskMap["PLAN-001"]
Assert-Condition -Condition ([string]$planTask.phase -eq "plan") -Message "PLAN-001.phase 必须为 plan"
Assert-Condition -Condition (Test-ExactArray -Actual (ConvertTo-StringArray -Value $planTask.dependencies) -Expected @("DESIGN-001")) -Message "PLAN-001 必须只依赖 DESIGN-001"
Assert-Condition -Condition (-not ((ConvertTo-StringArray -Value $planTask.required_truth_sources) -contains "plan")) -Message "PLAN-001 不能把 plan 配成前置 truth source"

$placeholderPhases = @("foundation", "domain", "verify")
foreach ($task in @($taskDocument.tasks | Where-Object { $placeholderPhases -contains [string]$_.phase })) {
  $expectedCommandPattern = [regex]::Escape("scripts\validate-queue-placeholders.ps1") + ".*" + [regex]::Escape($task.id)
  Assert-Condition -Condition ([string]$task.test_command -match $expectedCommandPattern) -Message "$($task.id).test_command 仍未绑定 placeholder sentinel 或 TaskId 不匹配"
  Assert-Condition -Condition (Test-ContainsPath -Task $task -RequiredPath "docs\context\dev-plan.md") -Message "$($task.id).context_files 必须包含 docs/context/dev-plan.md"
}

Push-Location $resolvedProjectRoot
try {
  $diffOutput = & git diff --check 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git diff --check 失败:`n$($diffOutput -join "`n")"
  }
}
finally {
  Pop-Location
}

Write-Output "INIT queue contract validation passed."
