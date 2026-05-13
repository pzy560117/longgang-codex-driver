# Knowledge Import

本文定义历史项目或既有项目接入 Harness 时的知识冷启动流程。目标是把散落在代码、文档、issue、review 和口头经验里的隐性知识转成 `docs/knowledge/` 的 draft 条目。

## 原则

- 不追求一次导入完美；冷启动条目默认 `maturity: draft`。
- 优先提取会影响后续实现决策的知识，而不是搬运完整文档。
- 每条知识都必须有 `source_references`，可以追溯到代码路径、文档、issue、review 或人工访谈记录。
- 单次导入建议控制在 5-13 条高价值条目，避免知识库第一天就膨胀。
- 导入阶段只建立候选知识，不把规则直接升级到 `AGENTS.md`。

## 输入来源

| 来源 | 可提取内容 |
| --- | --- |
| README / docs | 项目边界、运行方式、架构说明、业务流程 |
| 代码结构 | 模块边界、核心实体、数据流、依赖关系 |
| 测试与 CI | 验证入口、风险路径、质量门禁 |
| issue / PR / review | 反复出现的 pitfall、约束和决策原因 |
| trace / failure triage | 已验证失败模式和排查路径 |
| 团队访谈 | AI 无法从代码推断的私域经验 |

## 三段式导入

1. `doc-collector`：收集已有文档、README、测试说明、CI、issue 或人工访谈摘要。
2. `codebase-profiler`：扫描代码结构、技术栈、模块边界、入口命令和关键依赖。
3. `knowledge-builder`：按 `model / decision / guideline / pitfall / process` 标准化条目，写入 `docs/knowledge/` 并更新索引。

## 输出要求

- `docs/knowledge/catalog.md` 增加一行摘要。
- 新条目写入对应目录，初始 `maturity: draft`。
- 每条条目包含 `source_references` 和 `contributors`。
- 导入报告说明未处理来源、低置信条目和后续验证建议。

## 断点恢复

冷启动导入可能跨多轮扫描。导入任务应在 `docs/knowledge/import-state.json` 或导入报告中记录可恢复状态，避免中断后重复处理同一批来源。

推荐最小结构：

```json
{
  "schema_version": "1",
  "started_at": "2026-05-12T00:00:00+08:00",
  "updated_at": "2026-05-12T00:00:00+08:00",
  "sources": {
    "processed": [],
    "pending": [],
    "skipped": [],
    "low_confidence": []
  },
  "resume_cursor": {
    "source": "",
    "path": "",
    "position": ""
  },
  "generated_entries": [],
  "follow_up_verification": []
}
```

`import-state.json` 只描述导入进度，不替代知识条目的 `source_references`。如果项目不希望长期保留该文件，可在导入完成后把同等信息写入导入报告，但必须保留未处理来源和低置信候选。

## 任务模板片段

需要加入 `task.json` 时，可复制并按项目裁剪：

```json
{
  "id": "KNOWLEDGE-IMPORT-001",
  "description": "从既有代码、文档和历史记录冷启动 docs/knowledge 项目知识库",
  "task_kind": "archive",
  "phase": "archive",
  "gate_profile": "lightweight",
  "required_truth_sources": ["repo_context"],
  "priority": 5,
  "dependencies": ["INIT-001"],
  "passes": false,
  "context_files": [
    "AGENTS.md",
    "README.md",
    "docs/harness/knowledge-architecture.md",
    "docs/harness/knowledge-import.md"
  ],
  "owned_paths": ["docs/knowledge/"],
  "execution": { "mode": "single" },
  "knowledge_query_budget": {
    "catalogs": 2,
    "entries": 5
  },
  "steps": [
    "扫描 README、docs、测试入口、CI 和核心代码结构",
    "维护 import-state.json 或导入报告，记录 processed/pending/skipped/low_confidence 来源和 resume_cursor",
    "提取 5-13 条高价值 draft 知识，按 model/decision/guideline/pitfall/process 分类",
    "更新 knowledge-catalog.md 和 catalog.md",
    "输出导入报告，列出低置信来源和后续验证建议"
  ],
  "test_command": "git diff --check",
  "acceptance": [
    "新增条目均为 draft 且带 source_references",
    "catalog 与新增条目一致",
    "导入状态或报告能支持断点恢复，未处理来源没有丢失",
    "没有把冷启动条目直接升级为 AGENTS.md 规则"
  ]
}
```
