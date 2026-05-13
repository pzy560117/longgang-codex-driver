# Component Map 模板

> 目标: 明确每个页面由哪些可复用组件组成，防止 Codex 直接生成不可维护的整页代码。

| 页面/模块 | 组件 | 责任 | 复用来源 | Props / 数据输入 | 事件输出 | 必备状态 | 测试方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | existing / new / generated | | | default, empty, loading, error | story / interaction / e2e / visual |

## 组件状态矩阵

| 组件 | default | empty | loading | error | disabled | permission | long_content | mobile |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | 是 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 | 是/否 |

## 复用与新增规则

- 优先复用现有组件库，不要为单一页面随意造新组件。
- 新组件必须说明为什么现有组件不满足。
- `必备状态` 至少覆盖 `default / empty / loading / error`。
- `测试方式` 写明 story、interaction test、e2e 或 visual。
- generated client / types 不作为 UI 组件复用来源。
- 如果组件依赖接口字段，必须能追溯到 `contracts/openapi.yaml` 或 PRD 数据字典。
