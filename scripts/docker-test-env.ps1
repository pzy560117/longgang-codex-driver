param(
  [string]$ProjectRoot = "",
  [string]$MysqlContainerName = "export-platform-mysql-local",
  [int]$MysqlPort = 33306,
  [string]$MysqlDatabase = "export_platform_test",
  [string]$ObjectStorageBucket = "export-platform-docker-test",
  [string]$NodePath = "node",
  [switch]$RunValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$SeedScript = Join-Path $ProjectRoot "scripts\docker-test-seed.mjs"
$LocalObjectStorageScript = Join-Path $ProjectRoot "scripts\local-object-storage-server.mjs"
$ObjectStorageProcess = $null
$ObjectStorageLog = $null
$ObjectStorageErrorLog = $null

function Invoke-Native {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = $output
  }
}

function Invoke-Docker {
  param([string[]]$Arguments)

  $result = Invoke-Native -FilePath "docker" -Arguments $Arguments
  if ($result.ExitCode -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')`n$($result.Output)"
  }
  return $result.Output
}

function Test-DockerDaemon {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    return [pscustomobject]@{
      Ready = $false
      Output = "docker command is not available"
    }
  }

  $result = Invoke-Native -FilePath "docker" -Arguments @("info", "--format", "{{.ServerVersion}}")
  return [pscustomobject]@{
    Ready = $result.ExitCode -eq 0
    Output = ($result.Output -join "`n")
  }
}

function Start-DockerDesktopIfNeeded {
  $status = Test-DockerDaemon
  if ($status.Ready) {
    return
  }

  $dockerDesktopPath = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path -LiteralPath $dockerDesktopPath -PathType Leaf)) {
    throw "BLOCKED - 需要人工介入: Docker daemon is not reachable and Docker Desktop was not found. Start Docker manually, then rerun npm run test:docker-local.`n$($status.Output)"
  }

  Start-Process -FilePath $dockerDesktopPath -WindowStyle Hidden

  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $status = Test-DockerDaemon
    if ($status.Ready) {
      return
    }
  }

  throw "BLOCKED - 需要人工介入: Docker daemon is not reachable after starting Docker Desktop. Wait for Docker Desktop to finish startup, then rerun npm run test:docker-local.`n$($status.Output)"
}

function Get-DockerContainerInspect {
  param([string]$ContainerName)

  $result = Invoke-Native -FilePath "docker" -Arguments @("inspect", $ContainerName)
  if ($result.ExitCode -ne 0) {
    return $null
  }

  $inspect = $result.Output | ConvertFrom-Json
  return @($inspect)[0]
}

function Assert-DockerMysqlConfiguration {
  param(
    [object]$Container,
    [string]$ContainerName,
    [int]$Port,
    [string]$Database
  )

  $networkPortProperty = $Container.NetworkSettings.Ports.PSObject.Properties["3306/tcp"]
  $hostConfigPortProperty = $Container.HostConfig.PortBindings.PSObject.Properties["3306/tcp"]
  $portBindings = @()
  if ($null -ne $networkPortProperty) {
    $portBindings += @($networkPortProperty.Value)
  }
  if ($null -ne $hostConfigPortProperty) {
    $portBindings += @($hostConfigPortProperty.Value)
  }
  $matchingPort = @($portBindings | Where-Object {
    [int]$_.HostPort -eq $Port -and @("127.0.0.1", "0.0.0.0", "::") -contains [string]$_.HostIp
  }) | Select-Object -First 1
  if ($null -eq $matchingPort) {
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName is not mapped to 127.0.0.1:$Port. Remove or recreate it before running npm run test:docker-local."
  }

  $envVars = @($Container.Config.Env)
  if (-not ($envVars -contains "MYSQL_DATABASE=$Database")) {
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName was not created for database $Database. Remove or recreate it before running npm run test:docker-local."
  }
}

function Ensure-DockerMysql {
  param(
    [string]$ContainerName,
    [int]$Port,
    [string]$Database
  )

  Start-DockerDesktopIfNeeded

  $container = Get-DockerContainerInspect -ContainerName $ContainerName
  if ($null -eq $container) {
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
    Assert-DockerMysqlConfiguration -Container $container -ContainerName $ContainerName -Port $Port -Database $Database
    if ([string]$container.State.Running -ne "true") {
      Invoke-Docker -Arguments @("start", $ContainerName) | Out-Null
    }
  }

  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    $result = Invoke-Native -FilePath "docker" -Arguments @("exec", $ContainerName, "mysqladmin", "ping", "-uroot", "--silent")
    if ($result.ExitCode -eq 0) {
      $url = "mysql://root@127.0.0.1:$Port/$Database"
      [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_TEST_DATABASE_URL", $url, "Process")
      [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_DATABASE_URL", $url, "Process")
      [Environment]::SetEnvironmentVariable("EXPORT_PLATFORM_DOCKER_TEST_DATABASE_NAME", $Database, "Process")
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

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-docker-test-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-docker-test-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList @($LocalObjectStorageScript, "--bucket", $Bucket) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "docker test object storage mock exited early. $logText $errorText"
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
  throw "BLOCKED - 需要人工介入: local object storage mock did not become ready within 15 seconds."
}

function Invoke-CheckedCommand {
  param([string]$Command)

  Write-Output "Running: $Command"
  powershell -NoProfile -Command $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Verification command failed with exit code ${LASTEXITCODE}: $Command"
  }
}

try {
  $databaseUrl = Ensure-DockerMysql -ContainerName $MysqlContainerName -Port $MysqlPort -Database $MysqlDatabase
  $started = Start-LocalObjectStorage -Root $ProjectRoot -Bucket $ObjectStorageBucket -NodeExecutable $NodePath
  $ObjectStorageProcess = $started.Process
  $ObjectStorageLog = $started.LogPath
  $ObjectStorageErrorLog = $started.ErrorLogPath

  $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DOCKER_TEST_DATABASE_NAME = $MysqlDatabase
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $started.Endpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $started.Bucket
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES = "true"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE = "true"

  Push-Location $ProjectRoot
  try {
    & $NodePath --import tsx $SeedScript
    if ($LASTEXITCODE -ne 0) {
      throw "docker-test-seed.mjs failed with exit code $LASTEXITCODE"
    }

    Write-Output "docker test environment ready."
    Write-Output "MySQL: $MysqlContainerName at 127.0.0.1:$MysqlPort/$MysqlDatabase"
    Write-Output "Object storage mock: $($started.Endpoint) bucket=$($started.Bucket)"

    if ($RunValidation) {
      foreach ($command in @(
        "npm run arch:check",
        "npm run typecheck",
        "npm run test:api",
        "npm run test:db",
        "npm run test:worker",
        "npm run test:query",
        "npm run test:file",
        "npm run test:sample",
        "npm run test:object-storage-live"
      )) {
        Invoke-CheckedCommand -Command $command
      }
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  if ($null -ne $ObjectStorageProcess -and -not $ObjectStorageProcess.HasExited) {
    Stop-Process -Id $ObjectStorageProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($logPath in @($ObjectStorageLog, $ObjectStorageErrorLog)) {
    if ($null -ne $logPath -and (Test-Path -LiteralPath $logPath)) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }
}
