# Visual Parity Review 模板

> 目标: 前端实现完成后，必须在真实浏览器中截图，并把实拍图与已评审通过的 UI 设计图对比。没有浏览器截图和图片对比证据，前端 UI 任务不能通过 Stage 1 Review。

## 1. 评审对象

| Feature ID | Page ID | State | Viewport | Route / URL | 设计参考图 | 浏览器实拍图 | 对比结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | default | Desktop 1440x900 | | `docs/design/assets/<feature>/<page>/default-desktop-reference.png` | `artifacts/visual-review/<feature>/<page>/default-desktop-actual.png` | PASS / FAIL |

## 2. 前置条件

- `ui-image-review.md` 对应图片已 PASS。
- `image-to-frontend-spec.md` 已把设计图转成布局、组件、CSS/token、状态和数据规格。
- 页面可以在真实浏览器打开。
- 测试数据固定，避免商品名、价格、图片数量等动态内容导致误判。
- 截图前关闭调试浮层、cookie 弹窗、浏览器扩展遮挡和非业务 toast。

## 3. 产物目录规范

```text
docs/design/assets/<feature>/<page>/
  <state>-<viewport>-reference.png

artifacts/visual-review/<feature>/<page>/
  <state>-<viewport>-actual.png
  <state>-<viewport>-diff.png
  <state>-<viewport>-review.md
```

说明:

- `reference.png` 是评审通过的设计图或从设计稿导出的基准图。
- `actual.png` 必须来自真实浏览器截图，不允许用设计图、静态 mock 图或裁剪后的局部图替代。
- `diff.png` 可由视觉回归工具生成；如果没有像素 diff 工具，也必须生成 `review.md` 记录视觉模型或人工评审结论。
- `artifacts/visual-review/` 可以进入 Git，也可以作为 CI artifact；如果不入 Git，trace / handoff 必须记录路径。

## 4. 截图矩阵

| Page ID | State | Viewport | 数据准备 | 参考图 | 实拍图 | 必须评审 |
| --- | --- | --- | --- | --- | --- | --- |
| | default | Desktop 1440x900 | | | | Yes |
| | empty | Desktop 1440x900 | | | | Yes / N/A |
| | loading | Desktop 1440x900 | | | | Yes / N/A |
| | error | Desktop 1440x900 | | | | Yes / N/A |
| | default | Mobile 375x812 | | | | Yes / N/A |

## 5. 浏览器截图命令示例

Playwright CLI 示例:

```powershell
New-Item -ItemType Directory -Force -Path .\artifacts\visual-review\pet-mall\home | Out-Null
$env:VISUAL_BASE_URL = "http://localhost:5173"
npx playwright screenshot --viewport-size=1440,900 "$env:VISUAL_BASE_URL/pets" ".\artifacts\visual-review\pet-mall\home\default-desktop-actual.png"
```

如果项目使用 browser / devtools 工具执行 E2E，也必须把截图保存到 `artifacts/visual-review/...`，并在报告中写明截图路径。

## 6. 图片对比 Prompt

把设计参考图和浏览器实拍图同时交给具备图片理解能力的 reviewer，使用以下提示词:

```text
请对比这两张图：
1. 第一张是已评审通过的 UI 设计参考图。
2. 第二张是真实浏览器截图。

请只评审视觉还原，不重新设计页面。

必须检查：
- 页面结构、主次区域、导航、卡片、列表、表单和操作区是否一致。
- 字体、字号、字重、行高、间距、圆角、阴影、边框、颜色是否明显偏离。
- 商品图、图标、按钮、标签、价格、状态文本等业务元素是否缺失或多出。
- 空态、加载态、错误态、移动端状态是否符合设计图和 screen-states。
- 是否有文字溢出、遮挡、错位、重叠、响应式破版。

输出：
- Verdict: PASS / FAIL
- 主要差异清单
- 必须修复项
- 可接受差异及原因
```

## 7. 对比记录

| 检查项 | 参考图表现 | 实拍图表现 | 结论 | 修复任务 |
| --- | --- | --- | --- | --- |
| 布局结构 | | | PASS / FAIL | |
| 字体与字号 | | | PASS / FAIL | |
| 间距与密度 | | | PASS / FAIL | |
| 颜色与状态色 | | | PASS / FAIL | |
| 组件圆角 / 阴影 / 边框 | | | PASS / FAIL | |
| 业务元素完整性 | | | PASS / FAIL | |
| 响应式 | | | PASS / FAIL / N/A | |

## 8. 失败处理

如果 Verdict 为 FAIL:

1. 把差异写入当前 task 的 `progress.txt` 或 worker `handoff.md`。
2. 生成前端修复任务，明确允许修改的文件和必须重跑的截图矩阵。
3. 修复后重新启动页面，重新截图。
4. 用新的 `actual.png` 再次对比，直到 Verdict 为 PASS。
5. 如果连续多轮仍无法一致，输出 `BLOCKED`，说明是设计图、规格、数据或技术约束冲突。

## 9. 通过标准

- [ ] 每个 required UI state 都有参考图或明确豁免。
- [ ] 每个 required UI state 都有真实浏览器截图。
- [ ] 截图 viewport、测试数据和页面状态与参考图一致。
- [ ] 图片对比报告存在，并给出 `Verdict: PASS`。
- [ ] 所有 FAIL 差异都已修复并重新截图。
- [ ] Stage 1 Review 能读取参考图路径、实拍图路径和对比报告。
