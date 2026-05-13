---
description: Run feature-level verification from test-manifest.json, tasks.json, verify-matrix.md, and current git diff.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的验证进展、失败归因、完成汇报全部使用简体中文。
- 实际写入仓库的 `verify-report.md`、`docs/evidence/<feature>/verify.md` 和 `test-manifest.json` 状态更新必须使用简体中文说明。
- 保留 `FR-001`、`AE-001`、`TEST-GAP`、路径、命令、exit code 等机器敏感标记原样不变。

## Goal

`/speckit.verify` 是 feature 完成后的验证线，不替代需求阶段测试左移，也不替代实现期 test-first。它只负责：

- fresh evidence
- affected tests
- baseline / required commands
- P0/P1 regression confirmation
- failure triage

如果当前 feature 还没有 `acceptance-examples.md`、`requirements-testability-review.md`、`verify-matrix.md`、`test-strategy.md` 或 `test-manifest.json`，不要临时猜测试范围；先回到 `/speckit.plan` 补齐。

## Workflow

1. Run `.agents/.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse:
   - `FEATURE_DIR`
   - `FEATURE_SPEC`
   - `IMPL_PLAN`
   - `TASKS`

2. Load only the verification inputs:
   - `FEATURE_DIR/test-manifest.json`
   - `FEATURE_DIR/tasks.json`
   - `FEATURE_DIR/verify-matrix.md`
   - `FEATURE_DIR/requirements-testability-review.md`
   - `FEATURE_DIR/test-strategy.md`

3. Validate readiness before running commands:
   - `test-manifest.json` parses as JSON.
   - All completed `integration` / `production` tasks have evidence paths.
   - No formal requirement needed for this verification is `Blocked`.
   - `TEST-GAP` entries are either intentionally accepted by delivery mode or converted into follow-up tasks.
   - Every command about to run is concrete and executable from repo root.

4. Build the verification command set:
   - Baseline commands from `test-manifest.json.baseline.commands`.
   - Required commands from each relevant requirement in `test-manifest.json.requirements`.
   - Affected tests inferred from `git diff --name-only`, `tasks.json`, and `verify-matrix.md`.
   - Always include `git -c core.safecrlf=false diff --check`.

5. Execute commands from repo root:
   - Record command, exit code, start/end time, and compact output.
   - Stop on hard failure unless the failure is explicitly documented as pre-existing baseline failure.
   - Do not mark a failed requirement as verified.

6. Write verification outputs:
   - `FEATURE_DIR/verify-report.md`
   - `docs/evidence/<feature>/verify.md`

7. Update `test-manifest.json`:
   - Set `baseline.status` to `passed`, `failed`, or `blocked`.
   - For each requirement, set status-like fields if present; if absent, add `verificationStatus`.
   - Preserve existing requirement IDs, blockers, paths, and command arrays.

8. Report:
   - commands run
   - passed / failed / skipped count
   - affected tests
   - requirements verified
   - unresolved blockers or `TEST-GAP`
   - next action: proceed, create follow-up tasks, or return to plan/tasks

## Output Template

`verify-report.md` should use this structure:

```md
# Verify Report: <feature>

## Summary

| Field | Value |
| --- | --- |
| Feature | |
| Delivery Mode | |
| Result | Passed / Failed / Blocked |
| Generated At | |

## Commands

| Command | Exit Code | Result | Evidence |
| --- | --- | --- | --- |

## Requirement Verification

| Requirement ID | Testability | Commands | Evidence Path | Result | Notes |
| --- | --- | --- | --- | --- | --- |

## Affected Tests

| Changed Path | Selected Tests | Reason |
| --- | --- | --- |

## Failure Triage

| Failure | Likely Owner | Root Cause | Next Action |
| --- | --- | --- | --- |
```

## Hard Gates

- Invalid or missing `test-manifest.json` blocks verification.
- `integration` / `production` requirements with unresolved blockers remain `blocked`.
- Missing evidence paths for completed `integration` / `production` tasks block verification.
- Required commands failing without a documented pre-existing baseline failure block verification.
- `TEST-GAP` cannot be silently treated as verified.

## Next Steps

- `/speckit.tasks` - create follow-up tasks for failed verification or `TEST-GAP`
- `/speckit.implement` - fix failed tasks one boundary at a time
- `/speckit.verify` - rerun after fixes
