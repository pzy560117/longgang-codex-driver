param(
  [string]$ProjectRoot = "",
  [string]$TaskFile = "task.json",
  [string]$ProgressFile = "progress.txt",
  [string]$TraceDir = "traces",
  [string]$CodexCommand = "codex",
  [string]$RunProfileFile = ".codex\\task-run-profile.json",
  [switch]$RunUntilDone,
  [switch]$CaptureJsonEvents
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = $PSScriptRoot
}

function Write-Step {
  <#
    输出简洁的 driver 状态，避免把 Codex 原始事件流刷满终端。
  #>
  param([string]$Message)

  $timestamp = Get-Date -Format "HH:mm:ss"
  Write-Host "[$timestamp] $Message"
}

function Get-TextFileContent {
  <#
    读取 UTF-8 文本文件，文件不存在时返回空字符串。
  #>
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Show-LogTail {
  <#
    失败时只显示最后几行日志，并保留完整日志文件供排查。
  #>
  param(
    [string]$Path,
    [int]$LineCount = 40
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Write-Output ""
  Write-Output "最近 $LineCount 行日志:"
  Get-Content -LiteralPath $Path -Tail $LineCount -Encoding UTF8
}

function Get-LastNonEmptyLine {
  <#
    返回日志文件最后一条非空文本，缺失时返回空字符串。
  #>
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return ""
  }

  $lines = Get-Content -LiteralPath $Path -Tail 20 -Encoding UTF8
  if ($null -eq $lines) {
    return ""
  }

  foreach ($line in (@($lines)[-1..-([Math]::Min(@($lines).Count, 20))])) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      return $line.Trim()
    }
  }

  return ""
}

function Get-CompactLogPreview {
  <#
    压缩日志预览，避免心跳消息过长。
  #>
  param(
    [string]$Path,
    [int]$MaxLength = 120
  )

  $line = Get-LastNonEmptyLine -Path $Path
  if ([string]::IsNullOrWhiteSpace($line)) {
    return ""
  }

  if ($line.Length -le $MaxLength) {
    return $line
  }

  return ($line.Substring(0, $MaxLength - 3) + "...")
}

function Get-ObjectPropertyValue {
  <#
    安全读取对象属性，属性不存在时返回默认值。
  #>
  param(
    [object]$InputObject,
    [string]$Name,
    $Default = $null
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
  <#
    归一化为字符串数组。
  #>
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

  if ($Value -is [System.Collections.IEnumerable]) {
    $result = @()
    foreach ($item in $Value) {
      if ($null -eq $item) {
        continue
      }

      $text = [string]$item
      if (-not [string]::IsNullOrWhiteSpace($text)) {
        $result += $text
      }
    }

    return $result
  }

  return @([string]$Value)
}

function Normalize-GitRelativePath {
  <#
    统一 Git 相对路径，便于做 owned_paths / runtime allowlist 比较。
  #>
  param([string]$Path)

  $rawValue = if ($null -eq $Path) { "" } else { [string]$Path }
  $value = $rawValue.Trim().Replace('\', '/')
  while ($value.StartsWith('./', [System.StringComparison]::Ordinal)) {
    $value = $value.Substring(2)
  }

  return $value.TrimStart('/')
}

function Convert-OwnedPathsToPrefixes {
  <#
    读取当前任务声明的 owned_paths，并转成标准前缀。
  #>
  param([object]$Task)

  $ownedPaths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "owned_paths")
  return @(
    $ownedPaths |
      ForEach-Object { Normalize-GitRelativePath -Path $_ } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
}

function Convert-GitStatusLineToRelativePaths {
  <#
    从 porcelain v1 -z record 提取一个或两个受影响路径。
  #>
  param(
    [string]$Line,
    [string]$NextRecord = $null
  )

  if ([string]::IsNullOrWhiteSpace($Line) -or $Line.Length -lt 4) {
    return @()
  }

  $statusCode = $Line.Substring(0, 2)
  $relativePath = $Line.Substring(3)
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    return @()
  }

  $paths = @()
  $isRenameOrCopy = ($statusCode.IndexOf('R') -ge 0 -or $statusCode.IndexOf('C') -ge 0)
  if ($isRenameOrCopy) {
    $sourcePath = Normalize-GitRelativePath -Path $NextRecord
    $destinationPath = Normalize-GitRelativePath -Path $relativePath
    if (-not [string]::IsNullOrWhiteSpace($sourcePath)) {
      $paths += $sourcePath
    }
    if (-not [string]::IsNullOrWhiteSpace($destinationPath)) {
      $paths += $destinationPath
    }
    return ConvertTo-UniqueStringArray -Items $paths
  }

  $normalizedPath = Normalize-GitRelativePath -Path $relativePath
  if ([string]::IsNullOrWhiteSpace($normalizedPath)) {
    return @()
  }

  return @($normalizedPath)
}

function Get-GitStatusPorcelainRecords {
  <#
    读取 porcelain v1 -z 输出，避免 core.quotePath 的 C-style escape。
  #>
  param([string]$Root)

  $processInfo = New-Object System.Diagnostics.ProcessStartInfo
  $processInfo.FileName = "git"
  $processInfo.Arguments = "status --porcelain=v1 -z --untracked-files=all"
  $processInfo.WorkingDirectory = $Root
  $processInfo.UseShellExecute = $false
  $processInfo.RedirectStandardOutput = $true
  $processInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::Start($processInfo)
  $outputStream = New-Object System.IO.MemoryStream
  $exitCode = $null
  try {
    $process.StandardOutput.BaseStream.CopyTo($outputStream)
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode
  }
  finally {
    $process.Dispose()
  }

  if ($exitCode -ne 0) {
    throw "无法读取 Git 状态，无法执行 commit ownership gate。$stderr"
  }

  $text = [System.Text.Encoding]::UTF8.GetString($outputStream.ToArray())
  return @(
    $text.Split([char]0) |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
  )
}

function Test-CommitPathOwnership {
  <#
    提交前检查 Git 脏文件是否全部落在 owned_paths 或 runtime allowlist 内。
  #>
  param(
    [string]$Root,
    [object]$Task,
    [string[]]$RuntimeAllowedPaths,
    [string[]]$NonBlockingDirtyPaths
  )

  $defaultRuntimeAllowedPaths = @(
    "task.json",
    "progress.txt",
    "traces/",
    "artifacts/"
  )
  $allowed = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($path in @(
      (Convert-OwnedPathsToPrefixes -Task $Task) +
      (ConvertTo-StringArray -Value $defaultRuntimeAllowedPaths) +
      (ConvertTo-StringArray -Value $RuntimeAllowedPaths) +
      (ConvertTo-StringArray -Value $NonBlockingDirtyPaths)
    )) {
    $normalized = Normalize-GitRelativePath -Path $path
    if (-not [string]::IsNullOrWhiteSpace($normalized)) {
      $null = $allowed.Add($normalized)
    }
  }

  $statusLines = @(Get-GitStatusPorcelainRecords -Root $Root)
  $unexpected = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt @($statusLines).Count; $i++) {
    $line = $statusLines[$i]
    $nextRecord = $null
    if ($line.Length -ge 2) {
      $statusCode = $line.Substring(0, 2)
      if (($statusCode.IndexOf('R') -ge 0 -or $statusCode.IndexOf('C') -ge 0) -and ($i + 1) -lt @($statusLines).Count) {
        $i++
        $nextRecord = $statusLines[$i]
      }
    }

    foreach ($relativePath in @(Convert-GitStatusLineToRelativePaths -Line $line -NextRecord $nextRecord)) {
      $matched = $false
      foreach ($allowedPath in $allowed) {
        if (
          $relativePath.Equals($allowedPath, [System.StringComparison]::OrdinalIgnoreCase) -or
          $relativePath.StartsWith(($allowedPath.TrimEnd('/') + '/'), [System.StringComparison]::OrdinalIgnoreCase)
        ) {
          $matched = $true
          break
        }
      }

      if (-not $matched) {
        $unexpected.Add($relativePath)
      }
    }
  }

  return [PSCustomObject]@{
    Passed = ($unexpected.Count -eq 0)
    UnexpectedPaths = ConvertTo-UniqueStringArray -Items @($unexpected)
  }
}

function ConvertTo-BulletLines {
  <#
    把数组格式化成多行 bullet，空数组时输出占位。
  #>
  param(
    [string[]]$Items,
    [string]$EmptyText = "- 无"
  )

  if ($null -eq $Items -or $Items.Count -eq 0) {
    return $EmptyText
  }

  return ($Items | ForEach-Object { "- $_" }) -join "`n"
}

function ConvertTo-UniqueStringArray {
  <#
    去重并保持原始顺序。
  #>
  param([string[]]$Items)

  $result = @()
  foreach ($item in @(ConvertTo-StringArray -Value $Items)) {
    if ($result -notcontains $item) {
      $result += $item
    }
  }

  return $result
}

function Get-TaskDefinitionDefaults {
  <#
    根据任务类型返回默认 gate 和 truth source 约束。
  #>
  param([object]$Task)

  $taskKind = [string](Get-ObjectPropertyValue -InputObject $Task -Name "task_kind" -Default "harness")
  if ([string]::IsNullOrWhiteSpace($taskKind)) {
    $taskKind = "harness"
  }

  $defaultGateProfile = "lightweight"
  $defaultTruthSources = @()

  switch ($taskKind) {
    "harness" {
      $defaultGateProfile = "lightweight"
      $defaultTruthSources = @()
    }
    "smoke" {
      $defaultGateProfile = "lightweight"
      $defaultTruthSources = @()
    }
    "feature_research" {
      $defaultGateProfile = "research_required"
      $defaultTruthSources = @("repo_context")
    }
    "feature_spec" {
      $defaultGateProfile = "research_required"
      $defaultTruthSources = @("repo_context")
    }
    "feature_design" {
      $defaultGateProfile = "spec_required"
      $defaultTruthSources = @("product", "testing")
    }
    "feature_plan" {
      $defaultGateProfile = "spec_required"
      $defaultTruthSources = @("product", "design", "testing")
    }
    "feature_impl" {
      $defaultGateProfile = "spec_required"
      $defaultTruthSources = @("product", "design", "plan", "testing")
    }
    "release" {
      $defaultGateProfile = "release_required"
      $defaultTruthSources = @("product", "design", "plan", "testing")
    }
    "archive" {
      $defaultGateProfile = "lightweight"
      $defaultTruthSources = @("knowledge")
    }
    default {
      $defaultGateProfile = "lightweight"
      $defaultTruthSources = @()
    }
  }

  $gateProfile = [string](Get-ObjectPropertyValue -InputObject $Task -Name "gate_profile" -Default $defaultGateProfile)
  if ([string]::IsNullOrWhiteSpace($gateProfile)) {
    $gateProfile = $defaultGateProfile
  }

  $requiredTruthSources = @(ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "required_truth_sources"))
  if ($requiredTruthSources.Count -eq 0) {
    $requiredTruthSources = @($defaultTruthSources)
  }

  if ($gateProfile -eq "contract_required" -and $requiredTruthSources -notcontains "contract") {
    $requiredTruthSources += "contract"
  }

  $producesArtifacts = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "produces_artifacts")
  $phase = [string](Get-ObjectPropertyValue -InputObject $Task -Name "phase" -Default "")

  return [PSCustomObject]@{
    task_kind = $taskKind
    gate_profile = $gateProfile
    required_truth_sources = ConvertTo-UniqueStringArray -Items $requiredTruthSources
    produces_artifacts = ConvertTo-UniqueStringArray -Items $producesArtifacts
    phase = $phase
  }
}

function Get-DefaultRunProfile {
  <#
    返回默认 task 会话与子代理策略。
  #>
  return [PSCustomObject]@{
    session = [PSCustomObject]@{
      mode = "fresh-process"
      reuse_previous_chat = $false
      carry_forward_summary = $false
      context_sources = @(
        "AGENTS.md",
        "docs/harness/task-session-strategy.md",
        "docs/harness/architecture.md",
        "docs/harness/knowledge-architecture.md",
        "docs/harness/prompt-knowledge-integration.md",
        "docs/harness/rule-governance.md",
        "docs/harness/regression-rules.md",
        "docs/knowledge/knowledge-catalog.md"
      )
    }
    subagents = [PSCustomObject]@{
      mode = "guided"
      allowed_roles = @(
        "explorer",
        "readonly-research",
        "docs-researcher",
        "planner",
        "architect",
        "reviewer",
        "stage1-reviewer",
        "stage2-reviewer",
        "security-reviewer",
        "test-planner",
        "failure-triage",
        "visual-reviewer",
        "harness-writer",
        "docs-worker",
        "frontend-worker",
        "backend-worker",
        "test-runner"
      )
      max_parallel_roles = 3
      notes = @(
        "Only enable subagents when the task has two or more independent subtasks, or when the controller/session must delegate a file write instead of writing directly.",
        "Subagents must read the matching AGENTS/rules/docs/skills before concluding.",
        "Read-only roles stay read-only and return summaries or concrete results, not full transcripts.",
        "Any repo write outside driver-owned runtime outputs must go to a matching writer role; the controller/main session should not write directly."
      )
    }
    git = [PSCustomObject]@{
      require_clean_workspace = $true
      non_blocking_dirty_paths = @()
    }
  }
}

function Merge-PolicySection {
  <#
    用覆盖对象更新默认策略对象。
  #>
  param(
    [object]$BaseSection,
    [object]$OverrideSection
  )

  $merged = [PSCustomObject]@{}
  foreach ($property in $BaseSection.PSObject.Properties) {
    $value = $property.Value
    if ($value -is [System.Array]) {
      $value = @($value)
    }
    Add-Member -InputObject $merged -MemberType NoteProperty -Name $property.Name -Value $value
  }

  if ($null -eq $OverrideSection) {
    return $merged
  }

  foreach ($property in $OverrideSection.PSObject.Properties) {
    $value = $property.Value
    if ($value -is [System.Array]) {
      $value = @($value)
    }

    if ($null -eq $merged.PSObject.Properties[$property.Name]) {
      Add-Member -InputObject $merged -MemberType NoteProperty -Name $property.Name -Value $value
    }
    else {
      $merged.$($property.Name) = $value
    }
  }

  return $merged
}

function Resolve-RunProfilePath {
  <#
    解析运行策略文件路径，优先级: 参数 > task.runtime.run_profile。
  #>
  param(
    [string]$Root,
    [string]$ConfiguredPath,
    [object]$TaskDocument
  )

  $runtime = Get-ObjectPropertyValue -InputObject $TaskDocument -Name "runtime"
  $runtimeProfile = Get-ObjectPropertyValue -InputObject $runtime -Name "run_profile"
  $candidate = $ConfiguredPath
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    $candidate = $runtimeProfile
  }

  if ([string]::IsNullOrWhiteSpace($candidate)) {
    return $null
  }

  if ([System.IO.Path]::IsPathRooted($candidate)) {
    return $candidate
  }

  return Join-Path $Root $candidate
}

function Get-TaskExecutionPolicy {
  <#
    组合默认 profile、runtime 默认项和 task 覆盖项。
  #>
  param(
    [string]$Root,
    [string]$ConfiguredRunProfilePath,
    [object]$TaskDocument,
    [object]$Task
  )

  $defaultProfile = Get-DefaultRunProfile
  $resolvedProfilePath = Resolve-RunProfilePath -Root $Root -ConfiguredPath $ConfiguredRunProfilePath -TaskDocument $TaskDocument
  $profileOverrides = $null
  if ($null -ne $resolvedProfilePath -and (Test-Path -LiteralPath $resolvedProfilePath)) {
    $profileOverrides = Get-Content -LiteralPath $resolvedProfilePath -Raw | ConvertFrom-Json
  }

  $runtime = Get-ObjectPropertyValue -InputObject $TaskDocument -Name "runtime"
  $runtimeSession = Get-ObjectPropertyValue -InputObject $runtime -Name "session"
  $runtimeSubagents = Get-ObjectPropertyValue -InputObject $runtime -Name "subagents"
  $runtimeGit = Get-ObjectPropertyValue -InputObject $runtime -Name "git"

  $taskExecution = Get-ObjectPropertyValue -InputObject $Task -Name "execution"
  $taskSession = Get-ObjectPropertyValue -InputObject $taskExecution -Name "session"
  $taskSubagents = Get-ObjectPropertyValue -InputObject $taskExecution -Name "subagents"
  $taskGit = Get-ObjectPropertyValue -InputObject $taskExecution -Name "git"

  $session = Merge-PolicySection -BaseSection $defaultProfile.session -OverrideSection (Get-ObjectPropertyValue -InputObject $profileOverrides -Name "session")
  $session = Merge-PolicySection -BaseSection $session -OverrideSection $runtimeSession
  $session = Merge-PolicySection -BaseSection $session -OverrideSection $taskSession
  $session.context_sources = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $session -Name "context_sources")

  $subagents = Merge-PolicySection -BaseSection $defaultProfile.subagents -OverrideSection (Get-ObjectPropertyValue -InputObject $profileOverrides -Name "subagents")
  $subagents = Merge-PolicySection -BaseSection $subagents -OverrideSection $runtimeSubagents
  $subagents = Merge-PolicySection -BaseSection $subagents -OverrideSection $taskSubagents
  $subagents.allowed_roles = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $subagents -Name "allowed_roles")
  $subagents.notes = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $subagents -Name "notes")

  $gitPolicy = Merge-PolicySection -BaseSection $defaultProfile.git -OverrideSection (Get-ObjectPropertyValue -InputObject $profileOverrides -Name "git")
  $gitPolicy = Merge-PolicySection -BaseSection $gitPolicy -OverrideSection $runtimeGit
  $gitPolicy = Merge-PolicySection -BaseSection $gitPolicy -OverrideSection $taskGit
  $gitPolicy.non_blocking_dirty_paths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $gitPolicy -Name "non_blocking_dirty_paths")

  $contextFiles = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "context_files")
  $taskDefaults = Get-TaskDefinitionDefaults -Task $Task

  return [PSCustomObject]@{
    run_profile_path = $resolvedProfilePath
    session = $session
    subagents = $subagents
    git = $gitPolicy
    context_files = $contextFiles
    task_kind = $taskDefaults.task_kind
    gate_profile = $taskDefaults.gate_profile
    required_truth_sources = $taskDefaults.required_truth_sources
    produces_artifacts = $taskDefaults.produces_artifacts
    phase = $taskDefaults.phase
  }
}

function Invoke-NativeCommandQuiet {
  <#
    运行原生命令并捕获 stdout/stderr。
    PowerShell 5.1 会把原生命令 stderr 包装成 ErrorRecord；这里避免 warning 触发 Stop。
  #>
  param([scriptblock]$Script)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $Script 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [PSCustomObject]@{
    ExitCode = $exitCode
    Output = ($output -join "`n")
  }
}

function Resolve-NativeApplicationCommand {
  <#
    将命令名解析为 Start-Process 可直接启动的原生命令。
    Windows 上 npm/pwsh shim 可能优先返回 .ps1 或无扩展文件，Start-Process 不能稳定执行它们。
  #>
  param([string]$Command)

  if ([string]::IsNullOrWhiteSpace($Command)) {
    return $Command
  }

  if ([System.IO.Path]::IsPathRooted($Command) -or (Test-Path -LiteralPath $Command)) {
    return $Command
  }

  $candidates = @(Get-Command $Command -All -ErrorAction SilentlyContinue)
  $nativeExtensions = @(".exe", ".cmd", ".bat", ".com")
  foreach ($candidate in $candidates) {
    $path = [string]$candidate.Path
    if ([string]::IsNullOrWhiteSpace($path)) {
      continue
    }

    $extension = [System.IO.Path]::GetExtension($path)
    if ($candidate.CommandType -eq "Application" -and $nativeExtensions -contains $extension.ToLowerInvariant()) {
      return $path
    }
  }

  return $Command
}

function Test-CodexBlocked {
  <#
    只识别 Codex 内层按约定输出的固定 BLOCKED 行。
    不要用宽泛的 "BLOCKED" 匹配，否则英文 blocked/阻塞说明会误判。
  #>
  param([string]$Output)

  return $Output -cmatch "(?m)^\s*BLOCKED(?:\s+-\s+.*)?\s*$"
}

function Test-RecoverableCodexCompletion {
  <#
    识别可继续推进的 Codex 完成态：
    - 进程退出码异常或缺失
    - 但 last_message 已存在
    - 且没有触发固定 BLOCKED 标记
    这类情况交给后续测试和 review 闸门裁决，不在实现阶段直接打成 BLOCKED。
  #>
  param(
    [object]$ExitCode,
    [string]$Output,
    [string]$LastMessage
  )

  if (($null -ne $ExitCode) -and ([int]$ExitCode -eq 0)) {
    return $false
  }

  if ([string]::IsNullOrWhiteSpace($LastMessage)) {
    return $false
  }

  if (Test-CodexBlocked -Output $LastMessage) {
    return $false
  }

  return $true
}

function Get-TaskDocument {
  <#
    读取并解析任务文件。
  #>
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "找不到任务文件: $Path"
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Select-NextTask {
  <#
    选择优先级最高且依赖已完成的未通过任务。
  #>
  param([object]$TaskDocument)

  $completedIds = @{}
  foreach ($task in $TaskDocument.tasks) {
    if ($task.passes -eq $true) {
      $completedIds[$task.id] = $true
    }
  }

  $candidates = @($TaskDocument.tasks |
    Where-Object { $_.passes -eq $false } |
    Sort-Object priority)

  foreach ($task in $candidates) {
    $missing = @($task.dependencies | Where-Object { -not $completedIds.ContainsKey($_) })
    if ($missing.Count -eq 0) {
      return $task
    }
  }

  return $null
}

function Assert-CleanGitWorkspace {
  <#
    启动前确认 Git 工作区干净，或仅包含允许忽略的非阻塞路径。
  #>
  param(
    [string]$Root,
    [string[]]$NonBlockingPaths = @()
  )

  $status = & git -C $Root status --short --untracked-files=all
  if ($LASTEXITCODE -ne 0) {
    throw "当前目录不是有效 Git 仓库: $Root"
  }

  if (-not $status) {
    return
  }

  $normalizedAllowedPaths = @()
  foreach ($allowedPath in @(ConvertTo-StringArray -Value $NonBlockingPaths)) {
    $normalized = $allowedPath.Trim()
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
  foreach ($line in @($status)) {
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

  if ($disallowedEntries.Count -eq 0) {
    return
  }

  if ($status) {
    $autoCommitSkillPath = Join-Path $Root ".agents\skills\auto-commit\SKILL.md"
    Write-Output "BLOCKED - 需要人工介入"
    Write-Output ""
    Write-Output "当前任务: 未选择"
    Write-Output ""
    Write-Output "阻塞原因:"
    Write-Output "- Git 工作区启动时已有未提交改动。"
    if ($normalizedAllowedPaths.Count -gt 0) {
      Write-Output "- 当前改动不在 non_blocking_dirty_paths 白名单内。"
    }
    Write-Output ""
    Write-Output "检测到的阻塞路径:"
    foreach ($entry in $disallowedEntries) {
      Write-Output "- $entry"
    }
    Write-Output ""
    Write-Output "需要人工操作:"
    Write-Output "1. 提交、暂存或清理这些改动。"
    $nextStepNumber = 2
    if (Test-Path -LiteralPath $autoCommitSkillPath) {
      Write-Output "$nextStepNumber. 如果这些改动就是当前任务的收尾结果、且没有混入用户无关改动，读取 `.agents/skills/auto-commit/SKILL.md` 并执行 Auto Review and Commit 流程。"
      $nextStepNumber++
    }
    if ($normalizedAllowedPaths.Count -gt 0) {
      Write-Output "$nextStepNumber. 如果这些改动属于可忽略运行产物，请把路径加入 runtime.git.non_blocking_dirty_paths。"
      $nextStepNumber++
    }
    Write-Output "$nextStepNumber. 确认没有用户改动会被自动提交混入。"
    exit 2
  }
}

function Invoke-RuntimeDoctor {
  <#
    在任务执行前检查 runtime 入口、.codex 配置和 harness 深文档是否完整。
  #>
  param([string]$Root)

  $doctorPath = Join-Path $Root "doctor.ps1"
  if (-not (Test-Path -LiteralPath $doctorPath)) {
    throw "找不到 runtime doctor: $doctorPath"
  }

  Push-Location $Root
  try {
    $output = powershell -NoProfile -ExecutionPolicy Bypass -File .\doctor.ps1 2>&1
    $exitCode = $LASTEXITCODE
    return [PSCustomObject]@{
      ExitCode = $exitCode
      Output = ($output -join "`n")
    }
  }
  finally {
    Pop-Location
  }
}

function Get-PromptTemplate {
  <#
    优先读取项目内 prompt 模板；不存在时回退到内置模板。
  #>
  param(
    [string]$Root,
    [string]$TemplateName,
    [string]$FallbackTemplate
  )

  $relativePath = Join-Path ".codex\prompts" $TemplateName
  $fullPath = Join-Path $Root $relativePath
  if (Test-Path -LiteralPath $fullPath) {
    return Get-TextFileContent -Path $fullPath
  }

  return $FallbackTemplate
}

function New-ImplementationPrompt {
  <#
    根据任务对象生成给 Codex 的单任务 prompt。
  #>
  param(
    [object]$Task,
    [object]$ExecutionPolicy,
    [string]$TaskSessionId
  )

  $steps = ($Task.steps | ForEach-Object { "- $_" }) -join "`n"
  $acceptance = ($Task.acceptance | ForEach-Object { "- $_" }) -join "`n"
  $dependencies = @(ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "dependencies"))
  $contextSourcesText = ConvertTo-BulletLines -Items $ExecutionPolicy.session.context_sources
  $contextFilesText = ConvertTo-BulletLines -Items $ExecutionPolicy.context_files -EmptyText "- 无显式任务文件列表；仅按需读取与当前任务直接相关的文件"
  $allowedRoles = @(ConvertTo-StringArray -Value $ExecutionPolicy.subagents.allowed_roles)
  $allowedRolesText = if ($allowedRoles.Count -eq 0) { "none" } else { $allowedRoles -join ", " }
  $subagentNotesText = ConvertTo-BulletLines -Items (ConvertTo-StringArray -Value $ExecutionPolicy.subagents.notes)
  $requiredTruthSourcesText = ConvertTo-BulletLines -Items $ExecutionPolicy.required_truth_sources -EmptyText "- 无前置 truth source 要求"
  $producesArtifactsText = ConvertTo-BulletLines -Items $ExecutionPolicy.produces_artifacts -EmptyText "- 无显式产物要求"
  $requirementIdsText = ConvertTo-BulletLines -Items (ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "requirement_ids")) -EmptyText "- 未在 task 中显式声明；实现前应先从 TRACEABILITY_MATRIX 或验收示例中确认"
  $fallbackTemplate = @"
你是 Codex 自动实现会话。只处理 Driver Context 中的一个任务。不要修改 task.json、progress.txt、traces/ 或执行 git 命令。先确认验收示例、追溯矩阵和测试影响，再实现最小必要改动；完成后总结修改内容、验证结果和剩余风险。
"@
  $template = Get-PromptTemplate -Root $ProjectRoot -TemplateName "implement-one-task.md" -FallbackTemplate $fallbackTemplate

  return @"
$template

## Driver Context

任务 ID: $($Task.id)
任务描述: $($Task.description)
任务类型: $($ExecutionPolicy.task_kind)
Gate Profile: $($ExecutionPolicy.gate_profile)
Phase: $(if ([string]::IsNullOrWhiteSpace($ExecutionPolicy.phase)) { "未指定" } else { $ExecutionPolicy.phase })
优先级: $($Task.priority)
Requirement IDs:
$requirementIdsText
依赖: $(if ($dependencies.Count -eq 0) { "none" } else { $dependencies -join ", " })
Task Session ID: $TaskSessionId

会话策略:
- Session mode: $($ExecutionPolicy.session.mode)
- Reuse previous chat: $($ExecutionPolicy.session.reuse_previous_chat)
- Carry forward summary: $($ExecutionPolicy.session.carry_forward_summary)

优先上下文源:
$contextSourcesText

任务相关文件:
$contextFilesText

前置 truth source:
$requiredTruthSourcesText

知识使用:
- 如果存在 `docs/knowledge/knowledge-catalog.md`，先按任务阶段判断是否需要读取 `docs/knowledge/catalog.md` 和相关条目。
- 如果引用了知识条目，最终总结必须列出 `knowledge_references`，包含 id、title、used_in 和 path。
- 如果发现可复用的新经验，最终总结必须列出 `knowledge_outputs` 建议，供 ARCHIVE 任务归档。

预期产物:
$producesArtifactsText

子代理策略:
- Mode: $($ExecutionPolicy.subagents.mode)
- Allowed roles: $allowedRolesText
- Max parallel roles: $($ExecutionPolicy.subagents.max_parallel_roles)
- Notes:
$subagentNotesText

执行步骤:
$steps

验收标准:
$acceptance

测试命令:
$($Task.test_command)
"@
}

function Get-ExistingRelativePaths {
  <#
    返回工作区内实际存在的相对路径列表。
  #>
  param(
    [string]$Root,
    [string[]]$RelativePaths
  )

  $existing = @()
  foreach ($relativePath in $RelativePaths) {
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      continue
    }

    $fullPath = Join-Path $Root $relativePath
    if (Test-Path -LiteralPath $fullPath) {
      $existing += $relativePath
    }
  }

  return $existing
}

function Get-FirstExistingRelativePath {
  <#
    返回候选路径中第一个实际存在的相对路径。
  #>
  param(
    [string]$Root,
    [string[]]$Candidates
  )

  foreach ($candidate in @(ConvertTo-StringArray -Value $Candidates)) {
    $fullPath = Join-Path $Root $candidate
    if (Test-Path -LiteralPath $fullPath) {
      return $candidate
    }
  }

  return $null
}

function Get-ExistingDevPlans {
  <#
    收集存在的 DEV-PLAN 文件，避免让 reviewer 猜测计划入口。
  #>
  param([string]$Root)

  $plansRoot = Join-Path $Root "plans"
  if (-not (Test-Path -LiteralPath $plansRoot)) {
    return @()
  }

  $matches = Get-ChildItem -Path $plansRoot -Recurse -Filter "*.dev-plan.md" -File -ErrorAction SilentlyContinue |
    Select-Object -First 5

  $paths = @()
  foreach ($match in $matches) {
    $paths += $match.FullName.Substring($Root.Length).TrimStart("\", "/")
  }

  return $paths
}

function Get-RuntimeTruthSourceMap {
  <#
    读取 task.json runtime.handoff.truth_sources 中声明的项目自定义 truth source。
  #>
  param([string]$Root)

  $taskPath = Join-Path $Root "task.json"
  $truthSourceMap = @{}
  if (-not (Test-Path -LiteralPath $taskPath)) {
    return $truthSourceMap
  }

  try {
    $taskDocument = Get-Content -LiteralPath $taskPath -Raw -Encoding UTF8 | ConvertFrom-Json
  }
  catch {
    return $truthSourceMap
  }

  $runtime = Get-ObjectPropertyValue -InputObject $taskDocument -Name "runtime"
  $handoff = Get-ObjectPropertyValue -InputObject $runtime -Name "handoff"
  $truthSources = Get-ObjectPropertyValue -InputObject $handoff -Name "truth_sources"
  if ($null -eq $truthSources) {
    return $truthSourceMap
  }

  foreach ($property in $truthSources.PSObject.Properties) {
    $truthSourceName = [string]$property.Name
    if ([string]::IsNullOrWhiteSpace($truthSourceName)) {
      continue
    }

    $truthSourceMap[$truthSourceName] = ConvertTo-StringArray -Value $property.Value
  }

  return $truthSourceMap
}

function Get-TruthSourceState {
  <#
    按 truth source 类型收集已满足和缺失的真相源。
  #>
  param(
    [string]$Root,
    [string[]]$RequiredTruthSources
  )

  $states = @()
  $runtimeTruthSourceMap = Get-RuntimeTruthSourceMap -Root $Root
  foreach ($truthSource in @(ConvertTo-UniqueStringArray -Items $RequiredTruthSources)) {
    switch ($truthSource) {
      "repo_context" {
        $presentPaths = @()
        $missingRequirements = @()

        $featurePack = Get-FirstExistingRelativePath -Root $Root -Candidates @(
          "feature-pack.md",
          "context\feature-pack.md",
          "docs\context\feature-pack.md"
        )
        if ($null -ne $featurePack) { $presentPaths += $featurePack } else { $missingRequirements += "feature-pack.md | context\\feature-pack.md | docs\\context\\feature-pack.md" }

        $repoMap = Get-FirstExistingRelativePath -Root $Root -Candidates @(
          "repo-map.md",
          "context\repo-map.md",
          "docs\context\repo-map.md",
          "docs\ai\repo-map.md"
        )
        if ($null -ne $repoMap) { $presentPaths += $repoMap } else { $missingRequirements += "repo-map.md | context\\repo-map.md | docs\\context\\repo-map.md | docs\\ai\\repo-map.md" }

        $architectureBrief = Get-FirstExistingRelativePath -Root $Root -Candidates @(
          "architecture-brief.md",
          "context\architecture-brief.md",
          "docs\context\architecture-brief.md",
          "docs\architecture\architecture-brief.md"
        )
        if ($null -ne $architectureBrief) { $presentPaths += $architectureBrief } else { $missingRequirements += "architecture-brief.md | context\\architecture-brief.md | docs\\context\\architecture-brief.md | docs\\architecture\\architecture-brief.md" }

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "research" {
        $presentPaths = @()
        $researchRoot = Join-Path $Root "docs\research"
        if (Test-Path -LiteralPath $researchRoot) {
          $presentPaths += @(Get-ChildItem -Path $researchRoot -Recurse -Filter "*.md" -File -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName.Substring($Root.Length).TrimStart("\", "/") })
        }

        $adrRoot = Join-Path $Root "docs\adr"
        if (Test-Path -LiteralPath $adrRoot) {
          $presentPaths += @(Get-ChildItem -Path $adrRoot -Filter "ADR-*.md" -File -ErrorAction SilentlyContinue |
            ForEach-Object { $_.FullName.Substring($Root.Length).TrimStart("\", "/") })
        }

        $presentPaths = ConvertTo-UniqueStringArray -Items $presentPaths
        $missingRequirements = @()
        if ($presentPaths.Count -eq 0) {
          $missingRequirements += "docs\\research\\*.md | docs\\adr\\ADR-*.md"
        }

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "product" {
        $requiredPaths = @(
          "docs\product\prd-lite.md",
          "docs\product\page-inventory.md",
          "docs\product\state-matrix.yaml",
          "docs\product\acceptance-criteria.md",
          "docs\product\requirement-interface-matrix.md",
          "docs\product\difficulty-research.md"
        )
        $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
        $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "design" {
        $requiredPaths = @(
          "docs\design\design-brief.md",
          "docs\design\component-map.md",
          "docs\design\screen-states.md",
          "docs\design\design-tokens.json",
          "docs\design\ai-image-brief.md",
          "docs\design\ui-image-review.md",
          "docs\design\image-to-frontend-spec.md"
        )
        $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
        $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "plan" {
        $presentPaths = @(Get-ExistingDevPlans -Root $Root)
        $missingRequirements = @()
        if ($presentPaths.Count -eq 0) {
          $missingRequirements += "plans\\**\\*.dev-plan.md"
        }

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "testing" {
        $requiredPaths = @(
          "docs\testing\ACCEPTANCE_CRITERIA.md",
          "docs\testing\ACCEPTANCE_EXAMPLES.md",
          "docs\testing\TRACEABILITY_MATRIX.md",
          "docs\testing\TEST_DATA_MATRIX.md",
          "docs\testing\test-matrix.md",
          "docs\testing\verify-matrix.md"
        )
        $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
        $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "contract" {
        $requiredPaths = @("contracts\openapi.yaml")
        $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
        $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      "knowledge" {
        $requiredPaths = @(
          "docs\knowledge\knowledge-catalog.md",
          "docs\knowledge\catalog.md"
        )
        $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
        $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

        $states += [PSCustomObject]@{
          source = $truthSource
          satisfied = ($missingRequirements.Count -eq 0)
          present_paths = $presentPaths
          missing_requirements = $missingRequirements
        }
      }
      default {
        if ($runtimeTruthSourceMap.ContainsKey($truthSource)) {
          $requiredPaths = @(ConvertTo-StringArray -Value $runtimeTruthSourceMap[$truthSource])
          $presentPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths $requiredPaths
          $missingRequirements = @($requiredPaths | Where-Object { $presentPaths -notcontains $_ })

          $states += [PSCustomObject]@{
            source = $truthSource
            satisfied = ($requiredPaths.Count -gt 0 -and $missingRequirements.Count -eq 0)
            present_paths = $presentPaths
            missing_requirements = $missingRequirements
          }
        }
        else {
          $states += [PSCustomObject]@{
            source = $truthSource
            satisfied = $false
            present_paths = @()
            missing_requirements = @("unsupported truth source")
          }
        }
      }
    }
  }

  return $states
}

function Convert-TruthSourceStateToBulletLines {
  <#
    将 truth source 满足情况格式化成多行 bullet。
  #>
  param([object[]]$States)

  if ($null -eq $States -or $States.Count -eq 0) {
    return "- 无前置 truth source 要求"
  }

  $lines = @()
  foreach ($state in $States) {
    $status = if ($state.satisfied) { "OK" } else { "MISSING" }
    $presentPaths = @(ConvertTo-StringArray -Value $state.present_paths)
    $missingRequirements = @(ConvertTo-StringArray -Value $state.missing_requirements)
    $presentText = if ($presentPaths.Count -gt 0) { $presentPaths -join ", " } else { "无" }
    $missingText = if ($missingRequirements.Count -gt 0) { $missingRequirements -join "; " } else { "无" }
    $lines += "- [$status] $($state.source): present=$presentText; missing=$missingText"
  }

  return $lines -join "`n"
}

function Get-ReviewPromptTemplate {
  <#
    优先读取项目内 prompt 模板；不存在时回退到内置模板。
  #>
  param(
    [string]$Root,
    [string]$TemplateName,
    [string]$FallbackTemplate
  )

  return Get-PromptTemplate -Root $Root -TemplateName $TemplateName -FallbackTemplate $FallbackTemplate
}

function Get-ReviewContextPaths {
  <#
    收集两阶段审查需要优先对照的真相源文件。
  #>
  param(
    [string]$Root,
    [object]$ExecutionPolicy
  )

  $productPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths @(
    "docs\product\prd-lite.md",
    "docs\product\page-inventory.md",
    "docs\product\state-matrix.yaml",
    "docs\product\acceptance-criteria.md",
    "docs\product\requirement-interface-matrix.md",
    "docs\product\difficulty-research.md"
  )

  $designPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths @(
    "docs\design\design-brief.md",
    "docs\design\component-map.md",
    "docs\design\screen-states.md",
    "docs\design\design-tokens.json",
    "docs\design\ai-image-brief.md",
    "docs\design\ui-image-review.md",
    "docs\design\image-to-frontend-spec.md"
  )

  $contractPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths @(
    "contracts\openapi.yaml"
  )
  $testingPaths = Get-ExistingRelativePaths -Root $Root -RelativePaths @(
    "docs\testing\ACCEPTANCE_CRITERIA.md",
    "docs\testing\ACCEPTANCE_EXAMPLES.md",
    "docs\testing\TRACEABILITY_MATRIX.md",
    "docs\testing\RISK_BASED_TEST_PLAN.md",
    "docs\testing\TEST_DATA_MATRIX.md",
    "docs\testing\EVIDENCE_PROTOCOL.md",
    "docs\testing\REGRESSION_PLAN.md",
    "docs\testing\test-matrix.md",
    "docs\testing\test-data-plan.md",
    "docs\testing\verify-matrix.md",
    "docs\testing\failure-triage.md"
  )

  $planPaths = @(Get-ExistingDevPlans -Root $Root)
  $contextFiles = Get-ExistingRelativePaths -Root $Root -RelativePaths $ExecutionPolicy.context_files
  $truthSourceState = Get-TruthSourceState -Root $Root -RequiredTruthSources $ExecutionPolicy.required_truth_sources

  return [PSCustomObject]@{
    product = $productPaths
    design = $designPaths
    contracts = $contractPaths
    testing = $testingPaths
    plans = $planPaths
    task_context = $contextFiles
    truth_source_state = $truthSourceState
    missing_truth_sources = @($truthSourceState | Where-Object { -not $_.satisfied } | ForEach-Object { $_.source })
  }
}

function Get-ReviewVerdict {
  <#
    从 reviewer 输出中提取 PASS / FAIL，未显式给出时返回 UNKNOWN。
  #>
  param([string]$Output)

  $matches = [regex]::Matches($Output, '(?im)^[\t ]*(?:[-*][\t ]*)?(?:Final[\t ]+Verdict|Verdict)[\t ]*[:：][\t ]*(PASS|FAIL)\b|^[\t ]*#{1,6}[\t ]*(?:Final[\t ]+)?Verdict[\t ]*(?:\r?\n[\t ]*)+(?:[-*][\t ]*)?(PASS|FAIL)\b')
  if ($matches.Count -gt 0) {
    $lastMatch = $matches[$matches.Count - 1]
    foreach ($group in $lastMatch.Groups) {
      if ($group.Value -in @("PASS", "FAIL")) {
        return $group.Value
      }
    }
  }

  return "UNKNOWN"
}

function New-Stage1ReviewPrompt {
  <#
    生成 Stage 1：Spec / 设计一致性审查 prompt。
  #>
  param(
    [object]$Task,
    [string]$Root,
    [object]$ExecutionPolicy,
    [object]$ReviewContext
  )

  $fallbackTemplate = @"
你是 Stage 1 Reviewer。只审查当前实现是否符合 Product Spec / Design Brief / 设计稿 / DEV-PLAN，不要讨论代码风格。
"@

  $template = Get-ReviewPromptTemplate -Root $Root -TemplateName "review-stage1-spec.md" -FallbackTemplate $fallbackTemplate
  $productText = ConvertTo-BulletLines -Items $ReviewContext.product
  $designText = ConvertTo-BulletLines -Items $ReviewContext.design
  $testingText = ConvertTo-BulletLines -Items $ReviewContext.testing
  $planText = ConvertTo-BulletLines -Items $ReviewContext.plans
  $contractText = ConvertTo-BulletLines -Items $ReviewContext.contracts
  $contextFilesText = ConvertTo-BulletLines -Items $ReviewContext.task_context
  $truthSourceStateText = Convert-TruthSourceStateToBulletLines -States $ReviewContext.truth_source_state
  $acceptanceText = ConvertTo-BulletLines -Items (ConvertTo-StringArray -Value $Task.acceptance)
  $requirementIdsText = ConvertTo-BulletLines -Items (ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "requirement_ids")) -EmptyText "- 未显式声明 Requirement IDs"

  return @"
$template

## Driver Context

- Task ID: $($Task.id)
- 描述: $($Task.description)
- Task Kind: $($ExecutionPolicy.task_kind)
- Gate Profile: $($ExecutionPolicy.gate_profile)
- Requirement IDs:
$requirementIdsText
- 验收标准:
$acceptanceText

优先真相源:

### Product
$productText

### Design
$designText

### Testing
$testingText

### DEV-PLAN
$planText

### Contract
$contractText

### Task Context Files
$contextFilesText

### Truth Source Completeness
$truthSourceStateText

审查要求:
- 只看功能完整性、状态覆盖、与设计和计划的一致性。
- 不要重写代码，不要实现新功能。
- 如果 Gate Profile 不是 `lightweight`，缺少 required truth source 视为阻塞性问题。
- 如果 Gate Profile 是 `lightweight`，可以记录缺口，但不要把 driver 自己负责的状态文件当作失败项。

输出要求:
- 必须包含 `Verdict: PASS` 或 `Verdict: FAIL`。
- 只要存在阻塞性功能/状态/设计偏差，就输出 `Verdict: FAIL`。
"@
}

function New-Stage2ReviewPrompt {
  <#
    生成 Stage 2：代码质量 / 测试风险审查 prompt。
  #>
  param(
    [object]$Task,
    [string]$Root,
    [object]$ExecutionPolicy,
    [object]$ReviewContext,
    [object]$TestResult
  )

  $fallbackTemplate = @"
你是 Stage 2 Reviewer。Stage 1 已通过。现在只审查代码质量、测试、风险和可维护性，不要重新做需求裁判。
"@

  $template = Get-ReviewPromptTemplate -Root $Root -TemplateName "review-stage2-quality.md" -FallbackTemplate $fallbackTemplate
  $contextFilesText = ConvertTo-BulletLines -Items $ReviewContext.task_context
  $contractText = ConvertTo-BulletLines -Items $ReviewContext.contracts
  $testingText = ConvertTo-BulletLines -Items $ReviewContext.testing
  $requirementIdsText = ConvertTo-BulletLines -Items (ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $Task -Name "requirement_ids")) -EmptyText "- 未显式声明 Requirement IDs"

  return @"
$template

## Driver Context

- Task ID: $($Task.id)
- 描述: $($Task.description)
- Requirement IDs:
$requirementIdsText
- 测试命令: $($Task.test_command)
- 测试退出码: $($TestResult.ExitCode)

任务相关文件:
$contextFilesText

Contract 真相源:
$contractText

Testing 真相源:
$testingText

测试输出摘要:
$($TestResult.Output)

审查要求:
- 只讨论代码质量、测试覆盖、回归风险、安全风险和可维护性。
- 不要回到 Stage 1 的需求/设计裁判。

输出要求:
- 必须包含 `Verdict: PASS` 或 `Verdict: FAIL`。
- 只要存在阻塞性质量问题或关键测试缺口，就输出 `Verdict: FAIL`。
"@
}

function Invoke-CodexTask {
  <#
    调用 codex exec 运行单任务。
    原始输出写入日志文件，终端只显示 driver 摘要。
  #>
  param(
    [string]$Prompt,
    [string]$Root,
    [string]$Command,
    [string]$LogDirectory,
    [string]$TaskId,
    [string]$Sandbox = "danger-full-access",
    [string]$ActivityLabel = "Codex",
    [int]$HeartbeatSeconds = 20,
    [switch]$CaptureJsonEvents
  )

  New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null

  $safeTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $promptPath = Join-Path $LogDirectory "$TaskId-$safeTimestamp-prompt.txt"
  $stdoutPath = Join-Path $LogDirectory "$TaskId-$safeTimestamp-codex-output.log"
  $stderrPath = Join-Path $LogDirectory "$TaskId-$safeTimestamp-codex-error.log"
  $lastMessagePath = Join-Path $LogDirectory "$TaskId-$safeTimestamp-codex-final.txt"

  Set-Content -LiteralPath $promptPath -Value $Prompt -Encoding UTF8

  $arguments = @("exec")
  if ($Sandbox -eq "danger-full-access") {
    $arguments += "--dangerously-bypass-approvals-and-sandbox"
  }
  else {
    $arguments += @(
      "--sandbox",
      $Sandbox
    )
  }
  $arguments += @(
    "--color",
    "never",
    "--disable",
    "hooks",
    "--output-last-message",
    $lastMessagePath,
    "-C",
    $Root,
    "-"
  )
  if ($CaptureJsonEvents) {
    $arguments += "--json"
  }

  $resolvedCommand = Resolve-NativeApplicationCommand -Command $Command
  $process = Start-Process `
    -FilePath $resolvedCommand `
    -ArgumentList $arguments `
    -WorkingDirectory $Root `
    -RedirectStandardInput $promptPath `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -NoNewWindow `
    -PassThru

  Write-Step "$ActivityLabel 已启动，PID=$($process.Id)，日志: $stdoutPath"

  $startedAt = Get-Date
  $lastHeartbeatAt = $startedAt.AddSeconds(-1 * $HeartbeatSeconds)
  while (-not $process.HasExited) {
    Start-Sleep -Seconds 2
    $process.Refresh()

    $now = Get-Date
    if (($now - $lastHeartbeatAt).TotalSeconds -lt $HeartbeatSeconds) {
      continue
    }

    $elapsed = [int]($now - $startedAt).TotalSeconds
    $preview = Get-CompactLogPreview -Path $stdoutPath
    if ([string]::IsNullOrWhiteSpace($preview)) {
      $preview = Get-CompactLogPreview -Path $stderrPath
    }

    if ([string]::IsNullOrWhiteSpace($preview)) {
      Write-Step "$ActivityLabel 仍在运行，已耗时 ${elapsed}s，日志: $stdoutPath"
    }
    else {
      Write-Step "$ActivityLabel 仍在运行，已耗时 ${elapsed}s，最近输出: $preview"
    }

    $lastHeartbeatAt = $now
  }

  $process.WaitForExit()

  $stdout = Get-TextFileContent -Path $stdoutPath
  $stderr = Get-TextFileContent -Path $stderrPath
  $lastMessage = Get-TextFileContent -Path $lastMessagePath
  $combinedOutput = @($stdout, $stderr, $lastMessage) -join "`n"

  return [PSCustomObject]@{
    ExitCode = $process.ExitCode
    Output = $combinedOutput
    LastMessage = $lastMessage
    StdoutLog = $stdoutPath
    StderrLog = $stderrPath
    PromptLog = $promptPath
    LastMessageLog = $lastMessagePath
    EventsLog = $(if ($CaptureJsonEvents) { $stdoutPath } else { $null })
  }
}

function Get-TaskLogDirectory {
  <#
    为当前 task session 创建持久日志目录。
  #>
  param(
    [string]$TraceRoot,
    [string]$TaskId,
    [string]$TaskSessionId
  )

  $taskDirectory = Join-Path $TraceRoot "$TaskId-$TaskSessionId"
  New-Item -ItemType Directory -Force -Path $taskDirectory | Out-Null
  return $taskDirectory
}

function Get-TraceLogFiles {
  <#
    汇总当前 task session 已产生的日志文件路径。
  #>
  param([object[]]$CodexResults)

  $paths = @()
  foreach ($result in @($CodexResults)) {
    if ($null -eq $result) {
      continue
    }

    $paths += ConvertTo-StringArray -Value @(
      $result.StdoutLog,
      $result.StderrLog,
      $result.PromptLog,
      $result.LastMessageLog
    )
  }

  return ConvertTo-UniqueStringArray -Items $paths
}

function Add-TraceDurableFields {
  <#
    为 trace payload 补齐 durable trace schema 字段。
  #>
  param(
    [object]$Trace,
    [string]$SessionDirectory,
    [switch]$CaptureJsonEvents,
    [object]$EventsSource,
    [string[]]$LogFiles
  )

  Add-Member -InputObject $Trace -MemberType NoteProperty -Name "schema_version" -Value "2.0.0" -Force
  Add-Member -InputObject $Trace -MemberType NoteProperty -Name "session_dir" -Value $SessionDirectory -Force
  Add-Member -InputObject $Trace -MemberType NoteProperty -Name "events_file" -Value $(if ($CaptureJsonEvents -and $null -ne $EventsSource) { $EventsSource.EventsLog } else { $null }) -Force
  Add-Member -InputObject $Trace -MemberType NoteProperty -Name "log_files" -Value @(ConvertTo-StringArray -Value $LogFiles) -Force
  Add-Member -InputObject $Trace -MemberType NoteProperty -Name "evidence_files" -Value @() -Force
  if ($null -eq (Get-ObjectPropertyValue -InputObject $Trace -Name "knowledge_references")) {
    Add-Member -InputObject $Trace -MemberType NoteProperty -Name "knowledge_references" -Value @() -Force
  }
  if ($null -eq (Get-ObjectPropertyValue -InputObject $Trace -Name "knowledge_outputs")) {
    Add-Member -InputObject $Trace -MemberType NoteProperty -Name "knowledge_outputs" -Value @() -Force
  }
  if ($null -eq (Get-ObjectPropertyValue -InputObject $Trace -Name "archive_summary")) {
    Add-Member -InputObject $Trace -MemberType NoteProperty -Name "archive_summary" -Value $null -Force
  }
  return $Trace
}

function Invoke-TestCommand {
  <#
    执行任务指定的验证命令，并在需要时持久化测试输出。
  #>
  param(
    [string]$Command,
    [string]$Root,
    [string]$LogDirectory = "",
    [string]$TaskId = "task"
  )

  Push-Location $Root
  try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
      $output = powershell -NoProfile -Command $Command 2>&1
      $exitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    $outputText = ($output -join "`n")
    $outputLog = $null
    if (-not [string]::IsNullOrWhiteSpace($LogDirectory)) {
      New-Item -ItemType Directory -Force -Path $LogDirectory | Out-Null
      $safeTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
      $outputLog = Join-Path $LogDirectory "$TaskId-test-$safeTimestamp.log"
      Set-Content -LiteralPath $outputLog -Value $outputText -Encoding UTF8
    }

    return [PSCustomObject]@{
      ExitCode = $exitCode
      Output = $outputText
      OutputLog = $outputLog
    }
  }
  finally {
    Pop-Location
  }
}

function Write-ProgressEntry {
  <#
    追加固定格式的人类可读进度记录。
  #>
  param(
    [string]$Path,
    [object]$Task,
    [string]$WorkSummary,
    [string]$TestSummary,
    [string]$Notes,
    [string]$Stage1Summary = "未运行",
    [string]$Stage2Summary = "未运行"
  )

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
  $entry = @"
## [$timestamp] - Task: $($Task.id) $($Task.description)

### 完成的工作：
- $WorkSummary

### 测试结果：
- $TestSummary

### 审查结果：
- Stage 1: $Stage1Summary
- Stage 2: $Stage2Summary

### 备注：
- $Notes
"@
  Add-Content -LiteralPath $Path -Value $entry
}

function Save-Trace {
  <#
    保存机器可读 trace。
  #>
  param(
    [string]$Directory,
    [object]$Trace
  )

  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $safeTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $path = Join-Path $Directory "$($Trace.task_id)-$safeTimestamp.json"
  $Trace | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding UTF8
  return $path
}

function Set-TaskPassed {
  <#
    将指定任务标记为通过并写回 JSON。
  #>
  param(
    [object]$TaskDocument,
    [string]$TaskId,
    [string]$Path
  )

  foreach ($task in $TaskDocument.tasks) {
    if ($task.id -eq $TaskId) {
      $task.passes = $true
    }
  }

  $TaskDocument | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-TaskExecutionMode {
  <#
    返回任务执行模式。默认 single。
  #>
  param([object]$Task)

  $execution = Get-ObjectPropertyValue -InputObject $Task -Name "execution"
  $mode = Get-ObjectPropertyValue -InputObject $execution -Name "mode"
  if ([string]::IsNullOrWhiteSpace($mode)) {
    $mode = Get-ObjectPropertyValue -InputObject $Task -Name "mode" -Default "single"
  }

  return ([string]$mode).Trim().ToLowerInvariant()
}

function Invoke-OneTask {
  <#
    执行单个任务闭环。
  #>
  param(
    [string]$TaskPath,
    [string]$ProgressPath,
    [string]$TracePath
  )

  $startedAt = Get-Date
  $taskDocument = Get-TaskDocument -Path $TaskPath
  $task = Select-NextTask -TaskDocument $taskDocument

  if ($null -eq $task) {
    return [PSCustomObject]@{
      Status = "idle"
      TaskId = $null
    }
  }

  $executionPolicy = Get-TaskExecutionPolicy -Root $ProjectRoot -ConfiguredRunProfilePath $RunProfileFile -TaskDocument $taskDocument -Task $task
  $requireCleanWorkspace = Get-ObjectPropertyValue -InputObject $executionPolicy.git -Name "require_clean_workspace" -Default $true
  $nonBlockingDirtyPaths = ConvertTo-StringArray -Value (Get-ObjectPropertyValue -InputObject $executionPolicy.git -Name "non_blocking_dirty_paths")
  if ($requireCleanWorkspace) {
    Assert-CleanGitWorkspace -Root $ProjectRoot -NonBlockingPaths $nonBlockingDirtyPaths
  }

  $taskSessionId = [guid]::NewGuid().ToString("N")
  $taskLogDirectory = Get-TaskLogDirectory -TraceRoot $TracePath -TaskId $task.id -TaskSessionId $taskSessionId
  $taskMode = Get-TaskExecutionMode -Task $task
  if ($taskMode -ne "single") {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "未识别的执行模式。" -TestSummary "未运行测试。" -Notes "execution.mode = $taskMode。允许值: single。" -Stage1Summary "NOT_RUN - 未进入 Stage 1。" -Stage2Summary "NOT_RUN - 未进入 Stage 2。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = "unknown"
      agent = "codex-loop"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "blocked"
      failed_stage = "execution_mode"
      stage1_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 1 审查。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 2 审查。"
      }
      blocked_reason = "未知 execution.mode: $taskMode"
      commands = @()
      logs = @{}
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $null -LogFiles @() | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "BLOCKED: 未知 execution.mode: $taskMode"
    return [PSCustomObject]@{
      Status = "blocked"
      TaskId = $task.id
      ExitCode = 2
    }
  }

  $initialReviewContext = Get-ReviewContextPaths -Root $ProjectRoot -ExecutionPolicy $executionPolicy
  if ($executionPolicy.gate_profile -ne "lightweight" -and $initialReviewContext.missing_truth_sources.Count -gt 0) {
    $truthSourceSummary = Convert-TruthSourceStateToBulletLines -States $initialReviewContext.truth_source_state
    $blockedReason = "缺少前置 truth sources: $($initialReviewContext.missing_truth_sources -join ', ')"
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "未进入实现阶段，前置 truth source 检查未通过。" -TestSummary "未运行测试。" -Notes "$blockedReason`n$truthSourceSummary" -Stage1Summary "NOT_RUN - truth source precheck 未通过。" -Stage2Summary "NOT_RUN - 未进入 Stage 2 审查。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = $executionPolicy.task_kind
      gate_profile = $executionPolicy.gate_profile
      required_truth_sources = $executionPolicy.required_truth_sources
      truth_source_state = $initialReviewContext.truth_source_state
      agent = "codex"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "blocked"
      test_command = $task.test_command
      failed_stage = "truth_source_precheck"
      stage1_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "truth source precheck 未通过。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 2 审查。"
      }
      session_policy = $executionPolicy.session
      subagent_policy = $executionPolicy.subagents
      context_files = $executionPolicy.context_files
      run_profile_path = $executionPolicy.run_profile_path
      review_context = $initialReviewContext
      commands = @(@{ cmd = "truth_source_precheck"; exit_code = 1 })
      blocked_reason = $blockedReason
      final_message = $blockedReason
      logs = @{}
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $null -LogFiles @() | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "BLOCKED: 前置 truth source 检查未通过。"
    Write-Output $truthSourceSummary
    return [PSCustomObject]@{
      Status = "blocked"
      TaskId = $task.id
      ExitCode = 2
    }
  }

  Write-Step "选择任务: $($task.id) $($task.description)"
  Write-Step "启动新 task 会话: $taskSessionId ($($executionPolicy.session.mode))"

  $prompt = New-ImplementationPrompt -Task $task -ExecutionPolicy $executionPolicy -TaskSessionId $taskSessionId
  Write-Step "Codex 执行中，完整日志将写入 $taskLogDirectory"
  $codexResult = Invoke-CodexTask -Prompt $prompt -Root $ProjectRoot -Command $CodexCommand -LogDirectory $taskLogDirectory -TaskId $task.id -Sandbox "danger-full-access" -ActivityLabel "实现阶段" -CaptureJsonEvents:$CaptureJsonEvents
  $codexBlocked = Test-CodexBlocked -Output $codexResult.LastMessage
  $codexRecoverableCompletion = Test-RecoverableCodexCompletion -ExitCode $codexResult.ExitCode -Output $codexResult.Output -LastMessage $codexResult.LastMessage

  if ($codexRecoverableCompletion -and $codexResult.ExitCode -ne 0) {
    Write-Step "检测到可继续推进的 Codex 完成态，忽略异常退出码并继续后续闸门。详情见: $($codexResult.StdoutLog)"
  }

  if ((($codexResult.ExitCode -ne 0) -and (-not $codexRecoverableCompletion)) -or $codexBlocked) {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "Codex 会话未完成。" -TestSummary "未运行测试。" -Notes "Codex 输出包含失败或 BLOCKED，请人工查看。" -Stage1Summary "NOT_RUN - 未进入 Stage 1 审查。" -Stage2Summary "NOT_RUN - 未进入 Stage 2 审查。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = $executionPolicy.task_kind
      gate_profile = $executionPolicy.gate_profile
      required_truth_sources = $executionPolicy.required_truth_sources
      truth_source_state = $initialReviewContext.truth_source_state
      agent = "codex"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "blocked"
      test_command = $task.test_command
      failed_stage = $null
      stage1_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 1 审查。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 2 审查。"
      }
      session_policy = $executionPolicy.session
      subagent_policy = $executionPolicy.subagents
      context_files = $executionPolicy.context_files
      run_profile_path = $executionPolicy.run_profile_path
      review_context = $initialReviewContext
      commands = @(@{ cmd = "codex exec"; exit_code = $codexResult.ExitCode })
      blocked_reason = "Codex 会话未完成。"
      final_message = $codexResult.Output
      logs = @{
        stdout = $codexResult.StdoutLog
        stderr = $codexResult.StderrLog
        prompt = $codexResult.PromptLog
        last_message = $codexResult.LastMessageLog
      }
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $codexResult -LogFiles (Get-TraceLogFiles -CodexResults @($codexResult)) | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "BLOCKED: Codex 会话未完成。完整日志: $($codexResult.StdoutLog)"
    Show-LogTail -Path $codexResult.StderrLog
    Show-LogTail -Path $codexResult.StdoutLog
    return [PSCustomObject]@{
      Status = "blocked"
      TaskId = $task.id
      ExitCode = 2
    }
  }

  $reviewContext = Get-ReviewContextPaths -Root $ProjectRoot -ExecutionPolicy $executionPolicy

  Write-Step "实现完成，开始 Stage 1 审查。"
  $stage1Prompt = New-Stage1ReviewPrompt -Task $task -Root $ProjectRoot -ExecutionPolicy $executionPolicy -ReviewContext $reviewContext
  $stage1Result = Invoke-CodexTask -Prompt $stage1Prompt -Root $ProjectRoot -Command $CodexCommand -LogDirectory $taskLogDirectory -TaskId "$($task.id)-stage1" -Sandbox "danger-full-access" -ActivityLabel "Stage 1 审查" -CaptureJsonEvents:$CaptureJsonEvents
  $stage1Verdict = Get-ReviewVerdict -Output $stage1Result.Output
  $stage1RecoverableCompletion = Test-RecoverableCodexCompletion -ExitCode $stage1Result.ExitCode -Output $stage1Result.Output -LastMessage $stage1Result.LastMessage

  if ($stage1RecoverableCompletion -and $stage1Result.ExitCode -ne 0) {
    Write-Step "Stage 1 审查存在可继续推进的异常退出码，按 verdict 继续裁决。"
  }

  if ((($stage1Result.ExitCode -ne 0) -and (-not $stage1RecoverableCompletion)) -or $stage1Verdict -ne "PASS") {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "Codex 已完成实现，但 Stage 1 审查未通过。" -TestSummary "未运行测试。" -Notes "请先修复 Spec / 设计 / 状态偏差，再重新运行 driver。" -Stage1Summary "$stage1Verdict - 审查未通过。" -Stage2Summary "NOT_RUN - 未进入 Stage 2 审查。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = $executionPolicy.task_kind
      gate_profile = $executionPolicy.gate_profile
      required_truth_sources = $executionPolicy.required_truth_sources
      truth_source_state = $reviewContext.truth_source_state
      agent = "codex"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "failed"
      test_command = $task.test_command
      failed_stage = "stage1_review"
      stage1_review = [PSCustomObject]@{
        verdict = $stage1Verdict
        exit_code = $stage1Result.ExitCode
        summary = "Stage 1 审查未通过。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 2 审查。"
      }
      session_policy = $executionPolicy.session
      subagent_policy = $executionPolicy.subagents
      context_files = $executionPolicy.context_files
      run_profile_path = $executionPolicy.run_profile_path
      review_context = $reviewContext
      commands = @(
        @{ cmd = "codex exec"; exit_code = $codexResult.ExitCode },
        @{ cmd = "stage1 review"; exit_code = $stage1Result.ExitCode; verdict = $stage1Verdict }
      )
      final_message = $stage1Result.Output
      logs = @{
        implementation_stdout = $codexResult.StdoutLog
        implementation_stderr = $codexResult.StderrLog
        implementation_prompt = $codexResult.PromptLog
        implementation_last_message = $codexResult.LastMessageLog
        stage1_stdout = $stage1Result.StdoutLog
        stage1_stderr = $stage1Result.StderrLog
        stage1_prompt = $stage1Result.PromptLog
        stage1_last_message = $stage1Result.LastMessageLog
      }
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $codexResult -LogFiles (Get-TraceLogFiles -CodexResults @($codexResult, $stage1Result)) | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "FAILED: Stage 1 审查未通过。Verdict = $stage1Verdict"
    Show-LogTail -Path $stage1Result.StdoutLog
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = 1
    }
  }

  Write-Step "Stage 1 审查通过，开始运行测试。"
  $testResult = Invoke-TestCommand -Command $task.test_command -Root $ProjectRoot -LogDirectory $taskLogDirectory -TaskId $task.id

  if ($testResult.ExitCode -ne 0) {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "Codex 已产生改动。" -TestSummary "测试失败，退出码 $($testResult.ExitCode)。" -Notes "禁止标记 passes=true，请人工查看 trace。" -Stage1Summary "PASS - 审查通过。" -Stage2Summary "NOT_RUN - 未进入 Stage 2 审查。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = $executionPolicy.task_kind
      gate_profile = $executionPolicy.gate_profile
      required_truth_sources = $executionPolicy.required_truth_sources
      truth_source_state = $reviewContext.truth_source_state
      agent = "codex"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "failed"
      test_command = $task.test_command
      failed_stage = "test_command"
      stage1_review = [PSCustomObject]@{
        verdict = "PASS"
        exit_code = $stage1Result.ExitCode
        summary = "Stage 1 审查通过。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = "NOT_RUN"
        exit_code = $null
        summary = "未进入 Stage 2 审查。"
      }
      session_policy = $executionPolicy.session
      subagent_policy = $executionPolicy.subagents
      context_files = $executionPolicy.context_files
      run_profile_path = $executionPolicy.run_profile_path
      review_context = $reviewContext
      commands = @(
        @{ cmd = "codex exec"; exit_code = $codexResult.ExitCode },
        @{ cmd = "stage1 review"; exit_code = $stage1Result.ExitCode; verdict = $stage1Verdict },
        @{ cmd = $task.test_command; exit_code = $testResult.ExitCode }
      )
      final_message = $codexResult.Output
      logs = @{
        implementation_stdout = $codexResult.StdoutLog
        implementation_stderr = $codexResult.StderrLog
        implementation_prompt = $codexResult.PromptLog
        implementation_last_message = $codexResult.LastMessageLog
        stage1_stdout = $stage1Result.StdoutLog
        stage1_stderr = $stage1Result.StderrLog
        stage1_prompt = $stage1Result.PromptLog
        stage1_last_message = $stage1Result.LastMessageLog
        test_output = $testResult.OutputLog
      }
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $codexResult -LogFiles (@(Get-TraceLogFiles -CodexResults @($codexResult, $stage1Result)) + @(ConvertTo-StringArray -Value $testResult.OutputLog)) | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "FAILED: 测试失败，退出码 $($testResult.ExitCode)。"
    Write-Output ""
    Write-Output "测试输出:"
    Write-Output $testResult.Output
    Write-Output ""
    Write-Output "Codex 完整日志: $($codexResult.StdoutLog)"
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = 1
    }
  }

  Write-Step "测试通过，开始 Stage 2 审查。"
  $stage2Prompt = New-Stage2ReviewPrompt -Task $task -Root $ProjectRoot -ExecutionPolicy $executionPolicy -ReviewContext $reviewContext -TestResult $testResult
  $stage2Result = Invoke-CodexTask -Prompt $stage2Prompt -Root $ProjectRoot -Command $CodexCommand -LogDirectory $taskLogDirectory -TaskId "$($task.id)-stage2" -Sandbox "danger-full-access" -ActivityLabel "Stage 2 审查" -CaptureJsonEvents:$CaptureJsonEvents
  $stage2Verdict = Get-ReviewVerdict -Output $stage2Result.Output
  $stage2RecoverableCompletion = Test-RecoverableCodexCompletion -ExitCode $stage2Result.ExitCode -Output $stage2Result.Output -LastMessage $stage2Result.LastMessage

  if ($stage2RecoverableCompletion -and $stage2Result.ExitCode -ne 0) {
    Write-Step "Stage 2 审查存在可继续推进的异常退出码，按 verdict 继续裁决。"
  }

  if ((($stage2Result.ExitCode -ne 0) -and (-not $stage2RecoverableCompletion)) -or $stage2Verdict -ne "PASS") {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "Codex 已完成实现并通过测试，但 Stage 2 审查未通过。" -TestSummary "测试命令通过。" -Notes "请先修复代码质量或测试缺口，再重新运行 driver。" -Stage1Summary "PASS - 审查通过。" -Stage2Summary "$stage2Verdict - 审查未通过。"
    $tracePayload = [PSCustomObject]@{
      task_id = $task.id
      task_session_id = $taskSessionId
      task_kind = $executionPolicy.task_kind
      gate_profile = $executionPolicy.gate_profile
      required_truth_sources = $executionPolicy.required_truth_sources
      truth_source_state = $reviewContext.truth_source_state
      agent = "codex"
      started_at = $startedAt.ToString("o")
      ended_at = (Get-Date).ToString("o")
      status = "failed"
      test_command = $task.test_command
      failed_stage = "stage2_review"
      stage1_review = [PSCustomObject]@{
        verdict = "PASS"
        exit_code = $stage1Result.ExitCode
        summary = "Stage 1 审查通过。"
      }
      stage2_review = [PSCustomObject]@{
        verdict = $stage2Verdict
        exit_code = $stage2Result.ExitCode
        summary = "Stage 2 审查未通过。"
      }
      session_policy = $executionPolicy.session
      subagent_policy = $executionPolicy.subagents
      context_files = $executionPolicy.context_files
      run_profile_path = $executionPolicy.run_profile_path
      review_context = $reviewContext
      commands = @(
        @{ cmd = "codex exec"; exit_code = $codexResult.ExitCode },
        @{ cmd = "stage1 review"; exit_code = $stage1Result.ExitCode; verdict = $stage1Verdict },
        @{ cmd = $task.test_command; exit_code = $testResult.ExitCode },
        @{ cmd = "stage2 review"; exit_code = $stage2Result.ExitCode; verdict = $stage2Verdict }
      )
      final_message = $stage2Result.Output
      logs = @{
        implementation_stdout = $codexResult.StdoutLog
        implementation_stderr = $codexResult.StderrLog
        implementation_prompt = $codexResult.PromptLog
        implementation_last_message = $codexResult.LastMessageLog
        stage1_stdout = $stage1Result.StdoutLog
        stage1_stderr = $stage1Result.StderrLog
        stage1_prompt = $stage1Result.PromptLog
        stage1_last_message = $stage1Result.LastMessageLog
        stage2_stdout = $stage2Result.StdoutLog
        stage2_stderr = $stage2Result.StderrLog
        stage2_prompt = $stage2Result.PromptLog
        stage2_last_message = $stage2Result.LastMessageLog
        test_output = $testResult.OutputLog
      }
    }
    Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $codexResult -LogFiles (@(Get-TraceLogFiles -CodexResults @($codexResult, $stage1Result, $stage2Result)) + @(ConvertTo-StringArray -Value $testResult.OutputLog)) | Out-Null
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "FAILED: Stage 2 审查未通过。Verdict = $stage2Verdict"
    Show-LogTail -Path $stage2Result.StdoutLog
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = 1
    }
  }

  $changedFiles = & git -C $ProjectRoot status --short
  $tracePayload = [PSCustomObject]@{
    task_id = $task.id
    task_session_id = $taskSessionId
    task_kind = $executionPolicy.task_kind
    gate_profile = $executionPolicy.gate_profile
    required_truth_sources = $executionPolicy.required_truth_sources
    truth_source_state = $reviewContext.truth_source_state
    agent = "codex"
    started_at = $startedAt.ToString("o")
    ended_at = (Get-Date).ToString("o")
    status = "passed"
    test_command = $task.test_command
    failed_stage = $null
    stage1_review = [PSCustomObject]@{
      verdict = "PASS"
      exit_code = $stage1Result.ExitCode
      summary = "Stage 1 审查通过。"
    }
    stage2_review = [PSCustomObject]@{
      verdict = "PASS"
      exit_code = $stage2Result.ExitCode
      summary = "Stage 2 审查通过。"
    }
    session_policy = $executionPolicy.session
    subagent_policy = $executionPolicy.subagents
    context_files = $executionPolicy.context_files
    run_profile_path = $executionPolicy.run_profile_path
    review_context = $reviewContext
    commands = @(
      @{ cmd = "codex exec"; exit_code = $codexResult.ExitCode },
      @{ cmd = "stage1 review"; exit_code = $stage1Result.ExitCode; verdict = $stage1Verdict },
      @{ cmd = $task.test_command; exit_code = $testResult.ExitCode },
      @{ cmd = "stage2 review"; exit_code = $stage2Result.ExitCode; verdict = $stage2Verdict }
    )
    files_changed = $changedFiles
    final_message = $stage2Result.Output
    logs = @{
      implementation_stdout = $codexResult.StdoutLog
      implementation_stderr = $codexResult.StderrLog
      implementation_prompt = $codexResult.PromptLog
      implementation_last_message = $codexResult.LastMessageLog
      stage1_stdout = $stage1Result.StdoutLog
      stage1_stderr = $stage1Result.StderrLog
      stage1_prompt = $stage1Result.PromptLog
      stage1_last_message = $stage1Result.LastMessageLog
      stage2_stdout = $stage2Result.StdoutLog
      stage2_stderr = $stage2Result.StderrLog
      stage2_prompt = $stage2Result.PromptLog
      stage2_last_message = $stage2Result.LastMessageLog
      test_output = $testResult.OutputLog
    }
  }
  Add-TraceDurableFields -Trace $tracePayload -SessionDirectory $taskLogDirectory -CaptureJsonEvents:$CaptureJsonEvents -EventsSource $codexResult -LogFiles (@(Get-TraceLogFiles -CodexResults @($codexResult, $stage1Result, $stage2Result)) + @(ConvertTo-StringArray -Value $testResult.OutputLog)) | Out-Null
  $ownershipResult = Test-CommitPathOwnership -Root $ProjectRoot -Task $task -RuntimeAllowedPaths @(
    $TaskFile,
    $ProgressFile,
    "$TraceDir/",
    "traces/",
    "artifacts/"
  ) -NonBlockingDirtyPaths $nonBlockingDirtyPaths
  if (-not $ownershipResult.Passed) {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "实现、测试和审查已完成，但 commit ownership gate 未通过。" -TestSummary "测试命令通过。" -Notes ("unexpected paths: " + ($ownershipResult.UnexpectedPaths -join ", ")) -Stage1Summary "PASS - 审查通过。" -Stage2Summary "PASS - 审查通过。"
    Add-Member -InputObject $tracePayload -MemberType NoteProperty -Name "unexpected_paths" -Value $ownershipResult.UnexpectedPaths -Force
    $tracePayload.failed_stage = "commit_path_ownership"
    $tracePayload.status = "failed"
    Add-Member -InputObject $tracePayload -MemberType NoteProperty -Name "blocked_reason" -Value "changed paths 超出 owned_paths / runtime allowlist" -Force
    $tracePayload.files_changed = & git -C $ProjectRoot status --short
    $tracePayload.ended_at = (Get-Date).ToString("o")
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "FAILED: commit ownership gate 未通过。"
    Write-Output ("Unexpected paths: " + ($ownershipResult.UnexpectedPaths -join ", "))
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = 1
    }
  }

  Set-TaskPassed -TaskDocument $taskDocument -TaskId $task.id -Path $TaskPath
  Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "完成当前任务并更新 task.json。" -TestSummary "Stage 1、测试命令、Stage 2 全部通过。" -Notes "可继续运行 driver 处理下一个任务。" -Stage1Summary "PASS - 审查通过。" -Stage2Summary "PASS - 审查通过。"
  $tracePayload.files_changed = & git -C $ProjectRoot status --short
  $tracePayload.ended_at = (Get-Date).ToString("o")
  $traceFile = Save-Trace -Directory $TracePath -Trace $tracePayload

  $finalOwnershipResult = Test-CommitPathOwnership -Root $ProjectRoot -Task $task -RuntimeAllowedPaths @(
    $TaskFile,
    $ProgressFile,
    "$TraceDir/",
    "traces/",
    "artifacts/"
  ) -NonBlockingDirtyPaths $nonBlockingDirtyPaths
  if (-not $finalOwnershipResult.Passed) {
    Write-ProgressEntry -Path $ProgressPath -Task $task -WorkSummary "实现、测试和审查已完成，但最终 commit ownership gate 未通过。" -TestSummary "测试命令通过。" -Notes ("unexpected paths: " + ($finalOwnershipResult.UnexpectedPaths -join ", ")) -Stage1Summary "PASS - 审查通过。" -Stage2Summary "PASS - 审查通过。"
    Add-Member -InputObject $tracePayload -MemberType NoteProperty -Name "unexpected_paths" -Value $finalOwnershipResult.UnexpectedPaths -Force
    $tracePayload.failed_stage = "final_commit_path_ownership"
    $tracePayload.status = "failed"
    Add-Member -InputObject $tracePayload -MemberType NoteProperty -Name "blocked_reason" -Value "最终 changed paths 超出 owned_paths / runtime allowlist" -Force
    $tracePayload.files_changed = & git -C $ProjectRoot status --short
    $tracePayload.ended_at = (Get-Date).ToString("o")
    Save-Trace -Directory $TracePath -Trace $tracePayload | Out-Null
    Write-Step "FAILED: 最终 commit ownership gate 未通过。"
    Write-Output ("Unexpected paths: " + ($finalOwnershipResult.UnexpectedPaths -join ", "))
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = 1
    }
  }

  $gitAddResult = Invoke-NativeCommandQuiet -Script { & git -C $ProjectRoot add --all }
  if ($gitAddResult.ExitCode -ne 0) {
    Write-Step "FAILED: git add 失败。"
    Write-Output $gitAddResult.Output
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = $gitAddResult.ExitCode
    }
  }

  $gitCommitResult = Invoke-NativeCommandQuiet -Script { & git -C $ProjectRoot commit -m "feat: $($task.description) - completed $($task.id)" }
  if ($gitCommitResult.ExitCode -ne 0) {
    Write-Step "FAILED: git commit 失败。"
    Write-Output $gitCommitResult.Output
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = $gitCommitResult.ExitCode
    }
  }

  $gitHashResult = Invoke-NativeCommandQuiet -Script { & git -C $ProjectRoot rev-parse --short HEAD }
  if ($gitHashResult.ExitCode -ne 0) {
    Write-Step "FAILED: 无法读取 commit hash。"
    Write-Output $gitHashResult.Output
    return [PSCustomObject]@{
      Status = "failed"
      TaskId = $task.id
      ExitCode = $gitHashResult.ExitCode
    }
  }

  $commitHash = $gitHashResult.Output.Trim()
  Write-Step "任务完成: $($task.id)"
  Write-Output "Commit: $commitHash"
  Write-Output "Trace: $traceFile"
  Write-Output "Codex 日志: $($codexResult.StdoutLog)"

  return [PSCustomObject]@{
    Status = "passed"
    TaskId = $task.id
    ExitCode = 0
  }
}

$taskPath = Join-Path $ProjectRoot $TaskFile
$progressPath = Join-Path $ProjectRoot $ProgressFile
$tracePath = Join-Path $ProjectRoot $TraceDir

Write-Step "运行 runtime doctor。"
$doctorResult = Invoke-RuntimeDoctor -Root $ProjectRoot
if ($doctorResult.ExitCode -ne 0) {
  Write-Step "BLOCKED: runtime doctor 未通过。"
  Write-Output $doctorResult.Output
  exit 2
}
Write-Step "Runtime doctor 通过。"

do {
  $iteration = @(Invoke-OneTask -TaskPath $taskPath -ProgressPath $progressPath -TracePath $tracePath) | Select-Object -Last 1

  if ($iteration.Status -eq "idle") {
    Write-Output "全部任务已完成或没有依赖满足的任务。"
    exit 0
  }

  if ($iteration.Status -ne "passed") {
    exit $iteration.ExitCode
  }
}
while ($RunUntilDone)
