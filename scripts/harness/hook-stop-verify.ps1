param(
  [string]$ProjectRoot = (Get-Location).Path,
  [int]$MaxBlocksWithoutProgress = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-ContinuationDecision {
  param([string]$Reason)

  @{
    decision = "block"
    reason = $Reason
  } | ConvertTo-Json -Compress
}

function Exit-Allow {
  exit 0
}

function Get-ObjectPropertyValue {
  param(
    [object]$InputObject,
    [string]$Name,
    [object]$Default = $null
  )

  if ($null -eq $InputObject) {
    return $Default
  }

  $property = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $Default
  }

  return $property.Value
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
    if ($null -ne $item -and -not [string]::IsNullOrWhiteSpace([string]$item)) {
      $items += [string]$item
    }
  }

  return $items
}

function Resolve-RunProfilePath {
  param(
    [string]$Root,
    [object]$TaskDocument
  )

  $runtime = Get-ObjectPropertyValue -InputObject $TaskDocument -Name "runtime"
  $configuredPath = [string](Get-ObjectPropertyValue -InputObject $runtime -Name "run_profile" -Default ".codex\task-run-profile.json")
  if ([string]::IsNullOrWhiteSpace($configuredPath)) {
    $configuredPath = ".codex\task-run-profile.json"
  }

  if ([System.IO.Path]::IsPathRooted($configuredPath)) {
    return $configuredPath
  }

  return (Join-Path $Root $configuredPath)
}

function Get-EffectiveGitWorkspacePolicy {
  param(
    [string]$Root,
    [object]$TaskDocument,
    [object]$Task
  )

  $requireCleanWorkspace = $true
  $nonBlockingDirtyPaths = @()

  $runProfilePath = Resolve-RunProfilePath -Root $Root -TaskDocument $TaskDocument
  if (Test-Path -LiteralPath $runProfilePath) {
    try {
      $profileDocument = Read-JsonFile -Path $runProfilePath
      $profileGit = Get-ObjectPropertyValue -InputObject $profileDocument -Name "git"
      if ($null -ne $profileGit) {
        $requireCleanWorkspace = [bool](Get-ObjectPropertyValue -InputObject $profileGit -Name "require_clean_workspace" -Default $requireCleanWorkspace)
        $nonBlockingDirtyPaths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $profileGit -Name "non_blocking_dirty_paths" -Default $nonBlockingDirtyPaths)
      }
    }
    catch {
      # Ignore unreadable profile here; doctor/runtime hooks own that failure mode.
    }
  }

  $runtime = Get-ObjectPropertyValue -InputObject $TaskDocument -Name "runtime"
  $runtimeGit = Get-ObjectPropertyValue -InputObject $runtime -Name "git"
  if ($null -ne $runtimeGit) {
    $requireCleanWorkspace = [bool](Get-ObjectPropertyValue -InputObject $runtimeGit -Name "require_clean_workspace" -Default $requireCleanWorkspace)
    $nonBlockingDirtyPaths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $runtimeGit -Name "non_blocking_dirty_paths" -Default $nonBlockingDirtyPaths)
  }

  $taskExecution = Get-ObjectPropertyValue -InputObject $Task -Name "execution"
  $taskGit = Get-ObjectPropertyValue -InputObject $taskExecution -Name "git"
  if ($null -ne $taskGit) {
    $requireCleanWorkspace = [bool](Get-ObjectPropertyValue -InputObject $taskGit -Name "require_clean_workspace" -Default $requireCleanWorkspace)
    $nonBlockingDirtyPaths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $taskGit -Name "non_blocking_dirty_paths" -Default $nonBlockingDirtyPaths)
  }

  return [PSCustomObject]@{
    require_clean_workspace = $requireCleanWorkspace
    non_blocking_dirty_paths = $nonBlockingDirtyPaths
  }
}

function Get-GitStatusEntries {
  param([string]$Root)

  $status = & git -C $Root status --short --untracked-files=all 2>$null
  if ($LASTEXITCODE -ne 0) {
    return @()
  }

  return @($status)
}

function Get-DisallowedDirtyEntries {
  param(
    [string[]]$StatusLines,
    [string[]]$AllowedPaths
  )

  $normalizedAllowedPaths = @()
  foreach ($path in @(ConvertTo-StringArray -Value $AllowedPaths)) {
    $normalized = $path
    if ([string]::IsNullOrWhiteSpace($normalized)) {
      continue
    }

    $normalized = $normalized.Replace("/", "\")
    if ($normalized.StartsWith(".\")) {
      $normalized = $normalized.Substring(2)
    }

    $normalizedAllowedPaths += $normalized.TrimStart("\")
  }

  $disallowedEntries = @()
  foreach ($line in @($StatusLines)) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $relativePath = if ($line.Length -ge 4) { $line.Substring(3).Trim() } else { $line.Trim() }
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }

    $normalizedRelativePath = $relativePath.Replace("/", "\")
    $isAllowed = $false
    foreach ($allowedPath in $normalizedAllowedPaths) {
      if ([string]::IsNullOrWhiteSpace($allowedPath)) {
        continue
      }

      $directoryPrefix = $allowedPath.TrimEnd("\") + "\"
      if (($normalizedRelativePath -eq $allowedPath) -or $normalizedRelativePath.StartsWith($directoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $isAllowed = $true
        break
      }
    }

    if (-not $isAllowed) {
      $disallowedEntries += $line
    }
  }

  return $disallowedEntries
}

function Get-DirtyWorkspaceGateInfo {
  param(
    [string]$Root,
    [object]$TaskDocument,
    [object]$Task
  )

  $gitPolicy = Get-EffectiveGitWorkspacePolicy -Root $Root -TaskDocument $TaskDocument -Task $Task
  $statusLines = Get-GitStatusEntries -Root $Root
  $disallowedEntries = Get-DisallowedDirtyEntries -StatusLines $statusLines -AllowedPaths $gitPolicy.non_blocking_dirty_paths

  return [PSCustomObject]@{
    require_clean_workspace = $gitPolicy.require_clean_workspace
    non_blocking_dirty_paths = @(ConvertTo-StringArray -Value $gitPolicy.non_blocking_dirty_paths)
    status_lines = @($statusLines)
    disallowed_entries = @($disallowedEntries)
  }
}

function Get-StableProjectKey {
  param([string]$Root)

  $normalized = ([System.IO.Path]::GetFullPath($Root)).ToLowerInvariant()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").Substring(0, 16)
  }
  finally {
    $sha.Dispose()
  }
}

function Get-StatePath {
  param([string]$Root)

  $stateRoot = Join-Path ([System.IO.Path]::GetTempPath()) "codex-stop-hook-state"
  New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null
  return (Join-Path $stateRoot "$(Get-StableProjectKey -Root $Root).json")
}

function Read-GateState {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  try {
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  catch {
    return $null
  }
}

function Write-GateState {
  param(
    [string]$Path,
    [string]$EvidenceKey,
    [int]$BlockCount,
    [string]$ReasonCode
  )

  @{
    evidence_key = $EvidenceKey
    block_count = $BlockCount
    reason_code = $ReasonCode
    updated_at = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-FileStamp {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return "missing"
  }

  $item = Get-Item -LiteralPath $Path
  return "$($item.LastWriteTimeUtc.Ticks):$($item.Length)"
}

function Get-TaskHash {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return "missing"
  }

  try {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
  }
  catch {
    return "unreadable"
  }
}

function Get-LatestTrace {
  param([string]$TraceDir)

  if (-not (Test-Path -LiteralPath $TraceDir)) {
    return $null
  }

  return @(Get-ChildItem -LiteralPath $TraceDir -Filter "*.json" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1)[0]
}

function Read-JsonFile {
  param([string]$Path)

  $raw = Get-Content -LiteralPath $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "JSON file is empty: $Path"
  }

  return ($raw | ConvertFrom-Json)
}

function Get-TaskList {
  param([object]$TaskDocument)

  if ($null -eq $TaskDocument) {
    throw "task.json parsed to null."
  }

  $tasks = Get-ObjectPropertyValue -InputObject $TaskDocument -Name "tasks" -Default $null
  if ($null -eq $tasks) {
    throw "task.json must contain a tasks array."
  }

  if (($tasks -is [string]) -or (-not ($tasks -is [System.Collections.IEnumerable]))) {
    throw "task.json tasks must be an array."
  }

  return @($tasks)
}

function Get-CompletedTaskMap {
  param([object[]]$Tasks)

  $completed = @{}
  foreach ($task in @($Tasks)) {
    if ($task.passes -eq $true) {
      $completed[[string]$task.id] = $true
    }
  }

  return $completed
}

function Select-RunnableTask {
  param([object[]]$Tasks)

  $completed = Get-CompletedTaskMap -Tasks $Tasks
  $candidates = @($Tasks |
    Where-Object { $_.passes -ne $true } |
    Sort-Object @{ Expression = {
      try { [int]$_.priority } catch { [int]::MaxValue }
    } }, id)

  foreach ($task in $candidates) {
    $dependencies = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $task -Name "dependencies" -Default @())
    $missing = @($dependencies | Where-Object { -not $completed.ContainsKey($_) })
    if ($missing.Count -eq 0) {
      return $task
    }
  }

  return $null
}

function Get-PendingTaskCount {
  param([object[]]$Tasks)

  return @($Tasks | Where-Object { $_.passes -ne $true }).Count
}

function New-EvidenceKey {
  param(
    [string]$TaskPath,
    [string]$ProgressPath,
    [object]$LatestTrace
  )

  $traceStamp = "no-trace"
  if ($null -ne $LatestTrace) {
    $traceStamp = "$($LatestTrace.Name):$($LatestTrace.LastWriteTimeUtc.Ticks):$($LatestTrace.Length)"
  }

  return "task=$(Get-TaskHash -Path $TaskPath)|progress=$(Get-FileStamp -Path $ProgressPath)|trace=$traceStamp"
}

function Get-NextBlockCount {
  param(
    [object]$State,
    [string]$EvidenceKey
  )

  if ($null -ne $State -and [string](Get-ObjectPropertyValue -InputObject $State -Name "evidence_key" -Default "") -eq $EvidenceKey) {
    return ([int](Get-ObjectPropertyValue -InputObject $State -Name "block_count" -Default 0) + 1)
  }

  return 1
}

function Get-TraceSummary {
  param([object]$LatestTrace)

  if ($null -eq $LatestTrace) {
    return "latest trace: none"
  }

  try {
    $trace = Read-JsonFile -Path $LatestTrace.FullName
    $taskId = [string](Get-ObjectPropertyValue -InputObject $trace -Name "task_id" -Default "unknown")
    $status = [string](Get-ObjectPropertyValue -InputObject $trace -Name "status" -Default "unknown")
    $failedStage = [string](Get-ObjectPropertyValue -InputObject $trace -Name "failed_stage" -Default "")
    if ([string]::IsNullOrWhiteSpace($failedStage)) {
      return "latest trace: $taskId status=$status"
    }

    return "latest trace: $taskId status=$status failed_stage=$failedStage"
  }
  catch {
    return "latest trace: $($LatestTrace.Name) unreadable"
  }
}

function Get-LatestTraceInfo {
  param([object]$LatestTrace)

  if ($null -eq $LatestTrace) {
    return [PSCustomObject]@{
      Exists = $false
      Readable = $false
      TaskId = ""
      Status = "missing"
      FailedStage = ""
      Summary = "latest trace: none"
    }
  }

  try {
    $trace = Read-JsonFile -Path $LatestTrace.FullName
    $taskId = [string](Get-ObjectPropertyValue -InputObject $trace -Name "task_id" -Default "unknown")
    $status = [string](Get-ObjectPropertyValue -InputObject $trace -Name "status" -Default "unknown")
    $failedStage = [string](Get-ObjectPropertyValue -InputObject $trace -Name "failed_stage" -Default "")
    $summary = if ([string]::IsNullOrWhiteSpace($failedStage)) {
      "latest trace: $taskId status=$status"
    }
    else {
      "latest trace: $taskId status=$status failed_stage=$failedStage"
    }

    return [PSCustomObject]@{
      Exists = $true
      Readable = $true
      TaskId = $taskId
      Status = $status
      FailedStage = $failedStage
      Summary = $summary
    }
  }
  catch {
    return [PSCustomObject]@{
      Exists = $true
      Readable = $false
      TaskId = ""
      Status = "unreadable"
      FailedStage = ""
      Summary = "latest trace: $($LatestTrace.Name) unreadable"
    }
  }
}

function Block-OnTraceEvidenceIfNeeded {
  param(
    [string]$Root,
    [string]$EvidenceKey,
    [object]$TraceInfo
  )

  if (-not $TraceInfo.Exists) {
    Block-WithState -Root $Root -EvidenceKey $EvidenceKey -ReasonCode "missing_verification_trace" -Reason @"
Harness stop gate: no verification trace exists.

Next action:
Run the driver or the task verification command so the final answer has fresh evidence.
"@
  }

  if (-not $TraceInfo.Readable) {
    Block-WithState -Root $Root -EvidenceKey $EvidenceKey -ReasonCode "unreadable_trace" -Reason @"
Harness stop gate: latest trace is unreadable.

Evidence:
- $($TraceInfo.Summary)

Next action:
Inspect traces/ and rerun the driver or verification command before stopping.
"@
  }

  if ($TraceInfo.Status -ne "passed") {
    Block-WithState -Root $Root -EvidenceKey $EvidenceKey -ReasonCode "latest_trace_not_passed" -Reason @"
Harness stop gate: latest trace is not passed.

Evidence:
- $($TraceInfo.Summary)

Next action:
Inspect the latest trace and rerun the driver or repair task before stopping.
"@
  }
}

function Block-WithState {
  param(
    [string]$Root,
    [string]$EvidenceKey,
    [string]$ReasonCode,
    [string]$Reason
  )

  $statePath = Get-StatePath -Root $Root
  $state = Read-GateState -Path $statePath
  $blockCount = Get-NextBlockCount -State $state -EvidenceKey $EvidenceKey

  if ($blockCount -gt $MaxBlocksWithoutProgress) {
    Exit-Allow
  }

  Write-GateState -Path $statePath -EvidenceKey $EvidenceKey -BlockCount $blockCount -ReasonCode $ReasonCode

  $subagentReminder = @'

Before using any sub-agent on the next pass:
- first read `AGENTS.md`
- then read `docs/harness/task-session-strategy.md`
- then read `.agents/rules/agents.md`
- then read the current truth source and any relevant `.agents/skills/*/SKILL.md` files when they exist
- only after that may you use a read-only auxiliary sub-agent or a matching writer sub-agent
- if any repository file must change outside driver-owned runtime outputs, delegate it to the matching writer sub-agent instead of editing from the main/controller session
- read-only roles must stay read-only
'@

  $suffix = @"

Forced continuation: $blockCount/$MaxBlocksWithoutProgress for the current evidence snapshot.
If the next pass cannot make progress, report the real human blocker with the latest trace/progress evidence.
"@

  Write-Output (Write-ContinuationDecision -Reason (($Reason.Trim()) + $subagentReminder + $suffix))
  exit 0
}

try {
  $rawInput = [Console]::In.ReadToEnd()
  $hookInput = $null
  if (-not [string]::IsNullOrWhiteSpace($rawInput)) {
    try {
      $hookInput = $rawInput | ConvertFrom-Json
    }
    catch {
      $hookInput = $null
    }
  }

  $resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
  $taskPath = Join-Path $resolvedProjectRoot "task.json"
  $progressPath = Join-Path $resolvedProjectRoot "progress.txt"
  $driverPath = Join-Path $resolvedProjectRoot "codex-loop.ps1"
  $harnessDocsPath = Join-Path $resolvedProjectRoot "docs\harness"
  $traceDir = Join-Path $resolvedProjectRoot "traces"

  $isHarnessSurface = (Test-Path -LiteralPath $driverPath) -or (Test-Path -LiteralPath $harnessDocsPath)
  if (-not $isHarnessSurface) {
    Exit-Allow
  }

  $latestTrace = Get-LatestTrace -TraceDir $traceDir
  $latestTraceInfo = Get-LatestTraceInfo -LatestTrace $latestTrace
  $evidenceKey = New-EvidenceKey -TaskPath $taskPath -ProgressPath $progressPath -LatestTrace $latestTrace

  if (-not (Test-Path -LiteralPath $taskPath)) {
    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "missing_task" -Reason @"
Harness stop gate: task.json is missing.

Next action:
Initialize a real harness task queue before ending the session.
"@
  }

  if (-not (Test-Path -LiteralPath $progressPath)) {
    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "missing_progress" -Reason @"
Harness stop gate: progress.txt is missing.

Next action:
Restore the harness runtime files or run bootstrap before ending the session.
"@
  }

  $diffCheck = & git -C $resolvedProjectRoot -c core.safecrlf=false diff --check 2>$null
  if ($LASTEXITCODE -ne 0) {
    $reason = 'Harness stop gate: `git diff --check` failed. Fix whitespace/patch-format issues before stopping.'
    if (-not [string]::IsNullOrWhiteSpace(($diffCheck | Out-String))) {
      $reason = "$reason`n`nKey output:`n$($diffCheck | Out-String)"
    }

    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "diff_check_failed" -Reason $reason
  }

  try {
    $taskDocument = Read-JsonFile -Path $taskPath
  }
  catch {
    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "task_json_invalid" -Reason @"
Harness stop gate: task.json is not valid JSON.

Next action:
Fix task.json, then rerun the driver or verification command.
"@
  }

  try {
    $tasks = Get-TaskList -TaskDocument $taskDocument
  }
  catch {
    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "task_json_invalid_shape" -Reason @"
Harness stop gate: task.json does not contain the required `{ "tasks": [...] }` structure.

Next action:
Initialize task.json with a valid harness task queue, then rerun the driver or verification command.
"@
  }

  if ($tasks.Count -eq 0) {
    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "task_queue_empty" -Reason @"
Harness stop gate: task.json contains no tasks.

Next action:
Initialize a real harness task queue before ending the session.
"@
  }

  $pendingCount = Get-PendingTaskCount -Tasks $tasks
  if ($pendingCount -le 0) {
    Block-OnTraceEvidenceIfNeeded -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -TraceInfo $latestTraceInfo
    Exit-Allow
  }

  $runnableTask = Select-RunnableTask -Tasks $tasks
  if ($null -eq $runnableTask) {
    if ($latestTraceInfo.Exists -and (($latestTraceInfo.Readable -eq $false) -or ($latestTraceInfo.Status -ne "passed"))) {
      Block-OnTraceEvidenceIfNeeded -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -TraceInfo $latestTraceInfo
    }

    Exit-Allow
  }

  $taskId = [string]$runnableTask.id
  $description = [string](Get-ObjectPropertyValue -InputObject $runnableTask -Name "description" -Default "")
  $traceSummary = $latestTraceInfo.Summary
  $command = "powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1 -RunUntilDone"

  $workspaceGateInfo = Get-DirtyWorkspaceGateInfo -Root $resolvedProjectRoot -TaskDocument $taskDocument -Task $runnableTask
  if ($workspaceGateInfo.require_clean_workspace -and $workspaceGateInfo.disallowed_entries.Count -gt 0) {
    $dirtyPathsText = ($workspaceGateInfo.disallowed_entries | ForEach-Object { "- $_" }) -join "`n"
    $allowedPathsText = if ($workspaceGateInfo.non_blocking_dirty_paths.Count -gt 0) {
      ($workspaceGateInfo.non_blocking_dirty_paths | ForEach-Object { "- $_" }) -join "`n"
    }
    else {
      "- (none)"
    }

    $autoCommitSkillDisplayPath = ".agents\skills\auto-commit\SKILL.md"
    $autoCommitSkillPath = Join-Path $resolvedProjectRoot $autoCommitSkillDisplayPath
    $nextActionText = if (Test-Path -LiteralPath $autoCommitSkillPath) {
@"
1. 先确认这些改动全部属于当前任务或受控镜像同步，没有混入用户无关变更。
2. 读取 `$autoCommitSkillDisplayPath`，按 Auto Review and Commit 流程做审查、验证和提交。
3. 提交完成后运行:
$command
"@
    }
    else {
@"
1. 先确认这些改动全部属于当前任务，没有混入用户无关变更。
2. 手动提交、暂存或清理这些改动。
3. 处理完成后运行:
$command
"@
    }

    Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "dirty_workspace_auto_commit" -Reason @"
Harness stop gate: dirty workspace would block the next driver pass.

Next task:
$taskId $description

Evidence:
- pending tasks: $pendingCount
- $traceSummary

Detected dirty paths:
$dirtyPathsText

Current non_blocking_dirty_paths:
$allowedPathsText

Next action:
$nextActionText
"@
  }

  Block-WithState -Root $resolvedProjectRoot -EvidenceKey $evidenceKey -ReasonCode "runnable_task" -Reason @"
Harness stop gate: runnable work remains.

Next task:
$taskId $description

Evidence:
- pending tasks: $pendingCount
- $traceSummary

Next action:
$command

Before any later final response, report the checkpoint directly:
- acceptance coverage
- fresh verification evidence
- remaining review/controller/repair follow-ups, if any
- whether automatic driver iteration should continue or a real human blocker exists

No MCP feedback tool is required.
"@
}
catch {
  $message = $_.Exception.Message
  if ([string]::IsNullOrWhiteSpace($message)) {
    $message = "unknown error"
  }

  Write-Output (Write-ContinuationDecision -Reason ("Harness stop gate internal error: {0}. Re-run the current task or inspect the hook script." -f $message))
  exit 0
}
