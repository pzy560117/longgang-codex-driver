# Page Inventory 模板

> 目标: 明确本功能涉及的所有页面、视图、弹窗、抽屉和嵌入区，避免设计和实现阶段漏掉状态。

| Page ID | 页面/视图 | 路由/入口 | 类型 | 角色 | 核心目标 | 关键状态 | 依赖接口 | 关联需求 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| page-001 | | | 列表/详情/表单/弹窗/抽屉/嵌入视图 | | | default, empty, loading, error | | FR-001 |

## 状态覆盖检查

| Page ID | default | empty | loading | error | permission_denied | disabled | long_content | mobile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| page-001 | 是 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 |

## 使用说明

- 每一行只描述一个页面或一个独立视图。
- 弹窗、抽屉、嵌入式子视图也应单独列出。
- `关键状态` 至少列出 `default / empty / loading / error`。
- 如果某个状态不适用，在状态覆盖检查中写明“否”和原因，不要留空。
- `Page ID` 必须能被 `state-matrix.yaml`、`screen-states.md`、stories 和 e2e 用例引用。
