param(
  [switch]$Up,
  [switch]$Down,
  [switch]$CheckOnly,
  [string]$ComposeFile = "docker-compose.integration.yml",
  [string]$ProjectRoot = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$MinioSmokeScript = Join-Path $ProjectRoot "scripts\minio-live-smoke.mjs"

function Invoke-Compose {
  param([string[]]$Arguments)

  Push-Location $ProjectRoot
  try {
    & docker compose -f $ComposeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose failed: $($Arguments -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Wait-HttpHealth {
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-RestMethod "http://127.0.0.1:43000/health"
      if ($response.status -eq "ok") {
        return
      }
    }
    catch {
    }
    Start-Sleep -Seconds 2
  }

  throw "BLOCKED - 需要人工介入: integration stack HTTP health check timeout."
}

function Wait-MinioReady {
  $deadline = (Get-Date).AddMinutes(2)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:49000/minio/health/live" | Out-Null
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = "http://127.0.0.1:49000"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = "export-platform-integration"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_REGION = "us-east-1"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_ACCESS_KEY_ID = "export-platform"
      $env:EXPORT_PLATFORM_OBJECT_STORAGE_SECRET_ACCESS_KEY = "export-platform-secret"
      & node --import tsx $MinioSmokeScript | Out-Null
      if ($LASTEXITCODE -eq 0) {
        return
      }
    }
    catch {
    }
    Start-Sleep -Seconds 2
  }

  throw "BLOCKED - 需要人工介入: integration stack MinIO health check timeout."
}

if ($CheckOnly) {
  Invoke-Compose @("config")
  exit 0
}

if ($Down) {
  Invoke-Compose @("down", "-v")
  exit 0
}

if ($Up) {
  Invoke-Compose @("up", "-d", "--build")
  Wait-MinioReady
  Wait-HttpHealth
  Write-Output "integration stack ready."
  exit 0
}

throw "Specify -Up, -Down, or -CheckOnly."
