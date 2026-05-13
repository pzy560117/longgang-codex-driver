# Team Knowledge Sync

本文定义项目级 `docs/knowledge/` 与可选团队知识库之间的同步协议。团队知识库是知识复利层，不是 driver 的运行依赖；没有外部知识库时，本地任务仍必须可以完成、验证和提交。

## 目标

- 把项目中已经验证的通用经验提升为团队资产。
- 让多个项目共享同一套技术知识、业务知识和团队约定。
- 用 Git、Markdown 和追加日志保留知识来源、贡献者、验证证据和冲突处理记录。
- 避免把未验证的单次经验直接升级为全局规则或团队规范。

## 推荐仓库结构

团队知识库建议独立成 Git 仓库，不寄生在任何业务项目中：

```text
team-knowledge/
  knowledge-catalog.md        # 团队级全景入口
  .knowledge-config.yaml      # 成员、角色、同步和冲突策略
  log.md                      # 只追加的知识变更日志
  team-conventions/           # Layer 0-T: 团队约定
  tech-wiki/                  # Layer 1: 跨项目技术知识
    catalog.md
  biz-wiki/<domain>/          # Layer 2: 领域业务知识
    catalog.md
  project-profiles/           # 项目画像和知识源映射
  contributions/
    pending/                  # 待合并贡献
    conflicts/                # 内容矛盾和人工裁决项
```

项目仓库只保存 Layer 3 项目知识：

```text
docs/knowledge/
  knowledge-catalog.md
  catalog.md
  models/
  decisions/
  guidelines/
  pitfalls/
  processes/
  archive/
```

## 角色

| 角色 | 权限 | 典型职责 |
| --- | --- | --- |
| `maintainer` | 审批 proven、裁决冲突、维护目录和成员 | 决定团队知识是否升级为约定、规则或模板 |
| `contributor` | 提交新条目、追加 evidence、标记冲突 | 从项目归档中输出 `contributions/pending/` |
| `reader` | 读取知识，不写入团队仓库 | 新成员、外部协作方、只读自动化 |

角色只影响团队知识库写入权限，不影响项目本地 `docs/knowledge/` 的归档任务。

## 配置建议

`.knowledge-config.yaml` 可使用以下最小形状：

```yaml
team:
  name: example-team
  default_role: reader
roles:
  maintainers: []
  contributors: []
sync:
  accept_layers: [tech-wiki, biz-wiki]
  default_domain:
  require_maintainer_for_proven: true
conflicts:
  on_content_conflict: stage_to_conflicts
  on_maturity_conflict: keep_lower_and_mark_contradiction
```

项目 driver 不应依赖该配置存在。缺少配置时，只输出候选报告，不直接写外部仓库。

## 贡献流程

1. `ARCHIVE-*` 从本轮 trace、review、failure triage 和 `progress.txt` 中提取项目知识。
2. 条目先进入项目 `docs/knowledge/`，新增条目默认 `maturity: draft`。
3. `KNOWLEDGE-TEAM-SYNC-*` 只挑选具备跨项目价值的 `verified` 或 `proven` 候选。
4. 候选写入团队仓库 `contributions/pending/`，保留项目来源、贡献者、验证证据和建议目标层。
5. maintainer 审核后合入 `tech-wiki/`、`biz-wiki/<domain>/` 或 `team-conventions/`。
6. 合入时追加 `log.md`，记录日期、动作、贡献者、来源项目、条目 ID 和 evidence。

## 自动合并与冲突策略

| 情况 | 默认处理 |
| --- | --- |
| 不同 ID 的纯新增条目 | 可自动进入 `contributions/pending/` |
| 同一条目追加 `evidence`、`last_referenced` 或 `contributors` | 可自动合并并去重 |
| `draft -> verified` | 需要至少一个真实任务引用并有验证证据 |
| `verified -> proven` | 需要两个不同任务或项目的证据，或 maintainer 明确审批 |
| 内容结论相反 | 写入 `contributions/conflicts/`，等待 maintainer 裁决 |
| 一方提升成熟度、一方降级成熟度 | 保留较低成熟度并标记 `contradiction` |
| 删除或归档团队知识 | 必须有人类审批和 `log.md` 记录 |

自动化只能生成候选、追加 evidence、修复索引；不得静默删除团队知识或把单次经验提升为 `proven`。

## 追加日志

`log.md` 只追加，不重写历史。推荐格式：

```markdown
## [2026-05-12] promote | <contributor> | <source-project> | +1 guideline | #<trace-or-commit>
- GUIDELINE-API-001: 分页接口必须声明稳定排序字段 (verified -> proven)
```

每次团队知识变更至少记录：

- action: `ingest`、`verify`、`promote`、`decay`、`conflict`、`archive`
- contributor
- source project
- source trace、commit、review finding 或文档路径
- affected knowledge IDs

## 条目元数据补充

团队知识条目除项目知识的基本 frontmatter 外，建议补充：

```yaml
evidence:
  contributors:
    - name: codex
      source_project: example-project
      source_ref: traces/TASK-001-20260512.json
  last_referenced:
  validated_projects: []
  contradictions: []
```

如果项目知识仍使用简化 frontmatter，也应在同步候选里补齐 evidence，而不是丢失来源。

## 降级与失败处理

- 团队知识仓库不可用时，任务只能记录 `blocked_external_knowledge_sync` 或输出候选报告，不应阻塞本地实现验证。
- 外部仓库 push 失败时，不要伪造已同步状态；把候选保留在项目报告或本地 pending 文件里。
- 外部知识和项目事实冲突时，以当前项目可验证事实为准，并输出 conflict candidate。
- 衰减和归档必须先形成候选，再由 maintainer 或独立任务确认。

## 任务模板片段

需要把团队知识同步加入 `task.json` 时，可按项目裁剪以下任务。该任务是可选上层能力，不应成为所有项目的默认阻塞任务。

```json
{
  "id": "KNOWLEDGE-TEAM-SYNC-001",
  "description": "把项目知识中的跨项目候选输出到团队知识库贡献暂存区",
  "task_kind": "archive",
  "phase": "archive",
  "gate_profile": "lightweight",
  "required_truth_sources": ["knowledge"],
  "priority": 95,
  "dependencies": ["ARCHIVE-001"],
  "passes": false,
  "context_files": [
    "docs/harness/knowledge-architecture.md",
    "docs/harness/team-knowledge-sync.md",
    "docs/knowledge/knowledge-catalog.md",
    "docs/knowledge/catalog.md"
  ],
  "owned_paths": [
    "docs/knowledge/"
  ],
  "execution": { "mode": "single" },
  "steps": [
    "读取 promotion candidates，筛选具备跨项目价值的 verified/proven 条目",
    "如果团队知识库可用，输出 contributions/pending 候选并追加同步报告",
    "如果团队知识库不可用，仅在项目内记录候选、缺失配置和后续人工步骤",
    "内容冲突写入 conflict candidate，不直接覆盖团队知识"
  ],
  "test_command": "git diff --check",
  "acceptance": [
    "同步结果或候选报告可追溯到项目知识条目和 evidence",
    "没有把 draft 或单次经验直接升级为团队 proven 知识",
    "外部团队知识库不可用时没有阻塞本地 driver 验证"
  ]
}
```

## 相关文档

- 项目知识架构：`docs/harness/knowledge-architecture.md`
- 冷启动导入：`docs/harness/knowledge-import.md`
- 知识健康检查：`docs/harness/knowledge-lint.md`
- Prompt 知识集成：`docs/harness/prompt-knowledge-integration.md`
