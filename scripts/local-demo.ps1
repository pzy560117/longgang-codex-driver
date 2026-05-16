param(
  [string]$ProjectRoot = "",
  [string]$MysqlContainerName = "export-platform-mysql-local",
  [int]$MysqlPort = 33306,
  [string]$MysqlDatabase = "export_platform_test",
  [string]$ObjectStorageBucket = "export-platform-local-demo",
  [string]$NodePath = "node",
  [string]$HostName = "127.0.0.1",
  [int]$Port = 3000,
  [switch]$SmokeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$LocalObjectStorageScript = Join-Path $ProjectRoot "scripts\local-object-storage-server.mjs"
$LocalDemoSetupScript = Join-Path $ProjectRoot "scripts\local-demo-setup.mjs"
$ServerScript = Join-Path $ProjectRoot "src\server.ts"
$ObjectStorageProcess = $null
$ObjectStorageLog = $null
$ObjectStorageErrorLog = $null
$ServerProcess = $null
$ServerLog = $null
$ServerErrorLog = $null

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

function Assert-DockerDaemonReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "BLOCKED - 需要人工介入: demo:local requires Docker to self-provision local MySQL."
  }

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & docker info --format "{{.ServerVersion}}" 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    throw "BLOCKED - 需要人工介入: demo:local requires a running Docker daemon. Start Docker Desktop or another Docker engine, then rerun demo:local. $output"
  }
}

function Join-ProcessArguments {
  param([string[]]$Arguments)

  return ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_.Replace('"', '\"')) + '"'
    }
    else {
      $_
    }
  }) -join " "
}

function Get-FreeTcpPort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), 0)
  try {
    $listener.Start()
    return [int]$listener.LocalEndpoint.Port
  }
  finally {
    $listener.Stop()
  }
}

function Get-DockerContainerInspect {
  param([string]$ContainerName)

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $inspectJson = & docker inspect $ContainerName 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  if ($exitCode -ne 0) {
    return $null
  }

  $inspect = $inspectJson | ConvertFrom-Json
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
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName is not mapped to 127.0.0.1:$Port. Remove or recreate the container before running demo:local."
  }

  $envVars = @($Container.Config.Env)
  if (-not ($envVars -contains "MYSQL_DATABASE=$Database")) {
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName was not created for database $Database. Remove or recreate the container before running demo:local."
  }
}

if ($SmokeOnly -and -not $PSBoundParameters.ContainsKey("Port")) {
  $Port = Get-FreeTcpPort
}

function Ensure-DockerMysql {
  param(
    [string]$ContainerName,
    [int]$Port,
    [string]$Database
  )

  Assert-DockerDaemonReady

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
    $container = Get-DockerContainerInspect -ContainerName $ContainerName
  }
  else {
    Assert-DockerMysqlConfiguration -Container $container -ContainerName $ContainerName -Port $Port -Database $Database
    $running = [string]$container.State.Running
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

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-demo-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-demo-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList (Join-ProcessArguments -Arguments @($LocalObjectStorageScript, "--bucket", $Bucket)) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "demo:local object storage mock exited early. $logText $errorText"
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
  throw "demo:local object storage mock did not become ready within 15 seconds."
}

function Start-DemoServer {
  param(
    [string]$Root,
    [string]$NodeExecutable,
    [string]$ScriptPath
  )

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-demo-server-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-local-demo-server-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList (Join-ProcessArguments -Arguments @("--import", "tsx", $ScriptPath)) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "demo:local HTTP server exited early. $logText $errorText"
    }

    if (Test-Path -LiteralPath $logPath) {
      foreach ($line in Get-Content -LiteralPath $logPath) {
        if ($line -like '{"event":"export-platform.http.started"*') {
          $json = $line | ConvertFrom-Json
          return [pscustomobject]@{
            Process = $process
            LogPath = $logPath
            ErrorLogPath = $errorLogPath
            Host = [string]$json.host
            Port = [int]$json.port
          }
        }
      }
    }

    Start-Sleep -Milliseconds 200
  }

  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "demo:local HTTP server did not become ready within 15 seconds."
}

function Write-ApiExamples {
  param([string]$BaseUrl)

  Write-Output "Health URL: $BaseUrl/health"
  Write-Output "PowerShell health example:"
  Write-Output "  Invoke-RestMethod -Uri `"$BaseUrl/health`""
  Write-Output "curl health example:"
  Write-Output "  curl `"$BaseUrl/health`""
  Write-Output "POST /api/export/tasks example:"
  Write-Output "  curl -X POST `"$BaseUrl/api/export/tasks`" -H `"content-type: application/json`" -H `"x-operator-id: u001`" -H `"x-tenant-id: tenant-001`" -H `"x-role-codes: EXPORT_USER`" -H `"x-org-scope: ORG-001,ORG-002`" -H `"x-request-id: req-local-demo-create`" -d `"{\`"taskCode\`":\`"purchase-order-export\`",\`"subsystemCode\`":\`"purchase\`",\`"fileFormat\`":\`"XLSX\`",\`"clientRequestId\`":\`"local-demo-001\`",\`"queryParams\`":{\`"createdAtFrom\`":\`"2026-05-01T00:00:00.000Z\`",\`"createdAtTo\`":\`"2026-05-31T23:59:59.000Z\`",\`"orderStatus\`":\`"APPROVED\`",\`"supplierId\`":\`"SUP-DEMO-001\`",\`"purchaseOrgId\`":\`"PO-DEMO\`",\`"keyword\`":\`"DEMO-PO\`"}}`""
}

try {
  $databaseUrl = Ensure-DockerMysql -ContainerName $MysqlContainerName -Port $MysqlPort -Database $MysqlDatabase
  $started = Start-LocalObjectStorage -Root $ProjectRoot -Bucket $ObjectStorageBucket -NodeExecutable $NodePath
  $ObjectStorageProcess = $started.Process
  $ObjectStorageLog = $started.LogPath
  $ObjectStorageErrorLog = $started.ErrorLogPath

  $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_LOCAL_DEMO_DATABASE_NAME = $MysqlDatabase
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $started.Endpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $started.Bucket
  $env:EXPORT_PLATFORM_HOST = $HostName
  $env:EXPORT_PLATFORM_PORT = [string]$Port

  Push-Location $ProjectRoot
  try {
    & $NodePath --import tsx $LocalDemoSetupScript
    if ($LASTEXITCODE -ne 0) {
      throw "local-demo-setup.mjs failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }

  Write-Output "demo:local ready."
  Write-Output "MySQL: $MysqlContainerName at 127.0.0.1:$MysqlPort/$MysqlDatabase"
  Write-Output "Object storage mock: $($started.Endpoint) bucket=$($started.Bucket)"

  if ($SmokeOnly) {
    $server = Start-DemoServer -Root $ProjectRoot -NodeExecutable $NodePath -ScriptPath $ServerScript
    $ServerProcess = $server.Process
    $ServerLog = $server.LogPath
    $ServerErrorLog = $server.ErrorLogPath
    $baseUrl = "http://127.0.0.1:$($server.Port)"
    Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/health" | Out-Null
    Write-ApiExamples -BaseUrl $baseUrl
    Write-Output "demo:local smoke passed."
  }
  else {
    $baseUrl = "http://${HostName}:$Port"
    Write-ApiExamples -BaseUrl $baseUrl
    Write-Output "Starting HTTP server. Press Ctrl+C to stop the demo."
    Push-Location $ProjectRoot
    try {
      & $NodePath --import tsx $ServerScript
      if ($LASTEXITCODE -ne 0) {
        throw "HTTP server exited with code $LASTEXITCODE"
      }
    }
    finally {
      Pop-Location
    }
  }
}
finally {
  if ($null -ne $ServerProcess -and -not $ServerProcess.HasExited) {
    Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
  }
  if ($null -ne $ObjectStorageProcess -and -not $ObjectStorageProcess.HasExited) {
    Stop-Process -Id $ObjectStorageProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($logPath in @($ObjectStorageLog, $ObjectStorageErrorLog, $ServerLog, $ServerErrorLog)) {
    if ($null -ne $logPath -and (Test-Path -LiteralPath $logPath)) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }
}
