param(
  [string]$ProjectRoot = "",
  [string]$MysqlContainerName = "export-platform-mysql-local",
  [int]$MysqlPort = 33306,
  [string]$MysqlDatabase = "export_platform_test",
  [string]$ObjectStorageBucket = "export-platform-full-acceptance",
  [string]$NodePath = "node"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$LocalObjectStorageScript = Join-Path $ProjectRoot "scripts\local-object-storage-server.mjs"
$ReportPath = Join-Path $ProjectRoot "docs\testing\full-acceptance-test-report.md"
$ObjectStorageProcess = $null
$ObjectStorageLog = $null
$ObjectStorageErrorLog = $null
$Results = New-Object System.Collections.Generic.List[object]

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
    Output = @($output)
  }
}

function Invoke-Docker {
  param([string[]]$Arguments)

  $result = Invoke-Native -FilePath "docker" -Arguments $Arguments
  if ($result.ExitCode -ne 0) {
    throw "Docker command failed: docker $($Arguments -join ' ')`n$($result.Output -join "`n")"
  }
  return $result.Output
}

function Assert-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "BLOCKED - 需要人工介入: full acceptance requires Docker when EXPORT_PLATFORM_TEST_DATABASE_URL is not set."
  }

  $result = Invoke-Native -FilePath "docker" -Arguments @("info", "--format", "{{.ServerVersion}}")
  if ($result.ExitCode -ne 0) {
    throw "BLOCKED - 需要人工介入: Docker daemon is not reachable. Start Docker Desktop, then rerun npm run test:acceptance:full-report.`n$($result.Output -join "`n")"
  }
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
  $portBindings = @()
  if ($null -ne $networkPortProperty) {
    $portBindings += @($networkPortProperty.Value)
  }

  $matchingPort = @($portBindings | Where-Object {
    [int]$_.HostPort -eq $Port -and @("127.0.0.1", "0.0.0.0", "::") -contains [string]$_.HostIp
  }) | Select-Object -First 1
  if ($null -eq $matchingPort) {
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName is not mapped to 127.0.0.1:$Port."
  }

  $envVars = @($Container.Config.Env)
  if (-not ($envVars -contains "MYSQL_DATABASE=$Database")) {
    throw "BLOCKED - 需要人工介入: existing Docker MySQL container $ContainerName was not created for database $Database."
  }
}

function Ensure-DockerMysql {
  param(
    [string]$ContainerName,
    [int]$Port,
    [string]$Database
  )

  if (-not [string]::IsNullOrWhiteSpace($env:EXPORT_PLATFORM_TEST_DATABASE_URL)) {
    $env:EXPORT_PLATFORM_DATABASE_URL = $env:EXPORT_PLATFORM_TEST_DATABASE_URL
    return $env:EXPORT_PLATFORM_TEST_DATABASE_URL
  }

  Assert-DockerReady

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
      $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $url
      $env:EXPORT_PLATFORM_DATABASE_URL = $url
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

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-full-acceptance-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errorLogPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-full-acceptance-object-storage-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodeExecutable -ArgumentList @($LocalObjectStorageScript, "--bucket", $Bucket) -WorkingDirectory $Root -RedirectStandardOutput $logPath -RedirectStandardError $errorLogPath -PassThru -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(15)

  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) {
      $logText = if (Test-Path -LiteralPath $logPath) { Get-Content -LiteralPath $logPath -Raw } else { "" }
      $errorText = if (Test-Path -LiteralPath $errorLogPath) { Get-Content -LiteralPath $errorLogPath -Raw } else { "" }
      throw "full acceptance object storage mock exited early. $logText $errorText"
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

function Invoke-ReportCommand {
  param(
    [string]$Label,
    [string]$RequirementIds,
    [string]$Command
  )

  Write-Output "Running: $Command"
  $startedAt = Get-Date
  Push-Location $ProjectRoot
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
  }
  finally {
    Pop-Location
  }

  $endedAt = Get-Date
  $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
  $Results.Add([pscustomobject]@{
    Label = $Label
    RequirementIds = $RequirementIds
    Command = $Command
    Status = $status
    ExitCode = $exitCode
    DurationSeconds = [math]::Round(($endedAt - $startedAt).TotalSeconds, 2)
    Output = (($output | ForEach-Object { [string]$_ }) -join "`n")
  }) | Out-Null

  if ($exitCode -ne 0) {
    throw "Verification command failed with exit code ${exitCode}: $Command"
  }
}

function New-ReportMarkdown {
  param(
    [string]$DatabaseUrl,
    [string]$ObjectStorageEndpoint,
    [datetime]$StartedAt,
    [datetime]$EndedAt,
    [string]$Verdict
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add("# 全量需求验收测试报告") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("**结论**: $Verdict") | Out-Null
  $lines.Add("**开始时间**: $($StartedAt.ToUniversalTime().ToString('o'))") | Out-Null
  $lines.Add("**结束时间**: $($EndedAt.ToUniversalTime().ToString('o'))") | Out-Null
  $lines.Add("**数据库**: local/Docker MySQL (redacted)") | Out-Null
  $lines.Add("**对象存储**: local object storage mock ($ObjectStorageEndpoint)") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("## 覆盖范围") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("| Requirement | 验证层 | 主要命令 |") | Out-Null
  $lines.Add("| --- | --- | --- |") | Out-Null
  $lines.Add('| FR-001 / FR-002 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | HTTP API / auth / audit / history / state machine | `npm run test:api`, `npm run test:acceptance` |') | Out-Null
  $lines.Add('| FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | DB schema / repositories / durable evidence | `npm run test:db` |') | Out-Null
  $lines.Add('| FR-005 / FR-010 / FR-012 / FR-013 | scheduler / locks / retry / cleanup polling | `npm run test:worker` |') | Out-Null
  $lines.Add('| FR-006 / FR-008 / FR-009 / FR-014 | query executor / datasource adapter / data scope / masking | `npm run test:query` |') | Out-Null
  $lines.Add('| FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | file service / signed download / cleanup / render failures | `npm run test:file`, `npm run test:object-storage-live` |') | Out-Null
  $lines.Add('| FR-014 | purchase-order sample / 0-100001 row boundaries / masked output | `npm run test:sample` |') | Out-Null
  $lines.Add('| FR-001 - FR-014 | contract, architecture, docs, local/dev evidence boundary | `npm run arch:check`, `npm run test:contract`, `npm test`, `npm run test:mock-local` |') | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("## 命令结果") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("| 验证项 | Requirement | 状态 | 退出码 | 耗时秒 | 命令 |") | Out-Null
  $lines.Add("| --- | --- | --- | ---: | ---: | --- |") | Out-Null

  foreach ($result in $Results) {
    $safeCommand = $result.Command.Replace("|", "\|")
    $lines.Add("| $($result.Label) | $($result.RequirementIds) | $($result.Status) | $($result.ExitCode) | $($result.DurationSeconds) | ``$safeCommand`` |") | Out-Null
  }

  $lines.Add("") | Out-Null
  $lines.Add("## 证据边界") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("- 本报告覆盖当前仓库 FR-001 至 FR-014 的本机受控验收链路。") | Out-Null
  $lines.Add("- 证据来自 Docker/local MySQL、本地 object storage mock、Node test、OpenAPI/架构/文档守护和现有集成测试。") | Out-Null
  $lines.Add("- 本报告不声明外部生产 MySQL、外部业务数据源、live OSS/S3 或外部网关已验证。") | Out-Null
  $lines.Add('- `npm run test:object-storage-live` 在本脚本中由本地 object storage mock 和显式 allow flags 驱动，只能算 docker/mock smoke。') | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("## 输出摘要") | Out-Null
  $lines.Add("") | Out-Null

  foreach ($result in $Results) {
    $lines.Add("### $($result.Label)") | Out-Null
    $lines.Add("") | Out-Null
    $lines.Add('```text') | Out-Null
    $lines.Add((Trim-OutputForReport -Text $result.Output)) | Out-Null
    $lines.Add('```') | Out-Null
    $lines.Add("") | Out-Null
  }

  return ($lines -join "`n") + "`n"
}

function Trim-OutputForReport {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  $maxLength = 2500
  if ($Text.Length -le $maxLength) {
    return $Text.TrimEnd()
  }

  $tailLength = 1800
  return ($Text.Substring(0, 600).TrimEnd() + "`n... output truncated ...`n" + $Text.Substring($Text.Length - $tailLength).TrimStart()).TrimEnd()
}

function Assert-GeneratedReport {
  param([string]$Path)

  $text = Get-Content -LiteralPath $Path -Raw
  $requiredFragments = @(
    "**结论**: PASS",
    "**数据库**: local/Docker MySQL (redacted)",
    "本报告不声明外部生产 MySQL、外部业务数据源、live OSS/S3 或外部网关已验证",
    "只能算 docker/mock smoke"
  )

  foreach ($fragment in $requiredFragments) {
    if (-not $text.Contains($fragment)) {
      throw "Generated full acceptance report is missing required fragment: $fragment"
    }
  }

  foreach ($index in 1..14) {
    $requirementId = "FR-{0:D3}" -f $index
    if (-not $text.Contains($requirementId)) {
      throw "Generated full acceptance report is missing requirement id: $requirementId"
    }
  }

  $requiredCommands = @(
    "npm audit --audit-level=high",
    "npm run arch:check",
    "npm run typecheck",
    "npm run test:contract",
    "npm test",
    "npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml",
    "npm run test:mock-local",
    "npm run test:api",
    "npm run test:db",
    "npm run test:worker",
    "npm run test:query",
    "npm run test:file",
    "npm run test:sample",
    "npm run test:acceptance",
    "npm run test:acceptance:report",
    "npm run test:object-storage-live",
    "git diff --check"
  )

  foreach ($command in $requiredCommands) {
    if (-not $text.Contains($command)) {
      throw "Generated full acceptance report is missing command: $command"
    }
  }

  if ($text -match "mysql://root@") {
    throw "Generated full acceptance report must not include the raw MySQL connection string."
  }
}

$startedAt = Get-Date
$databaseUrl = ""
$objectStorageEndpoint = ""
$verdict = "FAIL"

try {
  $databaseUrl = Ensure-DockerMysql -ContainerName $MysqlContainerName -Port $MysqlPort -Database $MysqlDatabase
  $started = Start-LocalObjectStorage -Root $ProjectRoot -Bucket $ObjectStorageBucket -NodeExecutable $NodePath
  $ObjectStorageProcess = $started.Process
  $ObjectStorageLog = $started.LogPath
  $ObjectStorageErrorLog = $started.ErrorLogPath
  $objectStorageEndpoint = $started.Endpoint

  $env:EXPORT_PLATFORM_TEST_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $started.Endpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = $started.Bucket
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES = "true"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE = "true"
  $env:EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = [System.Guid]::NewGuid().ToString("N")

  Invoke-ReportCommand -Label "NPM high audit" -RequirementIds "FR-001 - FR-014" -Command "npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000"
  Invoke-ReportCommand -Label "Architecture gate" -RequirementIds "FR-001 - FR-014" -Command "npm run arch:check"
  Invoke-ReportCommand -Label "TypeScript typecheck" -RequirementIds "FR-001 - FR-014" -Command "npm run typecheck"
  Invoke-ReportCommand -Label "Contract tests" -RequirementIds "FR-001 - FR-014" -Command "npm run test:contract"
  Invoke-ReportCommand -Label "Base tests" -RequirementIds "FR-001 - FR-014" -Command "npm test"
  Invoke-ReportCommand -Label "OpenAPI lint" -RequirementIds "FR-001 - FR-014" -Command "npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml"
  Invoke-ReportCommand -Label "Mock/local evidence guards" -RequirementIds "FR-001 - FR-014" -Command "npm run test:mock-local"
  Invoke-ReportCommand -Label "API integration" -RequirementIds "FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013" -Command "npm run test:api"
  Invoke-ReportCommand -Label "DB integration" -RequirementIds "FR-001 / FR-005 / FR-007 / FR-010 / FR-013" -Command "npm run test:db"
  Invoke-ReportCommand -Label "Worker integration" -RequirementIds "FR-005 / FR-010 / FR-012 / FR-013" -Command "npm run test:worker"
  Invoke-ReportCommand -Label "Query executor" -RequirementIds "FR-006 / FR-008 / FR-009 / FR-014" -Command "npm run test:query"
  Invoke-ReportCommand -Label "File service" -RequirementIds "FR-003 / FR-006 / FR-009 / FR-011 / FR-014" -Command "npm run test:file"
  Invoke-ReportCommand -Label "Purchase-order sample" -RequirementIds "FR-014" -Command "npm run test:sample"
  Invoke-ReportCommand -Label "Acceptance matrix and API smoke" -RequirementIds "FR-001 - FR-014" -Command "npm run test:acceptance"
  Invoke-ReportCommand -Label "API smoke report" -RequirementIds "FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013" -Command "npm run test:acceptance:report"
  Invoke-ReportCommand -Label "Object storage docker/mock smoke" -RequirementIds "FR-003 / FR-006 / FR-011 / FR-014" -Command "npm run test:object-storage-live"
  Invoke-ReportCommand -Label "Scoped diff check" -RequirementIds "FR-001 - FR-014" -Command "git diff --check -- contracts task.json package.json tests/acceptance tests/arch-check.test.mjs tests/sample scripts docs/testing"

  $verdict = "PASS"
}
finally {
  $endedAt = Get-Date
  $report = New-ReportMarkdown -DatabaseUrl $databaseUrl -ObjectStorageEndpoint $objectStorageEndpoint -StartedAt $startedAt -EndedAt $endedAt -Verdict $verdict
  Set-Content -LiteralPath $ReportPath -Value $report -Encoding UTF8
  if ($verdict -eq "PASS") {
    Assert-GeneratedReport -Path $ReportPath
  }

  if ($null -ne $ObjectStorageProcess -and -not $ObjectStorageProcess.HasExited) {
    Stop-Process -Id $ObjectStorageProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($logPath in @($ObjectStorageLog, $ObjectStorageErrorLog)) {
    if ($null -ne $logPath -and (Test-Path -LiteralPath $logPath)) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }

  Write-Output "full acceptance report written: docs\testing\full-acceptance-test-report.md"
}

if ($verdict -ne "PASS") {
  exit 1
}
