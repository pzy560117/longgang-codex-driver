---
name: speckit-e2e-tasks
description: 生成严谨且具有强约束的 E2E 测试大纲 (e2e-plan.md) 并在 tasks.md 中精准追加格式一致的验证任务层。绝对禁绝 Mock。
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Context & Objectives

此 Skill 专精于 OpenSpec 的前端测试落地 (Test-Left 策略)。在正式交付前端进入整体实施环节前，本工作流将分析已有前端切页，以绝对严苛的模板和任务规范为当前项目生成端到端测试大纲 (e2e-plan.md)。保证格式可控且任务格式 (`tasks.md`) 完全无缝对齐 OpenSpec 标准。

## Outline

1. **Setup & Component Discovery**:
   - 阅读目标特性目录的 `tasks.md`（或 `plan.md`），获取目前的 Task ID 增长规律（如 `<!-- id: X0 -->` 系列）以及涉及的页面。
   - **强制遍历指令:** 必须使用 `find_by_name` 或 `list_dir` 锁定 `frontend/src/pages/`、`views/` 等目录下具体的 `.vue` 页面文件列表。
   - 必须基于上述页面采用 `grep_search` 或深度读取源码，搜索 `mock` 关键字、组件属性写死数组等，精准生成无幻觉的 “Mock依赖排雷清单”。

2. **Element Deep Extraction & Generate Standardized e2e-plan.md**:
   - 调用并克隆参考模板 `.agents/.specify/templates/e2e-plan-template.md`。
   - **强制源码解构:** 严禁自由联想。必须通过 `view_file` 彻底读取所有相关 `.vue` 文件的 `<template>` 结构。精准提取出所有的 `<button>`、`<input>`、`el-select/a-select` 等交互控件，以及 `v-if`/`v-show` 所定义的动态状态(加载屏、空态、报错视图)。
   - 将这些确凿的交互元素清单对应填入模板的 **“2.元素级扫描”** 和 **“3. CRUD 闭环”** 中，并强制与 [D1-D10] 维度进行绑定映射。
   - 将最终结构化分析的结果保存至对应的特性目录 (例如 `specs/xxx/e2e-plan.md`)。

3. **Append Tasks using Strict `Speckit Tasks` Format (CRITICAL)**:
   - 必须向原有的 `tasks.md` 末尾追加全新的 Phase。
   - 所有的 Task **必须逐一严格遵循以下格式结构**，禁止遗漏 `<!-- id: XX -->` 和 Emoji 符号 `📋` `✅` `📁` `📝`：

```markdown
## Phase X: E2E 极致验收与 Mock 清理 <!-- id: [获取当前最高Phase的十位+10] -->

**Goal**: 扫除所有的 Mock 数据拦截器保证生产流量贯通，并使用自动化代理执行 10 维度验收。

- [ ] **T0XX [US-ALL] 前置检查: 扫除本模块界面中的 Mock 数据引用** <!-- id: X1 -->
  - 📋 **规格参考**: e2e-plan.md → 第1节排雷清单
  - ✅ **验收标准**: 前端代码完全剥离 Mock，所有前端页面的请求对接真实的 API 端点且不产生 404/跨域。
  - 📁 **修改文件**: [填写步骤1扫出来的具体页面]
  - 📝 **执行内容**: 清除硬编码、恢复 Axios 的网络层拦截调用，或者关闭 `MockStateWrapper`。

- [ ] **T0XY [US-ALL] 执行全面元素级与 CRUD 闭环 E2E 测试** <!-- id: X2 -->
  - 📋 **规格参考**: e2e-plan.md
  - ✅ **验收标准**: 执行 `/browser-e2e-testing` 并全流程 Pass（通过每一个页面交互元素的点击、非法输入验证，及完整的 增、删、改、查 生命周期流转验证，过程中禁绝一切 Fake Data）。
  - 📝 **执行内容**: 根据大纲跑通全功能。
```

4. **Report to User**:
   - 通知用户该特性的 E2E 大纲及其配套的 tasks 生成完毕。提醒使用者若计划无误即可使用 `/speckit.implement` 执行排雷，最后再调用 `/browser-e2e-testing` 运行测例。
