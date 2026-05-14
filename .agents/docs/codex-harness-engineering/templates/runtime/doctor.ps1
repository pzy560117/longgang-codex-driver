param(
  [string]$ProjectRoot = "",
  [string]$TaskFile = "task.json",
  [string]$DefaultRunProfile = ".codex\\task-run-profile.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = $PSScriptRoot
}

function Test-JsonFile {
  param([string]$Path)

  try {
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Get-ExistingRelativePath {
  param(
    [string]$Root,
    [string]$RelativePath
  )

  $fullPath = Join-Path $Root $RelativePath
  if (Test-Path -LiteralPath $fullPath) {
    return $fullPath
  }

  return $null
}

function Add-DoctorError {
  param(
    [ref]$Errors,
    [string]$Message
  )

  $Errors.Value += $Message
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$taskPath = Join-Path $resolvedProjectRoot $TaskFile
$errors = @()

$requiredRootFiles = @(
  "AGENTS.md",
  "codex-loop.ps1",
  "doctor.ps1",
  "verify.ps1",
  "env-check.ps1",
  "task.json",
  "trace.schema.json"
)

$requiredPromptFiles = @(
  ".codex\\prompts\\implement-one-task.md",
  ".codex\\prompts\\controller-loop.md",
  ".codex\\prompts\\review-stage1-spec.md",
  ".codex\\prompts\\review-stage2-quality.md",
  ".codex\\prompts\\visual-evaluator.md",
  ".codex\\prompts\\failure-triage.md",
  ".codex\\prompts\\repair-one-finding.md",
  ".codex\\prompts\\harness-audit.md",
  ".codex\\prompts\\worker-role\\frontend-worker.md",
  ".codex\\prompts\\worker-role\\backend-worker.md",
  ".codex\\prompts\\worker-role\\test-runner.md",
  ".codex\\prompts\\worker-role\\docs-worker.md"
)

$requiredHarnessDocs = @(
  "docs\\harness\\architecture.md",
  "docs\\harness\\new-project-usage.md",
  "docs\\harness\\regression-rules.md",
  "docs\\harness\\sandbox-policy.md",
  "docs\\harness\\spec-to-ui-to-code-workflow.md",
  "docs\\harness\\task-session-strategy.md",
  "docs\\harness\\trace-format.md"
)

foreach ($relativePath in $requiredRootFiles + $requiredPromptFiles + $requiredHarnessDocs) {
  if (-not (Get-ExistingRelativePath -Root $resolvedProjectRoot -RelativePath $relativePath)) {
    Add-DoctorError -Errors ([ref]$errors) -Message "缺少必需文件: $relativePath"
  }
}

if (-not (Test-Path -LiteralPath $taskPath)) {
  Add-DoctorError -Errors ([ref]$errors) -Message "缺少任务文件: $TaskFile"
}
elseif (-not (Test-JsonFile -Path $taskPath)) {
  Add-DoctorError -Errors ([ref]$errors) -Message "task.json 不是合法 JSON: $TaskFile"
}
else {
  $taskDocument = Get-Content -LiteralPath $taskPath -Raw | ConvertFrom-Json
  $runtime = $taskDocument.runtime
  $runProfileRelativePath = $DefaultRunProfile
  if ($null -ne $runtime -and -not [string]::IsNullOrWhiteSpace($runtime.run_profile)) {
    $runProfileRelativePath = $runtime.run_profile
  }

  $runProfilePath = Join-Path $resolvedProjectRoot $runProfileRelativePath
  if (-not (Test-Path -LiteralPath $runProfilePath)) {
    Add-DoctorError -Errors ([ref]$errors) -Message "缺少 run profile: $runProfileRelativePath"
  }
  elseif (-not (Test-JsonFile -Path $runProfilePath)) {
    Add-DoctorError -Errors ([ref]$errors) -Message "run profile 不是合法 JSON: $runProfileRelativePath"
  }

  $allowedTaskKinds = @(
    "harness",
    "smoke",
    "feature_research",
    "feature_spec",
    "feature_design",
    "feature_plan",
    "feature_impl",
    "release",
    "archive"
  )
  $allowedGateProfiles = @(
    "lightweight",
    "research_required",
    "spec_required",
    "contract_required",
    "release_required"
  )
  $allowedTruthSources = @(
    "repo_context",
    "research",
    "product",
    "design",
    "plan",
    "testing",
    "contract",
    "knowledge"
  )
  $runtimeTruthSources = $null
  if ($null -ne $runtime -and $null -ne $runtime.PSObject.Properties["handoff"]) {
    $handoff = $runtime.handoff
    if ($null -ne $handoff -and $null -ne $handoff.PSObject.Properties["truth_sources"]) {
      $runtimeTruthSources = $handoff.truth_sources
    }
  }
  if ($null -ne $runtimeTruthSources) {
    foreach ($truthSourceProperty in $runtimeTruthSources.PSObject.Properties) {
      $truthSourceName = [string]$truthSourceProperty.Name
      if (-not [string]::IsNullOrWhiteSpace($truthSourceName) -and $allowedTruthSources -notcontains $truthSourceName) {
        $allowedTruthSources += $truthSourceName
      }
    }
  }

  $taskIds = @{}
  foreach ($task in @($taskDocument.tasks)) {
    if ($null -eq $task.id -or [string]::IsNullOrWhiteSpace([string]$task.id)) {
      Add-DoctorError -Errors ([ref]$errors) -Message "存在缺少 id 的任务。"
      continue
    }

    if ($taskIds.ContainsKey($task.id)) {
      Add-DoctorError -Errors ([ref]$errors) -Message "存在重复 task id: $($task.id)"
    }
    else {
      $taskIds[$task.id] = $true
    }

    $taskKindProperty = $task.PSObject.Properties["task_kind"]
    $taskKind = if ($null -ne $taskKindProperty) { [string]$taskKindProperty.Value } else { "" }
    if (-not [string]::IsNullOrWhiteSpace($taskKind) -and $allowedTaskKinds -notcontains $taskKind) {
      Add-DoctorError -Errors ([ref]$errors) -Message "任务 $($task.id) 使用了未知 task_kind: $taskKind"
    }

    $gateProfileProperty = $task.PSObject.Properties["gate_profile"]
    $gateProfile = if ($null -ne $gateProfileProperty) { [string]$gateProfileProperty.Value } else { "" }
    if (-not [string]::IsNullOrWhiteSpace($gateProfile) -and $allowedGateProfiles -notcontains $gateProfile) {
      Add-DoctorError -Errors ([ref]$errors) -Message "任务 $($task.id) 使用了未知 gate_profile: $gateProfile"
    }

    $requiredTruthSourcesProperty = $task.PSObject.Properties["required_truth_sources"]
    $requiredTruthSources = if ($null -ne $requiredTruthSourcesProperty) { $requiredTruthSourcesProperty.Value } else { @() }
    foreach ($truthSource in @($requiredTruthSources)) {
      if ($allowedTruthSources -notcontains [string]$truthSource) {
        Add-DoctorError -Errors ([ref]$errors) -Message "任务 $($task.id) 使用了未知 required_truth_source: $truthSource"
      }
    }
  }
}

if ($errors.Count -gt 0) {
  Write-Output "Runtime doctor failed."
  foreach ($errorMessage in $errors) {
    Write-Output "- $errorMessage"
  }
  exit 1
}

Write-Output "Runtime doctor passed."
