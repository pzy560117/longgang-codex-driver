# UI Image Review 模板

> 目标: 对 AI 生成的前端界面图进行评审。图片未通过前，不进入前端规范和代码实现。

## 1. 评审对象

| Image ID | Page ID | State | 图片路径 / 链接 | 版本 |
| --- | --- | --- | --- | --- |
| IMG-001 | page-001 | default | | v1 |

## 2. 需求匹配检查

| Requirement ID | 图片是否体现 | 证据 | 问题 | 结论 |
| --- | --- | --- | --- | --- |
| FR-001 | Yes / No / Partial | | | Pass / Fail |

## 3. 状态覆盖检查

| Page ID | State | 是否有图 | 是否符合 Screen States | 问题 | 结论 |
| --- | --- | --- | --- | --- | --- |
| page-001 | default | Yes | Yes / No | | Pass / Fail |

## 4. 视觉与 CSS 规范检查

| 检查项 | 预期 | 图片表现 | 结论 |
| --- | --- | --- | --- |
| 颜色 | | | Pass / Fail |
| 字体 / 字号 | | | Pass / Fail |
| 间距 | | | Pass / Fail |
| 圆角 / 阴影 | | | Pass / Fail |
| 信息密度 | | | Pass / Fail |
| 响应式 | | | Pass / Fail |

## 5. 交互与边界检查

| 检查项 | 是否满足 | 问题 | 处理 |
| --- | --- | --- | --- |
| 主操作清晰 | Yes / No | | |
| 空态可恢复 | Yes / No / N/A | | |
| 错误态可重试 | Yes / No / N/A | | |
| 权限差异清晰 | Yes / No / N/A | | |
| 长文本不破版 | Yes / No / N/A | | |
| 没有多余功能 | Yes / No | | |

## 6. 评审结论

- Verdict: PASS / FAIL
- 必须重生成的图片:
- 可通过编辑修复的图片:
- 通过后进入: `image-to-frontend-spec.md`
- 前端实现后还必须进入: `visual-parity-review.md`

## 7. 通过标准

- [ ] 每个 required state 都有图片或明确豁免。
- [ ] 每个 P0/P1 需求都能在至少一张图中找到界面证据。
- [ ] 图片没有添加需求之外的功能。
- [ ] 图片符合 CSS / token / 组件规范。
- [ ] 评审问题已关闭或转为新的图片编辑提示词。
- [ ] 图片已作为后续浏览器截图对比的 reference source 记录保存路径。
