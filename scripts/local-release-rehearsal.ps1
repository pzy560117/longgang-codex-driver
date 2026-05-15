param(
  [string]$ProjectRoot = "",
  [string]$DatabaseUrl = "",
  [string]$ObjectStorageEndpoint = "",
  [string]$ObjectStorageBucket = "",
  [switch]$StartLocalObjectStorageMock,
  [string]$NodePath = "node"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$VerifyScript = Join-Path $ProjectRoot "verify.ps1"
$LocalObjectStorageScript = Join-Path $ProjectRoot "scripts\local-object-storage-server.mjs"
$ObjectStorageProcess = $null
$ObjectStorageLog = $null
$ObjectStorageErrorLog = $null

if (
  -not $StartLocalObjectStorageMock -and
  [string]::IsNullOrWhiteSpace($ObjectStorageEndpoint) -and
  [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT"))
) {
  $StartLocalObjectStorageMock = $true
}

function Get-EffectiveValue {
  param(
    [string]$ExplicitValue,
    [string]$EnvironmentName
  )

  if (-not [string]::IsNullOrWhiteSpace($ExplicitValue)) {
    return $ExplicitValue
  }

  return [Environment]::GetEnvironmentVariable($EnvironmentName)
}

function Test-LocalEndpoint {
  param([string]$Endpoint)

  try {
    $uri = [System.Uri]::new($Endpoint)
  }
  catch {
    return $false
  }

  return @("localhost", "127.0.0.1", "::1") -contains $uri.Host.ToLowerInvariant()
}

function Start-LocalObjectStorage {
  param(
    [string]$Root,
    [string]$Bucket,
    [string]$NodeExecutable
  )

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $serverScript = Join-Path $Root "scripts\local-object-storage-server.mjs"
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList @($serverScript, "--bucket", $Bucket) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "LOCAL-RELEASE-REHEARSAL-001 object storage mock exited early. $logText $errorText"
    }

    if (Test-Path -LiteralPath $logPath) {
      $readyLine = Get-Content -LiteralPath $logPath | Where-Object { $_ -like "LOCAL_OBJECT_STORAGE_READY *" } | Select-Object -First 1
      if ($readyLine) {
        $json = $readyLine.Substring("LOCAL_OBJECT_STORAGE_READY ".Length) | ConvertFrom-Json
        return [pscustomobject]@{
          Process = $process
          LogPath = $logPath
          ErrorLogPath = $errorLogPath
          Endpoint = [string]$json.endpoint
          Bucket = [string]$json.bucket
        }
      }
    }

    Start-Sleep -Milliseconds 200
  }

  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "LOCAL-RELEASE-REHEARSAL-001 object storage mock did not become ready within 15 seconds."
}

function Invoke-RehearsalCommand {
  param(
    [string]$Command,
    [string]$Root
  )

  Push-Location $Root
  try {
    Write-Output "Running: $Command"
    powershell -NoProfile -Command $Command
    if ($LASTEXITCODE -ne 0) {
      throw "LOCAL-RELEASE-REHEARSAL-001 failed with exit code $($LASTEXITCODE): $Command"
    }
  }
  finally {
    Pop-Location
  }
}

try {
  $DatabaseUrl = Get-EffectiveValue -ExplicitValue $DatabaseUrl -EnvironmentName "EXPORT_PLATFORM_TEST_DATABASE_URL"
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    throw "BLOCKED - 需要人工介入: LOCAL-RELEASE-REHEARSAL-001 requires local/mock MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL. This is mock/local rehearsal evidence, not RELEASE-001 PASS evidence."
  }

  if ($StartLocalObjectStorageMock) {
    if (-not (Test-Path -LiteralPath $LocalObjectStorageScript -PathType Leaf)) {
      throw "Missing local object storage mock script: $LocalObjectStorageScript"
    }

    $localBucket = if ([string]::IsNullOrWhiteSpace($ObjectStorageBucket)) { "export-platform-local-rehearsal" } else { $ObjectStorageBucket }
    $started = Start-LocalObjectStorage -Root $ProjectRoot -Bucket $localBucket -NodeExecutable $NodePath
    $ObjectStorageProcess = $started.Process
    $ObjectStorageLog = $started.LogPath
    $ObjectStorageErrorLog = $started.ErrorLogPath
    $ObjectStorageEndpoint = $started.Endpoint
    $ObjectStorageBucket = $started.Bucket
  }
  else {
    $ObjectStorageEndpoint = Get-EffectiveValue -ExplicitValue $ObjectStorageEndpoint -EnvironmentName "EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT"
    $ObjectStorageBucket = Get-EffectiveValue -ExplicitValue $ObjectStorageBucket -EnvironmentName "EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET"
  }

  if ([string]::IsNullOrWhiteSpace($ObjectStorageEndpoint) -or [string]::IsNullOrWhiteSpace($ObjectStorageBucket)) {
    throw "BLOCKED - 需要人工介入: LOCAL-RELEASE-REHEARSAL-001 requires local/mock object storage endpoint and bucket. Use -StartLocalObjectStorageMock or set EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT and EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET."
  }

  $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $DatabaseUrl
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $ObjectStorageEndpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $ObjectStorageBucket
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES = "true"

  Write-Output "LOCAL-RELEASE-REHEARSAL-001 mock/local rehearsal starting."
  Write-Output "This run is mock/local rehearsal evidence only; it is not RELEASE-001 PASS evidence and cannot clear REAL-RELEASE-ENV-READY."

  & $VerifyScript -ProjectRoot $ProjectRoot -Commands @(
    "npm run arch:check",
    "npm run typecheck",
    "npm run test:contract",
    "npm test",
    "npm run test:api",
    "npm run test:db",
    "npm run test:worker",
    "npm run test:query",
    "npm run test:file",
    "npm run test:sample"
  )

  $LiveObjectStorageCommand = "npm run test:object-storage-live"
  if (Test-LocalEndpoint -Endpoint $ObjectStorageEndpoint) {
    Write-Output "Skipping $LiveObjectStorageCommand for mock/local rehearsal because the endpoint is local. Live object storage release evidence remains BLOCKED until a non-local endpoint is configured."
  }
  else {
    Invoke-RehearsalCommand -Command $LiveObjectStorageCommand -Root $ProjectRoot
  }

  Write-Output "LOCAL-RELEASE-REHEARSAL-001 mock/local rehearsal completed. This does not release RELEASE-001."
}
finally {
  if ($null -ne $ObjectStorageProcess -and -not $ObjectStorageProcess.HasExited) {
    Stop-Process -Id $ObjectStorageProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $ObjectStorageLog -and (Test-Path -LiteralPath $ObjectStorageLog)) {
    Remove-Item -LiteralPath $ObjectStorageLog -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $ObjectStorageErrorLog -and (Test-Path -LiteralPath $ObjectStorageErrorLog)) {
    Remove-Item -LiteralPath $ObjectStorageErrorLog -Force -ErrorAction SilentlyContinue
  }
}
