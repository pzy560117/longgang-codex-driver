# view-allure.ps1
# 快速查看指定运行目录的 Allure 报告

param(
    [Parameter(Mandatory=$true, HelpMessage="运行目录名称，例如: 2026-01-23_14-13-21-8ufgvd3i")]
    [string]$RunDir,
    
    [Parameter(Mandatory=$false, HelpMessage="可选：指定端口号")]
    [int]$Port = 0
)

$allureResultsPath = "midscene_run/$RunDir/allure-results"

if (-not (Test-Path $allureResultsPath)) {
    Write-Error "❌ Allure results not found: $allureResultsPath"
    Write-Host "Available run directories:" -ForegroundColor Yellow
    Get-ChildItem -Path "midscene_run" -Directory | Select-Object -First 10 Name | ForEach-Object { Write-Host "  - $($_.Name)" }
    exit 1
}

Write-Host "📊 Opening Allure report for: $RunDir" -ForegroundColor Green
Write-Host "📁 Results path: $allureResultsPath" -ForegroundColor Cyan

if ($Port -gt 0) {
    npx allure serve $allureResultsPath --port $Port
} else {
    npx allure serve $allureResultsPath
}
