# Screen States 模板

> 目标: 把每个页面状态写成可实现、可做 story、可做 visual regression 的状态规格。

## 页面名称

- Page ID:
- 页面:
- 路由/入口:
- 角色:
- 关联需求:
- 关联设计稿:

## 状态清单

### default

- 触发条件:
- 数据条件:
- 页面表现:
- 用户可执行动作:
- 组件影响:
- story 名称:
- visual baseline:

### empty

- 触发条件:
- 数据条件:
- 页面表现:
- 用户可执行动作:
- 恢复路径:
- story 名称:
- visual baseline:

### loading

- 触发条件:
- 等待对象:
- 页面表现:
- 用户可执行动作:
- 超时后行为:
- story 名称:
- visual baseline:

### error

- 触发条件:
- 错误类型:
- 页面表现:
- 用户可执行动作:
- 重试 / 兜底:
- story 名称:
- visual baseline:

### permission_denied

- 触发条件:
- 权限规则:
- 页面表现:
- 用户可执行动作:
- 是否隐藏受限操作:
- story 名称:
- visual baseline:

### disabled

- 触发条件:
- 禁用对象:
- 禁用原因展示:
- 用户可执行动作:
- 恢复条件:
- story 名称:
- visual baseline:

### long_content

- 触发条件:
- 极端数据:
- 页面表现:
- 用户可执行动作:
- 截断 / 换行 / tooltip 规则:
- story 名称:
- visual baseline:

### responsive/mobile

- 触发条件:
- 断点:
- 页面表现:
- 用户可执行动作:
- 折叠策略:
- story 名称:
- visual baseline:

## 状态到测试映射

| 状态 | Story | Interaction Test | E2E | Visual |
| --- | --- | --- | --- | --- |
| default | | | | |
| empty | | | | |
| loading | | | | |
| error | | | | |
| permission_denied | | | | |
| disabled | | | | |
| long_content | | | | |
| mobile | | | | |
