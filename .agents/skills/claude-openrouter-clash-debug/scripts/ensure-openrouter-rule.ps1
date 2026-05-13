param(
    [string]$GroupName = "AI-GitHub-HY2",
    [string]$TemplateRulePath = "C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles\rPQ84LOFBWXy.yaml",
    [string]$ActiveConfigPath = "C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml",
    [switch]$RestartMihomo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Backup-File {
    param([string]$Path)

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = "$Path.backup.$timestamp"
    Copy-Item -LiteralPath $Path -Destination $backupPath -Force
    return $backupPath
}

function Ensure-RuleLine {
    param(
        [string]$Path,
        [string]$RuleLine,
        [string]$AnchorLine,
        [string]$HeaderLine
    )

    $raw = Get-Content -Raw $Path
    if ($raw -match [regex]::Escape($RuleLine)) {
        return [pscustomobject]@{
            path = $Path
            changed = $false
            backup = $null
            reason = "already-present"
        }
    }

    $updated = $raw
    if ($raw -match [regex]::Escape($AnchorLine)) {
        $updated = $raw -replace [regex]::Escape($AnchorLine), ($RuleLine + "`r`n" + $AnchorLine)
    } elseif ($raw -match [regex]::Escape($HeaderLine)) {
        $updated = $raw -replace [regex]::Escape($HeaderLine), ($HeaderLine + "`r`n" + $RuleLine)
    } else {
        throw "Cannot find an insertion point in $Path"
    }

    $backup = Backup-File -Path $Path
    Set-Content -LiteralPath $Path -Value $updated -NoNewline

    return [pscustomobject]@{
        path = $Path
        changed = $true
        backup = $backup
        reason = "inserted"
    }
}

function Restart-MihomoProcess {
    $proc = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "verge-mihomo.exe" } | Select-Object -First 1
    if (-not $proc) {
        return [pscustomobject]@{
            restarted = $false
            reason = "verge-mihomo.exe not running"
        }
    }

    $commandMatch = [regex]::Match($proc.CommandLine, '^"[^"]+"\s*(.*)$')
    $argumentList = if ($commandMatch.Success) { $commandMatch.Groups[1].Value } else { "" }

    Stop-Process -Id $proc.ProcessId -Force
    Start-Sleep -Seconds 2
    Start-Process -FilePath $proc.ExecutablePath -ArgumentList $argumentList -WindowStyle Hidden
    Start-Sleep -Seconds 3

    $newProc = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "verge-mihomo.exe" } | Select-Object -First 1
    return [pscustomobject]@{
        restarted = $true
        processId = if ($newProc) { $newProc.ProcessId } else { $null }
    }
}

$templateRule = "  - DOMAIN-SUFFIX,openrouter.ai,$GroupName"
$templateAnchor = "  - DOMAIN-SUFFIX,openai.com,$GroupName"
$activeRule = "- DOMAIN-SUFFIX,openrouter.ai,$GroupName"
$activeAnchor = "- DOMAIN-SUFFIX,openai.com,$GroupName"

$templateResult = Ensure-RuleLine -Path $TemplateRulePath -RuleLine $templateRule -AnchorLine $templateAnchor -HeaderLine "prepend:"
$activeResult = Ensure-RuleLine -Path $ActiveConfigPath -RuleLine $activeRule -AnchorLine $activeAnchor -HeaderLine "rules:"

$restartResult = $null
if ($RestartMihomo) {
    $restartResult = Restart-MihomoProcess
}

[pscustomobject]@{
    timestamp = (Get-Date).ToString("s")
    groupName = $GroupName
    template = $templateResult
    active = $activeResult
    restart = $restartResult
} | ConvertTo-Json -Depth 6
