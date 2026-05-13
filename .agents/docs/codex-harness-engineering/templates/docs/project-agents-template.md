# Project AGENTS.md Template

本文是生成项目根 `AGENTS.md` 的通用模板，不应原样复制后长期保留占位符。生成时先分析项目事实，再按项目类型裁剪章节。

## 使用原则

- `AGENTS.md` 是给编码 Agent 的入口规则，不是 README 的复刻。
- 只写会改变 Agent 行为的项目特定信息；通用工程常识、formatter/linter 已覆盖的内容不要写。
- 根 `AGENTS.md` 保持短入口，建议 60-120 行；细节放到 `docs/`、`rules/`、`specs/` 或测试文档，并在入口索引引用。
- 每条禁令必须给替代方案；不能说明替代方案的内容先写成风险或待确认项。
- 可以自动检查的规则优先进入 lint、schema、hook、CI、verify 脚本，不只依赖文字提醒。
- 规则从 Bad Case 迭代：重复 review 问题、线上事故、新人必踩坑、Agent 反复犯错，才升级为入口规则。

## 生成前事实扫描

先收集这些事实，再填模板：

| 事实 | 来源 |
| --- | --- |
| 项目类型 | README、目录结构、启动脚本、部署文件 |
| 技术栈 | `package.json`、`pyproject.toml`、`go.mod`、`pom.xml`、Dockerfile |
| 常用命令 | scripts、Makefile、CI、现有 docs |
| 架构边界 | `src/`、`apps/`、`packages/`、`services/`、`docs/architecture*` |
| 测试入口 | test scripts、`tests/`、Playwright/Cypress/Pytest/Vitest 配置 |
| 自动化检查 | linter、formatter、typecheck、CI、hooks |
| 私域知识 | 内部组件库、私有 API、特殊目录、历史迁移约束 |
| Bad Case | 近期 review、bug 标签、trace、失败复盘、团队反复纠正事项 |

## 根 AGENTS.md 模板

```markdown
# AGENTS.md

本文件只保留当前项目中每次编码会话都必须知道的规则。更详细的背景、接口、测试和部署说明见下方索引。

## 项目边界

- 项目类型：<应用 / 库 / monorepo / harness / 模板 / 服务端 / 前端 / 全栈>
- 主要技术栈：<只列非默认且会影响实现选择的技术>
- 真实入口：<启动、构建、测试、driver 或任务系统入口>
- 不要把 README 的业务介绍复制到这里；README 回答“项目是什么”，本文件回答“Agent 怎么改”。

## 常用命令

| 场景 | 命令 | 说明 |
| --- | --- | --- |
| 安装 | `<command>` | <必要前提或包管理器> |
| 开发 | `<command>` | <端口 / 环境变量 / mock 说明> |
| 测试 | `<command>` | <默认测试范围> |
| 类型 / lint | `<command>` | <失败时处理方式> |
| 构建 | `<command>` | <产物路径或限制> |

## 架构与目录规则

| 场景 | 应使用 | 不要使用 |
| --- | --- | --- |
| <例如 API 入口> | `<path/helper>` | <禁止路径或绕路方式> |
| <例如状态管理> | `<existing-pattern>` | <不要引入的新库> |
| <例如数据访问> | `<repository/service>` | <不要跨层调用> |

## 项目硬约束

- <CRITICAL 规则 1>；替代方案：<明确可执行做法>。
- <CRITICAL 规则 2>；替代方案：<明确可执行做法>。
- <安全 / 数据 / 权限 / 迁移 / 发布红线>；替代方案：<明确可执行做法>。

## 测试与完成定义

- 修改 <模块/路径> 后至少运行 `<command>`。
- 涉及 <API/业务流/权限/支付/外部系统> 时，必须补充 <单元/集成/E2E/契约/真实环境 smoke> 证据。
- 完成声明必须包含实际运行过的命令和结果；不要只说“应该可以”。

## 工作区与提交

- 开始前检查 `git status --short`；不要覆盖用户未说明的改动。
- 只修改与当前任务相关的文件。
- 禁止使用破坏性 Git 命令，除非用户明确要求。
- 提交前运行与改动匹配的验证命令。

## 深文档索引

- 架构：`<docs/architecture.md>`
- API / 契约：`<docs/api.md>`
- 测试策略：`<docs/testing.md>`
- 部署 / 运维：`<docs/deploy.md>`
- 历史坑 / 项目知识：`<docs/knowledge/>`
```

## 子目录 AGENTS.md 模板

只有 monorepo 或目录规则明显不同时才添加子目录 `AGENTS.md`。子目录规则应比根规则更具体。

````markdown
# <path> AGENTS.md

## 作用范围

- 本文件只适用于 `<path>/` 下的改动。
- 根 `AGENTS.md` 仍然有效；本文件只补充或收紧本目录规则。

## 本目录约束

- 技术栈 / 框架：<目录特定信息>
- 入口文件：<真实入口>
- 测试命令：<目录级验证命令>

## 决策表

| 场景 | 应使用 | 不要使用 |
| --- | --- | --- |
| <场景> | <本目录模式> | <禁止做法> |

## 代码示例

```<language>
// 3-10 行真实项目代码，展示应该复用的模式
```
````

## CLAUDE.md 组合模板

仅当团队主要使用 Claude Code 且需要 Claude 专属能力时添加。通用规则仍放 `AGENTS.md`。

```markdown
# CLAUDE.md

@AGENTS.md

## Claude Code 专属规则

- 使用 hooks / commands / memory 的项目约定：<只写 Claude Code 独有内容>。
- 个人本地偏好放 `CLAUDE.local.md`，不要提交。
- 不要在这里重复 `AGENTS.md` 已有规则。
```

## 裁剪检查

生成后逐条检查：

| 检查项 | 处理 |
| --- | --- |
| 是否超过 120 行 | 下沉细节到深文档，只保留索引 |
| 是否复制 README 项目介绍 | 删除，改为 README 链接 |
| 是否包含通用编码常识 | 删除 |
| 禁令是否没有替代方案 | 补替代方案或降级为风险 |
| 是否引用不存在的命令或路径 | 修正或删除 |
| 自动化可检查的内容是否只写文字 | 补充脚本 / hook / CI / verify 入口 |
| 深文档是否无法从入口发现 | 加入索引 |
