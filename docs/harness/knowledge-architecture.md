# Harness Knowledge Architecture

本文定义 Codex Harness 的项目知识层。Harness 不只负责把任务跑完，还要把执行中被证明有用的经验沉淀成可检索、可追踪、可维护的项目资产。

## 目标

- 让任务执行前能按需读取项目经验，而不是每次从零推导。
- 让任务执行后能把架构决策、风险、流程和坏例归档。
- 让 trace 记录知识引用，支持后续成熟度提升、衰减和冲突治理。
- 控制上下文预算，避免把大量完整知识一次性塞进每个 Codex 会话。

## 存储层

当前仓库先落地项目级知识层：

```text
docs/knowledge/
  knowledge-catalog.md      # 全景入口，约 50-120 行
  catalog.md                # 当前项目全部知识条目的一行摘要索引
  models/                   # 实体、数据结构、关系
  decisions/                # 架构决策和技术选型
  guidelines/               # 推荐做法和禁止做法
  pitfalls/                 # 已知风险、失败模式、排查路径
  processes/                # 工作流、业务流、操作步骤
  archive/                  # 过时或低置信条目
```

跨项目团队知识库暂不直接耦合到 runtime。后续如引入独立 Git 知识仓库，应通过同步任务把稳定条目提升出去，而不是让 driver 直接依赖外部仓库可用性。

可选团队知识库建议使用独立 Git 仓库，而不是寄生在某个业务项目中：

```text
team-knowledge/
  knowledge-catalog.md        # 团队级全景入口
  .knowledge-config.yaml      # 成员、角色、同步和冲突策略
  log.md                      # 只追加的知识变更日志
  team-conventions/           # Layer 0-T: 团队约定
  tech-wiki/                  # Layer 1: 跨项目技术知识
  biz-wiki/<domain>/          # Layer 2: 领域业务知识
  project-profiles/           # 项目画像和知识源映射
  contributions/
    pending/                  # 待合并贡献
    conflicts/                # 内容矛盾和人工裁决项
```

团队知识库是可选上层能力。项目 driver 必须能在没有外部知识仓库的情况下继续执行；外部知识同步失败时只能降级为缺少可复用上下文，不应阻断本地验证。

团队知识库的完整同步协议见 `docs/harness/team-knowledge-sync.md`。本文件只定义项目知识层和提升边界；团队知识库的成员角色、贡献暂存、冲突裁决和追加日志由同步协议约束。

## 知识层级

| 层级 | 范围 | 存放建议 | 进入方式 |
| --- | --- | --- | --- |
| Layer 0-P | 个人偏好 | 用户本地配置，不提交项目 | 人工维护 |
| Layer 0-T | 团队约定 | `team-conventions/` | 团队维护 |
| Layer 1 | 跨项目技术知识 | `tech-wiki/` | verified / proven 技术条目提升 |
| Layer 2 | 业务领域知识 | `biz-wiki/<domain>/` | verified / proven 业务条目提升 |
| Layer 3 | 项目知识 | `docs/knowledge/` | `ARCHIVE-*` 或 `KNOWLEDGE-IMPORT-*` 写入 |

提升方向默认从 Layer 3 开始。只有当条目不再是项目特有经验，并且 evidence 显示可跨任务或跨项目复用时，才建议提升到 Layer 1 或 Layer 2。

## 知识类型

| 类型 | 用途 | 示例 |
| --- | --- | --- |
| `model` | 描述实体、结构和关系 | task、trace、truth source 的关系 |
| `decision` | 记录技术选择及原因 | driver-first 优先于聊天内手工实现 |
| `guideline` | 记录推荐或禁止做法 | 禁止只写禁令而不给替代方案 |
| `pitfall` | 记录已知风险和排查步骤 | smoke 占位任务被误带入真实项目 |
| `process` | 记录可重复流程 | ARCHIVE 从 trace 提取知识 |

## 成熟度

| 成熟度 | 定义 | 默认处理 |
| --- | --- | --- |
| `draft` | 单次任务、单一来源提取 | 可引用，但不能作为强约束 |
| `verified` | 至少在一个真实任务中被复用并通过验证 | 可作为 reviewer 的参考依据 |
| `proven` | 至少两个不同任务或项目复用并保持有效 | 可提升为规则、模板或 prompt |

成熟度提升必须基于 evidence，不接受口头判断。长期未引用或被发现过时的条目应降级或移入 `docs/knowledge/archive/`。

`verified -> proven` 不应由单个任务静默完成。默认需要两个不同任务或项目的证据；如果只有一个项目内证据，必须有 maintainer 在归档报告或团队知识同步记录中明确审批。

## 提升、衰减和冲突

| 事件 | 默认处理 |
| --- | --- |
| draft 条目在一个真实任务中被引用并通过验证 | 可提升为 `verified` |
| verified 条目在两个不同任务或项目中被引用并保持有效 | 可提升为 `proven` |
| proven 条目 12 个月未被引用 | 建议降级为 `verified` 或标记复核 |
| verified 条目 6 个月未被引用 | 建议降级为 `draft` 或标记复核 |
| draft 条目长期未引用且 lint 标记无入口 | 移入 `docs/knowledge/archive/` |
| 同一主题出现相反结论 | 保留较低成熟度，写入 conflict candidate，等待人工裁决 |
| 仅追加 evidence、last_referenced 或 contributors | 可自动合并 |

自动化只能产生候选，不应静默提升到 `proven` 或删除知识条目。成熟度变更必须在 trace 的 `archive_summary.maturity_changes` 或归档报告中留下证据。

团队知识库引入后，角色边界如下：

| 角色 | 项目知识权限 | 团队知识权限 |
| --- | --- | --- |
| `maintainer` | 可审批归档、衰减和冲突裁决 | 可审批 proven、合并冲突和维护 `log.md` |
| `contributor` | 可新增 draft、追加 evidence、输出候选 | 可写入 `contributions/pending/` |
| `reader` | 可读取并引用知识 | 只读，不写团队仓库 |

## 条目格式

每条知识使用 Markdown 文件，文件名推荐：

```text
<TYPE>-<AREA>-<NNN>.md
```

条目头部使用 YAML frontmatter：

```markdown
---
id: GUIDELINE-HARNESS-001
type: guideline
maturity: draft
tags: [harness, rules, context]
applicable_phases: [analysis, plan, implement, archive]
source_references:
  - traces/<task-id>-<timestamp>.json
last_referenced:
contributors:
  - codex
evidence:
  contributors:
    - name: codex
      source_ref: traces/<task-id>-<timestamp>.json
  validated_projects: []
  contradictions: []
---

# 标题

## Context

这条知识成立的背景。

## Guidance

可执行的规则、判断或流程。

## Evidence

验证命令、trace、review finding 或失败记录。
```

## 渐进式查询

Codex 会话按三层读取：

1. 读 `docs/knowledge/knowledge-catalog.md`，判断有哪些分类和阶段推荐入口。
2. 读 `docs/knowledge/catalog.md`，按 `tags`、`type`、`applicable_phases` 过滤候选条目。
3. 只读取和当前任务直接相关的完整条目。

任务可通过 `knowledge_query_budget` 限制读取量：

```json
{
  "knowledge_query_budget": {
    "catalogs": 2,
    "entries": 5
  }
}
```

## Trace 集成

任务使用知识后，应在最终报告或 trace 中留下：

```json
{
  "knowledge_references": [
    {
      "id": "GUIDELINE-HARNESS-001",
      "title": "规则必须配替代方案",
      "used_in": "Stage 1 review"
    }
  ]
}
```

归档任务读取 `knowledge_references` 后，可以更新 `last_referenced`、提升成熟度，或标记冲突。

归档任务还应输出以下候选清单，供维护者或后续 lint 任务处理：

- promotion candidates：可提升成熟度或提升到团队知识库的条目。
- decay candidates：长期未引用、上下文疑似过时的条目。
- conflict candidates：同一主题存在相反结论或适用条件冲突。
- merge candidates：重复或高度相似条目。

## 归档策略

`ARCHIVE-*` 任务只做知识沉淀和索引维护，不重新定义需求范围。归档输入包括：

- 当前任务 trace
- `progress.txt`
- Stage 1 / Stage 2 review 输出
- failure triage
- changed files
- 验证命令输出

归档输出包括：

- 新增或更新的知识条目
- 更新后的 `knowledge-catalog.md`
- 更新后的 `catalog.md`
- trace 中的 `archive_summary`

归档阶段缺失不应阻塞代码验证，但会降低后续任务复用历史经验的能力。

## 相关流程

- 冷启动导入：`docs/harness/knowledge-import.md`
- 知识健康检查：`docs/harness/knowledge-lint.md`
- 团队知识同步：`docs/harness/team-knowledge-sync.md`
