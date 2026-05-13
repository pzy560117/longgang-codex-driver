# AI Image Brief 模板

> 目标: 在写前端代码前，先基于完整产品和设计规格，使用 AI 生图/编辑工具生成可评审的前端界面图。图片不是最终实现规范，图片评审通过后才进入图转前端规格。

## 1. 基本信息

- Feature ID:
- Page ID:
- 页面名称:
- 设备 / 画布: Desktop 1440px / Tablet / Mobile 375px / Other
- 设计来源: Product Spec / Design Brief / Component Map / Screen States / Design Tokens
- 生成批次:
- 状态: Draft / Review / Approved / Rejected

## 2. 输入真相源

| 真相源 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| PRD-Lite | `docs/product/prd-lite.md` | Approved / Draft | |
| Requirement Interface Matrix | `docs/product/requirement-interface-matrix.md` | Approved / Draft | |
| Design Brief | `docs/design/design-brief.md` | Approved / Draft | |
| Component Map | `docs/design/component-map.md` | Approved / Draft | |
| Screen States | `docs/design/screen-states.md` | Approved / Draft | |
| Design Tokens | `docs/design/design-tokens.json` | Approved / Draft | |

## 3. CSS / 视觉要求

| 类别 | 要求 |
| --- | --- |
| 颜色 | |
| 字体 | |
| 字号层级 | |
| 间距 | |
| 圆角 | |
| 阴影 | |
| 表格 / 列表密度 | |
| 表单控件高度 | |
| 按钮层级 | |
| 状态色 | |
| 响应式折叠 | |

## 4. 必须生成的界面状态

| State | 是否生成 | 说明 | 输出图片 |
| --- | --- | --- | --- |
| default | Yes | | |
| empty | Yes | | |
| loading | Yes | | |
| error | Yes | | |
| permission_denied | Yes / No | | |
| disabled | Yes / No | | |
| long_content | Yes / No | | |
| mobile | Yes / No | | |

## 5. 生图提示词

```text
生成 [页面名称] 的生产级前端 UI 设计图。

页面目标:
[从 PRD 摘要填写]

用户角色:
[填写角色]

画布:
[Desktop 1440px / Mobile 375px 等]

视觉规范:
- 颜色:
- 字体:
- 间距:
- 圆角:
- 阴影:
- 信息密度:
- 状态色:

页面结构:
- 顶部:
- 主内容:
- 侧边 / 辅助区域:
- 底部 / 操作区:

组件:
- [来自 component-map 的组件和职责]

必须体现的状态:
- [本批次状态]

边界要求:
- 长文本:
- 空数据:
- 错误:
- 无权限:
- 移动端:

禁止:
- 不要添加 Product Spec 没有的功能
- 不要省略 required state
- 不要使用与 Design Tokens 冲突的颜色、字号或间距
```

## 6. 图片编辑提示词

```text
基于上一版图继续编辑，不改变页面信息架构。

需要修改:
- [具体差异]

保持不变:
- [已通过评审的布局/组件/样式]

补充状态:
- [需要补的状态]
```

## 7. 输出记录

| Image ID | State | 文件 / 链接 | 生成提示词版本 | 评审状态 |
| --- | --- | --- | --- | --- |
| IMG-001 | default | | v1 | Draft |
