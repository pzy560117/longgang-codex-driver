# Requirement Interface Matrix

## 1. 需求到界面映射

| Requirement ID | 需求摘要 | 用户角色 | 关联页面 / 视图 | 页面状态 | UI 元素 / 操作 | 关联字段 | 依赖接口 | 验收标准 | 覆盖状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | 按状态、优先级、负责人筛选工单 | 主管 / 客服 | ticket-list | default / empty / loading / error | `TicketFilterBar` | status, priority, assigneeId | `GET /tickets` | AC-001 | Covered |
| FR-002 | 保存当前筛选视图 | 主管 | ticket-list / saved-view-modal | default / validation-error / permission_denied | `SavedViewModal` | name, filters | `POST /ticket-views` | AC-002 | Covered |
| FR-003 | 无权限用户不能保存视图 | 客服 | ticket-list | permission_denied | 保存视图按钮隐藏 | role | `GET /ticket-views` | AC-003 | Covered |

## 2. 界面到需求反查

| Page ID | 页面 / 视图 | 页面目标 | 覆盖需求 | 未覆盖需求 | 多余功能风险 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| ticket-list | 工单列表页 | 筛选工单并管理个人视图 | FR-001, FR-002, FR-003 | 无 | 无导出、无共享视图 | |
| saved-view-modal | 保存视图弹窗 | 命名并保存当前筛选条件 | FR-002 | 无 | 不支持共享给他人 | |

## 3. 状态到需求映射

| Page ID | State | 触发需求 / 业务规则 | 用户可见表现 | 依赖数据 / 接口 | 验收标准 | 设计图 |
| --- | --- | --- | --- | --- | --- | --- |
| ticket-list | default | FR-001 | 筛选条、保存视图按钮、工单表格 | `GET /tickets` | AC-001 | IMG-001 |
| ticket-list | empty | FR-001 | 空态文案和清除筛选入口 | `GET /tickets` 返回空列表 | AC-E001 | IMG-002 |
| ticket-list | loading | FR-001 | 表格骨架屏，筛选操作禁用 | `GET /tickets` 请求中 | AC-E002 | IMG-003 |
| ticket-list | error | FR-001 | 内联错误提示和重试按钮 | `GET /tickets` 报错 | AC-E003 | IMG-004 |
| ticket-list | permission_denied | FR-003 | 客服不显示保存视图入口 | 用户角色 | AC-003 | IMG-005 |

## 4. 缺口清单

| Gap ID | 缺口类型 | 描述 | 影响阶段 | 处理方式 | 负责人 | 截止 |
| --- | --- | --- | --- | --- | --- | --- |
| GAP-000 | 无 | 当前 demo 的 P0/P1 需求已有界面映射 | - | - | - | - |
