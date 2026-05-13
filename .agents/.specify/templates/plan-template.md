# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Truth Sources

| Source | Path | Status | Notes |
| --- | --- | --- | --- |
| Product Spec | `specs/[###-feature-name]/spec.md` | Draft / Approved | |
| Architecture | `specs/[###-feature-name]/architecture.md` | Draft / Approved | |
| PRD-Lite | `docs/product/prd-lite.md` | Draft / Approved / N/A | |
| Page Inventory | `docs/product/page-inventory.md` | Draft / Approved / N/A | |
| State Matrix | `docs/product/state-matrix.yaml` | Draft / Approved / N/A | |
| Acceptance Criteria | `docs/product/acceptance-criteria.md` | Draft / Approved / N/A | |
| Requirement Interface Matrix | `docs/product/requirement-interface-matrix.md` | Draft / Approved / N/A | |
| Difficulty Research | `docs/product/difficulty-research.md` | Draft / Approved / N/A | |
| Acceptance Examples | `specs/[###-feature-name]/acceptance-examples.md` | Draft / Approved | |
| Requirements Testability Review | `specs/[###-feature-name]/requirements-testability-review.md` | Draft / Approved | |
| Verify Matrix | `specs/[###-feature-name]/verify-matrix.md` | Draft / Approved | |
| Test Strategy | `specs/[###-feature-name]/test-strategy.md` | Draft / Approved | |
| Test Manifest | `specs/[###-feature-name]/test-manifest.json` | Draft / Approved | Machine-readable mirror for hooks and verify workflows |
| Design Brief | `docs/design/design-brief.md` | Draft / Approved / N/A | |
| Component Map | `docs/design/component-map.md` | Draft / Approved / N/A | |
| Screen States | `docs/design/screen-states.md` | Draft / Approved / N/A | |
| Design Tokens | `docs/design/design-tokens.json` | Draft / Approved / N/A | |
| AI Image Brief | `docs/design/ai-image-brief.md` | Draft / Approved / N/A | |
| UI Image Review | `docs/design/ui-image-review.md` | Draft / Approved / N/A | |
| Image To Frontend Spec | `docs/design/image-to-frontend-spec.md` | Draft / Approved / N/A | |
| Contract | `contracts/openapi.yaml` | Draft / Approved / N/A | |
| Project Rules Sync | `AGENTS.md`, `docs/harness/*`, `docs/context/*` | Draft / Approved / N/A | |

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Delivery Mode Gate

> Fill this before implementation planning. If the delivery mode is not locked, mark the plan BLOCKED and return to clarification.

| Field | Value | Notes |
| --- | --- | --- |
| Delivery Mode | `prototype` / `spike` / `integration` / `production` | Must match `spec.md` |
| Local mock/sample may close acceptance? | Yes / No | |
| Formal FRs allowed to close in this mode? | Yes / No | `prototype` / `spike` defaults to No |
| User-approved downgrade note | | Required when not `integration` / `production` |

## OSS Reuse Matrix

> For any feature that depends on a predefined open-source stack, existing platform, or third-party system, this matrix is mandatory. If a row is blank, implementation must not start.

| Capability / Requirement | Target Ability | Reused OSS / Existing System | Reason Not Reused (if blank) | Integration Layer / Path | Verification / Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | | | | | | Planned / Blocked / Ready |

## Integration Blockers & Evidence

> `TBD-*` items are hard blockers for `integration` / `production` work. A related FR cannot be treated as complete while any linked blocker remains `Open`.

| Blocker ID | Related Requirements | Required Dependency / Environment / RBAC / Endpoint | Evidence Path | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| TBD-001 | FR-001 | | `docs/evidence/<feature>/tbd-001.md` | | Open / Resolved / N/A |

## Connector & Adapter Strategy

> Use this section whenever the feature depends on external systems, dashboards, metrics, webhooks, storage, or other runtime integrations.

### Connector Boundary

- Real integrations go through a connector / interface layer such as `lib/connectors/*`.
- Separate `sample` / `mock` adapters from `real` adapters; do not let pages, API handlers, or BFF code depend directly on sample JSON or placeholder repositories.
- UI and API layers should call connector interfaces, not reach into fake repositories as if they were the final implementation.

### Planned Structure

```text
lib/
└── connectors/
    ├── interfaces/
    ├── sample/
    └── real/
```

## Requirement Completion Gates

| Requirement Class | Minimum Completion Gate | Not Enough |
| --- | --- | --- |
| `prototype` / `spike` | Local flow works, downgrade recorded, evidence shows demo-only boundary | Claiming formal `FR-*` completion |
| `integration` | Real dependency connected, real request path proven, success + failure evidence recorded | UI visible, local mock works, unit tests only |
| `production` | Integration gate passes plus regression, permissions/RBAC, rollout/ops evidence as needed | “Almost real”, ad-hoc manual checks |

## Verification Layers

| Requirement / Slice | Unit | Integration | Smoke | E2E | Downstream Connectivity | Evidence Note |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 / INT-001 | Required / N/A | Required / N/A | Required / N/A | Required / N/A | Required / N/A | `docs/evidence/<feature>/fr-001.md` |

## Testing Left-Shift Truth Sources

> Generate these files during `/speckit.plan`. They are feature-local truth sources used by `/speckit.tasks`, `/speckit.analyze`, `/speckit.implement`, `/speckit.verify`, and stop hooks. Do not wait until implementation is complete to define them.

### Acceptance Examples

Target file: `specs/[###-feature-name]/acceptance-examples.md`

| Requirement ID | Scenario ID | Priority | Given | When | Then | Negative / Edge Case | Observable Oracle | Evidence Path |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | AE-001 | P0 | | | | | | `docs/evidence/<feature>/fr-001.md` |

### Requirements Testability Review

Target file: `specs/[###-feature-name]/requirements-testability-review.md`

| Requirement ID | Testability | Missing Input | Required Test Data | Required Environment | Risk | Blocker ID | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | Ready / Blocked / Needs Clarification / Prototype Only | | | | | TBD-001 / none | Continue / Downgrade / Block |

Rules:

- If `Testability` is `Blocked`, linked implementation tasks cannot close the related formal `FR-*`.
- If `Testability` is `Prototype Only`, tasks may close `PROTO-*` / `SPIKE-*` scope, but not formal production/integration requirements.

### Verify Matrix

Target file: `specs/[###-feature-name]/verify-matrix.md`

| Requirement ID | Acceptance Example IDs | Test Layers | Test Files | Required Commands | Evidence Path | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | AE-001 | unit / integration / e2e / downstream | `TEST-GAP` | `TEST-GAP` | `docs/evidence/<feature>/fr-001.md` | Planned / Ready / Blocked / Verified |

Rules:

- `integration` / `production` requirements cannot rely on `unit` alone.
- If a test file or command does not exist yet, write `TEST-GAP` explicitly and explain the gap in the testability review.

### Test Strategy

Target file: `specs/[###-feature-name]/test-strategy.md`

| Field | Value |
| --- | --- |
| Detected Stack | |
| Baseline Commands | |
| Required Layers | unit / component / contract / integration / e2e / visual / downstream |
| Affected Test Strategy | |
| Evidence Directory | `docs/evidence/<feature>/` |
| Blocking Failures | |
| Known Gaps | |

### Test Manifest

Target file: `specs/[###-feature-name]/test-manifest.json`

Minimum structure:

```json
{
  "schemaVersion": 1,
  "feature": "[###-feature-name]",
  "deliveryMode": "integration",
  "generatedAt": "YYYY-MM-DDTHH:mm:ssZ",
  "baseline": {
    "commands": [],
    "status": "unknown",
    "evidencePath": "docs/evidence/[###-feature-name]/baseline.md"
  },
  "requirements": [
    {
      "id": "FR-001",
      "testability": "Ready",
      "acceptanceExamples": ["AE-001"],
      "testLayers": ["integration"],
      "testFiles": [],
      "requiredCommands": [],
      "evidencePath": "docs/evidence/[###-feature-name]/fr-001.md",
      "blockers": []
    }
  ],
  "gaps": []
}
```

## Task Decomposition Guide

> Fill this before `/speckit.tasks` when the feature includes real integrations, predefined OSS stacks, or external systems.

- `integration` / `production` stories should expose progress at blocker/evidence, connector, upper-layer, and final verification boundaries.
- Do not plan a single task that simultaneously closes blockers, implements real connectors, builds BFF/API/UI, and writes final evidence.
- Prefer 4-6 acceptance-sized tasks for an integration-heavy story:
  1. readiness / blocker evidence
  2. contract projection / schema mapping
  3. real connector / read-write path skeleton
  4. bridge / policy / metadata / RBAC
  5. BFF / API / UI consumption plus failure states
  6. integration transcript / evidence / regression
- If the planned story truly remains a single task, record the reason explicitly, such as `prototype-only visual spike` or `single-file blocker note`.

## Product & Design Readiness

> Fill this before implementation planning. If a required artifact is missing, mark the plan BLOCKED instead of letting implementation guess.

| Gate | Required Evidence | Status | Blocker / Follow-up |
| --- | --- | --- | --- |
| Scope boundary | Goals, non-goals, in-scope, out-of-scope documented | Pass / Fail | |
| Architecture decision | Module boundaries, data flow, irreversible decisions, and main risks documented | Pass / Fail | |
| Roles and permissions | Role table and permission matrix documented | Pass / Fail / N/A | |
| Page inventory | Each page/view/modal/drawer has Page ID | Pass / Fail / N/A | |
| Requirement-interface mapping | Every P0/P1 requirement maps to pages, states, UI elements, APIs, and acceptance evidence | Pass / Fail / N/A | |
| Difficulty research | High-risk difficulties have research conclusions before implementation | Pass / Fail / N/A | |
| State matrix | Required states covered or explicitly marked N/A | Pass / Fail / N/A | |
| Acceptance criteria | P0 requirements have objective acceptance criteria | Pass / Fail | |
| Design brief | Visual, layout, interaction, responsive and a11y rules documented | Pass / Fail / N/A | |
| Component map | Components, props/data inputs, events and tests documented | Pass / Fail / N/A | |
| Screen states | Each UI state maps to stories/e2e/visual checks | Pass / Fail / N/A | |
| AI image generation | AI Image Brief covers CSS/tokens and required states | Pass / Fail / N/A | |
| UI image review | Generated UI images have passed requirement/state/style review | Pass / Fail / N/A | |
| Image-to-frontend spec | Approved images have been translated into implementable frontend specs | Pass / Fail / N/A | |
| Contract | API/data contract exists or is explicitly out of scope | Pass / Fail / N/A | |
| Project rules sync | Long-lived project rule files reflect the confirmed spec and architecture | Pass / Fail / N/A | |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── architecture.md      # Phase 1 output (/speckit.plan command)
├── acceptance-examples.md
├── requirements-testability-review.md
├── verify-matrix.md
├── test-strategy.md
├── test-manifest.json
├── data-model.md        # Phase 5 output (/speckit.plan command)
├── quickstart.md        # Phase 5 output (/speckit.plan command)
├── contracts/           # Phase 5 output (/speckit.plan command)
├── product-readiness.md  # Product truth source gate notes
├── design-readiness.md   # Design to code gate notes
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

## Phase Plan

### Phase 0: Research & Clarification

- Resolve open questions:
- Confirm non-goals:
- Confirm external dependencies:
- Lock delivery mode (`prototype` / `spike` / `integration` / `production`)
- Fill OSS reuse matrix and list all `TBD-*` blockers
- Output: `research.md`

### Phase 1: Architecture

- Generate / verify `specs/[###-feature]/architecture.md`
- Lock module boundaries, data flow, integration points, and key trade-offs
- Define connector boundaries, sample-vs-real adapter separation, and where the real dependency enters the codebase
- Identify coupling, migration, concurrency, and contract risks
- Mark project rule files that must change after architecture is approved
- Output: `architecture.md`

### Phase 2: Product Readiness

- Update / verify `docs/product/prd-lite.md`
- Update / verify `docs/product/page-inventory.md`
- Update / verify `docs/product/state-matrix.yaml`
- Update / verify `docs/product/acceptance-criteria.md`
- Update / verify `docs/product/requirement-interface-matrix.md`
- Update / verify `docs/product/difficulty-research.md`
- Output: `product-readiness.md`

### Phase 3: Design Readiness

- Generate / verify testing truth sources before design/code work proceeds:
  - `acceptance-examples.md`
  - `requirements-testability-review.md`
  - `verify-matrix.md`
  - `test-strategy.md`
  - `test-manifest.json`
- Mark every P0/P1 requirement as `Ready`, `Blocked`, `Needs Clarification`, or `Prototype Only`.
- If an `integration` / `production` requirement lacks data, endpoint, RBAC, environment, or evidence path, keep it blocked rather than allowing implementation to guess.
- Output: testing truth sources and machine-readable `test-manifest.json`

### Phase 4: Design Readiness

- Update / verify `docs/design/design-brief.md`
- Update / verify `docs/design/component-map.md`
- Update / verify `docs/design/screen-states.md`
- Update / verify `docs/design/design-tokens.json`
- Generate / verify `docs/design/ai-image-brief.md`
- Review generated UI images with `docs/design/ui-image-review.md`
- Translate approved images to `docs/design/image-to-frontend-spec.md`
- Output: `design-readiness.md`

### Phase 5: Contracts & Data

- Generate / update data model
- Generate / update API contracts
- Confirm error, enum, pagination and permission semantics
- Resolve or explicitly document every `TBD-*` blocker that gates real integration
- Attach evidence paths for environments, endpoints, RBAC, dashboards, metrics, or webhook contracts
- Output: `data-model.md`, `contracts/`, `quickstart.md`

### Phase 6: Rules & Context Sync

- Update project root `AGENTS.md` when the feature introduces new stable rules
- Update `docs/harness/*` when workflow, gate, verification, or collaboration rules changed
- Update `docs/context/*` when architecture/dev-plan context changed
- Run agent context update script after rule sync
- Output: updated project rules and agent context
