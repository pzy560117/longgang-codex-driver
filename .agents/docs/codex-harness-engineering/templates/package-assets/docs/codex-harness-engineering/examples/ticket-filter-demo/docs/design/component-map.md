# Component Map

| 页面/模块 | 组件 | 责任 | 复用来源 | 必备状态 | 测试方式 |
| --- | --- | --- | --- | --- | --- |
| 工单列表页 | `TicketFilterBar` | 展示状态、优先级、负责人筛选条件 | 业务组件 | default / dirty / mobile | story + e2e |
| 工单列表页 | `SavedViewModal` | 输入名称并保存当前筛选视图 | 业务组件 | default / validation-error / permission-denied | story + unit |
| 工单列表页 | `TicketTable` | 展示工单结果列表 | 表格基础组件 | default / empty / loading / error | story + visual |
