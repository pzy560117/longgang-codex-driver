---
description: Generate comprehensive Test Cases, Test Plan, and actionable Tasks for an OpenSpec feature, emphasizing zero-mock validation, exhaustive element traversal, and full CRUD loop testing.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Context & Objectives

This workflow analyzes the current frontend interface, meticulously examines code for mocked data, and generates a robust E2E test plan (`e2e-plan.md`) along with standard OpenSpec tasks in `tasks.md`. By generating E2E test cases during the OpenSpec Planning phase (Test-Left), you ensure that:
1. **Zero-Mock Assurance**: No frontend interfaces rely on fake or mocked data; everything connects to real backend APIs.
2. **Exhaustive Coverage**: Every single interactive UI element (buttons, inputs, dropdowns) is mapped out and verified.
3. **CRUD Reliability**: Core business entities seamlessly undergo Create, Read, Update, and Delete testing sequences without breakage.

## Outline

1. **Context & Mock Extraction**: Read the frontend views (`src/pages`, `src/views`) identified by the feature spec. Rigorously check for the presence of mocked data or hardcoded dependencies. Flag these for mandatory cleanup.
2. **Element Traversal Analysis**: Iterate across all extracted interactive UI elements. Generate dedicated natural language `browser-subagent` commands to test bounds and interactions.
3. **CRUD Sequence Design**: Construct a cohesive execution sequence connecting Create -> Read -> Update -> Delete scenarios to validate the full business lifecycle.
4. **Plan Output (`e2e-plan.md`)**: Produce an `e2e-plan.md` detailing the exhaustive test cases structured around the 10 dimensions of E2E verification.
5. **Task Population (`tasks.md`)**: Append testing tasks into your `tasks.md`. Include an explicit task to clean up mock references, and a task to execute the E2E suites.

## Task Format Rules

When generating tasks for `tasks.md`, you MUST strictly use the `speckit.tasks` format:

```markdown
- [ ] **T00X [P?] [USn?] 任务描述** <!-- id: XX -->
  - 📋 **规格参考**: document.md → Section
  - ✅ **验收标准**: 可验证的完成条件
  - 📁 **关联文件**: 相关文件路径
  - 📝 **执行内容**: 具体执行细节
```

**Example Output**:

```markdown
- [ ] **T021 [US1] 扫除本模块界面中的 Mock 数据引用** <!-- id: 51 -->
  - 📋 **规格参考**: e2e-plan.md
  - ✅ **验收标准**: 界面不再依赖 `src/mock` 假数据，切换为真实 API
  - 📁 **修改文件**: `src/pages/user/UserListPage.vue`
  - 📝 **执行内容**: 移除 Mock 拦截器或假数据，对接实际后端接口
- [ ] **T022 [US1] 执行全面元素级与 CRUD 闭环 E2E 测试** <!-- id: 52 -->
  - 📋 **规格参考**: e2e-plan.md → TC-1.1, TC-1.2
  - ✅ **验收标准**: 所有设计的交互边界及 CRUD 闭环 100% 验证通过
  - 📝 **执行内容**: 调用 `/browser-e2e-testing` 根据 `e2e-plan.md` 逐一执行用例
```

## Next Steps

- Execute the overall feature and mock cleanup tasks via `/speckit.implement`.
- Use `/browser-e2e-testing` to systematically run the E2E tests against the verified live environment.
