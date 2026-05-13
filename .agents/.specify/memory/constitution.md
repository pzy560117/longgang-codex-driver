# Hermes Agent Spec Constitution

## Core Principles

### I. Truth Sources Before Implementation

Every feature MUST define the product and design truth sources required by its task kind before implementation starts. Product truth sources include PRD-Lite, page inventory, state matrix, and acceptance criteria. Design truth sources include design brief, component map, screen states, and design tokens. If a required truth source is missing, the task MUST be marked BLOCKED instead of letting an implementation agent infer behavior.

### II. Scope Boundary Is Mandatory

Every feature spec MUST document goals, non-goals, in-scope behavior, out-of-scope behavior, impacted roles, impacted pages or flows, and open questions. Non-goals are not optional; they prevent uncontrolled scope expansion.

### III. Requirements Must Map To Interfaces

Every P0/P1 requirement MUST map to concrete pages, views, states, UI elements, fields, APIs, and acceptance evidence before design or implementation starts. Every page, modal, drawer, or embedded view MUST have a requirement source. Unmapped requirements and requirement-less UI elements are blocking issues unless explicitly deferred.

### IV. Difficulties Must Be Researched Before Coding

High-risk implementation, design, data, integration, performance, permission, or interaction difficulties MUST be researched before implementation. The research record MUST include alternatives considered, selected approach, rejected approach rationale, validation evidence, and downstream task impact. Implementation agents must not rediscover core strategy during coding.

### V. State Coverage Is Mandatory For UI Work

Every UI-facing page, modal, drawer, or embedded view MUST define default, empty, loading, error, permission_denied, disabled, long_content, and mobile states, or explicitly mark a state as not applicable with a reason. State definitions MUST map to stories, E2E cases, or visual regression checks before frontend implementation can be considered complete.

### VI. AI Image Before Frontend Implementation

For UI-facing frontend work, Design Brief and CSS/token requirements MUST be completed before generating UI images. The workflow is: AI Image Brief -> AI image generation/editing -> UI Image Review -> Image To Frontend Spec -> frontend implementation. Generated images are review evidence, not implementation instructions by themselves. Codex must implement from the approved frontend spec and tokens, not guess hidden behavior from images.

### VII. Contract-First For API Or Data Changes

Any task that changes API behavior, data shape, enums, error semantics, pagination, permissions, or client/server integration MUST update or explicitly exempt `contracts/openapi.yaml` before implementation. Generated clients, mocks, and tests MUST align with the same contract.

### VIII. Verification Evidence Required

No task may be marked complete without fresh verification evidence directly tied to its acceptance criteria. Documentation-only changes MUST at least pass `git diff --check`. UI work SHOULD include story and visual evidence. API or business flow work SHOULD include unit, integration, contract, or E2E evidence.

## Product Requirements Standards

- Requirements MUST be testable and traceable to acceptance criteria.
- Functional requirements SHOULD use stable IDs such as `FR-001`.
- Business rules SHOULD use stable IDs such as `BR-001`.
- Acceptance criteria SHOULD use Given/When/Then or EARS-style wording.
- Risks, assumptions, and open questions MUST be explicit.
- Permission differences MUST be represented as a matrix when roles differ.
- `requirement-interface-matrix.md` MUST map requirements to interfaces and states.
- `difficulty-research.md` MUST be completed for all high-risk difficulties.

## Design Standards

- Design Brief MUST define visual direction, information architecture, layout rules, interaction rules, responsive behavior, and accessibility expectations.
- Component Map MUST identify reuse source, responsibility, data inputs, event outputs, required states, and test method for each component.
- Screen States MUST define trigger, data condition, UI behavior, user actions, and verification mapping for each required state.
- Design tokens MUST be structured and parseable; colors, typography, spacing, radius, and status colors are the minimum baseline.
- AI Image Brief MUST include CSS/token requirements, target page states, and generation/edit prompts.
- UI Image Review MUST compare generated images against requirements, state coverage, CSS rules, and forbidden extra functionality.
- Image To Frontend Spec MUST translate approved images into layout, component, CSS/token, mock data, state, and test mappings.
- When visual details conflict, the precedence is: design artifact > Design Brief > Product Spec. Functional behavior remains governed by Product Spec.

## Workflow Gates

- `feature_spec` tasks require repository context and a completed feature specification.
- `feature_design` tasks require product truth sources.
- `feature_plan` tasks require product and design truth sources.
- `feature_impl` tasks require product, design, and plan truth sources.
- `contract_required` tasks additionally require `contracts/openapi.yaml`.
- Missing truth sources in non-lightweight gates are blocking issues.

## Governance

This constitution supersedes workflow convenience and prompt shortcuts. If the constitution conflicts with a task description, the task must be clarified or blocked. Amendments require updating this file and any affected templates or workflow docs in the same change.

**Version**: 1.0.0 | **Ratified**: 2026-04-26 | **Last Amended**: 2026-04-26
