# Current Repo Sync Matrix

Use this matrix to decide where the real edit belongs and which copies must be refreshed afterwards.

## 1. Root Runtime And Driver Truth Sources

Canonical source:

- repo root:
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

Typical mirrors:

- `agent/*`
- `.agents/*`
- `agent/docs/codex-harness-engineering/templates/runtime/*`
- `.agents/docs/codex-harness-engineering/templates/runtime/*`
- `agent/docs/codex-harness-engineering/templates/docs/*` or `templates/testing/*` when the source is under `docs/harness/*` or `docs/testing/*`

## 2. Active Role Rules

Canonical source:

- `.agents/rules/agents.md`

Typical mirrors:

- `agent/rules/agents.md`
- `agent/docs/codex-harness-engineering/templates/package-assets/rules/agents.md`
- `.agents/docs/codex-harness-engineering/templates/package-assets/rules/agents.md`

## 3. Human-Facing Harness And Package Docs

Canonical source:

- `agent/docs/codex-harness-engineering/*.md`

Typical mirrors:

- `agent/docs/codex-harness-engineering/templates/package-assets/docs/codex-harness-engineering/*.md`
- `.agents/docs/codex-harness-engineering/templates/package-assets/docs/codex-harness-engineering/*.md`

Special case:

- `docs/harness/spec-to-ui-to-code-workflow.md` often also feeds:
  - `agent/docs/harness/spec-to-ui-to-code-workflow.md`
  - `agent/docs/codex-harness-engineering/spec-to-ui-to-code-workflow.md`
  - `agent/docs/codex-harness-engineering/templates/docs/spec-to-ui-to-code-workflow.md`
  - package-assets doc mirrors

## 4. Template Config

Canonical source:

- `agent/docs/codex-harness-engineering/templates/config/*`

Typical mirrors:

- `.agents/docs/codex-harness-engineering/templates/config/*`

Common targets:

- `codex-config.toml`
- `codex-readme.md`
- `codex-agent-roles.md`
- `global-AGENTS.md`
- `agents/*.toml`

## 5. Package-Assets Workflows

Canonical source:

- `agent/docs/codex-harness-engineering/templates/package-assets/workflows/*`

Typical mirrors:

- `.agents/docs/codex-harness-engineering/templates/package-assets/workflows/*`

## 6. Package-Assets Root Docs

Canonical source:

- `agent/docs/codex-harness-engineering/templates/package-assets/root/*`

Typical mirrors:

- `.agents/docs/codex-harness-engineering/templates/package-assets/root/*`

## 7. Repo Skills

Canonical source for active usage:

- `.agents/skills/<skill-name>/...`

Distribution mirrors:

- `agent/skills/<skill-name>/...`
- `agent/docs/codex-harness-engineering/templates/package-assets/skills/<skill-name>/...`
- `.agents/docs/codex-harness-engineering/templates/package-assets/skills/<skill-name>/...`

When a skill is created or updated, refresh the `agent/skills` copy and both package distribution copies before considering the task done.
