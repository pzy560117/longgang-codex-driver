# Image To Frontend Spec 模板

> 目标: 把评审通过的 UI 图片转换成可实现的前端规格。前端编码只能依据本规格、Design Tokens、Component Map 和 Screen States，不直接凭图片猜实现。

## 1. 输入图片

| Image ID | Page ID | State | 图片路径 / 链接 | 评审结论 |
| --- | --- | --- | --- | --- |
| IMG-001 | page-001 | default | | PASS |

## 2. 页面布局规格

| 区域 | 位置 | 尺寸 / 约束 | 内容 | 响应式行为 |
| --- | --- | --- | --- | --- |
| Header | | | | |
| Main | | | | |
| Aside | | | | |
| Footer / Action Bar | | | | |

## 3. 组件实现映射

| 图片元素 | 前端组件 | 复用来源 | Props / 数据 | 事件 | 状态 |
| --- | --- | --- | --- | --- | --- |
| | | existing / new | | | default |

## 4. CSS / Token 映射

| 图片表现 | Token / CSS 变量 | 值 | 备注 |
| --- | --- | --- | --- |
| 主背景 | `--color-bg-default` | | |
| 主文字 | `--color-text-primary` | | |
| 间距 | `--space-*` | | |
| 圆角 | `--radius-*` | | |

## 5. 状态实现规格

| State | 数据条件 | UI 行为 | 组件变化 | 测试 |
| --- | --- | --- | --- | --- |
| default | | | | story / e2e / visual |
| empty | | | | story / e2e / visual |
| loading | | | | story / visual |
| error | | | | story / e2e / visual |

## 6. Mock 数据

| 场景 | 数据文件 / 生成方式 | 覆盖状态 |
| --- | --- | --- |
| default | | |
| empty | | |
| error | | |
| long_content | | |

## 7. 实现任务输入

- 必读:
  - `docs/product/requirement-interface-matrix.md`
  - `docs/design/component-map.md`
  - `docs/design/screen-states.md`
  - `docs/design/design-tokens.json`
  - 本文件
- 必须输出:
  - 前端组件 / 页面
  - stories
  - mock 数据
  - visual baseline 或截图证据

## 8. 视觉还原验证计划

| Page ID | State | Viewport | Route / URL | 数据准备 | 参考图 | 实拍截图 | 对比报告 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| page-001 | default | Desktop 1440x900 | | | `docs/design/assets/.../reference.png` | `artifacts/visual-review/.../actual.png` | `artifacts/visual-review/.../review.md` |

规则:

- 前端实现完成后，必须启动真实浏览器访问页面并截图。
- 截图必须保存到 `artifacts/visual-review/<feature>/<page>/`。
- 参考图必须来自已通过 `ui-image-review.md` 的设计图。
- 对比过程使用 `visual-parity-review.md`，结论为 `PASS` 才能通过 Stage 1。
- 如果 UI 和设计图不一致，必须修复前端代码并重新截图，不允许只改验收文档绕过。

## 9. 通过标准

- [ ] 图片中的每个可见业务元素都有组件映射。
- [ ] 每个组件都能追溯到数据、事件和状态。
- [ ] CSS 实现可以从 token 或明确规则得出。
- [ ] 没有直接从图片猜出的隐藏业务逻辑。
- [ ] 前端实现任务不再需要重新做视觉决策。
- [ ] 真实浏览器截图与设计参考图完成视觉还原对比，`visual-parity-review.md` 结论为 PASS。
