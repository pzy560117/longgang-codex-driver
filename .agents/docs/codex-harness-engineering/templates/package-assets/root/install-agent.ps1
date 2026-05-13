param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot,
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

function Write-Step {
  param([string]$Message)
  Write-Host ("[install-agent] {0}" -f $Message)
}

function Test-GitRepository {
  param([string]$Root)

  $gitPath = (Get-Command git -ErrorAction Stop).Source
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process `
      -FilePath $gitPath `
      -ArgumentList @('-C', $Root, 'rev-parse', '--show-toplevel') `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    return ($process.ExitCode -eq 0)
  }
  finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Assert-GitRepoOrInit {
  param(
    [string]$Root,
    [bool]$AllowInit
  )

  $repoExists = Test-GitRepository -Root $Root

  if ($repoExists) {
    return $true
  }

  if (-not $AllowInit) {
    throw "目标目录不是 Git 仓库: $Root。请先初始化 Git，或传入 -InitGitIfNeeded。"
  }

  Write-Step "目标目录不是 Git 仓库，执行 git init。"
  & git -C $Root init | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "git init 失败: $Root"
  }

  return $false
}

function Get-GitStatusLines {
  param([string]$Root)

  $output = & git -C $Root status --short
  if ($LASTEXITCODE -ne 0) {
    throw "无法读取 Git 状态: $Root"
  }

  if ($null -eq $output) {
    return @()
  }

  return @($output)
}

function Test-GitHeadExists {
  param([string]$Root)

  $gitPath = (Get-Command git -ErrorAction Stop).Source
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()
  try {
    $process = Start-Process `
      -FilePath $gitPath `
      -ArgumentList @('-C', $Root, 'rev-parse', '--verify', 'HEAD') `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    return ($process.ExitCode -eq 0)
  }
  finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Build-BaselineCommitMessage {
  param(
    [string]$InstallMode,
    [bool]$HadHeadBeforeInstall,
    [bool]$HadAgentsBeforeInstall
  )

  if ($HadHeadBeforeInstall) {
    if (-not $HadAgentsBeforeInstall) {
      return "chore: add codex agent package"
    }

    return "chore: refresh codex agent package"
  }

  return "chore: initialize codex agent package"
}

function Get-GitConfigValue {
  param([string[]]$Arguments)

  $gitPath = (Get-Command git -ErrorAction Stop).Source
  $stdoutPath = [System.IO.Path]::GetTempFileName()
  $stderrPath = [System.IO.Path]::GetTempFileName()

  try {
    $process = Start-Process `
      -FilePath $gitPath `
      -ArgumentList $Arguments `
      -NoNewWindow `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath

    if ($process.ExitCode -ne 0) {
      return ""
    }

    return (Get-Content -LiteralPath $stdoutPath -Raw).Trim()
  }
  finally {
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
}

function Test-GitIdentityConfigured {
  param([string]$Root)

  $userName = Get-GitConfigValue -Arguments @('-C', $Root, 'config', '--get', 'user.name')
  if ([string]::IsNullOrWhiteSpace([string]$userName)) {
    $userName = Get-GitConfigValue -Arguments @('config', '--global', '--get', 'user.name')
  }

  $userEmail = Get-GitConfigValue -Arguments @('-C', $Root, 'config', '--get', 'user.email')
  if ([string]::IsNullOrWhiteSpace([string]$userEmail)) {
    $userEmail = Get-GitConfigValue -Arguments @('config', '--global', '--get', 'user.email')
  }

  return (-not [string]::IsNullOrWhiteSpace([string]$userName)) -and (-not [string]::IsNullOrWhiteSpace([string]$userEmail))
}

function Copy-DirectoryContent {
  param(
    [string]$SourceDirectory,
    [string]$DestinationDirectory
  )

  if (-not (Test-Path -LiteralPath $DestinationDirectory)) {
    New-Item -ItemType Directory -Path $DestinationDirectory | Out-Null
  }

  Get-ChildItem -LiteralPath $SourceDirectory -Force | ForEach-Object {
    $destinationPath = Join-Path $DestinationDirectory $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
  }
}

function Copy-DirectoryContentExcludingNames {
  param(
    [string]$SourceDirectory,
    [string]$DestinationDirectory,
    [string[]]$ExcludeNames = @()
  )

  if (-not (Test-Path -LiteralPath $DestinationDirectory)) {
    New-Item -ItemType Directory -Path $DestinationDirectory | Out-Null
  }

  Get-ChildItem -LiteralPath $SourceDirectory -Force | Where-Object { $ExcludeNames -notcontains $_.Name } | ForEach-Object {
    $destinationPath = Join-Path $DestinationDirectory $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
  }
}

function Copy-ManagedFile {
  param(
    [string]$SourceRoot,
    [string]$SourceRelativePath,
    [string]$DestinationRoot,
    [string]$DestinationRelativePath
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

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

function Copy-ManagedDirectory {
  param(
    [string]$SourceDirectory,
    [string]$DestinationDirectory,
    [bool]$Overwrite
  )

  if (-not (Test-Path -LiteralPath $SourceDirectory)) {
    throw "模板目录不存在: $SourceDirectory"
  }

  if (Test-Path -LiteralPath $DestinationDirectory) {
    if (-not $Overwrite) {
      return
    }

    Remove-Item -LiteralPath $DestinationDirectory -Recurse -Force
  }

  New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
  Copy-DirectoryContent -SourceDirectory $SourceDirectory -DestinationDirectory $DestinationDirectory
}

function Copy-TemplatePackageCodex {
  param(
    [string]$TemplateRoot,
    [string]$DestinationRoot
  )

  $codexRoot = Join-Path $DestinationRoot ".codex"
  if (-not (Test-Path -LiteralPath $codexRoot)) {
    New-Item -ItemType Directory -Force -Path $codexRoot | Out-Null
  }

  $fileMappings = @(
    @{ Source = "config\codex-config.toml"; Destination = ".codex\config.toml" },
    @{ Source = "config\codex-readme.md"; Destination = ".codex\README.md" },
    @{ Source = "hooks\hooks.json"; Destination = ".codex\hooks.json" },
    @{ Source = "runtime\task-run-profile.json"; Destination = ".codex\task-run-profile.json" }
  )

  foreach ($mapping in $fileMappings) {
    Copy-ManagedFile `
      -SourceRoot $TemplateRoot `
      -SourceRelativePath $mapping.Source `
      -DestinationRoot $DestinationRoot `
      -DestinationRelativePath $mapping.Destination
  }

  Copy-DirectoryContent -SourceDirectory (Join-Path $TemplateRoot "config\agents") -DestinationDirectory (Join-Path $codexRoot "agents")
  Copy-DirectoryContent -SourceDirectory (Join-Path $TemplateRoot "prompts") -DestinationDirectory (Join-Path $codexRoot "prompts")
}

function Copy-AssetDirectory {
  param(
    [string]$AssetsRoot,
    [string]$SourceRelativePath,
    [string]$DestinationRoot,
    [string]$DestinationRelativePath
  )

  $sourcePath = Join-Path $AssetsRoot $SourceRelativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "模板目录不存在: $sourcePath"
  }

  $destinationPath = Join-Path $DestinationRoot $DestinationRelativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if (-not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  }

  if (-not (Test-Path -LiteralPath $destinationPath)) {
    New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
  }

  $robocopyArgs = @(
    $sourcePath,
    $destinationPath,
    "/E",
    "/COPY:DAT",
    "/DCOPY:DAT",
    "/R:2",
    "/W:1",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP"
  )

  & robocopy @robocopyArgs | Out-Null
  $robocopyExitCode = $LASTEXITCODE

  if ($robocopyExitCode -ge 8) {
    throw "复制模板目录失败: $sourcePath -> $destinationPath (robocopy exit $robocopyExitCode)"
  }

  $global:LASTEXITCODE = 0
}

function Overlay-DirectoryIfPresent {
  param(
    [string]$SourceDirectory,
    [string]$DestinationDirectory
  )

  if (-not (Test-Path -LiteralPath $SourceDirectory -PathType Container)) {
    return
  }

  if (-not (Test-Path -LiteralPath $DestinationDirectory)) {
    New-Item -ItemType Directory -Force -Path $DestinationDirectory | Out-Null
  }

  foreach ($directory in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -Force -Directory) {
    $relativePath = $directory.FullName.Substring($SourceDirectory.Length + 1)
    $targetDirectory = Join-Path $DestinationDirectory $relativePath
    if (-not (Test-Path -LiteralPath $targetDirectory)) {
      New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
    }
  }

  foreach ($file in Get-ChildItem -LiteralPath $SourceDirectory -Recurse -Force -File) {
    $relativePath = $file.FullName.Substring($SourceDirectory.Length + 1)
    $targetPath = Join-Path $DestinationDirectory $relativePath
    $targetParent = Split-Path -Parent $targetPath
    if (-not (Test-Path -LiteralPath $targetParent)) {
      New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
    }

    Copy-Item -LiteralPath $file.FullName -Destination $targetPath -Force
  }
}

function Ensure-ReadmeForSmoke {
  param([string]$Root)

  $readmePath = Join-Path $Root "README.md"
  if (Test-Path -LiteralPath $readmePath) {
    return $null
  }

  @(
    "# Project README",
    "",
    "This README was generated by install-agent.ps1 to support the initial smoke task.",
    "Replace it with project-specific content after harness setup is verified."
  ) | Set-Content -LiteralPath $readmePath -Encoding UTF8

  return $readmePath
}

function Copy-Package {
  param(
    [string]$SourceRoot,
    [string]$DestinationRoot,
    [string]$InstallMode
  )

  $templateRoot = Join-Path $SourceRoot "docs\codex-harness-engineering\templates"
  if (-not (Test-Path -LiteralPath $templateRoot)) {
    throw "找不到模板目录: $templateRoot"
  }

  $packageAssetsRoot = Join-Path $templateRoot "package-assets"
  if (-not (Test-Path -LiteralPath $packageAssetsRoot)) {
    throw "找不到 package-assets 模板目录: $packageAssetsRoot"
  }

  $rootFileMappings = @(
    @{ SourceRoot = $templateRoot; Source = "runtime\AGENTS.md"; Destination = "AGENTS.md" },
    @{ SourceRoot = $templateRoot; Source = "bootstrap-codex-harness.ps1"; Destination = "bootstrap-codex-harness.ps1" },
    @{ SourceRoot = $templateRoot; Source = "runtime\codex-loop.ps1"; Destination = "codex-loop.ps1" },
    @{ SourceRoot = $templateRoot; Source = "config\env-check.ps1"; Destination = "env-check.ps1" },
    @{ SourceRoot = $templateRoot; Source = "runtime\verify.ps1"; Destination = "verify.ps1" },
    @{ SourceRoot = $templateRoot; Source = "trace\trace.schema.json"; Destination = "trace.schema.json" },
    @{ SourceRoot = $packageAssetsRoot; Source = "root\install-agent.ps1"; Destination = "install-agent.ps1" },
    @{ SourceRoot = $packageAssetsRoot; Source = "root\install-agent-here.ps1"; Destination = "install-agent-here.ps1" },
    @{ SourceRoot = $packageAssetsRoot; Source = "root\README.md"; Destination = "README.md" },
    @{ SourceRoot = $packageAssetsRoot; Source = "root\PACKAGE.md"; Destination = "PACKAGE.md" }
  )

  foreach ($mapping in $rootFileMappings) {
    Copy-ManagedFile `
      -SourceRoot $mapping.SourceRoot `
      -SourceRelativePath $mapping.Source `
      -DestinationRoot $DestinationRoot `
      -DestinationRelativePath $mapping.Destination
  }

  $dirsToCopy = @("rules", "workflows", "scripts", ".specify", "skills")

  foreach ($dir in $dirsToCopy) {
    Copy-AssetDirectory `
      -AssetsRoot $packageAssetsRoot `
      -SourceRelativePath $dir `
      -DestinationRoot $DestinationRoot `
      -DestinationRelativePath $dir
  }

  Copy-AssetDirectory `
    -AssetsRoot (Join-Path $SourceRoot "docs\codex-harness-engineering") `
    -SourceRelativePath "templates" `
    -DestinationRoot $DestinationRoot `
    -DestinationRelativePath "docs\codex-harness-engineering\templates"
}

$sourceRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$resolvedProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$stagedSourceRoot = $null
$effectiveSourceRoot = $sourceRoot
$baselineCommitted = $false
$baselinePolicy = "skipped"

try {
  if (-not (Test-Path -LiteralPath $resolvedProjectRoot)) {
    Write-Step "目标目录不存在，创建目录: $resolvedProjectRoot"
    New-Item -ItemType Directory -Path $resolvedProjectRoot | Out-Null
  }

  $targetAgentsRoot = Join-Path $resolvedProjectRoot ".agents"
  $targetAgentsExistedBeforeInstall = Test-Path -LiteralPath $targetAgentsRoot
  if ((Test-Path -LiteralPath $targetAgentsRoot) -and (-not $Force.IsPresent)) {
    throw "目标项目已存在 .agents 目录: $targetAgentsRoot。若要覆盖，请显式传入 -Force。"
  }

  $repoExistedBeforeInstall = Assert-GitRepoOrInit -Root $resolvedProjectRoot -AllowInit:$InitGitIfNeeded.IsPresent
  $hadGitHeadBeforeInstall = Test-GitHeadExists -Root $resolvedProjectRoot
  $statusBeforeInstall = if ($repoExistedBeforeInstall) { @(Get-GitStatusLines -Root $resolvedProjectRoot) } else { @() }

  if ((Test-Path -LiteralPath $targetAgentsRoot) -and
      ([System.StringComparer]::OrdinalIgnoreCase.Equals(
        [System.IO.Path]::GetFullPath($targetAgentsRoot),
        $sourceRoot
      ))) {
    $stagedSourceRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-agent-stage-" + [System.Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $stagedSourceRoot | Out-Null
    Copy-DirectoryContent -SourceDirectory $sourceRoot -DestinationDirectory $stagedSourceRoot
    $effectiveSourceRoot = $stagedSourceRoot
    Write-Step "检测到从已安装的 .agents 自更新，已创建临时复制源: $effectiveSourceRoot"
  }

  if (Test-Path -LiteralPath $targetAgentsRoot) {
    Write-Step "删除已存在的 .agents 目录: $targetAgentsRoot"
    Remove-Item -LiteralPath $targetAgentsRoot -Recurse -Force
  }

  Write-Step "复制 agent package 到目标项目 .agents/ (mode=$Mode)"
  New-Item -ItemType Directory -Path $targetAgentsRoot | Out-Null
  Copy-Package -SourceRoot $effectiveSourceRoot -DestinationRoot $targetAgentsRoot -InstallMode $Mode

  $templateRoot = Join-Path $effectiveSourceRoot "docs\codex-harness-engineering\templates"
  $bootstrapScript = Join-Path $targetAgentsRoot "bootstrap-codex-harness.ps1"

  Write-Step "调用 bootstrap-codex-harness.ps1 同步项目根 runtime 文件"
  $bootstrapArgs = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $bootstrapScript,
    '-ProjectRoot', $resolvedProjectRoot,
    '-TemplateRoot', $templateRoot
  )
  if ($Force.IsPresent) {
    $bootstrapArgs += '-Force'
  }

  & powershell @bootstrapArgs | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "bootstrap-codex-harness.ps1 执行失败: $resolvedProjectRoot"
  }

  $generatedReadme = $null
  if ($InitSmoke) {
    $generatedReadme = Ensure-ReadmeForSmoke -Root $resolvedProjectRoot
    if ($null -ne $generatedReadme) {
      Write-Step "为 smoke 初始化补充 README.md: $generatedReadme"
    }

    $smokeTaskPath = Join-Path $resolvedProjectRoot "smoke-task.json"
    $taskPath = Join-Path $resolvedProjectRoot "task.json"
    if (-not (Test-Path -LiteralPath $smokeTaskPath)) {
      throw "找不到 smoke-task.json: $smokeTaskPath"
    }

    Copy-Item -LiteralPath $smokeTaskPath -Destination $taskPath -Force
    Write-Step "已将 smoke-task.json 覆盖到 task.json"
  }

  $shouldCommitBaseline = $false
  if ($SkipBaselineCommit.IsPresent) {
    $baselinePolicy = "disabled-by-flag"
  }
  elseif ($CommitBaseline.IsPresent) {
    $shouldCommitBaseline = $true
    $baselinePolicy = "explicit"
  }
  elseif (@($statusBeforeInstall).Count -eq 0) {
    $shouldCommitBaseline = $true
    $baselinePolicy = if ($hadGitHeadBeforeInstall -or $targetAgentsExistedBeforeInstall) { "auto-clean-repo" } else { "auto-fresh-repo" }
  }
  else {
    $baselinePolicy = "skipped-dirty-before-install"
  }

  if ($shouldCommitBaseline) {
    if ($repoExistedBeforeInstall -and (@($statusBeforeInstall).Count -gt 0)) {
      throw "目标项目在安装前已存在未提交改动。为避免把无关改动并入 baseline，本次拒绝自动提交。"
    }

    if (-not (Test-GitIdentityConfigured -Root $resolvedProjectRoot)) {
      if ($CommitBaseline.IsPresent) {
        throw "当前 Git 未配置 user.name / user.email，无法执行 baseline commit。"
      }

      Write-Step "当前 Git 未配置 user.name / user.email，跳过自动 baseline commit。"
      $baselinePolicy = "skipped-missing-git-identity"
    }
    else {
      $statusAfterInstall = @(Get-GitStatusLines -Root $resolvedProjectRoot)
      if ($statusAfterInstall.Count -eq 0) {
        Write-Step "安装后没有新增 Git 变更，跳过 baseline commit。"
        $baselinePolicy = "no-op"
      }
      else {
        Write-Step "创建 baseline commit"
        & git -C $resolvedProjectRoot add --all
        if ($LASTEXITCODE -ne 0) {
          throw "git add 失败: $resolvedProjectRoot"
        }

        $baselineMessage = Build-BaselineCommitMessage `
          -InstallMode $Mode `
          -HadHeadBeforeInstall:$hadGitHeadBeforeInstall `
          -HadAgentsBeforeInstall:$targetAgentsExistedBeforeInstall
        & git -C $resolvedProjectRoot commit -m $baselineMessage | Out-Host
        if ($LASTEXITCODE -ne 0) {
          throw "git commit 失败: $resolvedProjectRoot"
        }

        $baselineCommitted = $true
      }
    }
  }

  Write-Output ""
  Write-Output "Install completed."
  Write-Output ("ProjectRoot: {0}" -f $resolvedProjectRoot)
  Write-Output ("AgentsRoot: {0}" -f $targetAgentsRoot)
  Write-Output ("Mode: {0}" -f $Mode)
  Write-Output ("SmokeInitialized: {0}" -f $InitSmoke.IsPresent)
  Write-Output ("BaselineCommitted: {0}" -f $baselineCommitted)
  Write-Output ("BaselinePolicy: {0}" -f $baselinePolicy)
  Write-Output ""
  Write-Output "Next steps:"
  Write-Output ("- powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f (Join-Path $resolvedProjectRoot 'env-check.ps1'))
  Write-Output ("- powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f (Join-Path $resolvedProjectRoot 'verify.ps1'))
  Write-Output ("- powershell -NoProfile -ExecutionPolicy Bypass -File `"{0}`"" -f (Join-Path $resolvedProjectRoot 'codex-loop.ps1'))
}
finally {
  if (($null -ne $stagedSourceRoot) -and (Test-Path -LiteralPath $stagedSourceRoot)) {
    Remove-Item -LiteralPath $stagedSourceRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
