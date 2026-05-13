# Ticket Filter Demo

这个 demo 不是完整可运行应用，而是一个**最小可读的真相源链路示例**，用来说明下面这条工作流在实际目录里应该长什么样：

```text
Product Spec
  -> Requirement Interface Matrix + Difficulty Research
  -> Design Brief
  -> AI Image Brief
  -> UI Image Review
  -> Image To Frontend Spec
  -> DEV-PLAN
  -> OpenAPI Contract
```

适用场景:

- 想快速理解 `spec-to-ui-to-code-workflow.md`
- 想看模板填完之后实际应该长什么样
- 想给新项目做第一版 feature skeleton

## 目录

- `docs/product/`: 需求、页面、状态矩阵、需求-界面追溯、前置难点研究
- `docs/design/`: 设计 brief、AI 生图 brief、图片评审、图转前端规格、组件映射、屏幕状态
- `plans/features/`: DEV-PLAN
- `contracts/`: OpenAPI 样例
- `contracts/orval.config.ts`: Orval 配置样例
- `packages/ui/`: 最小前端组件样例
- `stories/`: 最小 Storybook 状态样例
- `packages/api-client/generated/`: 最小 generated client 样例
- `task.json`: 最小任务队列样例
- `traces/`: 最小 trace 样例
- `verify.ps1`: fake verify 链路样例

## 怎么用

1. 先读 `docs/product/prd-lite.md`
2. 再读 `docs/product/requirement-interface-matrix.md` 与 `docs/product/difficulty-research.md`
3. 再读 `docs/design/design-brief.md`
4. 再读 `docs/design/ai-image-brief.md`、`docs/design/ui-image-review.md` 与 `docs/design/image-to-frontend-spec.md`
5. 再读 `docs/design/component-map.md` 与 `docs/design/screen-states.md`
6. 再读 `plans/features/ticket-filter.dev-plan.md`
7. 最后读 `contracts/openapi.yaml`
8. 如需检查 demo 资产是否齐全，运行:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1
```

9. 如果想看 driver 闭环最小输入输出，再看：

- `task.json`
- `traces/DEMO-TICKET-FILTER-001-20260422-120000.json`

## 这个 demo 刻意没有做什么

- 没有放完整后端实现
- 没有放真实 Playwright / visual baseline 资产
- 没有接真实构建配置

目的不是提供业务代码，而是提供**项目开始前的真相源样例**。
