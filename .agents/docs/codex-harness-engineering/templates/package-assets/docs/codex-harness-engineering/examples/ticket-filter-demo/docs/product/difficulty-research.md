# Difficulty Research

## 1. 难点总览

| Difficulty ID | 难点 / 不确定点 | 来源需求 | 影响页面 / 接口 | 风险等级 | 是否阻塞 | 负责人 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DR-001 | 筛选状态、保存视图和 URL 查询参数如何保持一致 | FR-001, FR-002 | ticket-list / `GET /tickets` | Medium | No | Demo | Closed |
| DR-002 | 普通客服无保存权限时按钮隐藏还是禁用 | FR-003 | ticket-list | Low | No | Demo | Closed |

## 2. 研究记录

### DR-001: 筛选状态一致性

- 关联需求: FR-001, FR-002
- 关联界面: ticket-list, saved-view-modal
- 问题描述: 筛选条件需要同时驱动列表查询、保存视图和刷新恢复。
- 为什么现在必须研究: 如果实现阶段才决定状态来源，前端、contract 和 mock 数据会漂移。
- 已知约束: demo 使用 OpenAPI contract 作为 API 真相源。

| 方案 | 优点 | 缺点 | 风险 | 验证方式 |
| --- | --- | --- | --- | --- |
| URL 查询参数为主 | 可刷新恢复，便于分享当前筛选 | 保存视图时需要序列化 query | 低 | e2e 刷新后检查筛选 |
| 组件本地状态为主 | 实现简单 | 刷新丢失，保存视图易漂移 | 中 | 不采用 |

**结论**: 以 URL 查询参数和 generated client 参数为主，组件内部只保留临时输入状态。

**选择理由**: 保证刷新、保存视图、mock 和真实接口使用同一组字段。

**后续任务影响**: `TicketFilterBar` 的 props 使用 `TicketFilter`，stories 要覆盖 default、empty、error、long_content。

**仍需确认**: 无。

### DR-002: 无权限保存视图

**结论**: 普通客服隐藏保存视图按钮，不展示不可用入口。

**选择理由**: 保存视图不是客服核心任务，隐藏能降低误操作。

**后续任务影响**: permission_denied story 中不渲染保存视图按钮，e2e 验证按钮不存在。
