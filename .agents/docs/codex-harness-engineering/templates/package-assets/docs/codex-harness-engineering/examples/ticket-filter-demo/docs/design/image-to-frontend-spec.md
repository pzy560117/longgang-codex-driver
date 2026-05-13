# Image To Frontend Spec

## 1. 输入图片

| Image ID | Page ID | State | 图片路径 / 链接 | 评审结论 |
| --- | --- | --- | --- | --- |
| IMG-001 | ticket-list | default | `images/ticket-list-default.png` | PASS |
| IMG-002 | ticket-list | empty | `images/ticket-list-empty.png` | PASS |
| IMG-003 | ticket-list | loading | `images/ticket-list-loading.png` | PASS |
| IMG-004 | ticket-list | error | `images/ticket-list-error.png` | PASS |
| IMG-005 | ticket-list | permission_denied | `images/ticket-list-permission.png` | PASS |

## 2. 页面布局规格

| 区域 | 位置 | 尺寸 / 约束 | 内容 | 响应式行为 |
| --- | --- | --- | --- | --- |
| Header | 顶部 | 高度约 64px | 标题、说明、保存视图按钮 | mobile 保留标题，操作进菜单 |
| Filter Bar | Header 下方 | 横向排列 | 状态、优先级、负责人、搜索 | mobile 折叠为筛选抽屉 |
| Main Table | 主区域 | 宽度自适应 | 工单表格、状态标签、操作 | mobile 转卡片列表 |
| Pagination | 底部 | 右对齐 | 页码、每页数量 | mobile 简化为上一页/下一页 |

## 3. 组件实现映射

| 图片元素 | 前端组件 | 复用来源 | Props / 数据 | 事件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 筛选条 | `TicketFilterBar` | existing business component | `TicketFilter` | `onChange`, `onReset` | default / dirty / mobile |
| 保存视图弹窗 | `SavedViewModal` | new business component | `CreateTicketViewRequest` | `onSubmit`, `onCancel` | default / validation-error |
| 工单表格 | `TicketTable` | table base component | `Ticket[]`, pagination | `onRetry` | default / empty / loading / error |

## 4. CSS / Token 映射

| 图片表现 | Token / CSS 变量 | 值 | 备注 |
| --- | --- | --- | --- |
| 页面背景 | `--color-bg-subtle` | `#F6F7F9` | 来自 design tokens |
| 主面板 | `--color-bg-default` | `#FFFFFF` | |
| 高优先级强调 | `--color-status-warning` | `#B45309` | |
| 错误提示 | `--color-status-danger` | `#B91C1C` | |
| 面板圆角 | `--radius-md` | `8px` | |

## 5. 状态实现规格

| State | 数据条件 | UI 行为 | 组件变化 | 测试 |
| --- | --- | --- | --- | --- |
| default | `items.length > 0` | 展示表格和分页 | `TicketTable` default | story / e2e / visual |
| empty | `items.length === 0` | 展示空态和清除筛选 | `TicketTable` empty | story / e2e / visual |
| loading | 请求中 | 展示骨架屏并禁用保存 | `TicketTable` loading | story / visual |
| error | 请求失败 | 展示错误和重试 | `TicketTable` error | story / e2e / visual |
| permission_denied | role=agent | 隐藏保存视图入口 | `TicketFilterBar` permission | e2e |
