# AI Image Brief

## 1. 基本信息

- Feature ID: DEMO-TICKET-FILTER
- Page ID: ticket-list
- 页面名称: 工单列表筛选页
- 设备 / 画布: Desktop 1440px
- 设计来源: PRD-Lite / Requirement Interface Matrix / Design Brief / Component Map / Screen States / Design Tokens
- 生成批次: v1
- 状态: Approved

## 2. CSS / 视觉要求

| 类别 | 要求 |
| --- | --- |
| 颜色 | 蓝灰背景、白色主内容面板、橙色强调高优先级和保存视图按钮 |
| 字体 | 系统无衬线字体，后台管理密度 |
| 字号层级 | 页面标题 20px，表格主体 14px，辅助说明 12px |
| 间距 | 筛选控件 8px 间距，页面主间距 24px |
| 圆角 | 控件 6px，面板 8px |
| 表格 / 列表密度 | 每行 48px，高密度但不拥挤 |
| 状态色 | open 蓝色，pending 橙色，resolved 绿色，error 红色 |

## 3. 必须生成的界面状态

| State | 是否生成 | 说明 | 输出图片 |
| --- | --- | --- | --- |
| default | Yes | 显示筛选条、保存视图、10 条工单 | IMG-001 |
| empty | Yes | 无结果空态和清除筛选入口 | IMG-002 |
| loading | Yes | 表格骨架屏和禁用操作 | IMG-003 |
| error | Yes | 内联错误和重试入口 | IMG-004 |
| permission_denied | Yes | 客服角色不显示保存视图按钮 | IMG-005 |
| mobile | Yes | 筛选条折叠为抽屉入口 | IMG-006 |

## 4. 生图提示词摘要

```text
生成工单列表筛选页的生产级后台 UI 设计图，Desktop 1440px。
页面包含顶部标题、筛选条、保存视图按钮、已保存视图列表入口、工单表格和分页。
使用蓝灰背景、白色内容面板、橙色 CTA，高密度企业后台风格。
必须覆盖 default / empty / loading / error / permission_denied / mobile。
不要添加导出、共享视图、图表分析等 PRD 未要求功能。
```
