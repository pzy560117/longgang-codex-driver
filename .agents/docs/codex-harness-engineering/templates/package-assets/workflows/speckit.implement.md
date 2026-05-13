---
description: Execute the implementation plan by processing tasks one boundary at a time instead of batch-finishing the whole feature.
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

3. Load and analyze the implementation context progressively:
   - **REQUIRED**: Read tasks.md only far enough to locate the current open task boundary
   - **REQUIRED**: Read plan.md only for the sections directly referenced by the current task
   - **IF NEEDED**: Read spec.md for the requirement or user story directly referenced by the current task
   - **IF EXISTS AND CURRENT TASK NEEDS IT**: Read data-model.md, contracts/, research.md, quickstart.md
   - Do **not** bulk-read the entire feature directory or attempt to plan every remaining task in one pass

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

5. Parse tasks.md structure and extract only the current execution slice:
   - **Current task phase**
   - **Current task dependencies**
   - **Current task details**: ID, description, file paths, parallel markers [P]
   - **Next immediate task only after the current one is complete**

6. **单任务执行循环** (一次只完成一个任务边界):

   **6.1 子任务分析阶段** (进入新子任务前必须执行):
   - 从 tasks.md 读取当前唯一要执行的子任务
   - 分析该任务的具体要求、输入输出、依赖关系
   - 识别该任务需要修改/创建的文件列表
   - 确认技术方案和实现思路
   - **输出**: 简洁的单任务分析摘要（2-3行）

   **6.2 子任务实现阶段**:
   - 按分析结果执行具体实现
   - 遵循 TDD：先写测试再写实现（如适用）
   - 确保代码符合项目规范和设计文档

   **6.3 子任务完成更新** (完成后立即执行):
   - **立即**将 tasks.md 中对应任务标记为 `[X]`
   - 记录完成时间和关键产出（如新增文件路径）
   - 验证该任务产出符合预期

   **6.4 进入下一个子任务**:
   - 当前轮次默认到此结束
   - 只有在明确需要续跑时，再返回步骤 6.1 分析下一个未完成任务

7. Execute implementation following the task plan:
   - **Task-boundary execution**: Default to one task per round, not the whole phase at once
   - **Respect dependencies**: Run sequential tasks in order; do not preemptively finish later tasks
   - **Follow TDD approach**: Execute test tasks before their corresponding implementation tasks
   - **File-based coordination**: Tasks affecting the same files must run sequentially
   - **Validation checkpoints**: Verify the current task before touching the next one

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
   - **CRITICAL**: 每个任务完成后必须立即更新 tasks.md，不要批量更新，更不要一次性勾完多个任务

10. Completion validation:
   - Verify the current task is completed and correctly tracked
   - Check that the current task matches the original specification
   - Validate that tests for the current task pass and coverage meets requirements
   - Confirm the current task follows the technical plan
   - Report status with summary of the current task boundary and the next suggested task

Note: This command assumes a complete task breakdown exists in tasks.md. If tasks are incomplete or missing, suggest running `/speckit.tasks` first to regenerate the task list.
