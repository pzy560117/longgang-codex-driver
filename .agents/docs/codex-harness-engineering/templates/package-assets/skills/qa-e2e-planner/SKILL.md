---
name: qa-e2e-planner
description: 专门扫描前端工程，生成零幻觉、元素级的端到端测试大纲 (e2e-plan.md)。不侵入原工程的 tasks 体系。
---

# QA E2E Planner 专业测试计划生成器

## 核心职责
本 Skill 完全独立于常规业务开发流程，专职扮演 **QA 架构师** 角色，负责对前端项目进行自动化排雷扫描，生成标准的 `e2e-plan.md` 端到端验证计划。

## 执行前置条件
用户已完成前端页面的切图/开发，需要开始进入测试验收环节时调用。

## 工作流 (Workflow)

严格按照 **"扫描 -> 计划 -> 审核 -> 生成任务"** 的顺序执行，不得越级跳步：

1. **深度扫描组件 (Mock & DOM 提取)**
   - 必须通过底层文件 API (`find_by_name` / `list_dir` / `view_file`) 全面读取当前正在开发或测试的 Vue/React 视图组件文件。
   - 提取 `<template>` 中所有的交互式控件，例如：`<button>`、`<input>`、`<select>` 等。
   - 通过 `grep_search` 或深度读取，检索代码中 `mock`、`MockStateWrapper` 等硬编码虚拟数据的痕迹。

2. **导出标准化测试大纲 (e2e-plan.md)**
   - 根据收集到的待测点与排雷点，调用模板 `.agents/.specify/templates/e2e-plan-template.md`。
   - 分章节输出：**Mock 排雷清单**、**各页面元素级断言**（即测试用例）、**CRUD 闭环业务流**。
   - ⚠️ **输出路径强制规范**：必须使用 `write_to_file` 将文件写入**项目根目录**（即与 `frontend/`、`backend/` 同级），路径为 `<项目根路径>/e2e-plan.md`。**绝对禁止**将此文件写入 artifact 目录（`~/.gemini/...`）。
   - **注意**：大纲生成完毕后必须立即挂起操作。

3. **🚧 强制人工Review拦截点 (Mandatory User Review) 🚧**
   - 此时**严禁直接生成 Tasks 或去执行**。
   - 必须使用 `notify_user` (设置 `BlockedOnUser: true`) 向用户发起 `e2e-plan.md` 的审核请求。
   - 附带话术请用户审查是否存在测试用例遗漏（例如边界状态、特定弹窗未包含）。

4. **生成测试执行任务 (Generate Tasks)**
   - 仅在用户针对 `e2e-plan.md` 审核通过后！！！
   - 向 `tasks.md` 的末尾（或专门的测试 Task 文件中），严格追加 E2E 阶段特有格式的验证和执行层 Task。
   - 任务点必须显式指定调用后面的专用 Skills：`/qa-mock-cleaner` 和 `/qa-e2e-runner`。

5. **交接执行层 (Handoff)**
   - 任务追加完毕后通知用户：测试架构已准备就绪。引导用户调用执行工具链开始真正的自动化验证。
