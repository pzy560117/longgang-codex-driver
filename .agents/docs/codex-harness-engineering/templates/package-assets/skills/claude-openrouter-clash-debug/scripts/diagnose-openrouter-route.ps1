param(
    [string]$ClaudeSettingsPath = "C:\Users\pzy666\.claude\settings.json",
    [string]$ClashProfilesPath = "C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles.yaml",
    [string]$ClashConfigPath = "C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml",
    [string]$HysteriaConfigPath = "C:\Users\pzy666\AppData\Roaming\hysteria\config-jp.yaml",
    [string]$MixedProxy = "http://127.0.0.1:7897",
    [string]$SocksProxy = "127.0.0.1:1082",
    [string]$Model = "anthropic/claude-sonnet-4.6",
    [switch]$SkipApiProbe
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-JsonProbe {
    param(
        [string]$Uri,
        [ValidateSet("direct", "proxy", "socks5")]
        [string]$Mode = "direct",
        [string]$Proxy
    )

    $args = @("-sS")
    switch ($Mode) {
        "proxy" {
            if ($Proxy) {
                $args += @("--proxy", $Proxy)
            }
        }
        "socks5" {
            if ($Proxy) {
                $args += @("--socks5-hostname", $Proxy)
            }
        }
    }
    $args += $Uri

    try {
        $raw = & curl.exe @args 2>$null
        if (-not $raw) {
            return $null
        }
        return $raw | ConvertFrom-Json
    } catch {
        return [pscustomobject]@{
            error = $_.Exception.Message
            mode = $Mode
            proxy = $Proxy
        }
    }
}

function Invoke-OpenRouterProbe {
    param(
        [ValidateSet("proxy", "socks5")]
        [string]$Mode,
        [string]$Proxy,
        [string]$Token,
        [string]$ModelId
    )

    if (-not $Token) {
        return [pscustomobject]@{
            mode = $Mode
            proxy = $Proxy
            skipped = $true
            reason = "Missing OpenRouter token"
        }
    }

    $headersFile = New-TemporaryFile
    $bodyFile = New-TemporaryFile
    $payloadFile = New-TemporaryFile

    try {
        @{
            model = $ModelId
            messages = @(
                @{
                    role = "user"
                    content = "Reply with ok."
                }
            )
            max_tokens = 8
        } | ConvertTo-Json -Depth 6 | Set-Content -NoNewline $payloadFile

        $args = @("-sS")
        switch ($Mode) {
            "proxy" { $args += @("--proxy", $Proxy) }
            "socks5" { $args += @("--socks5-hostname", $Proxy) }
        }
        $args += @(
            "-o", $bodyFile,
            "-D", $headersFile,
            "-X", "POST",
            "https://openrouter.ai/api/v1/chat/completions",
            "-H", "Authorization: Bearer $Token",
            "-H", "Content-Type: application/json",
            "--data-binary", "@$payloadFile"
        )

        & curl.exe @args | Out-Null

        $headers = Get-Content -Raw $headersFile
        $bodyText = Get-Content -Raw $bodyFile
        $statusMatches = [regex]::Matches($headers, "HTTP/\d(?:\.\d)?\s+(\d{3})")
        $statusCode = if ($statusMatches.Count -gt 0) {
            [int]$statusMatches[$statusMatches.Count - 1].Groups[1].Value
        } else {
            $null
        }
        $cfRayMatch = [regex]::Match($headers, "(?im)^CF-RAY:\s*([^\r\n]+)")
        $cfRay = if ($cfRayMatch.Success) { $cfRayMatch.Groups[1].Value.Trim() } else { $null }

        $bodyJson = $null
        try {
            $bodyJson = $bodyText | ConvertFrom-Json
        } catch {
            $bodyJson = $bodyText.Trim()
        }

        return [pscustomobject]@{
            mode = $Mode
            proxy = $Proxy
            statusCode = $statusCode
            cfRay = $cfRay
            body = $bodyJson
        }
    } catch {
        return [pscustomobject]@{
            mode = $Mode
            proxy = $Proxy
            error = $_.Exception.Message
        }
    } finally {
        Remove-Item $headersFile, $bodyFile, $payloadFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-SelectedGroup {
    param(
        [string]$Path,
        [string]$GroupName
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $content = Get-Content -Raw $Path
    $pattern = "(?ms)- name:\s*" + [regex]::Escape($GroupName) + "\s*\r?\n\s*now:\s*(.+?)\r?$"
    $match = [regex]::Match($content, $pattern)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }

    return $null
}

function Get-HysteriaFacts {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $null
    }

    $content = Get-Content -Raw $Path
    $serverMatch = [regex]::Match($content, "(?m)^server:\s*(.+)$")
    $socksMatch = [regex]::Match($content, "(?m)^\s*listen:\s*([0-9\.]+:\d+)$")

    return [pscustomobject]@{
        configPath = $Path
        server = if ($serverMatch.Success) { $serverMatch.Groups[1].Value.Trim() } else { $null }
        socksListen = if ($socksMatch.Success) { $socksMatch.Groups[1].Value.Trim() } else { $null }
    }
}

$settings = $null
if (Test-Path $ClaudeSettingsPath) {
    $settings = Get-Content -Raw $ClaudeSettingsPath | ConvertFrom-Json
}

$openRouterToken = $null
if ($settings -and $settings.env) {
    if ($settings.env.ANTHROPIC_AUTH_TOKEN) {
        $openRouterToken = [string]$settings.env.ANTHROPIC_AUTH_TOKEN
    } elseif ($settings.env.ANTHROPIC_API_KEY) {
        $openRouterToken = [string]$settings.env.ANTHROPIC_API_KEY
    }
}

$claudeAuth = $null
try {
    $claudeAuth = (& claude auth status 2>$null) | ConvertFrom-Json
} catch {
    $claudeAuth = [pscustomobject]@{
        error = $_.Exception.Message
    }
}

$geoDirect = Get-JsonProbe -Uri "https://ipinfo.io/json" -Mode "direct"
$geoMixed = Get-JsonProbe -Uri "https://ipinfo.io/json" -Mode "proxy" -Proxy $MixedProxy
$geoSocks = Get-JsonProbe -Uri "https://ipinfo.io/json" -Mode "socks5" -Proxy $SocksProxy

$openrouterRulePresent = $false
if (Test-Path $ClashConfigPath) {
    $openrouterRulePresent = (Get-Content -Raw $ClashConfigPath) -match "DOMAIN-SUFFIX,openrouter\.ai,"
}

$apiMixed = $null
$apiSocks = $null
if (-not $SkipApiProbe) {
    $apiMixed = Invoke-OpenRouterProbe -Mode "proxy" -Proxy $MixedProxy -Token $openRouterToken -ModelId $Model
    $apiSocks = Invoke-OpenRouterProbe -Mode "socks5" -Proxy $SocksProxy -Token $openRouterToken -ModelId $Model
}

$findings = New-Object System.Collections.Generic.List[string]

if ($settings -and $settings.env.ANTHROPIC_BASE_URL -eq "https://openrouter.ai/api") {
    if (-not $settings.env.ANTHROPIC_AUTH_TOKEN) {
        $findings.Add("OpenRouter base URL is set but ANTHROPIC_AUTH_TOKEN is missing.")
    }
    if ($settings.env.ANTHROPIC_API_KEY) {
        $findings.Add("ANTHROPIC_API_KEY is still populated. Prefer ANTHROPIC_AUTH_TOKEN and blank ANTHROPIC_API_KEY for this OpenRouter path.")
    }
}

if ($geoMixed -and $geoSocks -and $geoMixed.country -and $geoSocks.country -and $geoMixed.country -ne $geoSocks.country) {
    if (-not $openrouterRulePresent) {
        $findings.Add("Clash mixed-port egress differs from the dedicated SOCKS node and openrouter.ai has no explicit rule. Expect region mismatch failures.")
    } else {
        $findings.Add("Generic Clash mixed-port egress differs from the dedicated SOCKS node. This is acceptable only when openrouter.ai has an explicit rule to the intended AI group.")
    }
}

if (-not $openrouterRulePresent) {
    $findings.Add("openrouter.ai has no explicit Clash rule and may be falling through to MATCH.")
}

if ($apiMixed -and $apiMixed.statusCode -eq 403 -and $apiSocks -and $apiSocks.statusCode -eq 200) {
    $findings.Add("OpenRouter works through the dedicated SOCKS node but fails through Clash mixed-port. Fix the Clash rule or selected group.")
}

if ($apiMixed -and $apiMixed.statusCode -eq 200) {
    $findings.Add("OpenRouter probe through Clash mixed-port is healthy.")
}

$result = [pscustomobject]@{
    timestamp = (Get-Date).ToString("s")
    claudeSettings = [pscustomobject]@{
        path = $ClaudeSettingsPath
        anthropicBaseUrl = if ($settings) { $settings.env.ANTHROPIC_BASE_URL } else { $null }
        anthropicModel = if ($settings) { $settings.env.ANTHROPIC_MODEL } else { $null }
        hasAuthToken = if ($settings -and $settings.env.ANTHROPIC_AUTH_TOKEN) { $true } else { $false }
        apiKeyBlank = if ($settings -and $settings.env.ANTHROPIC_API_KEY -eq "") { $true } else { $false }
    }
    claudeAuthStatus = $claudeAuth
    selectedGroups = [pscustomobject]@{
        aiGithubHy2 = Get-SelectedGroup -Path $ClashProfilesPath -GroupName "AI-GitHub-HY2"
        chatgpt = Get-SelectedGroup -Path $ClashProfilesPath -GroupName "🔥ChatGPT"
        defaultGroup = Get-SelectedGroup -Path $ClashProfilesPath -GroupName "狗狗加速.com"
    }
    clash = [pscustomobject]@{
        profilesPath = $ClashProfilesPath
        configPath = $ClashConfigPath
        mixedProxy = $MixedProxy
        openrouterRulePresent = $openrouterRulePresent
    }
    hysteria = Get-HysteriaFacts -Path $HysteriaConfigPath
    geolocation = [pscustomobject]@{
        direct = $geoDirect
        mixedProxy = $geoMixed
        dedicatedSocks = $geoSocks
    }
    openrouterProbe = [pscustomobject]@{
        mixedProxy = $apiMixed
        dedicatedSocks = $apiSocks
    }
    findings = $findings
}

$result | ConvertTo-Json -Depth 8
