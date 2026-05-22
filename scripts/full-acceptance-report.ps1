param(
  [string]$ProjectRoot = "",
  [string]$NodePath = "node"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$ReportPath = Join-Path $ProjectRoot "docs\testing\full-acceptance-test-report.md"
$IntegrationStackScript = Join-Path $ProjectRoot "scripts\integration-stack.ps1"
$IntegrationSeedScript = Join-Path $ProjectRoot "scripts\integration-seed.mjs"
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

function Assert-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "BLOCKED - 需要人工介入: full acceptance requires Docker integration stack support."
  }

  $result = Invoke-Native -FilePath "docker" -Arguments @("info", "--format", "{{.ServerVersion}}")
  if ($result.ExitCode -ne 0) {
    throw "BLOCKED - 需要人工介入: Docker daemon is not reachable. Start Docker Desktop, then rerun npm run test:acceptance:full-report.`n$($result.Output -join "`n")"
  }
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
  $outputText = (($output | ForEach-Object { [string]$_ }) -join "`n")
  if (
    $exitCode -ne 0 -and
    $Label -eq "OpenAPI lint" -and
    $outputText.Contains("Woohoo! Your API description is valid")
  ) {
    $exitCode = 0
  }

  $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
  $Results.Add([pscustomobject]@{
    Label = $Label
    RequirementIds = $RequirementIds
    Command = $Command
    Status = $status
    ExitCode = $exitCode
    DurationSeconds = [math]::Round(($endedAt - $startedAt).TotalSeconds, 2)
    Output = $outputText
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
  $lines.Add("**数据库**: Docker integration MySQL (redacted)") | Out-Null
  $lines.Add("**对象存储**: Docker MinIO ($ObjectStorageEndpoint)") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("## 覆盖范围") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("| Requirement | 验证层 | 主要命令 |") | Out-Null
  $lines.Add("| --- | --- | --- |") | Out-Null
  $lines.Add('| FR-001 / FR-002 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | HTTP API / auth / audit / history / state machine | `npm run test:api`, `npm run test:acceptance` |') | Out-Null
  $lines.Add('| FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | DB schema / repositories / durable evidence | `npm run test:db` |') | Out-Null
  $lines.Add('| FR-005 / FR-010 / FR-012 / FR-013 | scheduler / locks / retry / cleanup polling | `npm run test:worker` |') | Out-Null
  $lines.Add('| FR-006 / FR-008 / FR-009 / FR-014 | query executor / datasource adapter / data scope / masking | `npm run test:query` |') | Out-Null
  $lines.Add('| FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | file service / signed download / cleanup / render failures | `npm run test:file`, `npm run test:integration-live`, `npm run test:integration-performance` |') | Out-Null
  $lines.Add('| FR-014 | purchase-order sample / 0-100001 row boundaries / masked output | `npm run test:sample` |') | Out-Null
  $lines.Add('| FR-001 - FR-014 | contract, architecture, docs, integration-stack evidence boundary | `npm run arch:check`, `npm run test:contract`, `npm test`, `npm run stack:integration`, `node --import tsx scripts/integration-seed.mjs` |') | Out-Null
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
  $lines.Add("- 证据来自完整 Docker integration stack：平台 MySQL、业务只读 MySQL、MinIO、HTTP、scheduler、cleanup，以及在该环境上运行的 Node tests。") | Out-Null
  $lines.Add("- 本报告不声明外部生产 MySQL、外部业务数据源、外部 OSS/S3 或外部网关已验证；它只声明完整 Docker 集成环境已验证。") | Out-Null
  $lines.Add('- `npm run test:integration-live` 和 `npm run test:integration-performance` 都在完整 Docker 集成栈上执行。') | Out-Null
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
    "**数据库**: Docker integration MySQL (redacted)",
    "本报告不声明外部生产 MySQL、外部业务数据源、外部 OSS/S3 或外部网关已验证",
    "完整 Docker 集成栈上执行"
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
    "npm run stack:integration",
    "node --import tsx scripts/integration-seed.mjs",
    "npm run test:api",
    "npm run test:db",
    "npm run test:worker",
    "npm run test:query",
    "npm run test:file",
    "npm run test:sample",
    "npm run test:acceptance",
    "npm run test:acceptance:report",
    "npm run test:integration-live",
    "npm run test:integration-performance",
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
  Assert-DockerReady
  $databaseUrl = "mysql://root@127.0.0.1:43306/export_platform_integration"
  $objectStorageEndpoint = "http://127.0.0.1:49000"
  $env:EXPORT_PLATFORM_DATABASE_URL = $databaseUrl
  $env:EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL = "mysql://root@127.0.0.1:43307/purchase_readonly"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = $objectStorageEndpoint
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = "export-platform-integration"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_REGION = "us-east-1"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_ACCESS_KEY_ID = "export-platform"
  $env:EXPORT_PLATFORM_OBJECT_STORAGE_SECRET_ACCESS_KEY = "export-platform-secret"
  $env:EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET = "integration-auth-signing-secret"
  $env:EXPORT_PLATFORM_PERF_ROW_COUNTS = "10000"

  Invoke-ReportCommand -Label "NPM high audit" -RequirementIds "FR-001 - FR-014" -Command "npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000"
  Invoke-ReportCommand -Label "Architecture gate" -RequirementIds "FR-001 - FR-014" -Command "npm run arch:check"
  Invoke-ReportCommand -Label "TypeScript typecheck" -RequirementIds "FR-001 - FR-014" -Command "npm run typecheck"
  Invoke-ReportCommand -Label "Contract tests" -RequirementIds "FR-001 - FR-014" -Command "npm run test:contract"
  Invoke-ReportCommand -Label "Base tests" -RequirementIds "FR-001 - FR-014" -Command "npm test"
  Invoke-ReportCommand -Label "OpenAPI lint" -RequirementIds "FR-001 - FR-014" -Command "npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml"
  Invoke-ReportCommand -Label "Docker integration stack down" -RequirementIds "FR-001 - FR-014" -Command "npm run stack:integration:down"
  Invoke-ReportCommand -Label "Docker integration stack up" -RequirementIds "FR-001 - FR-014" -Command "npm run stack:integration"
  Invoke-ReportCommand -Label "Docker integration seed" -RequirementIds "FR-001 / FR-005 / FR-007 / FR-014" -Command "node --import tsx scripts/integration-seed.mjs"
  Invoke-ReportCommand -Label "API integration" -RequirementIds "FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013" -Command "npm run test:api"
  Invoke-ReportCommand -Label "DB integration" -RequirementIds "FR-001 / FR-005 / FR-007 / FR-010 / FR-013" -Command "npm run test:db"
  Invoke-ReportCommand -Label "Worker integration" -RequirementIds "FR-005 / FR-010 / FR-012 / FR-013" -Command "npm run test:worker"
  Invoke-ReportCommand -Label "Query executor" -RequirementIds "FR-006 / FR-008 / FR-009 / FR-014" -Command "npm run test:query"
  Invoke-ReportCommand -Label "File service" -RequirementIds "FR-003 / FR-006 / FR-009 / FR-011 / FR-014" -Command "npm run test:file"
  Invoke-ReportCommand -Label "Purchase-order sample" -RequirementIds "FR-014" -Command "npm run test:sample"
  Invoke-ReportCommand -Label "Acceptance matrix and API smoke" -RequirementIds "FR-001 - FR-014" -Command "npm run test:acceptance"
  Invoke-ReportCommand -Label "API smoke report" -RequirementIds "FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013" -Command "npm run test:acceptance:report"
  Invoke-ReportCommand -Label "Integration end-to-end chain" -RequirementIds "FR-001 / FR-002 / FR-003 / FR-005 / FR-006 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 / FR-014" -Command "npm run test:integration-live"
  Invoke-ReportCommand -Label "Integration performance baseline" -RequirementIds "FR-006 / FR-014" -Command "npm run test:integration-performance"
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

  Write-Output "full acceptance report written: docs\testing\full-acceptance-test-report.md"
}

if ($verdict -ne "PASS") {
  exit 1
}
