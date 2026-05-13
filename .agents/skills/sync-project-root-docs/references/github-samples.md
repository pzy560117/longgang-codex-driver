# GitHub Samples

Use these repositories for structure and quality signals, not for copy-pasting text.

## AGENTS.md patterns

- `https://github.com/agentsmd/agents.md`
  - Treat `AGENTS.md` as a predictable "README for agents".
  - Include concrete development and testing instructions.

- `https://github.com/openai/codex/blob/main/AGENTS.md`
  - Keep AGENTS tied to real files, commands, and change-impact rules.
  - Update docs when behavior or APIs change.

## Skills and README sync patterns

- `https://github.com/vercel-labs/skills/blob/main/AGENTS.md`
  - Skill ecosystems usually document the exact create/validate/sync commands.
  - README maintenance is treated as part of shipping a new capability.

- `https://github.com/github/awesome-copilot/blob/main/AGENTS.md`
  - Skill folders use kebab-case names and valid frontmatter.
  - New resources are validated and then made discoverable through README regeneration.

- `https://github.com/microsoft/skills`
  - Large skill catalogs treat discoverability and validation as first-class concerns.
  - Adding a new skill is expected to follow a repeatable quality workflow.

## Practical takeaway

- Let the local repo decide the facts.
- Let GitHub samples influence the shape of the docs, the level of specificity, and the validation steps.
- Prefer short, repo-specific rules over broad generic guidance.
