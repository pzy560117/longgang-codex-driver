# DEV-PLAN

## 1. 基本信息

- `feature_id`: `FEAT-TICKET-FILTER`
- `title`: `工单筛选与保存视图`

## 2. 真相源

- Product Spec: `docs/product/prd-lite.md`
- Design Brief: `docs/design/design-brief.md`
- 状态矩阵: `docs/product/state-matrix.yaml`
- Component Map: `docs/design/component-map.md`
- Screen States: `docs/design/screen-states.md`
- Contract: `contracts/openapi.yaml`

## 3. Phase 划分

### Phase 1

- 目标: 冻结 Product Spec、Design Brief、状态矩阵
- 交付物: `docs/product/*`、`docs/design/design-brief.md`

### Phase 2

- 目标: 完成 component-map、screen-states、contract
- 交付物: `component-map.md`、`screen-states.md`、`openapi.yaml`

### Phase 3

- 目标: 实现前端组件与页面
- 交付物: `TicketFilterBar`、`SavedViewModal`、stories

### Phase 4

- 目标: 联调、E2E、visual regression
- 交付物: generated client、mock、测试

## 4. Task 拆分

| Task ID | Phase | 目标 | 依赖 | 验证命令 | 状态 |
| --- | --- | --- | --- | --- | --- |
| T001 | P2 | 冻结 OpenAPI 与 generated client | P1 | contract validate | todo |
| T002 | P3 | 实现 `TicketFilterBar` 与 stories | T001 | typecheck + story | todo |
| T003 | P3 | 实现 `SavedViewModal` 与 stories | T001 | typecheck + unit | todo |
| T004 | P4 | 联调与回归 | T002,T003 | e2e + visual | todo |
