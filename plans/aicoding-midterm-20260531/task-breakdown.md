# Task Breakdown：AICoding 中期收口任务

## 1. 拆分原则

本拆分面向后续进入 `task.json` 的 driver-first 执行模式。每个任务应保持 single task，可独立验证，不把文档、演示、真实环境接入和功能开发混在同一任务里。

进入 `task.json` 前，应按仓库规则补齐：

- `architecture_constraints`
- `forbidden_implementations`
- `owned_paths`
- `test_command`
- 依赖关系

## 2. 推荐任务组

### `AICODING-MIDTERM-PLAN-001`

目标：固化中期评审计划、证据清单和演示口径。

Owned paths：

- `plans/aicoding-midterm-20260531/`

验证：

```powershell
git diff --check -- plans/aicoding-midterm-20260531
```

完成证据：

- 本目录文档存在。
- 计划、任务、演示和证据清单互相引用一致。

### `AICODING-EVIDENCE-AUDIT-001`

目标：盘点当前统一导出平台的可用证据，明确哪些可用于中期评审、哪些只属于历史证据、哪些需要补跑。

Owned paths：

- `plans/aicoding-midterm-20260531/evidence-checklist.md`
- `docs/testing/`
- `traces/`

验证：

```powershell
npm run arch:check
npm run test:acceptance
git diff --check -- plans/aicoding-midterm-20260531 docs/testing
```

完成证据：

- 已标注本地 Docker/mock 验收证据。
- 已标注外部生产 MySQL、live OSS、真实业务数据源为下一阶段依赖。

### `AICODING-DEMO-REHEARSAL-001`

目标：跑通评审演示链路，形成可复现演示步骤。

Owned paths：

- `plans/aicoding-midterm-20260531/review-demo-outline.md`
- `docs/testing/`
- `scripts/`

建议验证：

```powershell
npm run demo:local:smoke
npm run test:acceptance
git diff --check -- plans/aicoding-midterm-20260531 docs/testing scripts
```

完成证据：

- 演示能覆盖创建任务、查询状态、异步执行、文件交付、失败或拒绝态。
- 演示口径明确“不声明生产上线”。

### `AICODING-WORKFLOW-PACK-001`

目标：把 Harness 工程化流程整理成团队可复用说明，说明人、AI、driver、review、测试、知识沉淀各自边界。

Owned paths：

- `docs/product/aicoding-workflow-v1-plan.md`
- `docs/harness/`
- `plans/aicoding-midterm-20260531/`

验证：

```powershell
git diff --check -- docs/product docs/harness plans/aicoding-midterm-20260531
```

完成证据：

- 能说明 `task.json -> codex-loop.ps1 -> verify/test -> traces/progress -> commit` 的闭环。
- 明确产品、业务专家、技术负责人和开发执行 Agent 的介入点。

### `AICODING-TEAM-HANDOFF-001`

目标：形成团队交接包，说明新功能如何按统一流程接入 AICoding。

Owned paths：

- `docs/harness/new-project-usage.md`
- `project-task-template.json`
- `plans/aicoding-midterm-20260531/`

验证：

```powershell
git diff --check -- docs/harness/new-project-usage.md project-task-template.json plans/aicoding-midterm-20260531
```

完成证据：

- 新任务如何写 PRD、Spec、Architecture Constraints、task.json、test_command。
- 如何判断任务 blocked。
- 如何处理经验回流。

### `EXPORT-REAL-ENV-INTEGRATION-PLAN-001`

目标：为下一阶段真实环境接入制定计划，不在中期评审前强行伪造生产验收。

Owned paths：

- `docs/operations/`
- `plans/aicoding-midterm-20260531/`

验证：

```powershell
git diff --check -- docs/operations plans/aicoding-midterm-20260531
```

完成证据：

- 明确外部生产 MySQL、客户只读数据源、对象存储、网关认证上下文、部署入口的接入前置条件。
- 明确成功态证据和失败态证据。

## 3. 建议执行顺序

| 顺序 | Task ID | 依赖 | 说明 |
| --- | --- | --- | --- |
| 1 | `AICODING-MIDTERM-PLAN-001` | none | 先收口本目录 |
| 2 | `AICODING-EVIDENCE-AUDIT-001` | 1 | 盘点现有证据，不急于补功能 |
| 3 | `AICODING-DEMO-REHEARSAL-001` | 2 | 校准演示链路 |
| 4 | `AICODING-WORKFLOW-PACK-001` | 1,2 | 包装 Harness 方法论 |
| 5 | `AICODING-TEAM-HANDOFF-001` | 4 | 面向团队复制 |
| 6 | `EXPORT-REAL-ENV-INTEGRATION-PLAN-001` | 2,3 | 作为下一阶段计划，不作为本阶段完成条件 |

## 4. 不建议进入本阶段的任务

- 新增前端大屏或复杂 UI。
- 新增 Word / PDF / CUSTOM 导出格式。
- 把能源优化线与数据导出 PoC 混成同一个评审任务。
- 在没有真实凭证和环境前做“生产已接入”结论。
- 以 `InMemory*`、fixture repository 或 mock repository 冒充生产路径完成。
