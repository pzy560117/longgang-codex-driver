---
name: frontend-design
description: Frontend Design Skill
---

# Frontend Design Skill

创建独特的、生产级的前端界面，避免通用的"AI风格"美学。

## 上游 Skill 接入

前端 UI 任务默认先检查并组合以下已安装 skill：

| 能力 | Skill | 用法 |
|------|-------|------|
| 设计语言与整体质感 | `impeccable` | 处理信息架构、视觉层级、排版、间距、色彩、响应式、空/错/加载态和整体 polish |
| 审美判断与抗默认风格 | `design-taste-frontend`（目录 `taste-skill/`） | 纠正 AI 默认布局、字体、动效、图标和 Tailwind 反模式 |
| UI 工程基线 | `baseline-ui` | 检查 Tailwind、组件结构、可访问 primitive、加载骨架、交互状态 |
| 可访问性修复 | `fixing-accessibility` | 处理键盘、焦点、ARIA、语义、表单标签和 reduced motion |
| 元数据修复 | `fixing-metadata` | 处理标题、描述、Open Graph、社交卡片和 favicon |
| 动效性能 | `fixing-motion-performance` | 审核动画 duration、transform/opacity、layout thrashing、reduced motion |
| 图标检索 | `better-icons` | 需要图标时搜索并提取 Iconify SVG；不要凭空画低质量图标 |
| 大厂 DESIGN.md | `brand-design-md` | 用户提到 Apple、Stripe、Notion、Linear、Claude 等品牌风格时，先拉取 DESIGN.md 再设计 |

`motion-ai-kit` 是 Motion 官方 Motion+ AI Kit，公开 GitHub 没有可直接安装的 skill；如果本机后续安装了 `motion-ai-kit`，动画/动效任务优先使用它，再用 `fixing-motion-performance` 做性能兜底。

## 使用顺序

1. 先从需求或 PRD 中提取产品类型、用户、核心场景、品牌/竞品参照和约束。
2. 如果出现明确品牌风格，使用 `brand-design-md` 获取 DESIGN.md；如果项目已有 `PRODUCT.md`/`DESIGN.md`，使用 `impeccable` 的上下文规则。
3. 用 `design-taste-frontend` 设定设计方差、动效强度、信息密度，避免默认 AI UI。
4. 进入实现前，用 `baseline-ui` 补齐组件、状态、响应式、可访问 primitive 和 Tailwind 规则。
5. 涉及图标时用 `better-icons`；涉及动画时用 `motion-ai-kit`（若已安装）或 `fixing-motion-performance`。
6. 交付前至少跑一遍 `fixing-accessibility`、`fixing-motion-performance`；页面级交付同时跑 `fixing-metadata`。

## 设计思维

编码前，理解上下文并确定大胆的美学方向：
- **目的**: 这个界面解决什么问题？谁在使用？
- **调性**: 选择一个极端：极简主义、极繁主义、复古未来、有机自然、奢华精致、俏皮玩具风、杂志编辑风、粗野主义、装饰艺术、柔和粉彩、工业实用等
- **约束**: 技术要求（框架、性能、可访问性）
- **差异化**: 什么让这个设计令人难忘？

## 美学指南

- **字体**: 选择独特有趣的字体，避免 Arial、Inter 等通用字体
- **色彩**: 使用 CSS 变量保持一致性，主色配锐利的强调色
- **动效**: 使用 CSS 动画和微交互，React 项目用 Motion 库
- **空间构图**: 非对称、重叠、对角线流动、打破网格
- **背景细节**: 渐变网格、噪点纹理、几何图案、层叠透明度

## 禁止事项

- 不用 Inter、Roboto、Arial 等过度使用的字体
- 不用紫色渐变配白色背景这种陈词滥调
- 不用可预测的布局和组件模式
- 每个设计都应该独特，在明暗主题、字体、美学之间变化

