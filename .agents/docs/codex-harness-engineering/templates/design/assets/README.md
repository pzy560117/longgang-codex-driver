# Design Assets

本目录用于保存已评审的 UI 设计参考图。

## 工具策略

- 本目录的 AI 生图和图片编辑默认使用 Codex 内置 `image_gen` 工具。
- 项目绑定图片必须复制或移动到本目录后，任务才允许通过。
- `manifest.md` 必须为每张最终 PNG 记录 `source_tool: image_gen`、prompt、覆盖页面、覆盖状态、评审结论和实现注意事项。
- 浏览器截图、Playwright 截图、HTML/CSS 截图、程序化绘图和占位 PNG 只能作为实现证据或临时脚手架，不能满足本目录的设计参考图要求。
- CLI fallback 或第三方服务必须先获得用户显式确认，并且已配置所需凭据；它们不是本项目默认路径。

## 必需补齐文件

按当前 feature 的页面和状态矩阵补齐参考图，例如：

- `<feature>-<page>-default-reference.png`
- `<feature>-<page>-empty-reference.png`
- `<feature>-<page>-error-reference.png`
- `<feature>-<page>-disabled-reference.png`
- `<feature>-mobile-reference.png`
- `manifest.md`

`artifacts/visual-review/` 下的浏览器截图是实现证据，不能替代本目录的设计参考图。
