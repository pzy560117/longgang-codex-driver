# Harness Rule Governance

本文定义规则如何进入 `AGENTS.md`、深文档、prompt、task template 和自动化检查。目标是控制指令预算，同时让关键约束可执行、可验证、可演进。

## `docs/doc/1.md` 落地结论

`docs/doc/1.md` 的核心价值不是把模板原样搬进本仓库，而是约束规则系统的形态：

- `AGENTS.md` 做短入口，保留每次会话必须遵守的少量硬约束和深文档索引。
- AI 可以从代码、schema、lint 或脚本推断 / 检查的内容，不进入 `AGENTS.md`。
- 禁令必须带替代方案；例如不要伪造 `passes=true`，替代方案是让 `codex-loop.ps1` 在验证、review 和 commit gate 通过后写回状态。
- Bad Case 先进入知识、prompt、role rules 或自动化检查；只有所有会话都必须知道时，才升级到 `AGENTS.md`。
- 能自动检查的规则应进入 `verify.ps1`、`doctor.ps1`、JSON schema、hook 或同步脚本，不长期只靠文字提醒。
- 重要深文档必须被 `AGENTS.md` 引用，避免成为孤立文档。

本仓库实践选择：入口文件控制在“读完即可开工”的长度；任务、验证、知识、prompt 和镜像同步细节分别落到 `docs/harness/*`、`.agents/rules/*`、`.codex/prompts/*` 和 `agent/` package mirrors。

## 分层原则

| 层级 | 放什么 | 不放什么 |
| --- | --- | --- |
| `AGENTS.md` | 每次会话都必须遵守的少量硬约束、入口索引 | 长模板、通用编码常识、会频繁变动的细节 |
| `docs/harness/*` | driver、任务、验证、知识、治理等工程协议 | 具体业务需求 |
| `.agents/rules/*` | agent 角色、阶段路由、协作边界 | 单个功能的临时计划 |
| `.codex/prompts/*` | driver 注入给实现、review、repair 的执行提示 | 人类阅读优先的长说明 |
| `task.json` | 当前真实任务队列和验证命令 | 模板示例、过期 smoke 占位 |

## 规则进入标准

只有满足以下至少一项，才应新增规则：

- 同类问题在 review、trace 或失败记录中重复出现。
- 违反后会造成安全、数据、提交、验证或上下文污染风险。
- AI 无法从代码和现有文档自然推断。
- 新人或新会话必须知道，否则会走错执行链路。

以下内容默认不写进规则：

- formatter、linter 已经确定性检查的风格细节。
- “写清晰代码”这类无法改变行为的泛化建议。
- README 面向人类读者的项目介绍。
- 没有验证方式的一次性偏好。

## 禁令写法

禁令必须同时给替代方案：

```text
不要直接改 task.json 来伪造完成状态；应让 codex-loop.ps1 在验证、review 和 commit gate 通过后写回 passes=true。
```

如果无法给替代方案，先不要写成硬规则，改写成待确认风险或知识条目。

## Bad Case 闭环

每次出现 AI 错误，先判断应该落到哪里：

| 错误类型 | 处理位置 |
| --- | --- |
| 单次任务失败 | `progress.txt`、trace、failure triage |
| 可复用经验 | `docs/knowledge/pitfalls/` 或 `guidelines/` |
| 会反复影响 driver 行为 | `.codex/prompts/*` 或 `.agents/rules/*` |
| 所有会话必须知道 | `AGENTS.md` |
| 可以自动检查 | `verify.ps1`、`doctor.ps1`、JSON schema 或 hook |

## 变更流程

1. 先确认触发来源：trace、review finding、失败日志、用户明确要求或文档分析。
2. 选择最小生效层级，不把深文档内容直接搬进 `AGENTS.md`。
3. 修正文档歧义时，优先重构现有主入口、合并重复段落、删除过期引用；不要默认新增平行文档来解释另一个文档。
4. 如果改动影响模板或镜像，按 `harness-surface-sync` 同步 canonical source 和 mirrors。
5. 运行最小验证：文档至少 `git diff --check`，JSON 需要 `ConvertFrom-Json`，PowerShell 需要 parser 检查。
6. 提交前确认没有把 token、cookie、私钥、密码写入规则或 trace。

## 定期治理

建议每 10 个 driver 任务或每次较大 harness 改造后执行一次规则治理检查：

- `AGENTS.md` 是否仍保持短入口。
- 深文档是否有孤立规则没有被入口引用。
- prompt 是否与 `AGENTS.md`、`.agents/rules/agents.md` 冲突。
- task template 是否还包含 smoke、示例领域或占位路径。
- 知识条目是否有重复、过时、矛盾或长期未引用内容。

## AGENTS.md 压缩检查表

调整 `AGENTS.md` 时逐条检查：

| 问题 | 处理 |
| --- | --- |
| 这条规则是否每次会话都必须知道？ | 是则保留，否则下沉到深文档 |
| 这条规则是否已有脚本、schema、lint 或 hook 检查？ | 链接自动化位置，不重复写长说明 |
| 这条规则是否只是通用工程常识？ | 删除 |
| 这条规则是否只有禁止项？ | 补充替代方案，否则降级为风险说明 |
| 这条规则是否源自单次失败？ | 先进入 `docs/knowledge/` 或 trace，不直接升级入口 |
| 深文档是否在入口可发现？ | 在 `AGENTS.md` 索引补链接 |
