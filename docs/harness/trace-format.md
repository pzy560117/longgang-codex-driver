# Trace Format 模板

## 1. 文件命名

```text
traces/<task-id>-<yyyyMMdd-HHmmss>.json
```

## 2. 必需字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | string | 当前任务 id |
| `agent` | string | 执行代理，如 `codex` |
| `started_at` | string | ISO 8601 开始时间 |
| `ended_at` | string | ISO 8601 结束时间 |
| `status` | enum | `passed`、`failed`、`blocked` |
| `commands` | array | 执行命令和退出码 |
| `stage1_review` | object | Stage 1 审查 verdict、退出码和摘要 |
| `stage2_review` | object | Stage 2 审查 verdict、退出码和摘要 |

## 3. 推荐字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_session_id` | string | 当前 task 的 fresh session id |
| `task_kind` | string | 任务类型，例如 `harness`、`smoke`、`feature_impl` |
| `gate_profile` | string | 本任务启用的 gate 强度 |
| `schema_version` | string | trace schema 版本 |
| `session_dir` | string | 当前 task session 的持久日志目录 |
| `events_file` | string/null | implementation 阶段主 Codex JSONL 事件流文件；review JSONL 如有保留，仍记录在 `log_files` / `logs` |
| `log_files` | array | implementation / review / test output 等日志文件路径 |
| `evidence_files` | array | 与当前任务关联的额外证据附件 |
| `role` | string | 当前 Agent 的角色，例如 `frontend`、`backend`、`reviewer` |
| `model` | string | 实际使用的模型 |
| `reasoning_effort` | enum | 实际使用的思考深度: `none`、`low`、`medium`、`high`、`xhigh` |
| `model_policy` | object | 模型策略来源，例如 policy 文件和 role 覆盖路径 |
| `required_truth_sources` | array | 本任务必须满足的 truth source 类型 |
| `files_changed` | array | Git 检测到的文件 |
| `blocked_reason` | string/null | 阻塞原因 |
| `final_message` | string | Codex 最终消息摘要 |
| `test_command` | string | 当前任务验证命令 |
| `failed_stage` | string/null | 失败发生在哪个 gate |
| `unexpected_paths` | array | commit path ownership gate 阻断时记录超出 `owned_paths` / runtime allowlist 的路径 |
| `review_context` | object | Stage 1 / Stage 2 对照的真相源文件集合 |
| `truth_source_state` | array | truth source 满足情况、已找到路径和缺失项 |
| `knowledge_references` | array | 当前任务读取并实际使用的知识条目 |
| `knowledge_outputs` | array | 当前任务新增、更新或建议归档的知识条目 |
| `archive_summary` | object/null | 归档阶段对知识引用、知识产出和成熟度变化的摘要 |
| `logs` | object | implementation / stage review / test output 的日志文件路径 |

## 4. 校验

使用 `trace.schema.json` 校验 trace。CI 中可以用任意 JSON Schema validator 执行。
