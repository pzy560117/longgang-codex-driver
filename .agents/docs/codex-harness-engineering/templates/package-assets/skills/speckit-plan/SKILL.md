---
name: speckit-plan
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的阶段汇报、阻塞说明、结论汇总全部使用简体中文。
- 实际写入仓库的 `plan.md`、`research.md`、`architecture.md`、`product-readiness.md`、`design-readiness.md`、`data-model.md`、`quickstart.md` 以及相关说明文档必须使用简体中文。
- 即使模板原文是英文，实际落盘时也要把标题、说明、表格内容、占位文本改写成中文，但保持原有章节顺序。
- 保留不能随意翻译的机器敏感标记与技术标识，例如 `[NEEDS CLARIFICATION]`、需求编号、路径、命令、协议名、库名、接口路径。

## Outline

1. **Setup**: Run `.agents/.specify/scripts/powershell/setup-plan.ps1 -Json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, SPECS_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.agents/.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Delivery Mode Gate and confirm it matches `spec.md`
   - Fill OSS Reuse Matrix for every requirement/capability that depends on a predefined OSS stack, existing platform, or third-party system
   - Fill Integration Blockers & Evidence with machine-readable `TBD-*` rows and statuses
   - Fill Connector & Adapter Strategy, including sample-vs-real adapter separation
   - Fill Requirement Completion Gates and Verification Layers
   - Generate testing left-shift truth sources: `acceptance-examples.md`, `requirements-testability-review.md`, `verify-matrix.md`, `test-strategy.md`, and `test-manifest.json`
   - Fill Truth Sources table
   - Fill Product & Design Readiness gate table
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate architecture.md and verify module boundaries, data flow, integration points, irreversible decisions, and rule impact
   - Phase 2: Generate product-readiness.md and verify product truth sources, including requirement-interface mapping and difficulty research
   - Phase 3: Generate testing truth sources and machine-readable `test-manifest.json`
   - Phase 4: Generate design-readiness.md and verify design-to-code truth sources, including AI image generation/review and image-to-frontend spec for UI work
   - Phase 5: Generate data-model.md, contracts/, quickstart.md
   - Phase 6: Update project rule files and agent context so downstream tasks consume current rules
   - Re-evaluate Constitution Check post-design

4. **Stop and report**: Command ends after planning artifacts are generated. Report branch, IMPL_PLAN path, readiness status, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task
   - For each predefined OSS / external system → reuse-vs-build task
   - For each missing environment / endpoint / RBAC / dashboard / panel / webhook prerequisite → blocker evidence task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Architecture

**Prerequisites:** `research.md` complete

1. Generate `architecture.md` from confirmed spec, existing codebase patterns, and best practices:
   - Module boundaries and ownership
   - Data flow and integration points
   - Connector boundaries and interface-to-adapter layering
   - Real adapter vs sample/mock adapter separation
   - Irreversible or expensive decisions
   - Concurrency, migration, contract, and coupling risks
   - Smallest defensible architecture and rejected alternatives

2. Verify architecture-to-rule impact:
   - Which project rules become stale after this architecture
   - Which `AGENTS.md`, `docs/harness/*`, `docs/context/*` entries must be updated

**Output**: `architecture.md`

### Phase 2: Product Readiness

**Prerequisites:** `architecture.md` complete

1. Verify or generate product artifacts:
   - `docs/product/prd-lite.md`
   - `docs/product/page-inventory.md`
   - `docs/product/state-matrix.yaml`
   - `docs/product/acceptance-criteria.md`
   - `docs/product/requirement-interface-matrix.md`
   - `docs/product/difficulty-research.md`

2. Check required product coverage:
   - Goals and non-goals
   - Scope boundary
   - Delivery mode and prototype/integration boundary
   - Roles and permissions
   - Page inventory
   - Requirement-to-interface traceability for every P0/P1 requirement
   - Upfront difficulty research for all high-risk unknowns
   - Required states
   - Measurable acceptance criteria

**Output**: product-readiness.md

### Phase 3: Testing Readiness

**Prerequisites:** Product readiness complete

1. Generate or verify `acceptance-examples.md`:
   - Map every P0/P1 requirement to at least one scenario ID such as `AE-001`
   - Include Given, When, Then, negative or edge case, observable oracle, and evidence path
   - Do not use vague pass criteria such as "looks normal"

2. Generate or verify `requirements-testability-review.md`:
   - Mark every requirement as `Ready`, `Blocked`, `Needs Clarification`, or `Prototype Only`
   - Record missing endpoint, RBAC, credential, dashboard/panel ID, webhook target, fixture, environment, or downstream evidence as a blocker
   - For `integration` / `production`, keep related formal `FR-*` blocked while a linked blocker remains open

3. Generate or verify `verify-matrix.md`:
   - Map requirement IDs to acceptance examples, required test layers, test files, commands, evidence paths, and status
   - Mark missing test files or commands as `TEST-GAP` instead of leaving cells blank
   - Ensure `integration` / `production` requirements are not covered by unit tests alone

4. Generate or verify `test-strategy.md`:
   - Detect stack and list baseline command candidates
   - Define affected-test selection strategy
   - Define blocking failure rules and evidence directory

5. Generate or verify `test-manifest.json`:
   - Mirror delivery mode, baseline commands, requirement testability, layers, files, commands, evidence paths, blockers, and gaps
   - Keep the JSON valid and minimal because stop hooks and verify workflows read it

**Output**: `acceptance-examples.md`, `requirements-testability-review.md`, `verify-matrix.md`, `test-strategy.md`, `test-manifest.json`

### Phase 4: Design Readiness

**Prerequisites:** Product and testing readiness complete

1. Verify or generate design artifacts:
   - `docs/design/design-brief.md`
   - `docs/design/component-map.md`
   - `docs/design/screen-states.md`
   - `docs/design/design-tokens.json`
   - `docs/design/ai-image-brief.md`
   - `docs/design/ui-image-review.md`
   - `docs/design/image-to-frontend-spec.md`

2. Check required design-to-code coverage:
   - Information architecture
   - Layout and component rules
   - Required screen states
   - Responsive behavior
   - Accessibility expectations
   - Story / e2e / visual mapping
   - CSS/token requirements for AI image generation
   - Generated UI images reviewed against requirements and states
   - Approved images translated into frontend implementation specs

**Output**: design-readiness.md

### Phase 5: Data & Contracts

**Prerequisites:** Product, testing, and design readiness complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`
3. **Resolve integration blockers**:
   - Verify every `TBD-*` row has an evidence path
   - For `integration` / `production` work, unresolved blockers must keep related requirements in planned/blocked state
   - Record environment smoke, downstream connectivity, and failure-path evidence locations in `quickstart.md` or companion notes

### Phase 6: Rules & Context Sync

**Prerequisites:** `architecture.md`, product readiness, testing readiness, and design readiness complete

1. Update project rule files affected by the final spec and architecture:
   - Project root `AGENTS.md`
   - `docs/harness/*` long-lived workflow/rule files
   - `docs/context/*` architecture/dev-plan context files when present

2. Remove stale assumptions so downstream tasks do not inherit outdated rules.

3. **Agent context update**:
   - Run `.agents/.specify/scripts/powershell/update-agent-context.ps1 -AgentType gemini`
   - These scripts detect which AI agent is in use
   - Update the appropriate agent-specific context file
   - Add only new technology from current plan
   - Preserve manual additions between markers

**Output**: updated project rules, data-model.md, /contracts/*, quickstart.md, agent-specific file

## Key rules

- Use absolute paths
- ERROR on gate failures or unresolved clarifications
- Do not replace a real integration requirement with local mock/sample implementation unless the user explicitly accepts downgrade and the plan records formal FRs as still incomplete

## Next Steps

- `/speckit.tasks` - Break the plan into tasks
- `/speckit.checklist` - Create a checklist for the domain
