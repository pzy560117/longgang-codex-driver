---
id: DECISION-HARNESS-001
type: decision
maturity: draft
tags: [harness, knowledge]
applicable_phases: [analysis, plan, implement, review, archive]
source_references:
  - docs/doc/Harness不是目的，知识才是护城河.md
last_referenced:
contributors:
  - codex
---

# Harness 从执行闭环扩展为知识闭环

## Context

当前 harness 已经能通过 `task.json`、`codex-loop.ps1`、验证命令、Stage 1/2 review、trace 和 commit gate 建立执行闭环，但缺少知识复用与归档机制。

## Decision

将 `docs/knowledge/` 作为项目级知识层，并在 trace、任务模板和归档阶段中显式记录知识引用与知识产出。

## Consequences

正面影响：

- 后续任务可以复用已验证经验，减少重复推导。
- review finding 和失败经验能沉淀为可检索资产。
- 规则升级可以基于 proven 知识，而不是单次偏好。

代价：

- 需要维护 catalog 和条目成熟度。
- 需要在归档阶段控制噪音，避免把一次性结论误升为规则。

## Evidence

本条来自 `docs/doc/` 中对 Harness Engineering 和知识沉淀实践的分析，初始成熟度为 `draft`。
