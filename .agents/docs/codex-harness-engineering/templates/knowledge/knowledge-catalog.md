# Knowledge Catalog

本目录保存当前项目的可复用知识。Codex 会话应先读本文件，再按需读取 `catalog.md` 和具体条目。

## 查询顺序

1. 当前任务涉及 harness、规则、driver、trace、模板或 prompt 时，先读 `docs/harness/knowledge-architecture.md`。
2. 需要查找已有经验时，读 `docs/knowledge/catalog.md`。
3. 只读取与当前任务直接相关的完整条目。

## 维护入口

- 冷启动导入：`docs/harness/knowledge-import.md`
- 健康检查：`docs/harness/knowledge-lint.md`
- 架构协议：`docs/harness/knowledge-architecture.md`

## 分类

| 分类 | 路径 | 用途 |
| --- | --- | --- |
| Models | `docs/knowledge/models/` | 实体、结构、关系 |
| Decisions | `docs/knowledge/decisions/` | 架构决策、取舍和原因 |
| Guidelines | `docs/knowledge/guidelines/` | 推荐做法、禁止做法和替代方案 |
| Pitfalls | `docs/knowledge/pitfalls/` | 已知风险、失败模式、排查步骤 |
| Processes | `docs/knowledge/processes/` | 可重复工作流和操作步骤 |
| Archive | `docs/knowledge/archive/` | 过时、低置信或待合并条目 |

## 阶段推荐

| 阶段 | 优先知识类型 |
| --- | --- |
| analysis | `model`、`process`、`pitfall` |
| design | `decision`、`guideline`、`model` |
| plan | `decision`、`process`、`pitfall` |
| implement | `guideline`、`pitfall` |
| review | `guideline`、`pitfall`、`decision` |
| archive | 所有类型 |

## 当前状态

当前知识库处于 cold start。新增条目默认 maturity 为 `draft`，需要通过 trace 引用和验证证据逐步提升。
