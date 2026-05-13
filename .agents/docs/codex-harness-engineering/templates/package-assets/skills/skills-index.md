---
description: Index of active skills under .agents/skills
---

# Skills 索引

所有 active skill package 都位于 `.agents/skills/`。

说明:

- `skills/` 是当前主入口。
- `workflows/` 只保留独立 workflow 文档。
- 与 `skills/` 重复的 workflow 平铺副本已移到 `archive/workflows/skill-mirrors/`。

## 核心开发

| Skill | 目录 | 描述 |
|-------|------|------|
| **planner** | `planner/` | 复杂功能规划与实施步骤拆解（Opus 模型） |
| **architect** | `architect/` | 系统架构设计与技术选型（Opus 模型） |
| **Glue Coding** | `glue-coding/` | 胶水编程开发方法 - 通过组合现有成熟库快速实现功能 |
| **coding-standards** | `coding-standards/` | TypeScript/JavaScript/React/Node.js 通用编码标准与最佳实践 |
| **backend-patterns** | `backend-patterns/` | 后端架构模式、API 设计、数据库优化 |
| **frontend-patterns** | `frontend-patterns/` | React/Next.js 前端开发模式、状态管理、性能优化 |

## 测试与质量

| Skill | 目录 | 描述 |
|-------|------|------|
| **tdd-guide** | `tdd-guide/` | TDD 专家，强制 write-tests-first，确保 80%+ 覆盖率（Opus 模型） |
| **tdd-workflow** | `tdd-workflow/` | TDD 工作流，包含 unit/integration/E2E 测试，80%+ 覆盖率 |
| **e2e-runner** | `e2e-runner/` | Playwright E2E 测试专家 - 测试创建/维护/Flaky 管理/制品上传 |
| **browser-e2e-testing** | `browser-e2e-testing/` | 使用 browser_subagent (devtools MCP) 进行全量前端 E2E 测试 |
| **code-reviewer** | `code-reviewer/` | 代码审查专家 - 质量/安全/可维护性检查 |
| **Allure Report** | `allure-report/` | 生成和查看 Allure 测试报告 |

## 安全

| Skill | 目录 | 描述 |
|-------|------|------|
| **security-reviewer** | `security-reviewer/` | 安全漏洞检测与修复专家 - OWASP Top 10 / Secrets / SSRF / 注入（Opus 模型） |
| **security-review** | `security-review/` | 安全检查清单与模式 - 认证/输入验证/API 端点/敏感数据 |

## 构建与维护

| Skill | 目录 | 描述 |
|-------|------|------|
| **build-error-resolver** | `build-error-resolver/` | 构建/TypeScript 错误修复专家，最小 diff 快速变绿 |
| **refactor-cleaner** | `refactor-cleaner/` | 死代码清理与重构专家 - knip/depcheck/ts-prune 分析（Opus 模型） |
| **doc-updater** | `doc-updater/` | 文档与 Codemap 更新专家 |
| **harness-surface-sync** | `harness-surface-sync/` | 一次性审计并同步 harness runtime、docs/testing、templates、workflows、config、skills 与 package-assets 镜像 |

## Git 与自动化

| Skill | 目录 | 描述 |
|-------|------|------|
| **Auto Review and Commit** | `auto-commit/` | 检查当前工作区、补齐必要同步、生成提交并推送；缺少远程仓库时可用 GitHub CLI 自动建仓 |
| **ai-config-git-sync** | `ai-config-git-sync/` | 审计、更新并 fan-out 共享 AI workflow/config 到多个 Git 项目，支持 drift 检查、同步分支、push 和 PR |
| **git-xianyu-analyzer** | `git-xianyu-analyzer/` | 克隆 Git 仓库→清理→分析→生成咸鱼销售文案 |

## 设计与 UI/UX

| Skill | 目录 | 描述 |
|-------|------|------|
| **ui-ux-pro-max** | `ui-ux-pro-max/` | UI/UX 设计智能 - 67 种风格/96 色板/57 字体搭配/99 UX 指南 |
| **frontend-design** | `frontend-design/` | 前端界面设计原则，定义生产级视觉方向和差异化美学 |
| **impeccable** | `impeccable/` | 上游 Impeccable 前端设计 skill：设计语言、视觉层级、排版、布局、色彩、动效、响应式与 polish |
| **Taste Skill** | `taste-skill/` | 上游 Leonxlnx Taste Skill 主 skill，内部 name 为 `design-taste-frontend`，用于审美判断和抗 AI 默认 UI |
| **brand-design-md** | `brand-design-md/` | 根据 Apple/Stripe/Notion/Linear/Claude 等品牌名称拉取 getdesign.md/awesome-design-md 的 DESIGN.md |
| **baseline-ui** | `baseline-ui/` | UI Skills 子 skill：Tailwind、组件结构、状态、可访问 primitive 和 UI 工程基线 |
| **fixing-accessibility** | `fixing-accessibility/` | UI Skills 子 skill：键盘、焦点、ARIA、语义和表单可访问性修复 |
| **fixing-metadata** | `fixing-metadata/` | UI Skills 子 skill：页面 title/meta/OG/social card/favicon |
| **fixing-motion-performance** | `fixing-motion-performance/` | UI Skills 子 skill：动画性能、reduced motion、layout thrashing 检查 |
| **better-icons** | `better-icons/` | 通过 better-icons/Iconify 搜索并获取 SVG 图标 |
| **ai-ui-prompts** | `ai-ui-prompts/` | AI 生图/编辑提示词模板，按需求矩阵、CSS/token 和状态生成界面图 |
| **frontend-first-workflow** | `frontend-first-workflow/` | 前端先行流程：需求映射→难点研究→AI 生图→图片评审→图转规格→前端实现 |

说明：`motion-ai-kit` 是 Motion 官方 Motion+ AI Kit，需要 Motion+ token 通过官方 installer 安装；公开 GitHub 未提供可直接复制的 skill 包，当前未列为 active skill。

## 产品与 PRD

| Skill | 目录 | 描述 |
|-------|------|------|
| **prd-writer-skill** | `prd-writer-skill/` | PRD 写作工作流：需求采集→Feature List→PRD 文档→可交互原型（集成 UI/UX 设计系统） |
| **requirements-design-template** | `requirements-design-template/` | 需求与设计文档模板，覆盖目标/非目标、业务流程、状态、权限、数据字典、验收和设计方案 |
| **page-spec-template** | `page-spec-template/` | 页面规格模板，覆盖页面状态、交互状态、字段规格、操作反馈和权限视图 |
| **business-rule-spec** | `business-rule-spec/` | 业务规则规格模板，覆盖前置条件、后置动作、批量操作、导入导出和敏感操作确认 |
| **interaction-detail-spec** | `interaction-detail-spec/` | 交互细节规格模板，覆盖键盘、快捷键、手势、拖拽、动效、防抖节流和焦点管理 |
| **data-flow-spec** | `data-flow-spec/` | 数据流转规格模板，覆盖数据依赖、联动、缓存、更新、冲突和同步机制 |

## 规格与评审

| Skill | 目录 | 描述 |
|-------|------|------|
| **OpenSpec Architecture Review** | `openspec-architecture-review/` | OpenSpec 规格架构深度评审与完善工作流 |
| **Eval Harness** | `eval-harness/` | AI 会话评估框架 (Eval-Driven Development) |

## 数据库

| Skill | 目录 | 描述 |
|-------|------|------|
| **clickhouse-io** | `clickhouse-io/` | ClickHouse 数据库模式、查询优化、分析与数据工程最佳实践 |

## 工具与辅助

| Skill | 目录 | 描述 |
|-------|------|------|
| **strategic-compact** | `strategic-compact/` | 在逻辑边界建议手动 compact 以保留上下文 |
| **continuous-learning** | `continuous-learning/` | 从 Claude Code 会话中自动提取可复用模式并保存为 skill |
| **skill-creator** | `skill-creator/` | 创建和打包新 skill 的工作流与脚本 |
| **Example Skill** | `example-skill/` | 示例技能，展示如何创建和使用技能文件 |
| **Project Guidelines (Example)** | `project-guidelines-example/` | 项目指南示例模板（基于 Zenith 项目） |
