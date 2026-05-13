---
name: speckit-specify
description: Create or update the feature specification from a natural language feature description.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的交互、澄清问题、推荐选项、完成汇报全部使用简体中文。
- 实际写入仓库的 `spec.md` 及相关检查清单内容必须使用简体中文。
- 即使模板原文是英文，实际落盘时也要把标题、说明、表格内容、占位文本改写成中文，但保持原有章节顺序。
- 保留不能随意翻译的机器敏感标记与技术标识，例如 `[NEEDS CLARIFICATION]`、`FR-001`、`NFR-001`、`SC-001`、路径、命令、协议名、库名、接口路径。

## Outline

The text the user typed after `/speckit.specify` in the triggering message **is** the feature description. Assume you always have it available in this conversation even if `{{args}}` appears literally below. Do not ask the user to repeat it unless they provided an empty command.

Given that feature description, do this:

1. **Generate a concise short name** (2-4 words) for the branch:
   - Analyze the feature description and extract the most meaningful keywords
   - Create a 2-4 word short name that captures the essence of the feature
   - Use action-noun format when possible (e.g., "add-user-auth", "fix-payment-bug")
   - Preserve technical terms and acronyms (OAuth2, API, JWT, etc.)
   - Keep it concise but descriptive enough to understand the feature at a glance
   - Examples:
     - "I want to add user authentication" → "user-auth"
     - "Implement OAuth2 integration for the API" → "oauth2-api-integration"
     - "Create a dashboard for analytics" → "analytics-dashboard"
     - "Fix payment processing timeout bug" → "fix-payment-timeout"

2. **Check for existing branches before creating new one**:

   a. First, fetch all remote branches to ensure we have the latest information:

      ```bash
      git fetch --all --prune
      ```

   b. Find the highest feature number across all sources for the short-name:
      - Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+-<short-name>$'`
      - Local branches: `git branch | grep -E '^[* ]*[0-9]+-<short-name>$'`
      - Specs directories: Check for directories matching `specs/[0-9]+-<short-name>`

   c. Determine the next available number:
      - Extract all numbers from all three sources
      - Find the highest number N
      - Use N+1 for the new branch number

   d. Run the script `.agents/.specify/scripts/powershell/create-new-feature.ps1 -Json "{{args}}"` with the calculated number and short-name:
      - Pass `--number N+1` and `--short-name "your-short-name"` along with the feature description
      - Bash example: `.agents/.specify/scripts/powershell/create-new-feature.ps1 -Json "{{args}}" --json --number 5 --short-name "user-auth" "Add user authentication"`
      - PowerShell example: `.agents/.specify/scripts/powershell/create-new-feature.ps1 -Json "{{args}}" -Json -Number 5 -ShortName "user-auth" "Add user authentication"`

   **IMPORTANT**:
   - Check all three sources (remote branches, local branches, specs directories) to find the highest number
   - Only match branches/directories with the exact short-name pattern
   - If no existing branches/directories found with this short-name, start with number 1
   - You must only ever run this script once per feature
   - The JSON is provided in the terminal as output - always refer to it to get the actual content you're looking for
   - The JSON output will contain BRANCH_NAME and SPEC_FILE paths
   - For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot")

3. Load `.agents/.specify/templates/spec-template.md` to understand required sections.

4. Follow this execution flow:

    1. Parse user description from Input
       If empty: ERROR "No feature description provided"
    2. Extract key concepts from description
       Identify: actors, actions, data, constraints, pages/views, states, permissions, success metrics
    3. Before writing FRs, lock the delivery posture:
       - Determine whether the request is `prototype`, `spike`, `integration`, or `production`
       - If the user mentions a predefined OSS stack, existing platform, dashboard system, metrics stack, webhook target, or real external environment, default to `integration` unless the user explicitly approves prototype downgrade
       - If delivery posture is not clear, spend one of the allowed clarifications on this decision first
    4. For unclear aspects:
       - Make informed guesses based on context and industry standards
       - Only mark with [NEEDS CLARIFICATION: specific question] if:
         - The choice significantly impacts feature scope or user experience
         - Multiple reasonable interpretations exist with different implications
         - No reasonable default exists
       - **LIMIT: Maximum 3 [NEEDS CLARIFICATION] markers total**
       - Prioritize clarifications by impact: scope > security/privacy > user experience > technical details
    5. Fill Overview, goals, non-goals, scope boundary, and delivery/integration boundary
       Non-goals are mandatory; write explicit exclusions rather than leaving them implicit
    6. Fill User Scenarios & Testing section
       If no clear user flow: ERROR "Cannot determine user scenarios"
    7. Fill Testability & Acceptance Evidence
       - For every P0/P1 `FR-*` and relevant `NFR-*`, define:
         - observable result
         - positive Given/When/Then example
         - negative or edge example
         - required test data
         - evidence path
         - `Ready` / `Needs Clarification` / `Blocked` / `Prototype Only`
       - If a real integration depends on missing environment, endpoint, RBAC, dashboard, webhook, fixture, credential, or downstream system, create a `TBD-TEST-*` or linked `TBD-*` precondition instead of treating the requirement as testable
       - If the work is `prototype` / `spike`, record demo evidence boundaries and do not imply that formal `FR-*` will close
    8. Fill Pages, States & Permissions for UI-facing features
       Required states: default, empty, loading, error, permission_denied, disabled, long_content, mobile
       If a state is not applicable, write why
    9. Generate Functional Requirements
       Each requirement must be testable
       Use reasonable defaults for unspecified details (document assumptions in Assumptions section)
       If the current work is only `prototype` or `spike`, do not use demo-only deliverables to imply formal `FR-*` closure; put them in the optional `PROTO-*` / `SPIKE-*` section instead
    10. Generate business rules, data dictionary, non-functional requirements, and external dependency preconditions when relevant
    11. Define Success Criteria
       Create measurable, technology-agnostic outcomes
       Include both quantitative metrics (time, performance, volume) and qualitative measures (user satisfaction, task completion)
       Each criterion must be verifiable without implementation details
    12. Identify Key Entities (if data involved)
    13. Fill Risks, Assumptions & Open Questions
    14. Map every P0/P1 requirement to interfaces:
       - Each requirement must reference page/view IDs, UI states, fields, operations, APIs, and acceptance criteria
       - Each page/view/modal/drawer must have a requirement source
       - If a requirement has no interface/API/test mapping, mark it as a gap or BLOCKED
    15. Identify upfront difficulties:
       - Research-heavy implementation, UI, data, integration, performance, permission, or interaction issues
       - For each high-risk difficulty, create a research item with alternatives and validation approach
       - Do not defer core feasibility research to implementation
    16. If integrations exist, enumerate the external systems, existing OSS stack, and any known `TBD-*` blocker placeholders that the plan must resolve before implementation
    17. Map the spec to product and testing artifacts:
       - `docs/product/prd-lite.md`
       - `docs/product/page-inventory.md`
       - `docs/product/state-matrix.yaml`
       - `docs/product/acceptance-criteria.md`
       - `docs/product/requirement-interface-matrix.md`
       - `docs/product/difficulty-research.md`
       - `specs/<feature>/acceptance-examples.md`
       - `specs/<feature>/requirements-testability-review.md`
       - `specs/<feature>/verify-matrix.md`
       - `specs/<feature>/test-strategy.md`
       - `specs/<feature>/test-manifest.json`
    18. Return: SUCCESS (spec ready for clarification or planning)

5. Write the specification to SPEC_FILE using the template structure, replacing placeholders with concrete details derived from the feature description (arguments) while preserving section order. The final written headings and prose must be in Simplified Chinese.

6. **Specification Quality Validation**: After writing the initial spec, validate it against quality criteria:

   a. **Create Spec Quality Checklist**: Generate a checklist file at `FEATURE_DIR/checklists/requirements.md`

   b. **Run Validation Check**: Review the spec against each checklist item

   c. **Required quality dimensions**:
      - Goals and non-goals are explicit
      - Scope boundary is clear
      - User stories are independently testable
      - Page inventory and state coverage are complete for UI-facing work
      - Requirement-to-interface mapping covers every P0/P1 requirement
      - Every interface element has a requirement source
      - Delivery mode is explicit and matches the intended acceptance boundary
      - Features mentioning existing OSS/external systems do not silently downgrade to local mock behavior
      - Prototype / spike deliverables are not masquerading as completed formal `FR-*`
      - High-risk difficulties have research items before implementation
      - Permission differences are represented
      - Functional requirements are testable
      - P0/P1 requirements have observable results, positive examples, negative or edge examples, required test data, and evidence paths
      - Testability status is not `Ready` when required external evidence is missing
      - Prototype / spike evidence does not close formal integration or production requirements
      - Acceptance criteria are measurable
      - Risks, assumptions, and open questions are documented

   d. **Handle Validation Results**:
      - **If all items pass**: Mark checklist complete and proceed
      - **If items fail (excluding [NEEDS CLARIFICATION])**: Update spec and re-validate (max 3 iterations)
      - **If [NEEDS CLARIFICATION] markers remain**: Present options to user with suggested answers

7. Report completion with branch name, spec file path, checklist results, and readiness for the next phase (`/speckit.clarify` or `/speckit.plan`).

## General Guidelines

- Focus on **WHAT** users need and **WHY**.
- Avoid HOW to implement (no tech stack, APIs, code structure).
- Written for business stakeholders, not developers.
- DO NOT create any checklists that are embedded in the spec.

### Section Requirements

- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### Success Criteria Guidelines

Success criteria must be:

1. **Measurable**: Include specific metrics (time, percentage, count, rate)
2. **Technology-agnostic**: No mention of frameworks, languages, databases, or tools
3. **User-focused**: Describe outcomes from user/business perspective, not system internals
4. **Verifiable**: Can be tested/validated without knowing implementation details

**Good examples**:

- "Users can complete checkout in under 3 minutes"
- "System supports 10,000 concurrent users"
- "95% of searches return results in under 1 second"
- "Task completion rate improves by 40%"

**Bad examples** (implementation-focused):

- "API response time is under 200ms" (too technical, use "Users see results instantly")
- "Database can handle 1000 TPS" (implementation detail, use user-facing metric)

## Next Steps

- `/speckit.clarify` - Clarify specification requirements
- `/speckit.plan` - Create a technical plan for the spec
