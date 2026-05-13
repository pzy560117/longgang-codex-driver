---
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 输出给用户的分析报告必须使用简体中文。
- 报告中的表格标题、问题描述、修复建议、后续命令建议全部使用简体中文。
- 保留需求编号、任务 ID、路径、命令、协议名等技术标识原样不变。

## Goal

Identify inconsistencies, duplications, ambiguities, and underspecified items across the three core artifacts (`spec.md`, `plan.md`, `tasks.md`) before implementation. This command MUST run only after `/speckit.tasks` has successfully produced a complete `tasks.md`.

## Operating Constraints

**STRICTLY READ-ONLY**: Do **not** modify any files. Output a structured analysis report. Offer an optional remediation plan (user must explicitly approve before any follow-up editing commands would be invoked manually).

**Constitution Authority**: The project constitution (`.agents/.specify/memory/constitution.md`) is **non-negotiable** within this analysis scope. Constitution conflicts are automatically CRITICAL and require adjustment of the spec, plan, or tasks—not dilution, reinterpretation, or silent ignoring of the principle.

## Execution Steps

### 1. Initialize Analysis Context

Run `.agents/.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` once from repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS. Derive absolute paths:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md

Abort with an error message if any required file is missing.

### 2. Load Artifacts (Progressive Disclosure)

Load only the minimal necessary context from each artifact:

**From spec.md:**
- Overview/Context
- Delivery mode / integration boundary
- Functional Requirements
- Non-Functional Requirements
- User Stories
- Edge Cases (if present)

**From plan.md:**
- Delivery mode gate
- OSS reuse matrix
- Integration blockers & evidence
- Connector / adapter strategy
- Architecture/stack choices
- Data Model references
- Phases
- Technical constraints

**From tasks.md:**
- Task IDs
- Descriptions
- Phase grouping
- Parallel markers [P]
- Delivery attributes, blockers, evidence paths, verification layers
- Referenced file paths

**From constitution:**
- Load `.agents/.specify/memory/constitution.md` for principle validation

### 3. Build Semantic Models

Create internal representations (do not include raw artifacts in output):
- **Requirements inventory**: Each functional + non-functional requirement with a stable key
- **User story/action inventory**: Discrete user actions with acceptance criteria
- **Task coverage mapping**: Map each task to one or more requirements or stories
- **Constitution rule set**: Extract principle names and MUST/SHOULD normative statements

### 4. Detection Passes (Token-Efficient Analysis)

Focus on high-signal findings. Limit to 50 findings total.

- **A. Duplication Detection**: Identify near-duplicate requirements
- **B. Ambiguity Detection**: Flag vague adjectives lacking measurable criteria
- **C. Underspecification**: Requirements with verbs but missing object or measurable outcome
- **D. Constitution Alignment**: Any requirement or plan element conflicting with a MUST principle
- **E. Coverage Gaps**: Requirements with zero associated tasks
- **F. Inconsistency**: Terminology drift, conflicting requirements
- **G. Delivery Mode Drift**: Prototype/spike deliverables masquerading as completed formal `FR-*`
- **H. Integration Downgrade**: Requirements tied to predefined OSS/external systems but implemented only as local mock/sample without explicit downgrade note
- **I. Reuse Matrix Gap**: Missing or incomplete OSS reuse matrix rows for predefined stack / external systems
- **J. Blocker Gate Failure**: Related `TBD-*` still open while tasks try to close the linked requirement
- **K. Ordering Risk**: UI/BFF tasks are planned ahead of environment evidence, real connector, or integration-prep tasks they depend on
- **L. Task Compression Risk**: A story or feature is represented by a single oversized task that spans blockers/evidence, connector work, bridge logic, API/BFF, UI, and final verification, hiding progress and making stop-hook continuation ineffective

### 5. Severity Assignment

- **CRITICAL**: Violates constitution MUST, missing core spec artifact, or open integration blocker falsely treated as complete
- **HIGH**: Duplicate or conflicting requirement, ambiguous security/performance attribute, or a single oversized integration task that hides multiple execution layers
- **MEDIUM**: Terminology drift, missing non-functional task coverage, or missing explicit downgrade record
- **LOW**: Style/wording improvements, minor redundancy

### 6. Produce Compact Analysis Report

Output a Markdown report in Simplified Chinese (no file writes) with:

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|

**Coverage Summary Table:**

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|

**Constitution Alignment Issues:** (if any)

**Unmapped Tasks:** (if any)

**Metrics:**
- Total Requirements
- Total Tasks
- Coverage % (requirements with >=1 task)
- Integration Requirements Count
- Open `TBD-*` Count
- Compressed Story Count
- Ambiguity Count
- Duplication Count
- Critical Issues Count

### 7. Provide Next Actions

- If CRITICAL issues exist: Recommend resolving before `/speckit.implement`
- If Task Compression Risk exists: Recommend splitting the affected task into 4-6 acceptance-sized tasks before `/speckit.implement`
- If only LOW/MEDIUM: User may proceed, but provide improvement suggestions
- Provide explicit command suggestions

### 8. Offer Remediation

Ask the user: "Would you like me to suggest concrete remediation edits for the top N issues?" (Do NOT apply them automatically.)

## Operating Principles

- **NEVER modify files** (this is read-only analysis)
- **NEVER hallucinate missing sections** (if absent, report them accurately)
- **Prioritize constitution violations** (these are always CRITICAL)
- **Report zero issues gracefully** (emit success report with coverage statistics)
