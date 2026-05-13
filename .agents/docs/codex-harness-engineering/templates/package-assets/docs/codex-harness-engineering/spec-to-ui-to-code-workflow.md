# Spec To UI To Code Workflow 模板

## 1. 工作流目标

- 当前 feature:
- 当前设计来源:
- 当前 contract 来源:
- 当前需要打通的主流程:

## 2. 顺序

```text
Product Spec
  -> acceptance-criteria + acceptance-examples
  -> requirement-interface-matrix + traceability-matrix + difficulty-research
  -> test-matrix + risk-based-test-plan + regression-plan + test-data-plan + test-data-matrix
  -> Design Brief
  -> CSS / tokens / component rules
  -> AI image brief
  -> AI 生成 / 编辑前端界面图
  -> UI image review
  -> image-to-frontend-spec
  -> component-map + screen-states + design-tokens
  -> frontend stories / components / pages
  -> browser screenshot + visual parity review
  -> OpenAPI contract
  -> generated client + mock server
  -> integration + e2e + visual regression
  -> failure triage + repair/retest loop
  -> knowledge archive + catalog update
```

## 3. 真相源

- Product Spec:
- Acceptance Criteria:
- Acceptance Examples:
- Traceability Matrix:
- Test Strategy:
- Risk Based Test Plan:
- Regression Plan:
- Evidence Protocol:
- Design Brief:
- 设计稿:
- Component Map:
- Screen States:
- Design Tokens:
- DEV-PLAN:
- OpenAPI:
- Verify Matrix:
- Knowledge Catalog:

## 4. 每阶段交付物

### Phase 1: Spec

- [ ] `prd-lite.md`
- [ ] `page-inventory.md`
- [ ] `state-matrix.yaml`
- [ ] `acceptance-criteria.md`
- [ ] `ACCEPTANCE_CRITERIA.md`
- [ ] `ACCEPTANCE_EXAMPLES.md`
- [ ] `requirement-interface-matrix.md`
- [ ] `TRACEABILITY_MATRIX.md`
- [ ] `difficulty-research.md`
- [ ] `TEST_STRATEGY.md`
- [ ] `test-matrix.md`
- [ ] `RISK_BASED_TEST_PLAN.md`
- [ ] `REGRESSION_PLAN.md`
- [ ] `test-data-plan.md`
- [ ] `TEST_DATA_MATRIX.md`
- [ ] `EVIDENCE_PROTOCOL.md`
- [ ] `failure-triage.md`
- [ ] 目标、非目标、范围边界
- [ ] 角色与权限矩阵
- [ ] 异常流程、风险、假设、待确认点
- [ ] 每条 P0/P1 需求都映射到界面、状态、字段、接口和验收
- [ ] 每条 P0/P1 需求都映射到测试层级、测试数据、owner 和 evidence path
- [ ] 每条 P0/P1 需求都映射到 affected tests 和回归范围
- [ ] 每条 P0/P1 需求至少包含一个正向验收示例和一个异常示例
- [ ] 高风险难点已有前置研究结论

### Phase 2: Design Brief

- [ ] `design-brief.md`
- [ ] 信息架构
- [ ] 布局、交互、响应式和可访问性规则
- [ ] CSS / token 要求
- [ ] 默认态、加载态、空态、错误态、权限态、极端数据态、移动端状态

### Phase 3: AI Image Maker

- [ ] `ai-image-brief.md`
- [ ] AI 生成 / 编辑的多状态前端界面图
- [ ] `ui-image-review.md`

### Phase 4: Image To Frontend Spec

- [ ] `component-map.md`
- [ ] `screen-states.md`
- [ ] `design-tokens.json`
- [ ] `image-to-frontend-spec.md`
- [ ] `visual-parity-review.md` 截图矩阵已定义
- [ ] stories / e2e / visual 映射
- [ ] 稳定测试选择器和关键视觉断言

### Phase 5: Frontend

- [ ] 组件实现
- [ ] 页面实现
- [ ] stories
- [ ] 相关测试已新增或更新
- [ ] 真实浏览器截图保存到 `artifacts/visual-review/`
- [ ] 设计参考图与浏览器实拍图对比 PASS

### Phase 6: Contract First

- [ ] `contracts/openapi.yaml`
- [ ] generated client
- [ ] mock server
- [ ] contract / schema / negative examples

### Phase 7: Regression

- [ ] Stage 1 review
- [ ] Stage 2 review
- [ ] verify
- [ ] affected tests 与 P0/P1 regression 已运行
- [ ] 契约验证、回归计划和 evidence protocol 已按本次变更刷新
- [ ] `verify-matrix.md` 中必需项都有 fresh evidence
- [ ] 若测试失败，`failure-findings.json` 已生成并进入 repair/retest loop

### Phase 8: Knowledge Archive

- [ ] `docs/knowledge/knowledge-catalog.md` 已存在
- [ ] `docs/knowledge/catalog.md` 已按新增或更新条目刷新
- [ ] 可复用 decision / guideline / pitfall / process / model 已归档
- [ ] trace 或最终报告中的 `knowledge_references` 已被处理
- [ ] 新增条目默认 maturity 为 `draft`，不得把单次经验直接提升为 `proven`

## 5. 闸门

- 不能进入 Design Brief: Product Spec 缺目标、非目标、范围、角色、页面、可执行验收示例、TRACEABILITY_MATRIX 或需求-界面追溯矩阵。
- 不能进入 AI Image Maker: Design Brief 缺视觉、CSS/tokens、布局、交互、响应式或可访问性规则；高风险难点未研究。
- 不能进入 Image To Frontend Spec: UI 图片未评审通过。
- 不能进入前端实现: 缺 `image-to-frontend-spec.md`、`component-map.md`、`screen-states.md`、`design-tokens.json`、稳定测试选择器或关键视觉断言。
- 不能通过前端实现: 缺浏览器截图、缺设计参考图对比报告，或 `visual-parity-review.md` Verdict 不是 PASS。
- 不能进入联调: API / 数据变化没有 contract 或明确豁免。
- 不能结束任务: 缺 Stage 1、Stage 2、verify、affected tests、P0/P1 regression 或 P0/P1 test matrix 的 fresh evidence。
- 不能完成归档: 知识索引与条目不一致，或把一次性结论升级成全局规则却没有 evidence。
