param(
  [string]$ProjectRoot = "",
  [string]$SyncFile = ".ai-sync.yml",
  [string]$ManifestPath = "ai-sync/ai-kit-manifest.json",
  [string]$LockPath = ".ai-sync.lock.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $currentLocationRoot = (Get-Location).Path
  $scriptDerivedRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
  if (Test-Path -LiteralPath (Join-Path $currentLocationRoot $SyncFile) -PathType Leaf) {
    $ProjectRoot = $currentLocationRoot
  }
  elseif (Test-Path -LiteralPath (Join-Path $scriptDerivedRoot $SyncFile) -PathType Leaf) {
    $ProjectRoot = $scriptDerivedRoot
  }
  else {
    $ProjectRoot = $currentLocationRoot
  }
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

function Get-RelativePathFromRoot {
  param(
    [string]$Root,
    [string]$TargetPath
  )

  $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd("\", "/") + [System.IO.Path]::DirectorySeparatorChar
  $targetFull = [System.IO.Path]::GetFullPath($TargetPath)
  if (-not $targetFull.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "路径不在项目根目录内: $TargetPath"
  }

  return Normalize-RelativePath -Path $targetFull.Substring($rootFull.Length)
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

function Get-FileSha256 {
  param([string]$Path)
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$resolvedSyncFile = Join-Path $resolvedProjectRoot $SyncFile
$resolvedManifestPath = Join-Path $resolvedProjectRoot $ManifestPath
$resolvedLockPath = Join-Path $resolvedProjectRoot $LockPath

if (-not (Test-Path -LiteralPath $resolvedSyncFile -PathType Leaf)) {
  Write-Output "No .ai-sync.yml found. Skip AI sync drift check."
  exit 0
}

$config = Read-JsonConfig -Path $resolvedSyncFile -Label ".ai-sync.yml"
$manifest = Read-JsonConfig -Path $resolvedManifestPath -Label "ai-kit-manifest"
$lock = Read-JsonConfig -Path $resolvedLockPath -Label ".ai-sync.lock.json"

$currentManifestHash = Get-FileSha256 -Path $resolvedManifestPath
$expectedManifestPath = Normalize-RelativePath -Path $ManifestPath
$failures = New-Object System.Collections.Generic.List[string]

if ([string]$lock.manifest.path -ne $expectedManifestPath) {
  $failures.Add("Lock manifest path mismatch: expected $expectedManifestPath actual $($lock.manifest.path)")
}

if ([string]$lock.manifest.sha256 -ne $currentManifestHash) {
  $failures.Add("Lock manifest hash mismatch: expected $($lock.manifest.sha256) actual $currentManifestHash")
}

$sourceHash = @{}
foreach ($item in $manifest.files) {
  $sourceHash[(Normalize-RelativePath -Path ([string]$item.source))] = [string]$item.sha256
}

foreach ($mapping in $config.managed) {
  $mappingType = if ([string]::IsNullOrWhiteSpace($mapping.type)) { "directory" } else { [string]$mapping.type }
  $source = Normalize-RelativePath -Path ([string]$mapping.source) -Directory:($mappingType -eq "directory")
  $destination = Normalize-RelativePath -Path ([string]$mapping.dest) -Directory:($mappingType -eq "directory")

  if ($mappingType -eq "file") {
    $expectedHash = $sourceHash[(Normalize-RelativePath -Path $source)]
    if ([string]::IsNullOrWhiteSpace($expectedHash)) {
      $failures.Add("Manifest missing source file: $source")
      continue
    }

    $targetPath = Join-Path $resolvedProjectRoot $destination
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
      $failures.Add("Missing managed file: $destination")
      continue
    }

    $actualHash = Get-FileSha256 -Path $targetPath
    if ($actualHash -ne $expectedHash) {
      $failures.Add("Drift detected: $destination`n  expected $expectedHash`n  actual   $actualHash")
    }
    continue
  }

  $sourcePrefix = $source
  $destinationRoot = Join-Path $resolvedProjectRoot $destination
  $expectedDestinations = @{}

  foreach ($item in $manifest.files) {
    $itemSource = Normalize-RelativePath -Path ([string]$item.source)
    if (-not $itemSource.StartsWith($sourcePrefix, [System.StringComparison]::Ordinal)) {
      continue
    }

    $relative = $itemSource.Substring($sourcePrefix.Length)
    $targetRelative = Join-NormalizedRelativePath -Base $destination -Child $relative
    $expectedDestinations[$targetRelative] = $true

    $targetPath = Join-Path $destinationRoot ($relative.Replace("/", "\"))
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
      $failures.Add("Missing managed file: $targetRelative")
      continue
    }

    $actualHash = Get-FileSha256 -Path $targetPath
    $expectedHash = [string]$item.sha256
    if ($actualHash -ne $expectedHash) {
      $failures.Add("Drift detected: $targetRelative`n  expected $expectedHash`n  actual   $actualHash")
    }
  }

  if (Test-Path -LiteralPath $destinationRoot -PathType Container) {
    foreach ($file in Get-ChildItem -LiteralPath $destinationRoot -Recurse -File) {
      $targetRelative = Get-RelativePathFromRoot -Root $resolvedProjectRoot -TargetPath $file.FullName
      if (-not $expectedDestinations.ContainsKey($targetRelative)) {
        $failures.Add("Unexpected managed file: $targetRelative")
      }
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Output "AI config drift detected."
  Write-Output ""
  foreach ($failure in $failures) {
    Write-Output ("- {0}" -f $failure)
  }
  Write-Output ""
  Write-Output "Do not edit managed files directly."
  Write-Output "Use .ai-overrides/ for project-specific changes, or update the central ai-workflow-kit repository."
  exit 1
}

Write-Output "AI config drift check passed."
