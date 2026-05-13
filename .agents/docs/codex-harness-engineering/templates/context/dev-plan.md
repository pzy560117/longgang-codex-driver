# DEV-PLAN 模板

## 1. 基本信息

- `feature_id`:
- `title`:
- `owner`:
- `source_docs`:
  - `docs/product/...`
  - `docs/design/...`
  - `contracts/...`

## 2. 目标与完成定义

- 业务目标:
- 技术目标:
- Done 定义:

## 3. 真相源

- Product Spec:
- PRD-Lite:
- Page Inventory:
- State Matrix:
- Acceptance Criteria:
- Acceptance Examples:
- Requirement Interface Matrix:
- Traceability Matrix:
- Difficulty Research:
- Design Brief:
- 设计稿 / Figma:
- Component Map:
- Screen States:
- Design Tokens:
- AI Image Brief:
- UI Image Review:
- Image To Frontend Spec:
- Visual Parity Review:
- Contract:
- Test Matrix:
- E2E Plan:
- Test Data Plan:
- Test Data Matrix:
- Risk Based Test Plan:
- Regression Plan:
- Evidence Protocol:
- Failure Triage:
- Coverage Policy:
- Verify Matrix:
- Repo map:

## 4. 阶段闸门

| 阶段 | 进入条件 | 输出 | 未满足时处理 |
| --- | --- | --- | --- |
| Product Readiness | 原始需求已澄清，P0/P1 需求已补齐验收标准、验收示例和追溯入口 | `docs/product/*`, `ACCEPTANCE_CRITERIA.md`, `ACCEPTANCE_EXAMPLES.md`, `TRACEABILITY_MATRIX.md` | BLOCKED 或补需求 |
| Design Readiness | Product Readiness 通过 | `docs/design/*` | BLOCKED 或补设计 |
| UI Image Readiness | CSS/视觉规范完整，AI 生图已评审 | `ai-image-brief.md`, `ui-image-review.md`, `image-to-frontend-spec.md` | BLOCKED 或重生成/编辑图片 |
| Visual Parity Readiness | 前端页面已实现并可在浏览器打开 | `artifacts/visual-review/*`, `visual-parity-review.md` | BLOCKED 或修复 UI 后重新截图 |
| Test Readiness | P0/P1 需求已映射到测试层级、测试数据、affected tests、evidence path 和回归范围 | `test-matrix.md`, `TEST_DATA_MATRIX.md`, `RISK_BASED_TEST_PLAN.md`, `REGRESSION_PLAN.md`, `failure-triage.md` | BLOCKED 或补测试计划 |
| Contract Readiness | API / 数据变化已明确 | `contracts/openapi.yaml` | BLOCKED 或豁免说明 |
| Implementation | Product、Design、Plan、Testing 真相源齐全，Requirement IDs 已可追溯 | 代码、测试、trace | 禁止实现 |

## 5. Phase 划分

### Phase 1

- 目标:
- 交付物:
- 前置条件:
- 风险:

### Phase 2

- 目标:
- 交付物:
- 前置条件:
- 风险:

### Phase 3

- 目标:
- 交付物:
- 前置条件:
- 风险:

## 6. Task 拆分规则

- 每个 Task 只处理一个明确目标。
- 每个 Task 必须能在 fresh session 中完成。
- 每个 Task 必须有自己的验证命令。
- 每个实现 Task 必须声明 Requirement IDs、owned paths、affected tests 和 evidence expectation。
- 不允许把“实现 + 修所有 bug + 补所有测试”混成一个任务。

## 7. 当前 Task 队列

| Task ID | Phase | 目标 | 依赖 | 验证命令 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T001 | P1 | | | | todo |

## 8. 评审与修复闭环

```text
实现
  -> Stage 1 review（Spec / 设计稿 / DEV-PLAN 一致性）
  -> 浏览器截图与设计参考图视觉还原对比
  -> 修复偏差
  -> Stage 2 review（代码质量 / 测试 / 风险）
  -> 修复问题
  -> verify + fresh evidence
  -> 才允许完成
```

## 9. 验证矩阵

- 类型检查:
- Lint:
- Acceptance / Examples:
- Traceability:
- 单元测试:
- 组件 / Story 测试:
- Contract 测试:
- API integration:
- 集成测试:
- E2E:
- Affected Tests:
- P0/P1 Regression:
- Visual regression:
- Visual parity screenshots:
- Contract validation:
- Coverage:
- Verify matrix:

## 10. BLOCKED 条件

- 缺少设计稿或状态矩阵
- 缺少 PRD-Lite、页面清单或验收标准
- 缺少可执行验收示例
- 缺少需求到界面的完整追溯矩阵
- 缺少 `TRACEABILITY_MATRIX.md` 或 Requirement IDs 无法落到代码/测试
- 高风险难点没有研究结论
- 缺少 Design Brief、Component Map、Screen States 或 Design Tokens
- AI 生成界面图未评审通过
- 图片未转换成前端可实现规格
- 前端 UI 缺少真实浏览器截图和设计参考图对比报告
- Contract 未冻结
- P0/P1 需求缺少 `test-matrix.md` 映射
- P0/P1 需求缺少 `TEST_DATA_MATRIX.md`、`REGRESSION_PLAN.md` 或 affected tests
- E2E 缺少 seed 或账号数据
- 测试失败没有 failure class 和 owner hint
- 把 Stage 17 当成第一次定义测试范围的入口
- 依赖任务未完成
- 关键环境不可用
- 需要人工决策

## 11. 跨 Session 接续规则

- 新 session 开始时先读本文件。
- 进入新 Phase 前先重新读取真相源文档。
- 如果设计稿、Product Spec、Contract 有变更，先更新本计划再编码。
