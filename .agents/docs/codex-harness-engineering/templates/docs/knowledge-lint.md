# Knowledge Lint

本文定义 `docs/knowledge/` 的健康检查规则。目标是让知识库保持可检索、可追踪、不过期，而不是只进不出。

## 触发时机

- 每完成 10 个 driver 任务后建议运行一次。
- 连续 30 天未运行 knowledge lint 时，下次 `ARCHIVE-*` 或项目维护任务应提醒补跑。
- 每次较大 harness、规则、prompt 或模板改造后运行一次。
- `ARCHIVE-*` 发现重复、矛盾、长期未引用条目时运行一次。
- 手动维护知识库前后运行一次。

## 检查项

| 检查 | 规则 | 处理 |
| --- | --- | --- |
| 索引一致 | `knowledge-catalog.md`、`catalog.md` 必须覆盖实际条目 | 修复索引 |
| 孤儿条目 | 条目不在任何 catalog 中出现 | 加入索引或移入 archive |
| 路径失效 | catalog 指向不存在文件 | 修复路径或删除索引行 |
| 重复条目 | 标题、tags、source_references 高度重叠 | 标记 merge candidate |
| 矛盾条目 | 同主题出现相反指导 | 标记 conflict candidate |
| 长期未引用 | `last_referenced` 为空或超过衰减窗口 | 标记 decay candidate |
| 成熟度越权 | 单次来源直接为 `proven` | 降级并补 evidence |
| 团队同步候选 | verified/proven 条目具备跨项目价值 | 输出 team sync candidate |
| 团队冲突候选 | 项目事实与团队知识相反 | 输出 team conflict candidate |
| frontmatter 缺失 | 缺少 `id/type/maturity/tags/applicable_phases/source_references` | 补齐元数据 |

## 最小执行流程

1. 读取 `docs/harness/knowledge-architecture.md`。
2. 枚举 `docs/knowledge/` 下除 `archive/` 外的条目。
3. 对照 `docs/knowledge/catalog.md` 检查索引完整性。
4. 检查每条 frontmatter、路径、成熟度和引用信息。
5. 输出 lint report，列出 `fix_now`、`promotion_candidates`、`decay_candidates`、`conflict_candidates`、`merge_candidates`、`team_sync_candidates`。
6. 只自动修复索引、路径和明显元数据缺口；成熟度提升、冲突裁决、团队知识合并和删除归档必须保留人工确认或独立任务证据。

## 报告格式

```markdown
# Knowledge Lint Report

## Summary
- Entries scanned:
- Catalog mismatches:
- Fixes applied:
- Candidates:

## Fix Now
- ...

## Promotion Candidates
- ...

## Decay Candidates
- ...

## Conflict Candidates
- ...

## Merge Candidates
- ...

## Team Sync Candidates
- ...
```

## 任务模板片段

需要加入 `task.json` 时，可复制并按项目裁剪：

```json
{
  "id": "KNOWLEDGE-LINT-001",
  "description": "检查 docs/knowledge 索引、重复、冲突、成熟度和长期未引用条目",
  "task_kind": "archive",
  "phase": "archive",
  "gate_profile": "lightweight",
  "required_truth_sources": ["knowledge"],
  "priority": 95,
  "dependencies": ["ARCHIVE-001"],
  "passes": false,
  "context_files": [
    "docs/harness/knowledge-architecture.md",
    "docs/harness/knowledge-lint.md",
    "docs/harness/team-knowledge-sync.md",
    "docs/knowledge/knowledge-catalog.md",
    "docs/knowledge/catalog.md"
  ],
  "owned_paths": ["docs/knowledge/"],
  "execution": { "mode": "single" },
  "test_command": "git diff --check",
  "acceptance": [
    "输出 knowledge lint report",
    "catalog 与实际条目一致",
    "成熟度、冲突、团队同步和衰减只产出候选，不静默越权处理"
  ]
}
```
