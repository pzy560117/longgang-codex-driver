param(
  [string]$ProjectRoot = "",
  [string]$MysqlContainerName = "export-platform-mysql-local",
  [int]$MysqlPort = 33306,
  [string]$MysqlDatabase = "export_platform_test",
  [string]$MinioContainerName = "export-platform-minio-local",
  [int]$MinioApiPort = 39000,
  [int]$MinioConsolePort = 39001,
  [string]$ObjectStorageBucket = "export-platform-local-demo",
  [string]$MinioAccessKey = "export-platform",
  [string]$MinioSecretKey = "export-platform-secret",
  [int]$SeedRowCount = 10000,
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
$MinioSmokeScript = Join-Path $ProjectRoot "scripts\minio-live-smoke.mjs"

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

function Ensure-DockerMinio {
  param(
    [string]$ContainerName,
    [int]$ApiPort,
    [int]$ConsolePort,
    [string]$AccessKey,
    [string]$SecretKey,
    [string]$Bucket,
    [string]$NodeExecutable
  )

  $container = Get-DockerContainerInspect -ContainerName $ContainerName
  if ($null -eq $container) {
    Invoke-Docker -Arguments @(
      "run",
      "-d",
      "--name",
      $ContainerName,
      "-e",
      "MINIO_ROOT_USER=$AccessKey",
      "-e",
      "MINIO_ROOT_PASSWORD=$SecretKey",
      "-p",
      "127.0.0.1:${ApiPort}:9000",
      "-p",
      "127.0.0.1:${ConsolePort}:9001",
      "minio/minio:latest",
      "server",
      "/data",
      "--console-address",
      ":9001"
    ) | Out-Null
  }
  elseif ([string]$container.State.Running -ne "true") {
    Invoke-Docker -Arguments @("start", $ContainerName) | Out-Null
  }

  $endpoint = "http://127.0.0.1:$ApiPort"
  $deadline = (Get-Date).AddSeconds(60)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri "$endpoint/minio/health/live" | Out-Null

      $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $endpoint
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $Bucket
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_DRIVER = "s3"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_REGION = "us-east-1"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_ACCESS_KEY_ID = $AccessKey
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_SECRET_ACCESS_KEY = $SecretKey
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_FORCE_PATH_STYLE = "true"
      & $NodeExecutable --import tsx $MinioSmokeScript | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{
          Endpoint = $endpoint
          Bucket = $Bucket
          ConsoleUrl = "http://127.0.0.1:$ConsolePort"
        }
      }
    }
    catch {
    }
    Start-Sleep -Seconds 2
  }

  throw "BLOCKED - 需要人工介入: Docker MinIO container $ContainerName did not become ready within 60 seconds."
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
  $started = Ensure-DockerMinio -ContainerName $MinioContainerName -ApiPort $MinioApiPort -ConsolePort $MinioConsolePort -AccessKey $MinioAccessKey -SecretKey $MinioSecretKey -Bucket $ObjectStorageBucket -NodeExecutable $NodePath

  $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DOCKER_TEST_DATABASE_NAME = $MysqlDatabase
  $env:EXPORT_PLATFORM_SEED_ROW_COUNT = [string]$SeedRowCount
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $started.Endpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $started.Bucket
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES = "true"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE = "true"
  $env:EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = "local-minio-download-signing-secret"

  Push-Location $ProjectRoot
  try {
    & $NodePath --import tsx $SeedScript
    if ($LASTEXITCODE -ne 0) {
      throw "docker-test-seed.mjs failed with exit code $LASTEXITCODE"
    }

    Write-Output "docker test environment ready."
    Write-Output "MySQL: $MysqlContainerName at 127.0.0.1:$MysqlPort/$MysqlDatabase"
    Write-Output "MinIO: $($started.Endpoint) bucket=$($started.Bucket)"
    Write-Output "MinIO console: $($started.ConsoleUrl)"
    Write-Output "Seed rows: $SeedRowCount"

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
}
