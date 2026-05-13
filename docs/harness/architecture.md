# Harness 架构

## 目标

Harness 的目标是把 Codex 的执行过程固定成可重复、可验证、可追踪、可沉淀知识的工程闭环。

## 核心链路

```text
task.json
  -> codex-loop.ps1
  -> codex exec
  -> verify / lint / build / test
  -> progress.txt + traces/*.json
  -> docs/knowledge/ 引用与归档
  -> task.json passes=true
  -> git commit
```

## 分层

- 规则层：`AGENTS.md`
- 任务层：`task.json`
- 执行层：`codex-loop.ps1`
- 配置层：`.codex/task-run-profile.json`
- 证据层：`progress.txt`、`traces/`
- 验证层：`verify.ps1` 与任务内 `test_command`
- 知识层：`docs/knowledge/knowledge-catalog.md`、分类索引和知识条目
- 治理层：`docs/harness/rule-governance.md`、`docs/harness/knowledge-architecture.md`、`docs/harness/knowledge-import.md`、`docs/harness/knowledge-lint.md`、`docs/harness/team-knowledge-sync.md`

## 原则

- 任何完成声明都必须有验证证据。
- 任何任务推进都必须回到可验证的 `task.json`、`progress.txt` 或 `traces/` 证据链上。
- 任何复用过的项目经验都应在 trace 中留下 `knowledge_references`，避免知识只停留在对话上下文。
- 任何可复用的新经验都应在归档任务中沉淀到 `docs/knowledge/`，初始成熟度默认是 `draft`。
- 既有项目接入时，知识冷启动只生成 draft 条目；成熟度提升必须来自后续引用和验证证据。
- 知识库需要定期 lint，检查索引、孤儿条目、重复、冲突、成熟度和长期未引用条目。
- 团队知识库是可选上层能力，只同步 verified/proven 级别的跨项目候选；外部知识库不可用时不应阻塞本地 driver。
- `progress.txt`、`traces/` 和 Git 状态由 runtime 脚本落盘；其他需要新增或修改的仓库内容必须委派给匹配的 writer 子代理，主控会话自身不直接写文件。
- 默认只在当前 Git 工作区内执行，不创建额外执行目录。
