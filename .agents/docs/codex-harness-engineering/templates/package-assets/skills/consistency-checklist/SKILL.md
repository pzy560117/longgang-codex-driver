---
name: consistency-checklist
description: 一致性检查清单
---

# 一致性检查清单

评审时必须检查以下一致性问题。

## 命名一致性 ⚠️ 必查

| 业务概念 | 统一命名(中文) | 统一命名(英文) | 使用页面 |
|----------|----------------|----------------|----------|
| 用户名 | 用户名 | userName | 登录页、个人中心 |
| 订单号 | 订单号 | orderNo | 订单列表、订单详情 |
| 创建时间 | 创建时间 | createTime | 所有列表页 |
| 状态 | 状态 | status | 所有带状态的页面 |

### 命名规范
- 前端变量：camelCase（如 userName）
- API 参数：camelCase
- 数据库字段：snake_case
- URL 路径：kebab-case（如 /user-management）

## 状态值一致性 ⚠️ 必查

| 状态名 | 前端值 | 后端值 | 显示文本 | 标签颜色 | 可流转到 |
|--------|--------|--------|----------|----------|----------|
| 草稿 | draft | DRAFT | 草稿 | #999999 | pending |
| 待审核 | pending | PENDING | 待审核 | #faad14 | approved, rejected |
| 已通过 | approved | APPROVED | 已通过 | #52c41a | - |
| 已拒绝 | rejected | REJECTED | 已拒绝 | #ff4d4f | draft |

## 交互一致性 ⚠️ 必查

| 操作类型 | 统一交互规范 | 适用场景 |
|----------|--------------|----------|
| 删除操作 | 必须二次确认弹窗 | 所有删除操作 |
| 表单提交 | 按钮loading + 禁用 | 所有表单提交 |
| 列表空态 | 统一空态组件 | 所有列表页 |
| 加载状态 | 骨架屏（列表）或spinner（局部） | 所有异步加载 |
| 错误提示 | toast，3秒自动消失 | 所有错误反馈 |
| 成功提示 | toast，2秒自动消失 | 所有成功反馈 |
| 表格分页 | 支持10/20/50每页 | 所有表格 |
| 弹窗尺寸 | 小400px/中600px/大800px | 所有弹窗 |

## 组件一致性 ⚠️ 必查

| 场景 | 使用组件 | 禁止使用 |
|------|----------|----------|
| 主操作按钮 | Button type="primary" | 自定义样式 |
| 危险操作 | Button danger | 红色primary |
| 表格 | Table + 统一分页 | 自定义表格 |
| 弹窗 | Modal | 自定义弹窗 |
| 消息提示 | message.success/error | alert |
| 确认弹窗 | Modal.confirm | window.confirm |

