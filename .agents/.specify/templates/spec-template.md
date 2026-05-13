# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## Overview *(mandatory)*

### Problem Statement

[Describe the business/user problem this feature solves. Avoid implementation details.]

### Goals

- **G-001**: [Specific measurable goal]
- **G-002**: [Specific measurable goal]

### Non-Goals

- **NG-001**: [Explicitly excluded capability, scenario, or user group]
- **NG-002**: [Explicitly deferred behavior]

### Scope

| Scope Area | In Scope | Out of Scope |
| --- | --- | --- |
| Users / Roles | | |
| Pages / Flows | | |
| Data / Entities | | |
| Integrations | | |

## Delivery Intent & Integration Boundary *(mandatory)*

> Fill this section before writing FRs. If the user has not confirmed whether this is a prototype or a real integration effort, stop and clarify first.

### Delivery Mode

| Field | Value |
| --- | --- |
| Delivery Mode | `prototype` / `spike` / `integration` / `production` |
| User Confirmation | |
| Can local mock/sample close acceptance? | Yes / No |
| Formal requirements left incomplete after downgrade | |

### External Systems & Existing Stack

| Integration ID | Related Requirements | Target System / OSS | Required Outcome | Prototype Allowed? | Notes |
| --- | --- | --- | --- | --- | --- |
| INT-001 | FR-001 | | | Yes / No | |

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently - e.g., "Can be fully tested by [specific action] and delivers [specific value]"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Testability & Acceptance Evidence *(mandatory)*

> This section is the left-shift testing entry point. It does not replace later automated tests, but it must make every P0/P1 requirement observable before implementation planning starts.

### Requirement Testability Map

| Requirement ID | Priority | Observable Result | Positive Example | Negative / Edge Example | Required Test Data | Evidence Path | Testability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | P0 | | Given / When / Then | Given / When / Then | | `docs/evidence/<feature>/fr-001.md` | Ready / Needs Clarification / Blocked / Prototype Only |

### Acceptance Example Seeds

| Scenario ID | Requirement ID | Actor / Role | Given | When | Then | Observable Oracle |
| --- | --- | --- | --- | --- | --- | --- |
| AE-001 | FR-001 | | | | | |

### Testing Preconditions

| Blocker ID | Related Requirements | Missing Environment / Data / Permission / Endpoint | Why It Blocks Verification | Status |
| --- | --- | --- | --- | --- |
| TBD-TEST-001 | FR-001 | | | Open / Resolved / N/A |

Rules:

- `integration` / `production` requirements cannot be marked testable when required endpoints, credentials, RBAC, fixtures, dashboards, webhooks, or downstream environments are missing.
- `prototype` / `spike` work may use demo evidence, but must mark formal `FR-*` as incomplete unless the user explicitly accepts the downgrade.
- Avoid vague oracle wording such as "looks normal"; use response fields, UI states, transcript paths, logs, screenshots, metrics, or failure messages.

## Pages, States & Permissions *(mandatory for UI-facing features)*

### Page Inventory

| Page ID | Page / View | Entry / Route | Actor | Core Goal | Required States | Related Requirements |
| --- | --- | --- | --- | --- | --- | --- |
| page-001 | | | | | default, empty, loading, error | FR-001 |

### State Coverage

| Page ID | default | empty | loading | error | permission_denied | disabled | long_content | mobile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| page-001 | Required | Required | Required | Required | Required/NA | Required/NA | Required/NA | Required/NA |

### Permission Matrix

| Action | Role A | Role B | Role C | Notes |
| --- | --- | --- | --- | --- |
| View | Allowed | Read-only | Denied | |

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

> If the current delivery mode is `prototype` or `spike`, do not present demo-only deliverables as completed formal `FR-*`. Use the optional `PROTO-*` / `SPIKE-*` section below to represent exploratory or demo scope.

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Prototype / Spike Deliverables *(optional)*

- **PROTO-001**: [demo-only or local prototype capability]
- **SPIKE-001**: [exploratory validation, not a formal delivered requirement]
- **INTEGRATION-001**: [connector, environment, or evidence preparation work that must finish before FR closure]

### Business Rules

| Rule ID | Rule | Trigger | Validation / Decision Logic | Failure Behavior |
| --- | --- | --- | --- | --- |
| BR-001 | | | | |

### External Dependency Preconditions *(include when integrations exist)*

| Blocker ID | Related Requirements | Missing Dependency / Evidence | Impact If Open | Status |
| --- | --- | --- | --- | --- |
| TBD-001 | FR-001 | | | Open / Resolved |

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

### Data Dictionary *(include if fields affect UI, APIs, or persistence)*

| Field | Meaning | Type | Source | Required | Allowed Values / Range | Boundary Rule |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Non-Functional Requirements *(mandatory when relevant)*

| Category | Requirement | Target / Standard | Priority | Verification |
| --- | --- | --- | --- | --- |
| Performance | | | P0 | |
| Security | | | P0 | |
| Availability | | | P1 | |
| Accessibility | | | P1 | |
| Compatibility | | | P1 | |

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]

## Risks, Assumptions & Open Questions *(mandatory)*

### Risks

| Risk ID | Risk | Impact | Probability | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| R-001 | | High/Medium/Low | High/Medium/Low | | |

### Assumptions

| Assumption ID | Assumption | Validation Method | Impact If False |
| --- | --- | --- | --- |
| A-001 | | | |

### Open Questions

| Question ID | Question | Owner | Due Date | Status |
| --- | --- | --- | --- | --- |
| Q-001 | | | | Open |

## Product Artifact Mapping *(mandatory)*

| Artifact | Target Path | Purpose |
| --- | --- | --- |
| PRD-Lite | `docs/product/prd-lite.md` | Product truth source |
| Page Inventory | `docs/product/page-inventory.md` | Page and view scope |
| State Matrix | `docs/product/state-matrix.yaml` | UI state coverage |
| Acceptance Criteria | `docs/product/acceptance-criteria.md` | Verification entry point |
| Requirement Interface Matrix | `docs/product/requirement-interface-matrix.md` | Requirement-to-page/state/API/test traceability |
| Difficulty Research | `docs/product/difficulty-research.md` | Upfront research for hard problems and risks |
