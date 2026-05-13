# Prompt Knowledge Integration

本文定义 `.codex/prompts/*` 如何消费 `docs/harness/*` 和 `docs/knowledge/*`，确保知识沉淀不只停留在文档里，而是进入实现、审查、修复和归档链路。

## 目标

- 每个执行角色都知道何时读取知识目录。
- 每个输出角色都能记录 `knowledge_references` 和 `knowledge_outputs`。
- review 能检查知识是否被使用、是否被误用。
- failure triage、repair 和 visual review 能把坏例转成可归档建议。
- harness writer 和 docs worker 能按规则治理协议决定内容写到哪里。

## Prompt 覆盖矩阵

| Prompt | 知识消费 | 知识产出 |
| --- | --- | --- |
| `controller-loop.md` | 判断任务是否需要注入 `docs/knowledge/` 和规则治理上下文 | 决定是否进入 `ARCHIVE-*` |
| `implement-one-task.md` | 按阶段读取 knowledge catalog 和相关条目 | 输出 `Knowledge References` / `Knowledge Outputs` |
| `review-stage1-spec.md` | 检查 `knowledge` truth source、archive 阶段和规则误升级 | 输出 `knowledge_gap` finding |
| `review-stage2-quality.md` | 检查代码或文档决策是否引用知识 | 输出 `knowledge_gap` finding |
| `failure-triage.md` | 读取历史坑辅助归因 | 输出 `knowledgeOutputSuggestions` |
| `repair-one-finding.md` | 读取相关知识，避免重复踩坑 | 输出修复后的知识建议 |
| `visual-evaluator.md` | 使用设计和视觉相关经验 | 输出视觉 pitfall / guideline 建议 |
| `harness-audit.md` | 审计 prompt、trace、archive 和 catalog 覆盖 | 输出 Knowledge Gaps |
| `worker-role/harness-writer.md` | 读取知识架构和规则治理 | 同步 prompt/docs/knowledge mirrors |
| `worker-role/docs-worker.md` | 判断长期文档与临时讨论边界 | 把可复用经验写入 `docs/knowledge/` |
| `worker-role/frontend-worker.md` | 读取 UI/视觉/组件经验 | 输出前端知识引用和新坑建议 |
| `worker-role/backend-worker.md` | 读取架构、安全、API 风险经验 | 输出后端知识引用和新坑建议 |
| `worker-role/test-runner.md` | 读取历史测试/环境坑 | 输出失败模式归档建议 |

## 阶段查询矩阵

实现会话不应一次性读取全部知识。先读 `knowledge-catalog.md`，再按阶段和任务类型选择 catalog 与少量完整条目。

| 阶段 | 查询重点 | 优先知识类型 | 默认用途 |
| --- | --- | --- | --- |
| `analysis` / 产品分析 | 业务实体、历史需求、流程和已知坑 | `model`、`process`、`pitfall` | 补齐需求边界、异常流和术语 |
| `plan` / 技术分析 | 既有架构决策、禁止做法、失败模式 | `decision`、`guideline(avoid)`、`pitfall` | 避免重复推导和重复踩坑 |
| `design` / 架构设计 | 实体关系、模块边界、历史决策 | `model`、`decision` | 保持设计与已有约束一致 |
| `implement` | 编码实践、团队约定、风险路径 | `guideline`、`pitfall` | 指导实现细节和边界处理 |
| `verify` / release | 回归风险、环境坑、禁止做法 | `pitfall`、`guideline(avoid)` | 选择 affected tests 和失败排查路径 |
| `archive` | 本轮引用、产出、冲突和可提升条目 | 全部类型 | 更新 `last_referenced`、输出 promotion/decay/conflict/merge candidates |

每个阶段只读取和当前任务直接相关的条目。`draft` 条目可以启发分析，但不能成为阻塞性 review 依据；`proven` 条目才适合升级为规则、模板或 prompt。

## 输出字段约定

实现、修复和 worker handoff 应尽量使用以下 Markdown 字段：

```markdown
## Knowledge References
- `id`: title - used_in - `path`

## Knowledge Outputs
- `suggested-id`: type - title - action - `target-path`
```

失败归因 JSON 使用：

```json
{
  "knowledgeReferences": [],
  "knowledgeOutputSuggestions": []
}
```

driver trace 使用 `trace.schema.json` 中的：

- `knowledge_references`
- `knowledge_outputs`
- `archive_summary`

## 使用边界

- `draft` 知识只能作为参考，不应作为阻塞性 review 依据。
- `verified` 知识可以作为 reviewer 的辅助依据。
- `proven` 知识才适合升级为规则、模板或 prompt。
- 单次任务经验不得直接写入 `AGENTS.md`，应先进入 `docs/knowledge/`。
- prompt 改动后必须同步 `agent/.codex/prompts/`、`agent/docs/codex-harness-engineering/templates/prompts/` 和 `.agents/docs/codex-harness-engineering/templates/prompts/`。

## 维护检查

每次改动 `docs/harness/knowledge-architecture.md`、`docs/harness/rule-governance.md`、`trace.schema.json` 或 `project-task-template.json` 后，检查：

1. `implement-one-task.md` 是否仍要求输出知识引用和知识产出。
2. Stage 1 / Stage 2 review 是否能检查知识缺口。
3. failure / repair / visual prompts 是否能把坏例转成归档建议。
4. worker-role prompts 是否要求读取对应知识文档。
5. `refresh-agent-package.ps1 -CheckOnly` 是否通过。
