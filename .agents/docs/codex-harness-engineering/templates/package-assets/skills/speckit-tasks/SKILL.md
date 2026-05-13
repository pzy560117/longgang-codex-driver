---
name: speckit-tasks
description: Generate an actionable, dependency-ordered tasks.md for the feature based on available design artifacts.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的生成汇报、任务摘要、MVP 建议全部使用简体中文。
- 实际写入仓库的 `tasks.md` 必须使用简体中文。
- 即使模板原文是英文，实际落盘时也要把 Phase 标题、Goal、Independent Test、Checkpoint、说明文字改写成中文。
- 保留不能随意翻译的机器敏感标记与技术标识，例如 `_Requirements: ..._`、`FR-001`、任务 ID、HTML `<!-- id: XX -->`、路径、命令。

## Outline

1. **Setup**: Run `.agents/.specify/scripts/powershell/check-prerequisites.ps1 -Json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load design documents**: Read from FEATURE_DIR:
   - **Required**: plan.md (tech stack, libraries, structure), spec.md (user stories with priorities)
   - **Testing truth sources**: acceptance-examples.md, requirements-testability-review.md, verify-matrix.md, test-strategy.md, test-manifest.json when present
   - **Optional**: data-model.md (entities), contracts/ (API endpoints), research.md (decisions), quickstart.md (test scenarios)
   - Note: Not all projects have all documents. Generate tasks based on what's available.

3. **Execute task generation workflow**:
   - Load plan.md and extract tech stack, libraries, project structure
   - Load spec.md and extract user stories with their priorities (P1, P2, P3, etc.)
   - If data-model.md exists: Extract entities and map to user stories
   - If contracts/ exists: Map endpoints to user stories
   - If research.md exists: Extract decisions for setup tasks
   - If test-manifest.json or verify-matrix.md exists: Map requirement testability, test layers, test files, commands, blockers, gaps, and evidence paths into task fields
   - If requirements-testability-review.md marks a requirement as `Blocked`, do not generate a task that closes that formal `FR-*`; generate blocker/evidence work first
   - If the feature mentions predefined OSS stacks or real external systems: schedule environment/blocker/integration tasks before UI or BFF tasks
   - If a story is `integration` / `production` and spans external systems, connectors, BFF/API, or UI, decompose it into acceptance-sized slices instead of one epic-style task
   - Prefer 4-6 tasks for an integration-heavy story: blocker/evidence readiness, contract projection, real connector path, bridge/policy metadata, upper-layer aggregation or UI consumption, final integration transcript
   - If one candidate task would simultaneously close blockers, implement real connectors, add BFF/API/UI, and write final evidence, split it before continuing
   - Generate tasks organized by user story (see Task Generation Rules below)
   - Generate dependency graph showing user story completion order
   - Create parallel execution examples per user story
   - Validate task completeness (each user story has all needed tasks, independently testable)
   - If a story still collapses into a single oversized task, regenerate it with finer acceptance boundaries before writing `tasks.md`

4. **Generate tasks.md**: Use `.agents/.specify/templates/tasks-template.md` as structure, fill with:
   - Correct feature name from plan.md
   - **📚 文档引用索引**: 列出 FEATURE_DIR 中实际存在的文档
   - **🛠️ 技术栈速查**: 从 plan.md 提取技术栈到表格
   - Phase 1: Setup tasks (project initialization)
   - Phase 2+: One phase per user story (in priority order from spec.md)
   - Each phase includes: Goal, Independent Test, implementation tasks
   - Final Phase: Polish & cross-cutting concerns
   - All tasks must follow the strict task format (see Task Format Rules below), including testing fields for behavior/integration work
   - Dependencies section with ASCII dependency graph + User Story dependency table
   - Implementation strategy section (MVP first, incremental delivery)

5. **Report**: Output path to generated tasks.md and summary:
   - Total task count
   - Task count per user story
   - Stories intentionally kept as a single task (with explicit justification)
   - Parallel opportunities identified
   - Independent test criteria for each story
   - Suggested MVP scope (typically just User Story 1)
   - Format validation: Confirm ALL tasks follow the required format

## Task Format Rules

**CRITICAL**: Tasks MUST be organized by user story to enable independent implementation and testing.

**CRITICAL**: Default to one clear task boundary per round. Do not generate tasks that implicitly require the implementation agent to read the entire feature and finish everything in one pass.

**CRITICAL**: For `integration` / `production` stories, do not collapse the whole story into one giant `T001`-style task. A task should usually correspond to one acceptance checkpoint and be small enough to split into 3-7 flat Plan mode substeps.

**Testing is left-shifted**: Do not wait until `/speckit.implement` or `/speckit.verify` to invent test scope. Use `acceptance-examples.md`, `requirements-testability-review.md`, `verify-matrix.md`, `test-strategy.md`, and `test-manifest.json` when they exist.

**Tests are contextual, not optional by default**:
- Documentation-only tasks may use documentation validation such as `git -c core.safecrlf=false diff --check`.
- Behavior-changing tasks should include test file / command mapping or explicitly mark `TEST-GAP`.
- Bugfix tasks must include a failing test, failure transcript, or reproducible failure evidence.
- `integration` / `production` tasks must include evidence paths and at least one non-unit verification layer when applicable.

### 集成型 Story 拆分规则

- 如果一个故事同时涉及 `TBD-*` 阻塞、真实 connector、BFF/API 聚合、页面消费和最终证据，必须拆成多个任务，不要压成一个 epic 任务。
- 推荐拆分顺序是：环境或 blocker 证据 -> contract projection / schema mapping -> real connector / read-write path -> bridge / policy / metadata / RBAC -> BFF/API/UI 消费 -> 联调 transcript / 失败态证据。
- 如果一个任务同时承担 3 类以上职责，默认视为粒度过粗，应继续拆分。
- 如果某个故事最终只保留 1 个任务，必须在任务说明或生成汇报里给出明确理由，例如“本轮只做 blocker note”或“当前切片仅包含单文件修复”。

### Task Item Format (REQUIRED)

Every task MUST strictly follow this structure:

```markdown
- [ ] **T00X [P?] [USn?] 任务描述** <!-- id: XX -->
  - 📋 **规格参考**: document.md → Section
  - _Requirements: FR-XXX, FR-YYY_
  - ✅ **验收标准**: 可验证的完成条件
  - 📁 **创建文件**: `path/to/file` (或 **修改文件**)
  - 📝 **执行内容**:
    - 具体步骤 1
    - 具体步骤 2
```

**Format Components**:

1. **Checkbox + Bold**: `- [ ] **T00X ...** <!-- id: XX -->`
2. **Task ID**: Sequential (T001, T002, T003...) in execution order, **bold**
3. **HTML Comment ID**: `<!-- id: XX -->` for task tracking (Phase×10 + seq)
4. **[P] marker**: Include ONLY if parallelizable (different files, no dependencies)
5. **[USn] label**: REQUIRED for user story phase tasks only (US1, US2, ...)
6. **📋 规格参考**: Link to source document and section
7. **_Requirements_**: Italic, list of FR/NFR codes from spec.md
8. **✅ 验收标准**: Measurable acceptance criteria
9. **📁 文件清单**: Files to create/modify (with full paths)
10. **🧪 测试文件**: Required for behavior-changing tasks, or `TEST-GAP` with reason
11. **🔴 RED 命令**: Required for bugfix/TDD tasks; recommended for behavior-changing tasks
12. **🟢 GREEN 命令**: Command expected to pass after implementation
13. **📌 受影响测试**: Affected tests or regression commands
14. **📎 证据文件**: Evidence path for integration/production tasks
15. **🧪 验证层**: unit / component / contract / integration / e2e / visual / downstream
16. **🔍 自检命令**: Minimal executable task completion proof
17. **📝 执行内容**: Detailed implementation steps or method list

**Icons reference**:
- 📋 = 规格参考 (spec reference)
- 📁 = 文件清单 (file list)
- 📝 = 执行内容/方法清单 (implementation details)
- ✅ = 验收标准/一致性检查/验证场景 (acceptance criteria)

**Examples**:

- ✅ CORRECT:
```markdown
- [ ] **T005 [US1] 实现 AuthService 业务逻辑** <!-- id: 24 -->
  - 📋 **规格参考**: spec.md → FR-001~FR-005
  - _Requirements: FR-001, FR-002, FR-003_
  - 📁 **创建文件**: `service/AuthService.java`
  - 📝 **方法清单**:
    - `register()`: BCrypt 加密、手机号去重
    - `login()`: 密码校验、签发 JWT
```

- ✅ CORRECT:
```markdown
- [ ] **T012 [P] [US3] 创建 Flyway 迁移** <!-- id: 32 -->
  - 📋 **规格参考**: data-model.md → Script
  - _Requirements: FR-006_
  - 📁 **创建文件**: `db/migration/V1__create_script.sql`
  - ✅ **字段检查**: 14 个字段，含 type/difficulty
```

- ❌ WRONG: `- [ ] T001 Create project structure` (missing bold, missing HTML id, missing 📋/📁/✅)
- ❌ WRONG: `- [ ] **T005 [US1] 描述**` (missing HTML comment id, missing sub-items)

### Phase Structure

Each Phase MUST have:
- Phase title with `<!-- id: X0 -->` HTML comment
- **Goal**: Brief description
- **Independent Test**: How to verify independently
- Tasks following the format above
- **Checkpoint**: Completion criteria at phase end

Phase ordering:
- **Phase 1**: Setup (project initialization and infrastructure)
- **Phase 2+**: User Stories in priority order (P1, P2, P3...)
  - Within each story: Structure → Data → Logic → Interface → Verification
  - For `integration` / `production` stories, prefer: blocker/evidence → connector → logic/aggregation → interface → verification
  - Each phase should be a complete, independently testable increment
- **Final Phase**: Polish & Cross-Cutting Concerns

### Dependencies Section (REQUIRED)

Must include:
1. **ASCII dependency graph** showing Phase relationships
2. **User Story dependency table** (Story | 依赖 | 所在 Phase)
3. **并行机会** listing which Phases/tasks can run in parallel

## Next Steps

- `/speckit.analyze` - Run a project analysis for consistency
- `/speckit.implement` - Start the implementation in phases
- `/speckit.verify` - Run feature-level verification after implementation completes
