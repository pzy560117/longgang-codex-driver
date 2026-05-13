# Stale Pattern Checklist

These patterns are high-signal starting points for this repo. Do not replace blindly; inspect context first.

## Process And Testing-Left-Shift Signals

- `Tests are OPTIONAL`
  - Usually stale for implementation-facing harness workflows.
- `Stage 17 验证回归` or `Stage 17 Verify / Regression` with no mention of `fresh evidence` or `affected tests`
  - Usually needs the modern Stage 17 wording.
- `test-matrix + test-data-plan`
  - Often stale if it omits acceptance examples, traceability, regression plan, or evidence protocol.
- text implying tests are first defined during verify/regression
  - Usually conflicts with the current left-shift model.

## Missing Truth Sources

Look for docs that mention requirements, plan, or verification but omit:

- `ACCEPTANCE_EXAMPLES.md`
- `TRACEABILITY_MATRIX.md`
- `TEST_DATA_MATRIX.md`
- `verify-matrix.md`

Common stale surfaces:

- install docs
- implementation guides
- package root README/PACKAGE
- workflow docs
- planning docs
- review prompts / review docs

## Task And Workflow Shape Signals

- tasks/workflows missing Requirement IDs
- tasks/workflows missing an explicit test mapping or evidence line
- workflows saying tests are optional for executable changes
- implementation steps that say “write code then add tests later”

## Install / Validation Signals

- install docs that tell users to build a real `task.json` before testing truth sources exist
- docs that treat `env-check.ps1` as the main install gate when the repo now expects `doctor.ps1` + `verify.ps1`

## Role / Profile Signals

- `test-planner` described only as “test matrix”
- `test-runner` described only as “reports”
- no mention of acceptance examples, traceability, affected tests, or fresh evidence in config/role docs

## Recommended First Scan

Use `rg` against:

- `agent/docs/codex-harness-engineering`
- `agent/docs/harness`
- `agent/docs/codex-harness-engineering/templates`
- `.agents/docs/codex-harness-engineering/templates`
- `docs/project-flow`

Then open only the hits that appear semantically stale.
