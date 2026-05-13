# Windows Claude OpenRouter Clash Playbook

## Verified Incident

Date: `2026-05-03`

Symptom:

```text
Please run /login · API Error: 403
{"error":{"message":"This model is not available in your region.","code":403}}
```

What was true on this machine:

- `C:\Users\pzy666\.claude\settings.json` pointed `ANTHROPIC_BASE_URL` to OpenRouter.
- The OpenRouter key initially lived in `ANTHROPIC_API_KEY` instead of `ANTHROPIC_AUTH_TOKEN`.
- The dedicated Hysteria node at `127.0.0.1:1082` exited in `JP` as `207.148.115.43`.
- The generic Clash mixed-port path at `127.0.0.1:7897` still exited in `HK` as `192.142.4.97`.
- `anthropic.com` and `claude.ai` already had explicit rules, but `openrouter.ai` did not.
- `openrouter.ai` therefore fell through to `MATCH,狗狗加速.com`, whose selected group was a Hong Kong node.

## Known-Good Fix

1. In `C:\Users\pzy666\.claude\settings.json`:
   - Keep `ANTHROPIC_BASE_URL=https://openrouter.ai/api`
   - Move the OpenRouter key to `ANTHROPIC_AUTH_TOKEN`
   - Blank `ANTHROPIC_API_KEY`
2. Add `DOMAIN-SUFFIX,openrouter.ai,AI-GitHub-HY2` to:
   - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles\rPQ84LOFBWXy.yaml`
   - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml`
3. Restart `verge-mihomo`
4. Re-probe OpenRouter and then run `claude -p`

Expected result after the fix:

- OpenRouter returns `200 OK`
- `CF-RAY` often ends with `NRT`
- `claude -p "Reply with ok." --output-format json` succeeds

## Important Paths

- Claude settings:
  - `C:\Users\pzy666\.claude\settings.json`
- Clash Verge state:
  - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles.yaml`
  - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles\rPQ84LOFBWXy.yaml`
  - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml`
- Local Hysteria JP client:
  - `C:\Users\pzy666\AppData\Roaming\hysteria\config-jp.yaml`

## Command Checklist

Inspect Claude auth mode:

```powershell
claude auth status
```

Inspect direct or TUN egress:

```powershell
curl.exe -s https://ipinfo.io/json
```

Inspect Clash mixed-port egress:

```powershell
curl.exe -s --proxy http://127.0.0.1:7897 https://ipinfo.io/json
```

Inspect dedicated JP Hysteria egress:

```powershell
curl.exe -s --socks5-hostname 127.0.0.1:1082 https://ipinfo.io/json
```

Probe OpenRouter through Clash mixed-port:

```powershell
curl.exe -sS --proxy http://127.0.0.1:7897 -D - -X POST https://openrouter.ai/api/v1/chat/completions ...
```

Probe OpenRouter through the dedicated JP Hysteria SOCKS node:

```powershell
curl.exe -sS --socks5-hostname 127.0.0.1:1082 -D - -X POST https://openrouter.ai/api/v1/chat/completions ...
```

## Interpretation Rules

- If the JP SOCKS node shows `JP` but the generic mixed-port path shows `HK`, the server is not the problem; the route selection is.
- If `openrouter.ai` has no explicit rule, expect it to fall through to the default group.
- If OpenRouter succeeds through the dedicated JP SOCKS node but fails through the mixed-port path, fix the Clash rule before changing providers or rotating keys.
