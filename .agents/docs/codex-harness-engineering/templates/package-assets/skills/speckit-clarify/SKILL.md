---
name: speckit-clarify
description: Identify underspecified areas in the current feature spec by asking up to 5 highly targeted clarification questions and encoding answers back into the spec.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的澄清问答、推荐选项、完成汇报全部使用简体中文。
- 回写到 `spec.md` 的澄清内容必须使用简体中文。
- 保留 `[NEEDS CLARIFICATION]`、需求编号、路径、命令等机器敏感标记原样不变。

## Outline

Goal: Detect and reduce ambiguity or missing decision points in the active feature specification and record the clarifications directly in the spec file.

Note: This clarification workflow is expected to run (and be completed) BEFORE invoking `/speckit.plan`. If the user explicitly states they are skipping clarification (e.g., exploratory spike), you may proceed, but must warn that downstream rework risk increases.

## Execution Steps

1. Run `.agents/.specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly` from repo root **once** (combined `--json --paths-only` mode / `-Json -PathsOnly`). Parse minimal JSON payload fields:
   - `FEATURE_DIR`
   - `FEATURE_SPEC`
   - (Optionally capture `IMPL_PLAN`, `TASKS` for future chained flows.)
   - If JSON parsing fails, abort and instruct user to re-run `/speckit.specify` or verify feature branch environment.
   - For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. Load the current spec file. Perform a structured ambiguity & coverage scan using this taxonomy. For each category, mark status: Clear / Partial / Missing. Produce an internal coverage map used for prioritization (do not output raw map unless no questions will be asked).

   **Taxonomy Categories:**
   - Functional Scope & Behavior
   - Domain & Data Model
   - Interaction & UX Flow
   - Page Inventory & State Coverage
   - Requirement-to-Interface Traceability
   - Upfront Difficulty Research
   - Roles & Permissions
   - Non-Functional Quality Attributes
   - Integration & External Dependencies
   - Edge Cases & Failure Handling
   - Acceptance Criteria & Success Metrics
   - Testability & Acceptance Evidence
   - Required Test Data
   - Evidence Paths & Observable Oracles
   - Baseline / Affected Test Expectations
   - Constraints & Tradeoffs
   - Terminology & Consistency
   - Completion Signals
   - Misc / Placeholders

3. Generate (internally) a prioritized queue of candidate clarification questions (maximum 5). Do NOT output them all at once. Apply these constraints:
    - Maximum of 10 total questions across the whole session.
    - Each question must be answerable with EITHER:
       - A short multiple-choice selection (2–5 distinct, mutually exclusive options), OR
       - A one-word / short-phrase answer (explicitly constrain: "Answer in <=5 words").
    - Only include questions whose answers materially impact architecture, data modeling, task decomposition, test design, UX behavior, operational readiness, or compliance validation.
    - Prioritize questions that unblock verification: missing environment, endpoint, RBAC, dashboard/panel ID, webhook target, fixture, credential, acceptance oracle, evidence path, or delivery-mode downgrade.
    - If a P0/P1 requirement cannot be objectively verified, ask about verification before asking lower-impact UX or implementation-preference questions.
    - Ensure category coverage balance: attempt to cover the highest impact unresolved categories first
    - Never exceed 5 total asked questions

4. Sequential questioning loop (interactive):
    - Present EXACTLY ONE question at a time.
    - For multiple-choice questions: Present your **recommended option prominently** at the top with clear reasoning.
    - Format as: `**Recommended:** Option [X] - <reasoning>`
    - Then render all options as a Markdown table
    - After the user answers: validate and record in working memory

5. Integration after EACH accepted answer (incremental update approach):
    - Maintain in-memory representation of the spec
    - Ensure a `## 澄清记录` section exists
    - Append a bullet line in Chinese: `- 问：<问题> → 答：<最终答案>`
    - Apply the clarification to the most appropriate section(s)
    - If the answer changes testability, update `Testability & Acceptance Evidence`, `External Dependency Preconditions`, or the relevant acceptance scenario in the spec
    - If the answer confirms a blocker, add or update a linked `TBD-*` / `TBD-TEST-*` item instead of silently treating the requirement as implementation-ready
    - Save the spec file AFTER each integration

6. Validation (performed after EACH write plus final pass):
   - Clarifications session contains exactly one bullet per accepted answer
   - Total asked (accepted) questions ≤ 5
   - Markdown structure valid

7. Write the updated spec back to `FEATURE_SPEC`.

8. Report completion:
   - Number of questions asked & answered
   - Path to updated spec
   - Sections touched
   - Coverage summary table
   - Suggested next command

## Behavior Rules

- If no meaningful ambiguities found, respond: "No critical ambiguities detected worth formal clarification."
- If spec file missing, instruct user to run `/speckit.specify` first
- Never exceed 5 total asked questions
- Respect user early termination signals ("stop", "done", "proceed")

## Next Steps

- `/speckit.plan` - Create a plan for the spec
