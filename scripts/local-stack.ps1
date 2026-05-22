param(
  [string]$ProjectRoot = "",
  [string]$NodePath = "node",
  [int]$SeedRowCount = 10000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$EnvScript = Join-Path $ProjectRoot "scripts\docker-test-env.ps1"
$ServerScript = Join-Path $ProjectRoot "src\server.ts"
$SchedulerScript = Join-Path $ProjectRoot "src\workers\scheduler-worker.ts"
$CleanupScript = Join-Path $ProjectRoot "src\jobs\cleanup-job.ts"
$processes = @()
$logs = @()

function Start-BackgroundNodeProcess {
  param(
    [string]$ScriptPath,
    [string]$Label
  )

  $logPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-$Label-" + [System.Guid]::NewGuid().ToString("N") + ".log")
  $errPath = Join-Path ([System.IO.Path]::GetTempPath()) ("export-platform-$Label-" + [System.Guid]::NewGuid().ToString("N") + ".err.log")
  $process = Start-Process -FilePath $NodePath -ArgumentList @("--import", "tsx", $ScriptPath) -WorkingDirectory $ProjectRoot -RedirectStandardOutput $logPath -RedirectStandardError $errPath -PassThru -WindowStyle Hidden
  $script:processes += $process
  $script:logs += @($logPath, $errPath)
  return [pscustomobject]@{
    Process = $process
    LogPath = $logPath
    ErrorLogPath = $errPath
  }
}

try {
  . $EnvScript -SeedRowCount $SeedRowCount

  $server = Start-BackgroundNodeProcess -ScriptPath $ServerScript -Label "http"
  $scheduler = Start-BackgroundNodeProcess -ScriptPath $SchedulerScript -Label "scheduler"
  $cleanup = Start-BackgroundNodeProcess -ScriptPath $CleanupScript -Label "cleanup"

  Write-Output "local stack ready."
  Write-Output "HTTP: http://127.0.0.1:3000"
  Write-Output "Scheduler PID: $($scheduler.Process.Id)"
  Write-Output "Cleanup PID: $($cleanup.Process.Id)"
  Write-Output "Press Ctrl+C to stop."

  while ($true) {
    Start-Sleep -Seconds 5
    foreach ($proc in @($server.Process, $scheduler.Process, $cleanup.Process)) {
      if ($proc.HasExited) {
        throw "local stack process exited unexpectedly: PID=$($proc.Id)"
      }
    }
  }
}
finally {
  foreach ($proc in $processes) {
    if ($null -ne $proc -and -not $proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  }
  foreach ($logPath in $logs) {
    if ($null -ne $logPath -and (Test-Path -LiteralPath $logPath)) {
      Remove-Item -LiteralPath $logPath -Force -ErrorAction SilentlyContinue
    }
  }
}
