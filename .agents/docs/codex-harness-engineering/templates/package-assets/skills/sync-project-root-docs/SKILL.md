---
name: sync-project-root-docs
description: Analyze the current repository and rewrite the root AGENTS.md and README.md so they match the actual project instead of template or stale content. Use when either root doc is placeholder text, copied from another repo, outdated after harness/package changes, or when project positioning must be inferred from scripts, task/runtime files, docs, and optional GitHub research.
---

# Sync Project Root Docs

## Overview

Use this skill to refresh the repository-root `AGENTS.md` and `README.md` from the repo's real source of truth. Prefer local evidence first, then use GitHub research only to resolve structure or convention gaps.

## Scope

- Default write set: `AGENTS.md`, `README.md`
- Default read set: root runtime files, `docs/harness/*`, `docs/testing/*`, `.agents/*`, `agent/*`, and `.codex/task-run-profile.json`
- Do not edit `agent/README.md`, `.agents/README.md`, template copies, or `task.json` unless the user explicitly asks to propagate the change beyond the root docs

## Workflow

### 1. Identify the repository surface

- Inspect the root tree and decide whether the repo is primarily an application, a reusable package, a template, or a harness/runtime repo.
- Read `git status --short` before drafting so you do not overwrite unrelated user edits.
- Detect placeholder signals such as generated boilerplate, smoke-task wording, or copied template sections.

If available, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\.agents\skills\sync-project-root-docs\scripts\collect-root-doc-facts.ps1
```

Use the output as discovery input, not as final prose.

### 2. Build the truth-source stack

Read only what is needed, roughly in this order:

1. Root docs: `AGENTS.md`, `README.md`
2. Runtime and entry files:
   `bootstrap-codex-harness.ps1`, `codex-loop.ps1`, `verify.ps1`, `env-check.ps1`, `task.json`, `project-task-template.json`, `.codex/task-run-profile.json`
3. Human-facing docs:
   `docs/harness/*.md`, `docs/testing/*.md`
4. Package and export surfaces when present:
   `.agents/README.md`, `.agents/PACKAGE.md`, `agent/README.md`, `agent/PACKAGE.md`, install scripts
5. Role and delegation rules:
   `.agents/rules/agents.md`

For the current harness repo, read [references/current-repo-notes.md](references/current-repo-notes.md).

When generating `AGENTS.md` for a project, use the generic template at `agent/docs/codex-harness-engineering/templates/docs/project-agents-template.md` if it exists. Treat it as a decision framework, not as text to copy verbatim.

### 3. Research GitHub only when it changes the answer

Use GitHub examples when the local repo tells you what exists but not how to present it well.

Prioritize these patterns:

- `agentsmd/agents.md`: treat `AGENTS.md` as a README for agents
- `openai/codex`: keep AGENTS concrete, command-heavy, and tied to real files
- `vercel-labs/skills` and `github/awesome-copilot`: validate skill naming/frontmatter and keep README sync in mind

Use the notes in [references/github-samples.md](references/github-samples.md). Do not copy external wording verbatim into the repo docs.

### 4. Split responsibilities between the two root docs

Write `README.md` for humans:

- what the repo is
- what the important directories are
- how to install, verify, and run it
- where deeper docs live

Write `AGENTS.md` for coding agents:

- short project-specific entry rules
- real commands and source-of-truth files
- architecture or directory constraints that cannot be inferred from code
- task, workspace, and verification expectations
- repo-specific caveats and Bad Cases that affect execution
- links to deeper docs instead of long embedded explanations

Avoid duplicating the same long instruction blocks in both files. Prefer short cross-references when possible.

### 5. Draft the section outline before editing

Use a minimal outline unless the repo truly needs more:

`README.md`

1. Project summary
2. Repository structure
3. Common PowerShell commands
4. Runtime and package boundaries
5. Suggested workflow
6. Further reading

`AGENTS.md`

1. Project boundary and actual entry points
2. Common commands
3. Architecture and directory decision table
4. Hard constraints with alternatives
5. Verification and completion definition
6. Workspace / Git rules
7. Deep doc index

Keep the root `AGENTS.md` concise. For most projects, aim for 60-120 lines. If the draft grows past that, move details into `docs/`, `rules/`, `specs/`, or test docs and link them from the index.

### 6. Apply repository-aware wording

- Prefer Windows and PowerShell commands when the repo is Windows-first.
- State placeholder or smoke-template status plainly when it is still true.
- If both `.agents/` and `agent/` exist, explain the distinction exactly.
- If install/bootstrap scripts derive files from templates, make that relationship explicit.
- Preserve important existing constraints unless the code or docs clearly contradict them.
- Do not copy README product introductions into `AGENTS.md`; README explains what the project is, while `AGENTS.md` explains how agents should safely change it.
- Do not add generic coding advice that would be true in any repository.
- Every prohibition must include the expected alternative path, helper, command, or owner.
- Prefer decision tables when multiple valid implementation paths exist.
- If a rule can be enforced by lint, schema, hook, CI, or a verify script, mention the enforcement point rather than writing a long reminder.

### 7. Verify after editing

Run at least:

```powershell
git diff --check
rg -n "generated by install-agent|Replace it with project-specific content|\\[TODO|placeholder" AGENTS.md README.md
```

If commands were added or changed, confirm the referenced files and scripts actually exist.

Also review `AGENTS.md` against the template checks:

- It is a short entry point, not a full project manual.
- Deep docs referenced from the file exist.
- Prohibitions include alternatives.
- Real commands and paths are used instead of placeholders.
- Any repeated Bad Case is captured as a rule or linked knowledge item.

## Shipping note

If the repo is itself a distributable harness or template, updating `.agents/skills/<name>` may not be enough. Follow the package duplication chain used by the repo before considering the work complete.
