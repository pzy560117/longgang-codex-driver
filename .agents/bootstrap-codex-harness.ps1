param(
  [string]$ProjectRoot = "",
  [string]$TemplateRoot = "",
  [switch]$Force,
  [switch]$IncludeDocs = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = $PSScriptRoot
}

function Resolve-TemplateRoot {
  <#
    解析模板目录，兼容从 templates/ 或项目根目录运行。
  #>
  param(
    [string]$ProjectPath,
    [string]$ExplicitTemplateRoot
  )

  $candidates = @()
  if (-not [string]::IsNullOrWhiteSpace($ExplicitTemplateRoot)) {
    $candidates += $ExplicitTemplateRoot
  }

  $candidates += @(
    (Join-Path $PSScriptRoot "docs\codex-harness-engineering\templates"),
    (Join-Path $PSScriptRoot ".agents\docs\codex-harness-engineering\templates"),
    $PSScriptRoot,
    (Join-Path $ProjectPath "docs\codex-harness-engineering\templates"),
    (Join-Path $ProjectPath ".agents\docs\codex-harness-engineering\templates")
  )

  foreach ($candidate in $candidates) {
    if ([string]::IsNullOrWhiteSpace($candidate)) {
      continue
    }

    $resolved = $null
    try {
      $resolved = (Resolve-Path -LiteralPath $candidate).Path
    }
    catch {
      continue
    }

    $agentsTemplate = Join-Path $resolved "runtime\AGENTS.md"
    $driverTemplate = Join-Path $resolved "runtime\codex-loop.ps1"
    if ((Test-Path -LiteralPath $agentsTemplate) -and (Test-Path -LiteralPath $driverTemplate)) {
      return $resolved
    }
  }

  throw "找不到可用模板目录。请显式传入 -TemplateRoot。"
}

function Copy-ManagedFile {
  <#
    复制单个模板文件，默认只补齐缺失文件。
  #>
  param(
    [string]$SourceRoot,
    [string]$SourceRelativePath,
    [string]$DestinationRoot,
    [string]$DestinationRelativePath,
    [bool]$Overwrite
  )

  $sourcePath = Join-Path $SourceRoot $SourceRelativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "模板文件不存在: $sourcePath"
  }

  $destinationPath = Join-Path $DestinationRoot $DestinationRelativePath
  $destinationDirectory = Split-Path -Parent $destinationPath
  if (-not (Test-Path -LiteralPath $destinationDirectory)) {
    New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
  }

  if ((Test-Path -LiteralPath $destinationPath) -and (-not $Overwrite)) {
    return [PSCustomObject]@{
      Path = $destinationPath
      Action = "skipped"
    }
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
  return [PSCustomObject]@{
    Path = $destinationPath
    Action = "copied"
  }
}

function Sync-TemplateCodexAgents {
  param(
    [string]$TemplateRoot,
    [string]$ProjectPath,
    [bool]$Overwrite
  )

  $results = @()
  $agentsSourceRoot = Join-Path $TemplateRoot "config\agents"
  if (-not (Test-Path -LiteralPath $agentsSourceRoot)) {
    throw "找不到 Codex agents 模板目录: $agentsSourceRoot"
  }

  foreach ($file in Get-ChildItem -LiteralPath $agentsSourceRoot -Recurse -File) {
    $relativePath = $file.FullName.Substring($agentsSourceRoot.Length + 1)
    $results += Copy-ManagedFile `
      -SourceRoot $agentsSourceRoot `
      -SourceRelativePath $relativePath `
      -DestinationRoot $ProjectPath `
      -DestinationRelativePath (Join-Path ".codex\agents" $relativePath) `
      -Overwrite:$Overwrite
  }

  return $results
}

function Ensure-TaskFile {
  <#
    确保 task.json 存在，并补齐 runtime.driver。
  #>
  param(
    [string]$SourceRoot,
    [string]$DestinationRoot
  )

  $taskPath = Join-Path $DestinationRoot "task.json"
  if (-not (Test-Path -LiteralPath $taskPath)) {
    return Copy-ManagedFile -SourceRoot $SourceRoot -SourceRelativePath "runtime\task.json" -DestinationRoot $DestinationRoot -DestinationRelativePath "task.json" -Overwrite:$false
  }

  $taskContent = Get-Content -LiteralPath $taskPath -Raw
  if ([string]::IsNullOrWhiteSpace($taskContent)) {
    return Copy-ManagedFile -SourceRoot $SourceRoot -SourceRelativePath "runtime\task.json" -DestinationRoot $DestinationRoot -DestinationRelativePath "task.json" -Overwrite:$true
  }

  $taskDocument = $taskContent | ConvertFrom-Json
  if ($null -eq $taskDocument.runtime) {
    $taskDocument | Add-Member -NotePropertyName "runtime" -NotePropertyValue ([PSCustomObject]@{}) -Force
  }

  if ([string]::IsNullOrWhiteSpace($taskDocument.runtime.driver)) {
    $taskDocument.runtime.driver = "powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1"
    $taskDocument | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $taskPath -Encoding UTF8
    return [PSCustomObject]@{
      Path = $taskPath
      Action = "updated"
    }
  }

  return [PSCustomObject]@{
    Path = $taskPath
    Action = "kept"
  }
}

function Write-BootstrapSummary {
  <#
    输出自动配置结果，便于人工确认。
  #>
  param([object[]]$Results)

  foreach ($result in $Results) {
    Write-Output ("[{0}] {1}" -f $result.Action.ToUpperInvariant(), $result.Path)
  }
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$resolvedTemplateRoot = Resolve-TemplateRoot -ProjectPath $resolvedProjectRoot -ExplicitTemplateRoot $TemplateRoot
$results = @()

$rootFiles = @(
  @{ Source = "bootstrap-codex-harness.ps1"; Destination = "bootstrap-codex-harness.ps1" },
  @{ Source = "runtime\AGENTS.md"; Destination = "AGENTS.md" },
  @{ Source = "runtime\codex-loop.ps1"; Destination = "codex-loop.ps1" },
  @{ Source = "runtime\doctor.ps1"; Destination = "doctor.ps1" },
  @{ Source = "config\codex-config.toml"; Destination = ".codex\config.toml" },
  @{ Source = "config\codex-readme.md"; Destination = ".codex\README.md" },
  @{ Source = "hooks\hooks.json"; Destination = ".codex\hooks.json" },
  @{ Source = "hooks\hook-stop-verify.ps1"; Destination = "scripts\harness\hook-stop-verify.ps1" },
  @{ Source = "scripts\ai-workflow\check-ai-sync-drift.ps1"; Destination = "scripts\ai-workflow\check-ai-sync-drift.ps1" },
  @{ Source = "runtime\task-run-profile.json"; Destination = ".codex\task-run-profile.json" },
  @{ Source = "prompts\implement-one-task.md"; Destination = ".codex\prompts\implement-one-task.md" },
  @{ Source = "prompts\controller-loop.md"; Destination = ".codex\prompts\controller-loop.md" },
  @{ Source = "prompts\review-one-task.md"; Destination = ".codex\prompts\review-one-task.md" },
  @{ Source = "prompts\review-stage1-spec.md"; Destination = ".codex\prompts\review-stage1-spec.md" },
  @{ Source = "prompts\review-stage2-quality.md"; Destination = ".codex\prompts\review-stage2-quality.md" },
  @{ Source = "prompts\visual-evaluator.md"; Destination = ".codex\prompts\visual-evaluator.md" },
  @{ Source = "prompts\failure-triage.md"; Destination = ".codex\prompts\failure-triage.md" },
  @{ Source = "prompts\repair-one-finding.md"; Destination = ".codex\prompts\repair-one-finding.md" },
  @{ Source = "prompts\harness-audit.md"; Destination = ".codex\prompts\harness-audit.md" },
  @{ Source = "prompts\worker-role\frontend-worker.md"; Destination = ".codex\prompts\worker-role\frontend-worker.md" },
  @{ Source = "prompts\worker-role\backend-worker.md"; Destination = ".codex\prompts\worker-role\backend-worker.md" },
  @{ Source = "prompts\worker-role\test-runner.md"; Destination = ".codex\prompts\worker-role\test-runner.md" },
  @{ Source = "prompts\worker-role\docs-worker.md"; Destination = ".codex\prompts\worker-role\docs-worker.md" },
  @{ Source = "prompts\worker-role\harness-writer.md"; Destination = ".codex\prompts\worker-role\harness-writer.md" },
  @{ Source = "runtime\smoke-task.json"; Destination = "smoke-task.json" },
  @{ Source = "runtime\project-task-template.json"; Destination = "project-task-template.json" },
  @{ Source = "runtime\verify.ps1"; Destination = "verify.ps1" },
  @{ Source = "config\env-check.ps1"; Destination = "env-check.ps1" },
  @{ Source = "trace\trace.schema.json"; Destination = "trace.schema.json" }
)

foreach ($file in $rootFiles) {
  $results += Copy-ManagedFile -SourceRoot $resolvedTemplateRoot -SourceRelativePath $file.Source -DestinationRoot $resolvedProjectRoot -DestinationRelativePath $file.Destination -Overwrite:$Force.IsPresent
}

$results += Sync-TemplateCodexAgents -TemplateRoot $resolvedTemplateRoot -ProjectPath $resolvedProjectRoot -Overwrite:$Force.IsPresent

$results += Ensure-TaskFile -SourceRoot $resolvedTemplateRoot -DestinationRoot $resolvedProjectRoot

$progressPath = Join-Path $resolvedProjectRoot "progress.txt"
if (-not (Test-Path -LiteralPath $progressPath)) {
  $results += Copy-ManagedFile -SourceRoot $resolvedTemplateRoot -SourceRelativePath "runtime\progress.txt" -DestinationRoot $resolvedProjectRoot -DestinationRelativePath "progress.txt" -Overwrite:$false
}
else {
  $results += [PSCustomObject]@{
    Path = $progressPath
    Action = "kept"
  }
}

$testingFiles = @(
  @{ Source = "testing\ACCEPTANCE_CRITERIA.md"; Destination = "docs\testing\ACCEPTANCE_CRITERIA.md" },
  @{ Source = "testing\ACCEPTANCE_EXAMPLES.md"; Destination = "docs\testing\ACCEPTANCE_EXAMPLES.md" },
  @{ Source = "testing\EVIDENCE_PROTOCOL.md"; Destination = "docs\testing\EVIDENCE_PROTOCOL.md" },
  @{ Source = "testing\REGRESSION_PLAN.md"; Destination = "docs\testing\REGRESSION_PLAN.md" },
  @{ Source = "testing\RISK_BASED_TEST_PLAN.md"; Destination = "docs\testing\RISK_BASED_TEST_PLAN.md" },
  @{ Source = "testing\TEST_DATA_MATRIX.md"; Destination = "docs\testing\TEST_DATA_MATRIX.md" },
  @{ Source = "testing\TEST_STRATEGY.md"; Destination = "docs\testing\TEST_STRATEGY.md" },
  @{ Source = "testing\TRACEABILITY_MATRIX.md"; Destination = "docs\testing\TRACEABILITY_MATRIX.md" },
  @{ Source = "testing\test-matrix.md"; Destination = "docs\testing\test-matrix.md" },
  @{ Source = "testing\e2e-plan.md"; Destination = "docs\testing\e2e-plan.md" },
  @{ Source = "testing\test-data-plan.md"; Destination = "docs\testing\test-data-plan.md" },
  @{ Source = "testing\failure-triage.md"; Destination = "docs\testing\failure-triage.md" },
  @{ Source = "testing\coverage-policy.md"; Destination = "docs\testing\coverage-policy.md" },
  @{ Source = "testing\failure-findings.example.json"; Destination = "docs\testing\failure-findings.example.json" },
  @{ Source = "testing\test-report.md"; Destination = "docs\testing\test-report.md" },
  @{ Source = "testing\verify-matrix.md"; Destination = "docs\testing\verify-matrix.md" }
)

foreach ($file in $testingFiles) {
  $results += Copy-ManagedFile -SourceRoot $resolvedTemplateRoot -SourceRelativePath $file.Source -DestinationRoot $resolvedProjectRoot -DestinationRelativePath $file.Destination -Overwrite:$Force.IsPresent
}

if ($IncludeDocs) {
  $docFiles = @(
    @{ Source = "docs\harness-architecture.md"; Destination = "docs/harness/architecture.md" },
    @{ Source = "docs\knowledge-architecture.md"; Destination = "docs/harness/knowledge-architecture.md" },
    @{ Source = "docs\knowledge-import.md"; Destination = "docs/harness/knowledge-import.md" },
    @{ Source = "docs\knowledge-lint.md"; Destination = "docs/harness/knowledge-lint.md" },
    @{ Source = "docs\prompt-knowledge-integration.md"; Destination = "docs/harness/prompt-knowledge-integration.md" },
    @{ Source = "docs\rule-governance.md"; Destination = "docs/harness/rule-governance.md" },
    @{ Source = "docs\regression-rules.md"; Destination = "docs/harness/regression-rules.md" },
    @{ Source = "docs\team-knowledge-sync.md"; Destination = "docs/harness/team-knowledge-sync.md" },
    @{ Source = "docs\trace-format.md"; Destination = "docs/harness/trace-format.md" },
    @{ Source = "docs\task-session-strategy.md"; Destination = "docs/harness/task-session-strategy.md" },
    @{ Source = "docs\spec-to-ui-to-code-workflow.md"; Destination = "docs/harness/spec-to-ui-to-code-workflow.md" },
    @{ Source = "governance\sandbox-policy.md"; Destination = "docs/harness/sandbox-policy.md" },
    @{ Source = "docs\new-project-usage.md"; Destination = "docs/harness/new-project-usage.md" }
  )

  foreach ($file in $docFiles) {
    $results += Copy-ManagedFile -SourceRoot $resolvedTemplateRoot -SourceRelativePath $file.Source -DestinationRoot $resolvedProjectRoot -DestinationRelativePath $file.Destination -Overwrite:$Force.IsPresent
  }

  $knowledgeFiles = @(
    @{ Source = "knowledge\knowledge-catalog.md"; Destination = "docs/knowledge/knowledge-catalog.md" },
    @{ Source = "knowledge\catalog.md"; Destination = "docs/knowledge/catalog.md" },
    @{ Source = "knowledge\decisions\DECISION-HARNESS-001.md"; Destination = "docs/knowledge/decisions/DECISION-HARNESS-001.md" },
    @{ Source = "knowledge\guidelines\GUIDELINE-RULES-001.md"; Destination = "docs/knowledge/guidelines/GUIDELINE-RULES-001.md" }
  )

  foreach ($file in $knowledgeFiles) {
    $results += Copy-ManagedFile -SourceRoot $resolvedTemplateRoot -SourceRelativePath $file.Source -DestinationRoot $resolvedProjectRoot -DestinationRelativePath $file.Destination -Overwrite:$Force.IsPresent
  }
}

Write-Output "Bootstrap completed."
Write-BootstrapSummary -Results $results
