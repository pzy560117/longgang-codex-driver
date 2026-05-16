# Requirements Complete Review: REQUIREMENTS-COMPLETE-REVIEW-001

Verdict: PASS_WITH_GAPS

## Truth Source

- `docs/product/prd-lite.md`
- `docs/product/page-inventory.md`
- `docs/product/difficulty-research.md`
- `docs/product/acceptance-criteria.md`
- `docs/product/requirement-interface-matrix.md`
- `docs/product/state-matrix.yaml`
- `docs/architecture/constraints.md`

## Evidence Source

- `contracts/openapi.yaml`
- `src/`
- `tests/`
- `docs/testing/ACCEPTANCE_CRITERIA.md`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/TEST_DATA_MATRIX.md`
- `docs/testing/test-matrix.md`
- `docs/testing/verify-matrix.md`
- `task.json`

## Summary

本轮 review 以完整 `docs/product/*` 真相源、Architecture Constraints Packet 和 testing analysis outputs 为判定基线，重新对照当前 OpenAPI、生产入口、repository、worker、query executor、file service、sample、测试和 evidence 文档。`REGISTRY-CONTRACT-VALIDATION-001`、`CREATE-TASK-REGISTRY-GUARD-001`、`DATASOURCE-ADAPTER-BOUNDARY-001` 已作为本任务依赖修复并进入 fresh evidence，因此不再列为当前 P0 gap。

当前结论为 `PASS_WITH_GAPS`：FR-001 至 FR-014、AC-001 至 AC-021、AC-E001 至 AC-E027 均已逐项判定，但仍存在 P1 级别的证据、状态原子性、默认值、通用合同和公开错误脱敏缺口。本 review 只输出缺口和建议后续 task id，不修改业务实现，也不把未修复缺口伪装成完成。

当前 release evidence 边界仍限定为本机 / Docker MySQL + 本地 object storage mock / contract / local-dev evidence。本 review 不声明外部生产 MySQL、外部业务只读数据源或 live OSS/S3 已验证，也不把 docker/mock evidence 升级为 live evidence。

## Fresh Evidence Used

- `REGISTRY-CONTRACT-VALIDATION-001`: registry 必填配置、字段映射和脱敏策略落库前校验已修复。
- `CREATE-TASK-REGISTRY-GUARD-001`: 创建任务入队前按 registry `supportedFormats` 与 `parameterSchema` 拦截已修复。
- `DATASOURCE-ADAPTER-BOUNDARY-001`: query executor 已按 `datasourceCode` 解析独立 readonly datasource adapter。
- `AUTH-CONTEXT-TRUST-BOUNDARY-001`: 认证上下文可信 ingress 证明、freshness 和权限隔离已修复。
- `DATA-SCOPE-TEMPLATE-ENFORCE-001`: registry `dataScopeTemplate` 与认证上下文数据范围执行已修复。
- `DOWNLOAD-SIGNED-URL-GUARD-001`: 签名 URL、过期签名、伪造签名和 stream checksum guard 已修复。
- `QUERY-PARAMS-SIZE-LIMIT-001`: `queryParams` 32768 bytes 边界已在创建路径实施。
- `P0-ACCEPTANCE-EVIDENCE-REPAIR-001`: 未注册任务、历史查询、registry API、游标负向证据已补齐。

## FR Coverage Matrix

| FR ID | Status | Evidence / Notes |
| --- | --- | --- |
| FR-001 | partially_covered | 创建、注册启用、幂等、32KB 限制、registry format/schema guard 已有 API / contract evidence；`AC-001` 的 1 秒响应 SLA 缺少稳定耗时断言或 release gate 样本。 |
| FR-002 | covered | 任务详情返回状态、总数、已处理数、进度、错误信息和 `recentEvents`，并由 API / contract 测试守护。 |
| FR-003 | covered | 签名 URL、stream 元信息、文件元数据、发布前校验、下载权限和过期 guard 已覆盖；证据边界为 local / Docker / mock。 |
| FR-004 | partially_covered | 正式筛选维度和用户 / 管理员权限隔离有证据；历史分页响应 `total` 当前等于当前页数量，不是真实符合筛选条件总量。 |
| FR-005 | covered | MySQL 轮询、DB 抢锁、同子系统并发限制、续租和接管有 worker / DB evidence。 |
| FR-006 | covered | 空数据仅表头、分片、ZIP、阶段事件、渲染失败和文件发布前校验有 query / file / worker evidence。 |
| FR-007 | covered | registry 创建、更新、查询、启停、唯一性、必填配置、并发、保留期、阈值和格式策略已有 API / DB / contract evidence。 |
| FR-008 | partially_covered | 数据源 adapter、参数 schema、字段映射、脱敏、dataScopeTemplate、快照冲突和执行错误收口已有证据；registry-time query template 语义治理仍主要发生在执行前校验阶段。 |
| FR-009 | covered | 认证可信证明、任务可见性、操作权限、下载权限、数据范围、脱敏和签名 guard 在受控边界内已覆盖。 |
| FR-010 | partially_covered | 审计字段、动作枚举、事件链路和失败收口有证据；公开响应和任务失败文本仍可能透出内部错误消息。 |
| FR-011 | covered | cleanup job 先标记不可下载再删除对象，失败保留可重试记录；file service 默认保留期 fallback 为 15 天，具体 registry 可收紧。 |
| FR-012 | partially_covered | PENDING 取消、FAILED 重试、EXECUTING 批次边界收口有证据；取消 API 状态更新缺少基于原状态 / attemptNo 的 CAS 原子条件。 |
| FR-013 | covered | 幂等、执行尝试、配置快照、DB 锁租约、续租、接管和 FAILED 重试 attemptNo 递增已覆盖。 |
| FR-014 | partially_covered | 采购订单样板注册、边界数据、脱敏、XLSX/ZIP、10 万行压测和下载证据已覆盖；通用 query executor 仍导入样板专属断言，存在通用平台合同与样板特例耦合风险。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | partially_covered | 创建成功、PENDING、幂等、注册校验、32KB 限制和 registry guard 已闭合；缺少 1 秒 SLA 的自动化证据。 |
| AC-002 | covered | 详情响应字段、进度字段、失败字段和 `recentEvents` 已闭合。 |
| AC-003 | covered | 签名 URL / stream 元信息、文件元数据、checksum、`storageKey`、`attemptNo` 和下载 guard 已闭合。 |
| AC-004 | partially_covered | 筛选维度和权限隔离有证据；分页 `total` 不是真实总数。 |
| AC-005 | covered | 同子系统并发上限、DB 抢锁和多实例互斥已闭合。 |
| AC-006 | covered | 超阈值分片 ZIP、空数据仅表头和阶段事件已闭合。 |
| AC-007 | covered | registry CRUD、启停、唯一性、保留期、阈值、并发上限和支持格式策略已闭合。 |
| AC-008 | partially_covered | 集中查询执行边界、registry required 配置、create guard 和 datasource adapter 已有证据；registry-time query template 语义治理仍需加严。 |
| AC-009 | covered | 权限、数据范围、脱敏和下载 guard 已闭合。 |
| AC-010 | partially_covered | 审计字段和动作有证据；公开错误文本脱敏边界未闭合。 |
| AC-011 | covered | 过期文件先失效再删除、下载失效结果和清理失败重试记录已闭合。 |
| AC-012 | partially_covered | PENDING 取消、FAILED 重试、EXECUTING 批次边界收口有证据；取消状态更新缺少 CAS / 原子条件。 |
| AC-013 | covered | 同一 `taskId` 串联幂等、执行尝试、锁租约和配置快照已闭合。 |
| AC-014 | covered | 同幂等范围同摘要返回原任务，摘要冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-015 | covered | worker 抢锁、`attemptNo`、`lockOwner`、`lockExpireAt`、5 分钟租约和续租字段已闭合。 |
| AC-016 | covered | 注册配置变更只影响新任务，旧任务和失败重试沿用原快照。 |
| AC-017 | partially_covered | 采购订单样板注册合同有证据；样板专属断言耦合进通用 query executor。 |
| AC-018 | covered | 采购订单样板 `0/1/20000/20001/100000/100001` 行边界和压测证据已闭合。 |
| AC-019 | covered | 查询执行请求可串联任务快照、尝试上下文、模板版本、数据源编码和批次检查点。 |
| AC-020 | partially_covered | 阶段事件有证据；scheduler 默认批次重试次数为 2，与产品默认 3 不一致。 |
| AC-021 | covered | temp object 到 published object、checksum 校验和发布失败阻断下载已闭合。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件并完成。 |
| AC-E002 | covered | 未注册 `taskCode` 创建失败且不落无效任务。 |
| AC-E003 | covered | 禁用任务返回 `TASK_DISABLED`。 |
| AC-E004 | partially_covered | 短暂失败重试证据存在；scheduler 默认重试次数与产品默认不一致。 |
| AC-E005 | covered | object storage put/read/publish 失败映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | covered | 权限不足返回 403，不泄露任务 / 文件详情。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁只有一个实例成功执行。 |
| AC-E009 | covered | `queryParams` 32KB 限制已在创建路径实施。 |
| AC-E010 | covered | 超大导出由 create / query / sample 路径拒绝或失败并记录审计。 |
| AC-E011 | partially_covered | 执行前拒绝非法模板；registry-time 模板语义治理仍需加严。 |
| AC-E012 | partially_covered | datasource adapter 错误映射为 `DATASOURCE_UNAVAILABLE` 有证据；公开错误文本脱敏边界未闭合。 |
| AC-E013 | partially_covered | 查询失败重试和最终错误码有证据；公开错误 message 脱敏未闭合。 |
| AC-E014 | covered | 字段映射错误和 registry-time 字段映射配置缺失均可收口。 |
| AC-E015 | partially_covered | 非法重试请求有证据；取消接口缺少原子状态条件。 |
| AC-E016 | covered | 缺少最小字段或认证失败返回权限 / 参数错误并记录 `requestId`。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期后接管延续当前 `attemptNo` 并从 checkpoint 继续。 |
| AC-E020 | partially_covered | retry 耗尽失败有证据；默认 retry 次数与产品默认不一致。 |
| AC-E021 | covered | 100001 行或超过 registry 最大导出量时拒绝或失败并保留审计 / 证据。 |
| AC-E022 | covered | 采购订单敏感字段未脱敏时失败为 `MASKING_RULE_ERROR`。 |
| AC-E023 | covered | 游标缺失、重复或非递增时任务失败并收口为 `QUERY_EXECUTION_ERROR`。 |
| AC-E024 | covered | 快照沿用和模板 / 字段映射冲突错误收口有证据。 |
| AC-E025 | covered | 批次字段、顺序或脱敏校验失败会停止写入并收口错误码。 |
| AC-E026 | covered | 发布前校验失败不生成下载地址，错误码为 `FILE_VERIFY_ERROR`。 |
| AC-E027 | covered | XLSX/ZIP renderer 失败收口为 `EXPORT_RENDER_ERROR`，记录摘要和失败原因。 |

## Findings

- `CREATE-TASK-LATENCY-EVIDENCE-001`
  - Severity: P1
  - Requirement IDs: `FR-001`, `AC-001`
  - Evidence: `docs/product/acceptance-criteria.md`, `docs/testing/ACCEPTANCE_EXAMPLES.md`, `tests/api/export-http-api.test.mjs`, `docs/testing/verify-matrix.md`
  - Risk: 产品要求创建任务 1 秒内返回，但缺少稳定耗时断言或 release gate 样本，后续若创建路径引入同步查询或慢 I/O，回归可能无法被及时发现。
  - Suggested next task id: `CREATE-TASK-LATENCY-EVIDENCE-001`

- `HISTORY-PAGINATION-TOTAL-001`
  - Severity: P1
  - Requirement IDs: `FR-004`, `AC-004`
  - Evidence: `src/task-api/service.ts`, `src/repositories/export-task.repository.ts`, `tests/api/export-http-api.test.mjs`
  - Risk: 历史任务响应 `total` 当前使用当前页 `tasks.length`，不是筛选条件下真实总量；客户端无法可靠判断总页数和翻页结束。
  - Suggested next task id: `HISTORY-PAGINATION-TOTAL-001`

- `TASK-CANCEL-ATOMICITY-001`
  - Severity: P1
  - Requirement IDs: `FR-012`, `AC-012`, `AC-E015`
  - Evidence: `src/task-api/service.ts`, `src/repositories/export-task.repository.ts`, `tests/api/export-http-api.test.mjs`
  - Risk: 取消接口先读任务再按 `task_id` 更新状态，缺少原状态 / `attemptNo` CAS 条件；worker 在读写之间推进状态时，取消可能覆盖真实状态并污染审计链。
  - Suggested next task id: `TASK-CANCEL-ATOMICITY-001`

- `DEFAULT-QUERY-RETRY-ALIGNMENT-001`
  - Severity: P1
  - Requirement IDs: `FR-006`, `FR-010`, `AC-020`, `AC-E004`, `AC-E020`
  - Evidence: `docs/product/state-matrix.yaml`, `src/scheduler/worker.ts`, `tests/worker/scheduler-worker.test.mjs`
  - Risk: 产品默认 `query_batch_max_retries=3`，scheduler 默认 `maxQueryBatchRetries=2`；短暂数据源或查询失败可能比产品预期更早进入 FAILED。
  - Suggested next task id: `DEFAULT-QUERY-RETRY-ALIGNMENT-001`

- `SAMPLE-CONTRACT-GENERIC-VALIDATION-001`
  - Severity: P1
  - Requirement IDs: `FR-014`, `AC-017`, `AC-018`
  - Evidence: `docs/architecture/constraints.md`, `src/query-executor/index.ts`, `src/sample-purchase-order/index.ts`, `tests/sample/purchase-order-sample.test.mjs`
  - Risk: 通用 query executor 直接导入采购订单样板专属断言；样板能证明一期合同，但平台通用 registry/query 合同与样板特例仍有耦合风险。
  - Suggested next task id: `SAMPLE-CONTRACT-GENERIC-VALIDATION-001`

- `QUERY-TEMPLATE-HARDENING-001`
  - Severity: P1
  - Requirement IDs: `FR-008`, `AC-008`, `AC-E011`
  - Evidence: `src/registry-config/contract.ts`, `src/query-executor/index.ts`, `tests/query/query-executor.test.mjs`
  - Risk: registry-time 只校验 query template 结构字段，SELECT / unsafe keyword / placeholder 声明等语义校验主要在执行前发生；非法模板仍可能注册启用并延迟到任务执行失败。
  - Suggested next task id: `QUERY-TEMPLATE-HARDENING-001`

- `PUBLIC-ERROR-REDACTION-001`
  - Severity: P1
  - Requirement IDs: `FR-010`, `AC-010`, `AC-E012`, `AC-E013`
  - Evidence: `src/routes/respond.ts`, `src/query-executor/index.ts`, `src/task-api/service.ts`, `src/file-service/index.ts`
  - Risk: `sendError` 对 `ApiError` 和未捕获 `Error` 直接返回 `message`；公开响应和任务失败详情可能泄露 datasource、SQL、object-storage 或内部实现消息。
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
| `REGISTRY-CONTRACT-VALIDATION-001` | closed | `src/registry-config/contract.ts`, `tests/api/export-http-api.test.mjs`, `tests/contract/openapi-route-mapping.contract.test.mjs`, `docs/testing/verify-matrix.md` |
| `CREATE-TASK-REGISTRY-GUARD-001` | closed | `src/task-api/service.ts`, `tests/api/export-http-api.test.mjs`, `tests/contract/openapi-route-mapping.contract.test.mjs`, `docs/testing/verify-matrix.md` |
| `DATASOURCE-ADAPTER-BOUNDARY-001` | closed | `src/datasource-adapters/index.ts`, `src/query-executor/index.ts`, `src/scheduler/worker.ts`, `tests/query/query-executor.test.mjs`, `tests/worker/scheduler-worker.test.mjs`, `docs/testing/verify-matrix.md` |

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate，依赖本机 Docker MySQL + 本地 object storage mock。
- `docs/testing/verify-matrix.md` 中的 repaired evidence 可用于证明对应旧 finding 已关闭，但不能覆盖本 review 新发现的 P1 gaps。
- `npm run test:file` 中的 env-backed local HTTP adapter 只证明生产等价协议链路，不等于外部 live OSS/S3。
- `tests/query` 和 `tests/worker` 中的 readonly datasource adapter 使用受控本机 / Docker MySQL 业务表模拟，不等于外部业务只读库 live evidence。
- 外部生产 MySQL、外部业务只读库和 live OSS/S3 不属于当前 release gate；后续如要声明 live evidence，必须另开专项验证任务。

## Architecture Constraints

- `truth_source=docs/product/* + docs/architecture/constraints.md`: PASS - review truth source 已列出并用于 FR / AC / AC-E 判定。
- `review_only_no_business_fix`: PASS - 本轮只更新 review artifacts 和 mock-local consistency test，不改业务实现。
- `mock/local/docker/live evidence separated`: PASS - evidence boundary 明确不声明 external production MySQL、external business datasource live access 或 live OSS/S3。
- `forbidden_implementations`: PASS - 已修复的 P0 生产边界不再误列为 gap；当前 P1 gaps 被记录为后续任务建议，没有伪装成完成。

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `PITFALL-REVIEW-002`: pitfall - repaired findings 关闭后仍需重新 review 新生产边界缺口 - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-002.md`

## Remaining Risks

- P1 gaps 仍需后续处理：`CREATE-TASK-LATENCY-EVIDENCE-001`、`HISTORY-PAGINATION-TOTAL-001`、`TASK-CANCEL-ATOMICITY-001`、`DEFAULT-QUERY-RETRY-ALIGNMENT-001`、`SAMPLE-CONTRACT-GENERIC-VALIDATION-001`、`QUERY-TEMPLATE-HARDENING-001`、`PUBLIC-ERROR-REDACTION-001`。
- 当前 review 不修改业务实现；测试通过只能证明 review 产物和 mock-local 守护有效，不能把上述 gaps 标记为完成。
