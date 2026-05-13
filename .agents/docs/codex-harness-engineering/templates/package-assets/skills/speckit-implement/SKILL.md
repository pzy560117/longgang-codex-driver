---
name: speckit-implement
description: Execute tasks from tasks.md with per-task planning, validation, and task-boundary completion control
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## 语言要求

- 与用户的执行进展、验证结果、阻塞说明、完成汇报全部使用简体中文。
- 如需回写 `tasks.md`、补充说明或更新当前 feature 文档，实际落盘内容必须使用简体中文。
- 保留 `_Requirements: ..._`、任务 ID、HTML `<!-- id: XX -->`、路径、命令等机器敏感标记原样不变。

## Driver-First Rule

- do not try to finish the entire feature in one uninterrupted pass
- focus on the current task boundary first
- before editing files, enter built-in Plan mode and break the current task into 3-7 flat implementation steps
- prefer sub-agents for complex or cross-surface tasks, but do not block simple tasks on that formality
- only mark task checklist items as done after their validation command passes
- when the feature plan is ready for repository execution, convert the task boundary into `task.json` and let the full driver own execution, trace, and commit

## Outline

1. Run `.agents/.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count:
     - Total items: All lines matching `- [ ]` or `- [X]` or `- [x]`
     - Completed items: Lines matching `- [X]` or `- [x]`
     - Incomplete items: Lines matching `- [ ]`
   - Create a status table:

     | Checklist | Total | Completed | Incomplete | Status |
     |-----------|-------|-----------|------------|--------|
     | ux.md     | 12    | 12        | 0          | ✓ PASS |
     | test.md   | 8     | 5         | 3          | ✗ FAIL |
     | security.md | 6   | 6         | 0          | ✓ PASS |

   - **If any checklist is incomplete**:
     - Display the table with incomplete item counts
     - **STOP** and ask: "Some checklists are incomplete. Do you want to proceed with implementation anyway? (yes/no)"
     - Wait for user response before continuing

   - **If all checklists are complete**:
     - Display the table showing all checklists passed
     - Automatically proceed to step 3

3. Load and analyze the implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list and execution plan
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **IF EXISTS**: Read data-model.md for entities and relationships
   - **IF EXISTS**: Read contracts/ for API specifications and test requirements
   - **IF EXISTS**: Read research.md for technical decisions and constraints
   - **IF EXISTS**: Read quickstart.md for integration scenarios

4. **Project Setup Verification**:
   - **REQUIRED**: Create/verify ignore files based on actual project setup:

   **Detection & Creation Logic**:
   - Check if git repo exists → create/verify .gitignore
   - Check if Dockerfile* exists or Docker in plan.md → create/verify .dockerignore
   - Check if .eslintrc* exists → create/verify .eslintignore
   - Check if eslint.config.* exists → ensure the config's `ignores` entries cover required patterns
   - Check if .prettierrc* exists → create/verify .prettierignore
   - Check if .npmrc or package.json exists → create/verify .npmignore (if publishing)
   - Check if terraform files (*.tf) exist → create/verify .terraformignore

   **Common Patterns by Technology** (from plan.md tech stack):
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **Universal**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

5. Parse tasks.md structure and extract:
   - **Task phases**: Setup, Tests, Core, Integration, Polish
   - **Task dependencies**: Sequential vs parallel execution rules
   - **Task details**: ID, description, file paths, parallel markers [P]
   - **Execution flow**: Order and dependency requirements

6. **子任务执行循环** (对每个子任务重复执行):

   **6.1 子任务分析阶段** (进入新子任务前必须执行):
   - 从 tasks.md 读取当前要执行的子任务
   - 分析子任务的具体要求、输入输出、依赖关系
   - 识别需要修改/创建的文件列表
   - 确认技术方案和实现思路
   - 先进入内置 Plan mode，只围绕当前子任务拆成 3-7 个扁平子步骤
   - **输出**: 简洁的子任务分析摘要（2-3行）

   **6.2 子任务实现阶段**:
   - 按分析结果执行具体实现
   - 遵循 TDD：先写测试再写实现（如适用）
   - 确保代码符合项目规范和设计文档

   **6.3 子任务完成更新** (完成后立即执行):
   - 先运行当前子任务块里的 `🔍 自检命令`
   - **立即**将 tasks.md 中对应任务标记为 `[X]`
   - 记录完成时间和关键产出（如新增文件路径）
   - 验证子任务产出符合预期

   **6.4 进入下一个子任务**:
   - 返回步骤 6.1，分析下一个未完成的子任务
   - 直到当前 Phase 的所有子任务完成

7. Execute implementation following the task plan:
   - **Phase-by-phase execution**: Complete each phase before moving to the next
   - **Respect dependencies**: Run sequential tasks in order, parallel tasks [P] can run together  
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify each phase completion before proceeding
   - Prefer stopping at a single completed task boundary and hand full-driver execution back to `task.json` / `codex-loop.ps1` when repository automation should continue

8. Implementation execution rules:
   - **Setup first**: Initialize project structure, dependencies, configuration
   - **Tests before code**: If you need to write tests for contracts, entities, and integration scenarios
   - **Core development**: Implement models, services, CLI commands, endpoints
   - **Integration work**: Database connections, middleware, logging, external services
   - **Polish and validation**: Unit tests, performance optimization, documentation

9. Progress tracking and error handling:
   - Report progress after each completed task
   - Halt execution if any non-parallel task fails
   - For parallel tasks [P], continue with successful tasks, report failed ones
   - Provide clear error messages with context for debugging
   - Suggest next steps if implementation cannot proceed
   - **CRITICAL**: 每个子任务完成后必须立即更新 tasks.md，不要批量更新

10. Completion validation:
    - Verify all required tasks are completed
    - Check that implemented features match the original specification
    - Validate that tests pass and coverage meets requirements
    - Confirm the implementation follows the technical plan
    - Report final status with summary of completed work

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/speckit.tasks` first to regenerate the task list.
