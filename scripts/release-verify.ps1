param(
  [string]$ProjectRoot = "",
  [string]$MysqlContainerName = "export-platform-mysql-local",
  [int]$MysqlPort = 33306,
  [string]$MysqlDatabase = "export_platform_test",
  [string]$ObjectStorageBucket = "export-platform-release-docker-mock",
  [string]$NodePath = "node"
)

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

function Invoke-Docker {
  param([string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & docker @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')`n$output"
  }
  return $output
}

function Ensure-DockerDaemon {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & docker info 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "BLOCKED - 需要人工介入: Docker daemon is not reachable. Start Docker Desktop, or set EXPORT_PLATFORM_TEST_DATABASE_URL to a reachable local/Docker MySQL before running release-verify.`n$output"
  }
}

function Ensure-DockerMysql {
  param(
    [string]$ContainerName,
    [int]$Port,
    [string]$Database
  )

  if (-not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("EXPORT_PLATFORM_TEST_DATABASE_URL"))) {
    return [Environment]::GetEnvironmentVariable("EXPORT_PLATFORM_TEST_DATABASE_URL")
  }

  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "BLOCKED - 需要人工介入: release-verify requires Docker when EXPORT_PLATFORM_TEST_DATABASE_URL is not set."
  }

  Ensure-DockerDaemon

  & docker inspect $ContainerName *> $null
  if ($LASTEXITCODE -ne 0) {
    Invoke-Docker -Arguments @(
      "run",
      "-d",
      "--name",
      $ContainerName,
      "-e",
      "MYSQL_ALLOW_EMPTY_PASSWORD=yes",
      "-e",
      "MYSQL_DATABASE=$Database",
      "-p",
      "127.0.0.1:${Port}:3306",
      "mysql:8.4"
    ) | Out-Null
  }
  else {
    $running = (& docker inspect -f "{{.State.Running}}" $ContainerName 2>$null).Trim()
    if ($LASTEXITCODE -ne 0) {
      throw "Docker inspect failed for $ContainerName."
    }
    if ($running -ne "true") {
      Invoke-Docker -Arguments @("start", $ContainerName) | Out-Null
    }
  }

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    & docker exec $ContainerName mysqladmin ping -uroot --silent *> $null
    if ($LASTEXITCODE -eq 0) {
      $url = "mysql://root@127.0.0.1:$Port/$Database"
      [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_TEST_DATABASE_URL", $url, "Process")
      return $url
    }
    Start-Sleep -Seconds 1
  }

  throw "BLOCKED - 需要人工介入: Docker MySQL container $ContainerName did not become ready within 60 seconds."
}

function Start-LocalObjectStorage {
  param(
    [string]$Root,
    [string]$Bucket,
    [string]$NodeExecutable
  )

  if (-not (Test-Path -LiteralPath $LocalObjectStorageScript -PathType Leaf)) {
    throw "Missing local object storage mock script: $LocalObjectStorageScript"
  }

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-release-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-release-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList @($LocalObjectStorageScript, "--bucket", $Bucket) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "RELEASE-001 local object storage mock exited early. $logText $errorText"
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
  throw "RELEASE-001 local object storage mock did not become ready within 15 seconds."
}

try {
  $databaseUrl = Ensure-DockerMysql -ContainerName $MysqlContainerName -Port $MysqlPort -Database $MysqlDatabase
  $started = Start-LocalObjectStorage -Root $ProjectRoot -Bucket $ObjectStorageBucket -NodeExecutable $NodePath
  $ObjectStorageProcess = $started.Process
  $ObjectStorageLog = $started.LogPath
  $ObjectStorageErrorLog = $started.ErrorLogPath

  [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_TEST_DATABASE_URL", $databaseUrl, "Process")
  [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT", $started.Endpoint, "Process")
  [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET", $started.Bucket, "Process")
  [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES", "true", "Process")
  [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE", "true", "Process")

  Write-Output "RELEASE-001 docker/mock release verification starting."
  Write-Output "MySQL: $MysqlContainerName at 127.0.0.1:$MysqlPort/$MysqlDatabase"
  Write-Output "Object storage mock: $($started.Endpoint) bucket=$($started.Bucket)"

  & $VerifyScript -ProjectRoot $ProjectRoot -Commands @(
    "npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000",
    "npm run arch:check",
    "npm run typecheck",
    "npm run test:contract",
    "npm test",
    "npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml",
    "npm run test:api",
    "npm run test:db",
    "npm run test:worker",
    "npm run test:query",
    "npm run test:file",
    "npm run test:sample",
    "npm run test:object-storage-live",
    "git diff --check -- contracts docs/testing/verify-matrix.md task.json plans src tests migrations scripts package.json package-lock.json"
  )
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
