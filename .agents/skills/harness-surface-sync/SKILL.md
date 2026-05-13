---
name: harness-surface-sync
description: Audit and propagate Codex Harness repository changes across root runtime, docs/testing, templates, workflows, config, package-assets, skills, and `.agents` mirrors. Use when rules, prompts, task templates, testing-left-shift truth sources, install docs, or package docs changed and the repo must be checked end-to-end, stale wording fixed, and mirrors re-synced in one pass.
---

# Harness Surface Sync

## Overview

Use this skill to do a full-surface consistency pass on this harness repo after workflow, rule, template, or testing-left-shift changes.

Default goal:

1. Find stale wording or missing propagation.
2. Update the correct canonical source first.
3. Sync mirrored copies across `agent/`, templates, `package-assets/`, and `.agents`.
4. Validate diffs, JSON, PowerShell syntax, and mirror hashes.

Read [references/current-repo-sync-matrix.md](references/current-repo-sync-matrix.md) before editing.
Use [references/stale-patterns.md](references/stale-patterns.md) as the scan checklist.

## When To Use

Use this skill when the user asks to:

- continue syncing harness/template changes
- check whether old process wording still exists
- propagate runtime or doc changes into templates/package assets
- align `docs/testing/*`, `task` flow, `Stage 17`, or testing-left-shift behavior everywhere
- package a new repo-local skill so installed projects inherit it too

Do not use this skill for normal feature work inside an app repo.

## Canonical Source Rules

- For root runtime and root truth sources actually consumed by the driver, prefer repo-root files as canonical.
- For human-facing harness/package docs, prefer `agent/docs/codex-harness-engineering/*.md` as canonical.
- For template config, workflows, and package-assets content, prefer `agent/docs/codex-harness-engineering/templates/...` as canonical, then mirror to `.agents/docs/.../templates/...`.
- For active repo skills, prefer `.agents/skills/<skill-name>` as canonical, then mirror into `agent/skills/<skill-name>` and both package-assets skill trees.
- For active role rules, prefer `.agents/rules/agents.md` as canonical unless the user explicitly says otherwise.

## Workflow

### 1. Snapshot the workspace

- Run `git status --short` first.
- Identify unrelated dirty files and avoid touching them.
- Decide whether the request is:
  - audit only
  - fix and sync
  - create/update a reusable skill and distribute it

### 2. Build the truth-source stack

Read only the surfaces relevant to the requested change. Typical order:

1. Root runtime and truth sources:
   - `AGENTS.md`
   - `bootstrap-codex-harness.ps1`
   - `codex-loop.ps1`
   - `doctor.ps1`
   - `verify.ps1`
   - `.codex/task-run-profile.json`
   - `.codex/prompts/*.md`
   - `project-task-template.json`
   - `docs/harness/*`
   - `docs/testing/*`
2. Active package/runtime mirrors:
   - `agent/*`
   - `.agents/*`
   - `agent/docs/harness/*`
   - `agent/docs/codex-harness-engineering/*`
3. Template and distribution surfaces:
   - `agent/docs/codex-harness-engineering/templates/runtime/*`
   - `agent/docs/codex-harness-engineering/templates/docs/*`
   - `agent/docs/codex-harness-engineering/templates/testing/*`
   - `agent/docs/codex-harness-engineering/templates/config/*`
   - `agent/docs/codex-harness-engineering/templates/package-assets/*`
   - `.agents/docs/codex-harness-engineering/templates/...`
4. Skills when relevant:
   - `.agents/skills/<name>`
   - `agent/skills/<name>`
   - `agent/docs/codex-harness-engineering/templates/package-assets/skills/<name>`
   - `.agents/docs/codex-harness-engineering/templates/package-assets/skills/<name>`

### 3. Scan for stale signals

Use `rg` against likely surfaces before opening many files.

Common scan target groups:

- `agent/docs/codex-harness-engineering`
- `agent/docs/harness`
- `agent/docs/codex-harness-engineering/templates`
- `.agents/docs/codex-harness-engineering/templates`
- `docs/project-flow` when analysis docs must stay aligned

Start from the patterns in [references/stale-patterns.md](references/stale-patterns.md).

### 4. Update canonical files first

- Edit the real source first with `apply_patch`.
- Keep edits narrow and repository-aware.
- Do not “fix” every mention of a keyword blindly; verify the sentence is actually stale.
- If only wording changed, do not touch runtime scripts.
- If runtime behavior changed, update the driver-facing root file first, then the mirrors.

### 5. Propagate mirrors

After canonical edits, copy the exact file to all mapped destinations from the sync matrix.

Typical propagation pattern:

- root canonical -> `agent/` + `.agents/` + template runtime mirrors
- `docs/harness/*` / `docs/testing/*` canonical -> template docs/testing mirrors and any package docs that summarize them
- `agent/docs/codex-harness-engineering/*.md` canonical -> package-assets docs mirrors
- `agent/docs/.../templates/config|workflows|root/*` canonical -> `.agents/docs/.../templates/...`
- `.agents/skills/<name>` canonical -> `agent/skills/<name>` + both package-assets skill trees

### 6. Validate

Run the smallest useful validation set for the touched files:

- Diff quality:

```powershell
git diff --check -- <touched files>
```

- JSON parse:

```powershell
Get-Content <file>.json -Raw | ConvertFrom-Json | Out-Null
```

- PowerShell syntax:

```powershell
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path <file>.ps1), [ref]$null, [ref]$null) | Out-Null
```

- Mirror hash compare:

```powershell
(Get-FileHash <left>).Hash -eq (Get-FileHash <right>).Hash
```

Prefer validating only the touched surfaces, not the whole repo.

### 7. Report

Always summarize:

- canonical files changed
- mirrors updated
- validations run
- remaining stale areas or intentionally skipped surfaces

## Current Repo Conventions

For this repo, testing-left-shift means implementation-facing flows should normally reference:

- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/TEST_STRATEGY.md`
- `docs/testing/TEST_DATA_MATRIX.md`
- `docs/testing/RISK_BASED_TEST_PLAN.md`
- `docs/testing/REGRESSION_PLAN.md`
- `docs/testing/EVIDENCE_PROTOCOL.md`
- `docs/testing/test-matrix.md`
- `docs/testing/verify-matrix.md`

Stage 17 / Verify should be described as:

- fresh evidence
- affected tests
- P0/P1 regression
- contract / E2E / visual confirmation when applicable

It should not be described as the first place to define missing test scope.

## Guardrails

- Never revert unrelated user changes.
- Never assume all duplicated files should be edited independently; pick the canonical source first.
- When creating or updating a skill, ship it through the package duplication chain before closing the task.
- If the request is review-only, stop after findings and do not sync files.
