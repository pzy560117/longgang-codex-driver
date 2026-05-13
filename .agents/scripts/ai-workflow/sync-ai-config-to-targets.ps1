param(
  [string]$ConfigPath = "",
  [string]$SourceRoot = "",
  [string[]]$OnlyTargets = @(),
  [switch]$NoPush,
  [switch]$NoPullRequest,
  [switch]$AllowDirtySource
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($SourceRoot)) {
  $SourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
}

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  $ConfigPath = Join-Path $PSScriptRoot "sync-targets.json"
}

function Write-Step {
  param([string]$Message)
  Write-Host ("[ai-sync-targets] {0}" -f $Message)
}

function Get-OptionalPropertyValue {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Set-OptionalPropertyValue {
  param(
    [object]$Object,
    [string]$Name,
    [object]$Value
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
    return
  }

  $property.Value = $Value
}

function Normalize-RelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [switch]$Directory
  )

  $normalized = $Path.Replace("\", "/").Trim()
  while ($normalized.StartsWith("./", [System.StringComparison]::Ordinal)) {
    $normalized = $normalized.Substring(2)
  }

  if ($Directory) {
    return $normalized.TrimEnd("/") + "/"
  }

  return $normalized.TrimEnd("/")
}

function Join-NormalizedRelativePath {
  param(
    [string]$Base,
    [string]$Child
  )

  $left = Normalize-RelativePath -Path $Base
  $right = Normalize-RelativePath -Path $Child
  if ([string]::IsNullOrWhiteSpace($left)) {
    return $right
  }
  if ([string]::IsNullOrWhiteSpace($right)) {
    return $left
  }

  return "{0}/{1}" -f $left.TrimEnd("/"), $right
}

function Get-RelativePathFromBase {
  param(
    [string]$BasePath,
    [string]$TargetPath
  )

  $baseFull = [System.IO.Path]::GetFullPath($BasePath).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
  if (-not $targetFull.StartsWith($baseFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "路径不在预期根目录内: $TargetPath"
  }

  return Normalize-RelativePath -Path $targetFull.Substring($baseFull.Length)
}

function Read-JsonConfig {
  param(
    [string]$Path,
    [string]$Label
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "找不到 ${Label}: $Path"
  }

  try {
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  }
  catch {
    throw "${Label} 需要使用 JSON 兼容格式，当前文件无法用 ConvertFrom-Json 解析: $Path"
  }
}

function Write-JsonFile {
  param(
    [string]$Path,
    [object]$Value
  )

  $parent = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }

  $json = $Value | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
}

function Get-FileSha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Quote-ProcessArgument {
  param([string]$Value)

  if ($null -eq $Value -or $Value.Length -eq 0) {
    return '""'
  }

  if ($Value -notmatch '[\s"]') {
    return $Value
  }

  $escaped = $Value -replace '(\\*)"', '$1$1\"'
  $escaped = $escaped -replace '(\\+)$', '$1$1'
  return '"' + $escaped + '"'
}

function Invoke-Git {
  param(
    [string]$RepositoryPath,
    [string[]]$Arguments
  )

  $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("git-stdout-{0}.log" -f ([guid]::NewGuid().ToString("N")))
  $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) ("git-stderr-{0}.log" -f ([guid]::NewGuid().ToString("N")))
  try {
    $argumentString = ((@("-C", $RepositoryPath) + $Arguments) | ForEach-Object { Quote-ProcessArgument -Value ([string]$_) }) -join " "
    $process = Start-Process `
      -FilePath "git" `
      -ArgumentList $argumentString `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    $output = New-Object System.Collections.Generic.List[string]
    if (Test-Path -LiteralPath $stdoutPath -PathType Leaf) {
      foreach ($line in Get-Content -LiteralPath $stdoutPath) {
        $output.Add([string]$line)
      }
    }
    if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
      foreach ($line in Get-Content -LiteralPath $stderrPath) {
        $output.Add([string]$line)
      }
    }

    if ($process.ExitCode -ne 0) {
      $message = if ($output.Count -gt 0) { ($output -join [Environment]::NewLine) } else { "git command failed" }
      throw "git $($Arguments -join ' ') failed in $RepositoryPath`n$message"
    }

    return [string[]]$output.ToArray()
  }
  finally {
    if (Test-Path -LiteralPath $stdoutPath) {
      Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
    }
  }
}

function Get-GitStatusLines {
  param([string]$RepositoryPath)
  return @(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @("status", "--porcelain"))
}

function Get-GitCurrentBranch {
  param([string]$RepositoryPath)
  $output = @(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @("branch", "--show-current"))
  if (@($output).Count -eq 0) {
    return ""
  }

  return [string]$output[0]
}

function Get-GitHeadCommit {
  param([string]$RepositoryPath)
  $output = @(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @("rev-parse", "HEAD"))
  return [string]$output[0]
}

function Test-GitRepository {
  param([string]$RepositoryPath)
  try {
    Invoke-Git -RepositoryPath $RepositoryPath -Arguments @("rev-parse", "--show-toplevel") | Out-Null
    return $true
  }
  catch {
    return $false
  }
}

function Expand-ManagedEntries {
  param(
    [object]$Config,
    [string]$SourceRoot,
    [string]$DestinationRoot
  )

  $entries = New-Object System.Collections.Generic.List[object]
  $directoryPlans = New-Object System.Collections.Generic.List[object]
  $destinationSet = @{}
  $sourceHashSet = @{}

  $managedEntries = Get-OptionalPropertyValue -Object $Config -Name "managed"
  foreach ($mapping in @($managedEntries)) {
    $mappingTypeValue = [string](Get-OptionalPropertyValue -Object $mapping -Name "type")
    $mappingType = if ([string]::IsNullOrWhiteSpace($mappingTypeValue)) { "directory" } else { $mappingTypeValue }
    $sourceRelative = Normalize-RelativePath -Path ([string](Get-OptionalPropertyValue -Object $mapping -Name "source")) -Directory:($mappingType -eq "directory")
    $destinationRelative = Normalize-RelativePath -Path ([string](Get-OptionalPropertyValue -Object $mapping -Name "dest")) -Directory:($mappingType -eq "directory")
    $sourcePath = Join-Path $SourceRoot $sourceRelative

    if ($mappingType -eq "file") {
      if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "managed source file 不存在: $sourceRelative"
      }

      if ($destinationSet.ContainsKey($destinationRelative)) {
        throw "发现重复的 managed destination: $destinationRelative"
      }
      $destinationSet[$destinationRelative] = $true
      $sourceHashSet[$sourceRelative] = $true

      $entries.Add([pscustomobject]@{
        SourceRelative = $sourceRelative
        SourcePath = $sourcePath
        DestinationRelative = $destinationRelative
        DestinationPath = Join-Path $DestinationRoot $destinationRelative
      })
      continue
    }

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
      throw "managed source directory 不存在: $sourceRelative"
    }

    $expectedDestinations = @{}
    foreach ($file in Get-ChildItem -LiteralPath $sourcePath -Recurse -File) {
      $childRelative = Get-RelativePathFromBase -BasePath $sourcePath -TargetPath $file.FullName
      $entrySourceRelative = Join-NormalizedRelativePath -Base $sourceRelative -Child $childRelative
      $entryDestinationRelative = Join-NormalizedRelativePath -Base $destinationRelative -Child $childRelative

      if ($destinationSet.ContainsKey($entryDestinationRelative)) {
        throw "发现重复的 managed destination: $entryDestinationRelative"
      }

      $destinationSet[$entryDestinationRelative] = $true
      $expectedDestinations[$entryDestinationRelative] = $true
      $sourceHashSet[$entrySourceRelative] = $true

      $entries.Add([pscustomobject]@{
        SourceRelative = $entrySourceRelative
        SourcePath = Join-Path $SourceRoot $entrySourceRelative
        DestinationRelative = $entryDestinationRelative
        DestinationPath = Join-Path $DestinationRoot $entryDestinationRelative
      })
    }

    $directoryPlans.Add([pscustomobject]@{
      SourceRelative = $sourceRelative
      DestinationRelative = $destinationRelative
      DestinationRootPath = Join-Path $DestinationRoot $destinationRelative
      ExpectedDestinations = $expectedDestinations
    })
  }

  return [pscustomobject]@{
    Entries = [object[]]$entries.ToArray()
    DirectoryPlans = [object[]]$directoryPlans.ToArray()
    SourceHashKeys = @($sourceHashSet.Keys | Sort-Object)
  }
}

function Remove-EmptyDirectories {
  param([string]$RootPath)

  if (-not (Test-Path -LiteralPath $RootPath -PathType Container)) {
    return
  }

  $directories = Get-ChildItem -LiteralPath $RootPath -Recurse -Directory | Sort-Object FullName -Descending
  foreach ($directory in $directories) {
    if ((Get-ChildItem -LiteralPath $directory.FullName -Force | Measure-Object).Count -eq 0) {
      Remove-Item -LiteralPath $directory.FullName -Force
    }
  }
}

function Get-DirectoryExtraFiles {
  param(
    [object]$DirectoryPlan,
    [string]$TargetRoot
  )

  if (-not (Test-Path -LiteralPath $DirectoryPlan.DestinationRootPath -PathType Container)) {
    return @()
  }

  $extras = New-Object System.Collections.Generic.List[object]
  foreach ($file in Get-ChildItem -LiteralPath $DirectoryPlan.DestinationRootPath -Recurse -File) {
    $relative = Get-RelativePathFromBase -BasePath $TargetRoot -TargetPath $file.FullName
    if (-not $DirectoryPlan.ExpectedDestinations.ContainsKey($relative)) {
      $extras.Add([pscustomobject]@{
        RelativePath = $relative
        FullPath = $file.FullName
      })
    }
  }

  return [object[]]$extras.ToArray()
}

function Get-DefaultSourceRepo {
  param([string]$RepositoryPath)

  try {
    $remoteUrl = [string](@(Invoke-Git -RepositoryPath $RepositoryPath -Arguments @("remote", "get-url", "origin"))[0])
  }
  catch {
    return ""
  }

  if ($remoteUrl -match 'github\.com[:/](.+?)(?:\.git)?$') {
    return $Matches[1]
  }

  return $remoteUrl
}

function Resolve-TargetRepoSlug {
  param(
    [string]$TargetRepo,
    [string]$RepositoryPath
  )

  if (-not [string]::IsNullOrWhiteSpace($TargetRepo)) {
    return $TargetRepo
  }

  return Get-DefaultSourceRepo -RepositoryPath $RepositoryPath
}

function Resolve-TargetPath {
  param(
    [object]$Target,
    [string]$RunRoot
  )

  $localPath = [string](Get-OptionalPropertyValue -Object $Target -Name "localPath")
  if (-not [string]::IsNullOrWhiteSpace($localPath)) {
    return [System.IO.Path]::GetFullPath($localPath)
  }

  $targetRepo = [string](Get-OptionalPropertyValue -Object $Target -Name "repo")
  if ([string]::IsNullOrWhiteSpace($targetRepo)) {
    throw "target 必须提供 repo 或 localPath。"
  }

  $repoKey = $targetRepo.Replace("/", "__")
  $checkoutPath = Join-Path $RunRoot $repoKey
  $checkoutParent = Split-Path -Parent $checkoutPath
  if (-not (Test-Path -LiteralPath $checkoutParent)) {
    New-Item -ItemType Directory -Force -Path $checkoutParent | Out-Null
  }

  if (Test-Path -LiteralPath $checkoutPath) {
    throw "临时 checkout 目录已存在: $checkoutPath"
  }

  if (Get-Command gh -ErrorAction SilentlyContinue) {
    Write-Step "克隆目标仓库 $targetRepo -> $checkoutPath"
    & gh repo clone $targetRepo $checkoutPath | Out-Host
    if ($LASTEXITCODE -ne 0) {
      throw "gh repo clone 失败: $targetRepo"
    }
    return $checkoutPath
  }

  $cloneUrl = "https://github.com/{0}.git" -f $targetRepo
  Write-Step "克隆目标仓库 $cloneUrl -> $checkoutPath"
  & git clone $cloneUrl $checkoutPath | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "git clone 失败: $cloneUrl"
  }

  return $checkoutPath
}

function Resolve-TemplateValue {
  param(
    [string]$Template,
    [hashtable]$Variables
  )

  $result = $Template
  foreach ($key in $Variables.Keys) {
    $result = $result.Replace(("{{{{{0}}}}}" -f $key), [string]$Variables[$key])
  }

  return $result
}

function Sync-TargetRepository {
  param(
    [string]$SourceRoot,
    [string]$SourceRepo,
    [string]$SourceRef,
    [string]$SourceCommit,
    [string]$TargetRoot,
    [string]$SyncConfigPath,
    [bool]$PullRequestMode
  )

  $targetConfigFile = Join-Path $TargetRoot $SyncConfigPath
  $targetConfig = Read-JsonConfig -Path $targetConfigFile -Label ".ai-sync.yml"
  $targetConfigChanged = $false

  $targetSource = Get-OptionalPropertyValue -Object $targetConfig -Name "source"
  if ($null -eq $targetSource) {
    $targetSource = [pscustomobject]@{}
    Set-OptionalPropertyValue -Object $targetConfig -Name "source" -Value $targetSource
  }

  if ([string](Get-OptionalPropertyValue -Object $targetSource -Name "repo") -ne $SourceRepo) {
    Set-OptionalPropertyValue -Object $targetSource -Name "repo" -Value $SourceRepo
    $targetConfigChanged = $true
  }

  if ([string](Get-OptionalPropertyValue -Object $targetSource -Name "ref") -ne $SourceRef) {
    Set-OptionalPropertyValue -Object $targetSource -Name "ref" -Value $SourceRef
    $targetConfigChanged = $true
  }

  if ($targetConfigChanged) {
    Write-JsonFile -Path $targetConfigFile -Value $targetConfig
  }

  $expansion = Expand-ManagedEntries -Config $targetConfig -SourceRoot $SourceRoot -DestinationRoot $TargetRoot
  $copiedCount = 0
  $deletedCount = 0

  foreach ($entry in $expansion.Entries) {
    $expectedHash = Get-FileSha256 -Path $entry.SourcePath
    $actualHash = if (Test-Path -LiteralPath $entry.DestinationPath -PathType Leaf) { Get-FileSha256 -Path $entry.DestinationPath } else { $null }
    if ($actualHash -eq $expectedHash) {
      continue
    }

    $destinationParent = Split-Path -Parent $entry.DestinationPath
    if (-not (Test-Path -LiteralPath $destinationParent)) {
      New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }

    Copy-Item -LiteralPath $entry.SourcePath -Destination $entry.DestinationPath -Force
    $copiedCount += 1
  }

  foreach ($directoryPlan in $expansion.DirectoryPlans) {
    foreach ($extra in Get-DirectoryExtraFiles -DirectoryPlan $directoryPlan -TargetRoot $TargetRoot) {
      Remove-Item -LiteralPath $extra.FullPath -Force
      $deletedCount += 1
    }
    Remove-EmptyDirectories -RootPath $directoryPlan.DestinationRootPath
  }

  $manifestFiles = foreach ($sourceRelative in $expansion.SourceHashKeys) {
    [pscustomobject]@{
      source = $sourceRelative
      sha256 = Get-FileSha256 -Path (Join-Path $SourceRoot $sourceRelative)
    }
  }

  $manifestObject = [pscustomobject]@{
    version = $SourceRef
    commit = $SourceCommit
    generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    files = @($manifestFiles | Sort-Object source)
  }

  $manifestFile = Join-Path $TargetRoot "ai-sync\ai-kit-manifest.json"
  Write-JsonFile -Path $manifestFile -Value $manifestObject
  $manifestHash = Get-FileSha256 -Path $manifestFile

  $lockObject = [pscustomobject]@{
    source = [pscustomobject]@{
      repo = $SourceRepo
      ref = $SourceRef
      commit = $SourceCommit
    }
    manifest = [pscustomobject]@{
      path = "ai-sync/ai-kit-manifest.json"
      sha256 = $manifestHash
    }
    syncedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    mode = if ($PullRequestMode) { "pull-request-sync" } else { "manual-sync" }
  }

  Write-JsonFile -Path (Join-Path $TargetRoot ".ai-sync.lock.json") -Value $lockObject

  return [pscustomobject]@{
    CopiedCount = $copiedCount
    DeletedCount = $deletedCount
  }
}

function Invoke-VerifyCommands {
  param(
    [string]$TargetRoot,
    [string[]]$Commands
  )

  foreach ($command in $Commands) {
    if ([string]::IsNullOrWhiteSpace($command)) {
      continue
    }

    Write-Step "运行验证命令: $command"
    Push-Location $TargetRoot
    try {
      powershell -NoProfile -Command $command
      if ($LASTEXITCODE -ne 0) {
        throw "验证命令失败: $command"
      }
    }
    finally {
      Pop-Location
    }
  }
}

$resolvedSourceRoot = (Resolve-Path -LiteralPath $SourceRoot).Path
$resolvedConfigPath = if (Test-Path -LiteralPath $ConfigPath) { (Resolve-Path -LiteralPath $ConfigPath).Path } else { $ConfigPath }
$exampleConfigPath = Join-Path $PSScriptRoot "sync-targets.example.json"

if (-not (Test-Path -LiteralPath $resolvedConfigPath -PathType Leaf)) {
  throw "找不到 sync targets 配置文件: $resolvedConfigPath。可以先复制示例: $exampleConfigPath"
}

if (-not $AllowDirtySource.IsPresent) {
  $sourceStatus = Get-GitStatusLines -RepositoryPath $resolvedSourceRoot
  if (@($sourceStatus).Count -gt 0) {
    throw "源仓库存在未提交改动。请先提交/清理，或显式传入 -AllowDirtySource。"
  }
}

$fanoutConfig = Read-JsonConfig -Path $resolvedConfigPath -Label "sync-targets.json"
$defaults = Get-OptionalPropertyValue -Object $fanoutConfig -Name "defaults"
if ($null -eq $defaults) {
  $defaults = [pscustomobject]@{}
}
$sourceConfig = Get-OptionalPropertyValue -Object $fanoutConfig -Name "source"
$configuredSourceRepo = [string](Get-OptionalPropertyValue -Object $sourceConfig -Name "repo")
$configuredSourceRef = [string](Get-OptionalPropertyValue -Object $sourceConfig -Name "ref")
$sourceRepo = if (-not [string]::IsNullOrWhiteSpace($configuredSourceRepo)) { $configuredSourceRepo } else { Get-DefaultSourceRepo -RepositoryPath $resolvedSourceRoot }
$sourceRef = if (-not [string]::IsNullOrWhiteSpace($configuredSourceRef)) { $configuredSourceRef } else { Get-GitCurrentBranch -RepositoryPath $resolvedSourceRoot }
$sourceCommit = Get-GitHeadCommit -RepositoryPath $resolvedSourceRoot

if ([string]::IsNullOrWhiteSpace($sourceRepo) -or [string]::IsNullOrWhiteSpace($sourceRef)) {
  throw "sync-targets.json 必须提供 source.repo/source.ref，或者当前源仓库必须能推导出 origin/current branch。"
}

$defaultsWorkingRoot = [string](Get-OptionalPropertyValue -Object $defaults -Name "workingRoot")
$workingRoot = if (-not [string]::IsNullOrWhiteSpace($defaultsWorkingRoot)) {
  [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($defaultsWorkingRoot))
}
else {
  Join-Path ([System.IO.Path]::GetTempPath()) ("ai-sync-targets-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}

$fanoutTargets = Get-OptionalPropertyValue -Object $fanoutConfig -Name "targets"
[object[]]$targetList = if ($null -ne $fanoutTargets) { @($fanoutTargets) } else { @() }
if (@($OnlyTargets).Count -gt 0) {
  $filtered = New-Object System.Collections.Generic.List[object]
  foreach ($target in $targetList) {
    $keys = @(
      [string](Get-OptionalPropertyValue -Object $target -Name "repo"),
      [string](Get-OptionalPropertyValue -Object $target -Name "localPath"),
      [string](Get-OptionalPropertyValue -Object $target -Name "name")
    )
    foreach ($needle in $OnlyTargets) {
      if ($keys -contains $needle) {
        $filtered.Add($target)
        break
      }
    }
  }
  $targetList = @($filtered.ToArray())
}

if (@($targetList).Count -eq 0) {
  throw "没有可执行的目标仓库。"
}

$results = New-Object System.Collections.Generic.List[object]

foreach ($target in $targetList) {
  $targetRepoValue = [string](Get-OptionalPropertyValue -Object $target -Name "repo")
  $targetLocalPathValue = [string](Get-OptionalPropertyValue -Object $target -Name "localPath")
  $targetNameValue = [string](Get-OptionalPropertyValue -Object $target -Name "name")
  $targetRepoDisplay = if (-not [string]::IsNullOrWhiteSpace($targetRepoValue)) { $targetRepoValue } elseif (-not [string]::IsNullOrWhiteSpace($targetNameValue)) { $targetNameValue } else { $targetLocalPathValue }
  Write-Step "处理目标仓库: $targetRepoDisplay"

  $targetRoot = Resolve-TargetPath -Target $target -RunRoot $workingRoot
  if (-not (Test-GitRepository -RepositoryPath $targetRoot)) {
    throw "目标路径不是 Git 仓库: $targetRoot"
  }

  $targetRepo = Resolve-TargetRepoSlug -TargetRepo $targetRepoValue -RepositoryPath $targetRoot
  $targetBaseBranch = [string](Get-OptionalPropertyValue -Object $target -Name "baseBranch")
  $defaultBaseBranch = [string](Get-OptionalPropertyValue -Object $defaults -Name "baseBranch")
  $baseBranch = if (-not [string]::IsNullOrWhiteSpace($targetBaseBranch)) { $targetBaseBranch } elseif (-not [string]::IsNullOrWhiteSpace($defaultBaseBranch)) { $defaultBaseBranch } else { "main" }
  $targetBranchPrefix = [string](Get-OptionalPropertyValue -Object $target -Name "branchPrefix")
  $defaultBranchPrefix = [string](Get-OptionalPropertyValue -Object $defaults -Name "branchPrefix")
  $branchPrefix = if (-not [string]::IsNullOrWhiteSpace($targetBranchPrefix)) { $targetBranchPrefix } elseif (-not [string]::IsNullOrWhiteSpace($defaultBranchPrefix)) { $defaultBranchPrefix } else { "chore/ai-kit-sync" }
  $targetSyncConfigPath = [string](Get-OptionalPropertyValue -Object $target -Name "syncConfigPath")
  $defaultSyncConfigPath = [string](Get-OptionalPropertyValue -Object $defaults -Name "syncConfigPath")
  $syncConfigPath = if (-not [string]::IsNullOrWhiteSpace($targetSyncConfigPath)) { $targetSyncConfigPath } elseif (-not [string]::IsNullOrWhiteSpace($defaultSyncConfigPath)) { $defaultSyncConfigPath } else { ".ai-sync.yml" }
  $targetPushBranch = Get-OptionalPropertyValue -Object $target -Name "pushBranch"
  $defaultPushBranch = Get-OptionalPropertyValue -Object $defaults -Name "pushBranch"
  $pushBranch = if ($NoPush.IsPresent) { $false } elseif ($null -ne $targetPushBranch) { [bool]$targetPushBranch } elseif ($null -ne $defaultPushBranch) { [bool]$defaultPushBranch } else { $true }
  $targetCreatePullRequest = Get-OptionalPropertyValue -Object $target -Name "createPullRequest"
  $defaultCreatePullRequest = Get-OptionalPropertyValue -Object $defaults -Name "createPullRequest"
  $createPullRequest = if ($NoPullRequest.IsPresent) { $false } elseif ($null -ne $targetCreatePullRequest) { [bool]$targetCreatePullRequest } elseif ($null -ne $defaultCreatePullRequest) { [bool]$defaultCreatePullRequest } else { $true }
  $targetDraftPullRequest = Get-OptionalPropertyValue -Object $target -Name "draftPullRequest"
  $defaultDraftPullRequest = Get-OptionalPropertyValue -Object $defaults -Name "draftPullRequest"
  $draftPullRequest = if ($null -ne $targetDraftPullRequest) { [bool]$targetDraftPullRequest } elseif ($null -ne $defaultDraftPullRequest) { [bool]$defaultDraftPullRequest } else { $false }
  $targetVerifyCommands = Get-OptionalPropertyValue -Object $target -Name "verifyCommands"
  $defaultVerifyCommands = Get-OptionalPropertyValue -Object $defaults -Name "verifyCommands"
  $verifyCommands = if ($null -ne $targetVerifyCommands) { @($targetVerifyCommands) } elseif ($null -ne $defaultVerifyCommands) { @($defaultVerifyCommands) } else { @() }
  $targetLabels = Get-OptionalPropertyValue -Object $target -Name "labels"
  $defaultLabels = Get-OptionalPropertyValue -Object $defaults -Name "labels"
  $labels = if ($null -ne $targetLabels) { @($targetLabels) } elseif ($null -ne $defaultLabels) { @($defaultLabels) } else { @() }
  $targetCommitMessage = [string](Get-OptionalPropertyValue -Object $target -Name "commitMessage")
  $defaultCommitMessage = [string](Get-OptionalPropertyValue -Object $defaults -Name "commitMessage")
  $commitMessage = if (-not [string]::IsNullOrWhiteSpace($targetCommitMessage)) { $targetCommitMessage } elseif (-not [string]::IsNullOrWhiteSpace($defaultCommitMessage)) { $defaultCommitMessage } else { "chore(ai-kit): sync shared AI workflow config" }
  $targetPrTitle = [string](Get-OptionalPropertyValue -Object $target -Name "prTitle")
  $defaultPrTitle = [string](Get-OptionalPropertyValue -Object $defaults -Name "prTitle")
  $prTitleTemplate = if (-not [string]::IsNullOrWhiteSpace($targetPrTitle)) { $targetPrTitle } elseif (-not [string]::IsNullOrWhiteSpace($defaultPrTitle)) { $defaultPrTitle } else { "chore(ai-kit): sync shared AI workflow config from {{sourceRef}}" }
  $targetPrBody = [string](Get-OptionalPropertyValue -Object $target -Name "prBody")
  $defaultPrBody = [string](Get-OptionalPropertyValue -Object $defaults -Name "prBody")
  $prBodyTemplate = if (-not [string]::IsNullOrWhiteSpace($targetPrBody)) { $targetPrBody } elseif (-not [string]::IsNullOrWhiteSpace($defaultPrBody)) { $defaultPrBody } else { "## AI Workflow Kit Sync`n`nSource: {{sourceRepo}}@{{sourceRef}}`nCommit: {{sourceCommit}}`n`nChanged files:`n{{changedFiles}}`n" }

  $preStatus = Get-GitStatusLines -RepositoryPath $targetRoot
  if (@($preStatus).Count -gt 0) {
    throw "目标仓库存在未提交改动，拒绝自动同步: $targetRoot"
  }

  $hasOrigin = $true
  try {
    Invoke-Git -RepositoryPath $targetRoot -Arguments @("remote", "get-url", "origin") | Out-Null
  }
  catch {
    $hasOrigin = $false
  }

  if ($hasOrigin) {
    Invoke-Git -RepositoryPath $targetRoot -Arguments @("fetch", "origin", "--prune") | Out-Host
  }

  Invoke-Git -RepositoryPath $targetRoot -Arguments @("checkout", $baseBranch) | Out-Host
  if ($hasOrigin) {
    Invoke-Git -RepositoryPath $targetRoot -Arguments @("pull", "--ff-only", "origin", $baseBranch) | Out-Host
  }

  $branchName = "{0}-{1}" -f $branchPrefix.TrimEnd("/"), (Get-Date -Format "yyyyMMdd-HHmmss")
  Invoke-Git -RepositoryPath $targetRoot -Arguments @("switch", "-c", $branchName) | Out-Host

  $syncResult = Sync-TargetRepository `
    -SourceRoot $resolvedSourceRoot `
    -SourceRepo $sourceRepo `
    -SourceRef $sourceRef `
    -SourceCommit $sourceCommit `
    -TargetRoot $targetRoot `
    -SyncConfigPath $syncConfigPath `
    -PullRequestMode:($pushBranch -and $createPullRequest)

  if (@($verifyCommands).Count -gt 0) {
    Invoke-VerifyCommands -TargetRoot $targetRoot -Commands $verifyCommands
  }

  $postStatus = Get-GitStatusLines -RepositoryPath $targetRoot
  if (@($postStatus).Count -eq 0) {
    $results.Add([pscustomobject]@{
      Target = $targetRepoDisplay
      Branch = $branchName
      Status = "NO_CHANGES"
      PullRequest = ""
    })
    continue
  }

  Invoke-Git -RepositoryPath $targetRoot -Arguments @("add", "--all") | Out-Host
  $changedFiles = @(Invoke-Git -RepositoryPath $targetRoot -Arguments @("diff", "--cached", "--name-only"))
  $changedFilesMarkdown = if (@($changedFiles).Count -gt 0) {
    ($changedFiles | ForEach-Object { "- {0}" -f $_ }) -join [Environment]::NewLine
  }
  else {
    "- none"
  }

  $variables = @{
    sourceRepo = $sourceRepo
    sourceRef = $sourceRef
    sourceCommit = $sourceCommit
    targetRepo = $targetRepo
    branchName = $branchName
    changedFiles = $changedFilesMarkdown
  }

  $commitBody = Resolve-TemplateValue -Template "Source: {{sourceRepo}}@{{sourceRef}}`nSource-Commit: {{sourceCommit}}" -Variables $variables
  $commitMessageFile = Join-Path ([System.IO.Path]::GetTempPath()) ("ai-sync-commit-{0}.txt" -f ([guid]::NewGuid().ToString("N")))
  [System.IO.File]::WriteAllText($commitMessageFile, $commitMessage + [Environment]::NewLine + [Environment]::NewLine + $commitBody + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
  try {
    Invoke-Git -RepositoryPath $targetRoot -Arguments @("commit", "-F", $commitMessageFile) | Out-Host
  }
  finally {
    Remove-Item -LiteralPath $commitMessageFile -Force -ErrorAction SilentlyContinue
  }

  $prUrl = ""
  if ($pushBranch) {
    if (-not $hasOrigin) {
      throw "目标仓库没有 origin，无法 push: $targetRoot"
    }

    Invoke-Git -RepositoryPath $targetRoot -Arguments @("push", "-u", "origin", $branchName) | Out-Host
  }

  if ($pushBranch -and $createPullRequest) {
    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
      throw "未找到 gh CLI，无法创建 Pull Request。"
    }

    $prTitle = Resolve-TemplateValue -Template $prTitleTemplate -Variables $variables
    $prBody = Resolve-TemplateValue -Template $prBodyTemplate -Variables $variables
    $prBodyFile = Join-Path ([System.IO.Path]::GetTempPath()) ("ai-sync-pr-{0}.md" -f ([guid]::NewGuid().ToString("N")))
    [System.IO.File]::WriteAllText($prBodyFile, $prBody, [System.Text.UTF8Encoding]::new($false))
    try {
      $prArgs = @("pr", "create", "--repo", $targetRepo, "--base", $baseBranch, "--head", $branchName, "--title", $prTitle, "--body-file", $prBodyFile)
      if ($draftPullRequest) {
        $prArgs += "--draft"
      }
      $prOutput = & gh @prArgs
      if ($LASTEXITCODE -ne 0) {
        throw "gh pr create 失败: $targetRepo"
      }
      $prUrl = ($prOutput | Select-Object -Last 1).ToString().Trim()

      if (@($labels).Count -gt 0) {
        & gh pr edit $prUrl --add-label (($labels | ForEach-Object { [string]$_ }) -join ",") | Out-Host
        if ($LASTEXITCODE -ne 0) {
          throw "gh pr edit --add-label 失败: $prUrl"
        }
      }
    }
    finally {
      Remove-Item -LiteralPath $prBodyFile -Force -ErrorAction SilentlyContinue
    }
  }

  $results.Add([pscustomobject]@{
    Target = $targetRepoDisplay
    Branch = $branchName
    Status = "SYNCED"
    PullRequest = $prUrl
  })
}

Write-Output ""
Write-Output "AI sync fan-out summary:"
foreach ($result in $results) {
  Write-Output ("- {0} [{1}] branch={2}{3}" -f $result.Target, $result.Status, $result.Branch, $(if ([string]::IsNullOrWhiteSpace($result.PullRequest)) { "" } else { " pr=" + $result.PullRequest }))
}
