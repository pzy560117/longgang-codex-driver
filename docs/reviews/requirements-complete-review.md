# Requirements Complete Review: REQUIREMENTS-COMPLETE-REVIEW-001

Verdict: PASS_WITH_GAPS

## Truth Source

- `docs/product/prd-lite.md`
- `docs/product/acceptance-criteria.md`
- `docs/product/requirement-interface-matrix.md`
- `docs/product/state-matrix.yaml`
- `docs/architecture/constraints.md`

## Evidence Source

- `contracts/openapi.yaml`
- `src/`
- `tests/`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/verify-matrix.md`
- `task.json`

## Summary

本轮复审以产品真相源和架构约束为判定基线。上一轮 `RCR-P0-001` 至 `RCR-P0-005` 已由后续 repair task 补齐并关闭，但重新对照当前契约、实现、测试和证据边界后，仍发现新的 P0/P1 缺口，因此本 review 任务结论为 `PASS_WITH_GAPS`。该结论只表示 review 产物完整输出缺口和后续任务建议，不表示产品实现已经完成。

当前证据边界仍严格限定为本机 / Docker MySQL + 本地 object storage mock / contract / local-dev evidence。本 review 不声明外部生产 MySQL、外部业务只读数据源或 live OSS/S3 已验证，也不把 docker/mock evidence 升级为 live evidence。

## Fresh Evidence Used

- `AUTH-CONTEXT-TRUST-BOUNDARY-001`: 关闭旧认证上下文可信边界 finding。
- `DATA-SCOPE-TEMPLATE-ENFORCE-001`: 关闭旧 `dataScopeTemplate` 执行 finding。
- `DOWNLOAD-SIGNED-URL-GUARD-001`: 关闭旧签名 URL finding。
- `QUERY-PARAMS-SIZE-LIMIT-001`: 关闭旧 32KB 参数限制 finding。
- `P0-ACCEPTANCE-EVIDENCE-REPAIR-001`: 关闭旧历史查询、registry、未注册任务和游标负向证据 finding。

## FR Coverage Matrix

| FR ID | Status | Evidence / Notes |
| --- | --- | --- |
| FR-001 | partially_covered | 创建、幂等、注册启用、32KB 限制已有证据；但创建入口未按 registry `supportedFormats` / `parameterSchema` 拦截，且 `AC-001` 1 秒 SLA 缺少显式耗时证据。 |
| FR-002 | covered | 任务详情进度、失败字段和 `recentEvents` 已由 `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001` 关闭。 |
| FR-003 | covered | 签名 URL、stream 元信息、文件元数据、发布前校验和下载 guard 已覆盖；边界限定为 local / Docker / mock。 |
| FR-004 | partially_covered | 历史筛选和权限有证据；分页 `total` 当前等于当前页数量，不是真实符合筛选条件总量。 |
| FR-005 | covered | MySQL 轮询、DB 抢锁、并发限制、续租和接管有 worker / DB evidence。 |
| FR-006 | covered | 空数据、分片、ZIP、阶段事件、渲染失败和文件发布前校验有证据。 |
| FR-007 | partially_covered | registry API 主路径有证据；但持久化前未强校验 OpenAPI 必填配置，缺失配置可被默认成空数组、空字符串或 null。 |
| FR-008 | partially_covered | 执行层模板、字段、脱敏、dataScopeTemplate 有证据；但 registry 前置治理、create 入队前 schema/format guard、datasource adapter 边界仍缺。 |
| FR-009 | covered | 认证可信证明、权限、可见性、数据范围、脱敏和下载 guard 在受控边界内已覆盖。 |
| FR-010 | partially_covered | 审计枚举、事件和失败链路有证据；公开错误响应和任务详情仍可能透出底层 message。 |
| FR-011 | partially_covered | cleanup 行为有证据；但 registry 默认 `fileRetentionDays` 为 7，与产品默认 15 天不一致。 |
| FR-012 | partially_covered | 取消/重试主路径有证据；取消更新缺少基于原状态、attemptNo 或租约的原子条件。 |
| FR-013 | covered | 幂等、attemptNo、配置快照、锁租约和接管已覆盖。 |
| FR-014 | partially_covered | 样板边界数据和压测有证据；但通用 query executor 导入样板专属断言，架构上仍有平台通用合同与样板特例耦合风险。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | partially_covered | 创建成功、PENDING、幂等、注册校验和 32KB 限制已闭合；缺少 1 秒 SLA 证据，且 create 入队前未校验 registry schema/format。 |
| AC-002 | covered | 详情响应字段和失败态进度字段已闭合。 |
| AC-003 | covered | 签名 URL / stream 元信息、文件元数据和下载 guard 已闭合。 |
| AC-004 | partially_covered | 正式筛选维度和权限隔离有证据；分页 `total` 不是真实总数。 |
| AC-005 | covered | 同子系统并发上限、DB 抢锁和多实例互斥已闭合。 |
| AC-006 | covered | 超阈值分片 ZIP、空数据仅表头和阶段事件已闭合。 |
| AC-007 | partially_covered | registry CRUD/启停/唯一性有证据；必填注册配置落库前校验不足。 |
| AC-008 | partially_covered | 集中查询执行边界有证据；registry 前置治理、数据源 adapter、create 入队前 schema/format guard 未闭合。 |
| AC-009 | covered | 权限、数据范围、脱敏和下载 guard 已闭合。 |
| AC-010 | partially_covered | 审计字段和动作有证据；公开错误文本脱敏边界未闭合。 |
| AC-011 | partially_covered | 过期文件先失效再删除有证据；默认保留期与产品真相源不一致。 |
| AC-012 | partially_covered | PENDING 取消、FAILED 重试、EXECUTING 批次边界收口有证据；取消状态更新缺少 CAS/原子条件。 |
| AC-013 | covered | 同一 `taskId` 串联幂等、执行尝试、锁租约和配置快照已闭合。 |
| AC-014 | covered | 同幂等范围同摘要返回原任务，摘要冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-015 | covered | worker 抢锁、`attemptNo`、`lockOwner`、`lockExpireAt` 和续租字段已闭合。 |
| AC-016 | covered | 注册配置变更只影响新任务，旧任务和失败重试沿用原快照。 |
| AC-017 | partially_covered | 采购订单样板注册合同有证据；样板专属断言耦合进通用 query executor。 |
| AC-018 | covered | 采购订单样板边界数据和 10 万行压测证据已闭合。 |
| AC-019 | partially_covered | 查询上下文串联有证据；`datasourceCode` 未映射到独立只读 datasource adapter。 |
| AC-020 | partially_covered | 阶段事件有证据；默认批次重试次数实现为 2，与产品默认 3 不一致。 |
| AC-021 | covered | temp object 到 published object、checksum 校验和发布失败阻断下载已闭合。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件并完成。 |
| AC-E002 | covered | 未注册 `taskCode` 创建失败且不落无效任务。 |
| AC-E003 | covered | 禁用任务返回 `TASK_DISABLED`。 |
| AC-E004 | partially_covered | 短暂失败重试证据存在；默认重试次数实现与产品默认不一致。 |
| AC-E005 | covered | object storage put/read/publish 失败映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | covered | 权限不足返回 403，不泄露任务 / 文件详情。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁只有一个实例成功执行。 |
| AC-E009 | covered | `queryParams` 32KB 限制已在创建路径实施。 |
| AC-E010 | covered | 超大导出由 query/file/sample 路径拒绝或失败。 |
| AC-E011 | partially_covered | 执行层拒绝非法模板；registry 持久化前治理不足。 |
| AC-E012 | partially_covered | datasource 错误映射有证据；但业务 datasource adapter 边界和公开错误脱敏未闭合。 |
| AC-E013 | partially_covered | 查询失败重试和最终错误码有证据；公开错误 message 脱敏未闭合。 |
| AC-E014 | partially_covered | 执行层字段映射错误可收口；registry 前置配置校验不足。 |
| AC-E015 | partially_covered | 非法重试请求有证据；取消接口缺少原子状态条件。 |
| AC-E016 | covered | 缺少最小字段或认证失败返回权限 / 参数错误并记录 `requestId`。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期后接管延续当前 `attemptNo` 并从 checkpoint 继续。 |
| AC-E020 | partially_covered | retry 耗尽失败有证据；默认 retry 次数与产品默认不一致。 |
| AC-E021 | partially_covered | 超量在执行/样板路径有证据；创建入口未基于 registry schema/format 做足够前置 guard。 |
| AC-E022 | covered | 采购订单敏感字段未脱敏时失败为 `MASKING_RULE_ERROR`。 |
| AC-E023 | covered | 游标缺失、重复或非递增时任务失败并收口为 `QUERY_EXECUTION_ERROR`。 |
| AC-E024 | partially_covered | 快照沿用有证据；registry/create 前置合同校验不足会让不完整快照进入任务。 |
| AC-E025 | covered | 批次字段、顺序或脱敏校验失败会停止写入并收口错误码。 |
| AC-E026 | covered | 发布前校验失败不生成下载地址，错误码为 `FILE_VERIFY_ERROR`。 |
| AC-E027 | covered | XLSX/ZIP renderer 失败收口为 `EXPORT_RENDER_ERROR`，记录摘要和失败原因。 |

## Findings

- `REGISTRY-CONTRACT-VALIDATION-001`
  - Severity: P0
  - Requirement IDs: `FR-007`, `FR-008`, `AC-007`, `AC-008`, `AC-E011`, `AC-E014`, `AC-E024`
  - Evidence: `contracts/openapi.yaml` declares registry config fields as required; `src/registry-config/service.ts` only checks `taskCode/subsystemCode/displayName/datasourceCode` and defaults missing config to empty values.
  - Risk: Incomplete registry configs can be persisted and enabled, then fail later in worker/query instead of being rejected before execution.
  - Suggested next task id: `REGISTRY-CONTRACT-VALIDATION-001`

- `CREATE-TASK-REGISTRY-GUARD-001`
  - Severity: P0
  - Requirement IDs: `FR-001`, `FR-008`, `FR-014`, `AC-001`, `AC-008`, `AC-017`, `AC-E021`
  - Evidence: `src/task-api/service.ts` validates required task fields and `queryParams` size, then creates `PENDING`; it does not verify `fileFormat` against registry `supportedFormats` or `queryParams` against registry `parameterSchema` before enqueue.
  - Risk: Invalid tasks can enter the queue and produce false-positive creation success.
  - Suggested next task id: `CREATE-TASK-REGISTRY-GUARD-001`

- `DATASOURCE-ADAPTER-BOUNDARY-001`
  - Severity: P0
  - Requirement IDs: `FR-008`, `FR-009`, `AC-008`, `AC-019`, `AC-E012`
  - Evidence: `src/query-executor/index.ts` records registry `datasourceCode` but executes raw query through `context.db`, the platform DB connection.
  - Risk: The system cannot prove business readonly datasource isolation, datasource credential failure mapping, or platform/business data boundary.
  - Suggested next task id: `DATASOURCE-ADAPTER-BOUNDARY-001`

- `CREATE-TASK-LATENCY-EVIDENCE-001`
  - Severity: P1
  - Requirement IDs: `FR-001`, `AC-001`
  - Evidence: `docs/product/acceptance-criteria.md` and `docs/testing/ACCEPTANCE_EXAMPLES.md` require 1-second task creation; `tests/api/export-http-api.test.mjs` and `docs/testing/verify-matrix.md` do not record a stable latency assertion or release gate sample.
  - Risk: Future synchronous work or slow queries in creation path may violate SLA without regression signal.
  - Suggested next task id: `CREATE-TASK-LATENCY-EVIDENCE-001`

- `HISTORY-PAGINATION-TOTAL-001`
  - Severity: P1
  - Requirement IDs: `FR-004`, `AC-004`
  - Evidence: `src/task-api/service.ts` returns `total: tasks.length`; `src/repositories/export-task.repository.ts` only performs the paged `limit/offset` query.
  - Risk: Clients cannot know the real filtered total and may mis-handle multi-page history.
  - Suggested next task id: `HISTORY-PAGINATION-TOTAL-001`

- `TASK-CANCEL-ATOMICITY-001`
  - Severity: P1
  - Requirement IDs: `FR-012`, `AC-012`, `AC-E015`
  - Evidence: `src/task-api/service.ts` reads task then calls `updateTaskStatus`; `src/repositories/export-task.repository.ts` updates by `task_id` only.
  - Risk: A worker status transition between read and update can be overwritten by cancel, corrupting state and audit consistency.
  - Suggested next task id: `TASK-CANCEL-ATOMICITY-001`

- `DEFAULTS-ALIGNMENT-001`
  - Severity: P1
  - Requirement IDs: `FR-011`, `AC-011`, `AC-E004`, `AC-E020`
  - Evidence: `docs/product/state-matrix.yaml` sets default query batch retries to 3 and file retention to 15 days; `src/scheduler/worker.ts` defaults retries to 2 and `src/registry-config/service.ts` defaults file retention to 7.
  - Risk: Runtime defaults drift from product defaults, causing premature failures or early expiration.
  - Suggested next task id: `DEFAULTS-ALIGNMENT-001`

- `SAMPLE-CONTRACT-GENERIC-VALIDATION-001`
  - Severity: P1
  - Requirement IDs: `FR-014`, `AC-017`, `AC-018`
  - Evidence: `docs/architecture/constraints.md` forbids platform special-case sample implementation; `src/query-executor/index.ts` imports `assertSamplePurchaseOrderRegistryContract`, which only applies to `purchase-order-export/purchase`.
  - Risk: The sample proves a special-case assertion path, not a generic registry/query contract that future subsystems inherit.
  - Suggested next task id: `SAMPLE-CONTRACT-GENERIC-VALIDATION-001`

- `QUERY-TEMPLATE-HARDENING-001`
  - Severity: P1
  - Requirement IDs: `FR-008`, `AC-008`, `AC-E011`
  - Evidence: `src/registry-config/service.ts`, `src/query-executor/index.ts`, `docs/testing/verify-matrix.md`
  - Risk: datasource/table/function governance is still mostly execution-time, not registry-time.
  - Suggested next task id: `QUERY-TEMPLATE-HARDENING-001`

- `PUBLIC-ERROR-REDACTION-001`
  - Severity: P1
  - Requirement IDs: `FR-010`, `AC-010`, `AC-E012`, `AC-E013`
  - Evidence: `src/routes/respond.ts`, `src/query-executor/index.ts`, `src/task-api/service.ts`, `src/file-service/index.ts`
  - Risk: Public responses and task failure details may expose internal datasource, SQL or object-storage messages.
  - Suggested next task id: `PUBLIC-ERROR-REDACTION-001`

## Closed Findings

| Finding / Task | Status | Fresh evidence |
| --- | --- | --- |
| `RCR-001` / `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001` | closed | `tests/api/export-http-api.test.mjs`, `tests/contract/openapi-route-mapping.contract.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-002` / `FILE-RENDER-ERROR-CONTRACT-REPAIR-001` | closed | `tests/file/export-file-service.test.mjs`, `docs/testing/verify-matrix.md` |
| `CLEANUP-AUDIT-ERROR-CODE-ALIGN-001` | closed | `contracts/openapi.yaml`, `tests/worker/scheduler-worker.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-P0-001` / `AUTH-CONTEXT-TRUST-BOUNDARY-001` | closed | `src/audit-log/auth-context.ts`, `tests/api/export-http-api.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-P0-002` / `DATA-SCOPE-TEMPLATE-ENFORCE-001` | closed | `src/query-executor/index.ts`, `tests/query/query-executor.test.mjs`, `tests/worker/scheduler-worker.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-P0-003` / `DOWNLOAD-SIGNED-URL-GUARD-001` | closed | `src/file-service/index.ts`, `tests/file/export-file-service.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-P0-004` / `QUERY-PARAMS-SIZE-LIMIT-001` | closed | `src/task-api/service.ts`, `tests/api/export-http-api.test.mjs`, `tests/contract/openapi-route-mapping.contract.test.mjs`, `docs/testing/verify-matrix.md` |
| `RCR-P0-005` / `P0-ACCEPTANCE-EVIDENCE-REPAIR-001` | closed | `tests/api/export-http-api.test.mjs`, `tests/query/query-executor.test.mjs`, `docs/testing/verify-matrix.md` |

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate，依赖本机 Docker MySQL + 本地 object storage mock。
- `docs/testing/verify-matrix.md` 中的 repaired evidence 可用于证明对应旧 finding 已关闭，但不能覆盖本 review 新发现的 P0/P1 gaps。
- `npm run test:file` 中的 env-backed local HTTP adapter 只证明生产等价协议链路，不等于外部 live OSS/S3。
- 外部生产 MySQL、外部业务只读库和 live OSS/S3 不属于当前 release gate；后续如要声明 live evidence，必须另开专项验证任务。

## Architecture Constraints

- `truth_source=docs/product/* + docs/architecture/constraints.md`: PASS
- `review_only_no_business_fix`: PASS
- `mock/local/docker/live evidence separated`: PASS
- `forbidden_implementations`: PASS - current implementation still has production-boundary gaps around registry validation, create guard, datasource adapter and sample coupling; this review records them as follow-up findings instead of marking them complete.

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `PITFALL-REVIEW-002`: pitfall - repaired findings 关闭后仍需重新 review 新生产边界缺口 - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-002.md`

## Remaining Risks

- 三个 P0 gap 需要优先拆分修复：`REGISTRY-CONTRACT-VALIDATION-001`、`CREATE-TASK-REGISTRY-GUARD-001`、`DATASOURCE-ADAPTER-BOUNDARY-001`。
- P1 gaps 仍需后续处理：`CREATE-TASK-LATENCY-EVIDENCE-001`、`HISTORY-PAGINATION-TOTAL-001`、`TASK-CANCEL-ATOMICITY-001`、`DEFAULTS-ALIGNMENT-001`、`SAMPLE-CONTRACT-GENERIC-VALIDATION-001`、`QUERY-TEMPLATE-HARDENING-001`、`PUBLIC-ERROR-REDACTION-001`。
- 当前 review 不修改业务实现；测试通过只能证明 review 产物和 mock-local 守护有效，不能把上述 gaps 标记为完成。
