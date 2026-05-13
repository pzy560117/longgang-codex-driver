---
name: claude-openrouter-clash-debug
description: Diagnose Claude Code failures on Windows when OpenRouter, Clash Verge, and a local Hysteria/SOCKS node disagree about the real egress region or auth path. Use when Claude Code returns `403 This model is not available in your region`, when `ANTHROPIC_BASE_URL` points to OpenRouter, when a node label says Japan but external services still see Hong Kong or another region, or when `openrouter.ai`, `anthropic.com`, and `claude.ai` need explicit Clash routing and validation.
---

# Claude OpenRouter Clash Debug

## Overview

Use this skill to debug the full Claude Code -> OpenRouter -> Clash Verge -> local Hysteria route on this Windows machine.
Prefer the bundled scripts for repeated checks; use the reference playbook when you need the exact files, commands, and the known-good 2026-05-03 fix.

## Quick Start

1. Run the diagnostic script:

```powershell
powershell -ExecutionPolicy Bypass -File .\.agents\skills\claude-openrouter-clash-debug\scripts\diagnose-openrouter-route.ps1
```

2. If the output says `openrouter.ai` is missing an explicit Clash rule, add it:

```powershell
powershell -ExecutionPolicy Bypass -File .\.agents\skills\claude-openrouter-clash-debug\scripts\ensure-openrouter-rule.ps1 -GroupName AI-GitHub-HY2 -RestartMihomo
```

3. Re-run the diagnostic script.

4. Confirm Claude Code itself works:

```powershell
claude -p "Reply with ok." --output-format json
```

## Workflow

### 1. Validate Claude/OpenRouter auth mapping

- Read `C:\Users\pzy666\.claude\settings.json`.
- When `ANTHROPIC_BASE_URL` is `https://openrouter.ai/api`, the OpenRouter key should live in `ANTHROPIC_AUTH_TOKEN`.
- Blank `ANTHROPIC_API_KEY` for this path. If the key remains there, Claude Code often stays on the wrong auth mode.
- Check `claude auth status` before changing network rules.

### 2. Compare the three egress layers

- Direct or TUN egress: what the machine exposes by default.
- Clash mixed-port egress: what flows through `127.0.0.1:7897`.
- Dedicated Hysteria SOCKS egress: what the JP node at `127.0.0.1:1082` exposes.
- If the dedicated SOCKS node is `JP` but the mixed port or default path is `HK`, the server is fine and Clash routing is the likely problem.

### 3. Inspect Clash group and rule selection

- Find the group used by `openai.com` or the intended AI traffic.
- In this machine's verified case, `openai.com` routes through `AI-GitHub-HY2`.
- If `openrouter.ai` has no explicit rule, it will usually fall through to `MATCH`.
- Read the selected groups in `profiles.yaml` before changing anything.

### 4. Apply the narrow fix first

- Update the rules template and the active generated config together:
  - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\profiles\rPQ84LOFBWXy.yaml`
  - `C:\Users\pzy666\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev\clash-verge.yaml`
- Add:

```text
DOMAIN-SUFFIX,openrouter.ai,<target-group>
```

- Prefer reusing the same group that already carries `openai.com`.
- Reload or restart `verge-mihomo` after the edit.

### 5. Validate the actual OpenRouter path

- Probe `https://openrouter.ai/api/v1/chat/completions`.
- A healthy fix changes the response from `403 region` to `200 OK`.
- A Japan POP often shows `CF-RAY: ...-NRT` after the fix, but trust the status code first.
- Only after the API probe succeeds should you spend Claude Code tokens on `claude -p`.

## Resources

- `scripts/diagnose-openrouter-route.ps1`
  - Reads Claude/OpenRouter settings.
  - Compares direct, Clash mixed-port, and dedicated SOCKS geolocation.
  - Checks whether `openrouter.ai` has an explicit rule.
  - Probes OpenRouter through Clash mixed-port and the dedicated SOCKS node.

- `scripts/ensure-openrouter-rule.ps1`
  - Adds `DOMAIN-SUFFIX,openrouter.ai,<group>` to the rules template and active generated config.
  - Makes timestamped backups before edits.
  - Can restart `verge-mihomo` in place.

- `references/windows-openrouter-clash-playbook.md`
  - Contains the verified 2026-05-03 incident, machine paths, command checklist, and expected results.

## Guardrails

- Back up `settings.json`, `rPQ84LOFBWXy.yaml`, and `clash-verge.yaml` before edits.
- Do not trust node labels such as `jp`; trust GeoIP and API probes.
- Do not widen the default `MATCH` group before trying the narrow `openrouter.ai` rule.
- If `claude auth status` is still in API key mode after switching to OpenRouter, fix auth mapping before changing proxy groups.
