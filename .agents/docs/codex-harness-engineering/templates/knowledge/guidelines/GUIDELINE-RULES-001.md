---
id: GUIDELINE-RULES-001
type: guideline
maturity: draft
tags: [rules, governance, context]
applicable_phases: [analysis, plan, implement, review]
source_references:
  - docs/doc/1.md
last_referenced:
contributors:
  - codex
---

# 规则必须短入口、深文档、可验证

## Context

根规则过长会消耗指令预算，孤立深文档又容易不被发现。当前仓库已经有 `AGENTS.md`、`docs/harness/*`、`.agents/rules/*` 和 `.codex/prompts/*` 多层规则面，需要明确分层。

## Guidance

- `AGENTS.md` 只保留每次会话必须遵守的硬约束和深文档索引。
- 复杂流程写入 `docs/harness/*` 或 `.agents/rules/*`。
- 执行时必须注入的行为写入 `.codex/prompts/*`。
- 禁令必须包含替代方案。
- 能自动检查的规则应进入脚本、schema 或 hook，而不是只靠文字约束。

## Evidence

本条来自 `docs/doc/1.md` 的规则工程分析，初始成熟度为 `draft`。
