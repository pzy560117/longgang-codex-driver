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
- `src/audit-log/auth-context.ts`
- `src/task-api/service.ts`
- `src/query-executor/index.ts`
- `src/file-service/index.ts`
- `src/registry-config/service.ts`
- `tests/api/export-http-api.test.mjs`
- `tests/query/query-executor.test.mjs`
- `tests/file/export-file-service.test.mjs`
- `tests/contract/openapi-route-mapping.contract.test.mjs`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/verify-matrix.md`

## Summary

本轮复审以产品真相源和架构约束为判定基线，结合 `docs/testing/verify-matrix.md` 中已 repaired 的 fresh evidence 重新评估 `REQUIREMENTS-COMPLETE-REVIEW-001`。结论更新为 `PASS_WITH_GAPS`，不是 `FAIL`。

FR-001 至 FR-014、AC-001 至 AC-021、AC-E001 至 AC-E027 在本机 / Docker MySQL + 本地 object storage mock / contract / local-dev evidence 边界内均可判定为 `covered`。这里的 `covered` 只代表在受控边界内证据已经闭合，不等于外部生产 MySQL、外部业务只读数据源或 live OSS/S3 已验证。

当前仍保留两个 P1 gap：

- `QUERY-TEMPLATE-HARDENING-001`：注册持久化前 datasource/table/function 治理仍偏弱，尤其 `src/registry-config/service.ts` 和 `src/query-executor/index.ts` 之间的治理链路仍以执行层校验为主。
- `PUBLIC-ERROR-REDACTION-001`：公开错误响应和失败详情仍可能透出底层 message，尤其 `src/task-api/service.ts`、`src/query-executor/index.ts`、`src/file-service/index.ts` 和 `src/routes/respond.ts` 的错误传播与 fallback 路径需要继续收紧。

证据边界保持严格分层：`RELEASE-001` 是本机 Docker MySQL + 本地 object storage mock 的受控 release gate；本 review 不声明外部生产 MySQL、外部业务数据源或 live OSS/S3 已验证。docker/mock 和 mock/local 证据可以证明当前 release boundary 内的完成度，但不能自动升级为 live evidence。

## Fresh Evidence

以下 5 个 repaired 项是本轮结论更新的直接依据：

- `AUTH-CONTEXT-TRUST-BOUNDARY-001`：`src/audit-log/auth-context.ts`、`tests/api/export-http-api.test.mjs`、`docs/testing/verify-matrix.md`
- `DATA-SCOPE-TEMPLATE-ENFORCE-001`：`src/query-executor/index.ts`、`tests/query/query-executor.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`docs/testing/verify-matrix.md`
- `DOWNLOAD-SIGNED-URL-GUARD-001`：`src/file-service/index.ts`、`tests/file/export-file-service.test.mjs`、`docs/testing/verify-matrix.md`
- `QUERY-PARAMS-SIZE-LIMIT-001`：`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs`、`tests/contract/openapi-route-mapping.contract.test.mjs`、`docs/testing/verify-matrix.md`
- `P0-ACCEPTANCE-EVIDENCE-REPAIR-001`：`tests/api/export-http-api.test.mjs`、`tests/query/query-executor.test.mjs`、`docs/testing/verify-matrix.md`

## FR Coverage Matrix

| FR ID | Status | Evidence / Notes |
| --- | --- | --- |
| FR-001 | covered | 创建任务、幂等、注册校验和 32KB 参数限制已由 API / contract / repair evidence 闭合；见 `docs/testing/verify-matrix.md` 中 `QUERY-PARAMS-SIZE-LIMIT-001`、`P0-ACCEPTANCE-EVIDENCE-REPAIR-001`。 |
| FR-002 | covered | 任务详情进度、失败字段和 `recentEvents` 已由 `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001` 闭合。 |
| FR-003 | covered | 签名 URL、stream 元信息、文件元数据、发布前校验和下载 guard 已由 `DOWNLOAD-SIGNED-URL-GUARD-001` 和 file service evidence 闭合。 |
| FR-004 | covered | 历史查询正式筛选维度、权限隔离和管理员 scope 已由 `P0-ACCEPTANCE-EVIDENCE-REPAIR-001` 闭合。 |
| FR-005 | covered | MySQL 轮询、DB 抢锁、并发限制、续租和接管由 worker / DB evidence 闭合。 |
| FR-006 | covered | 空数据、分片、ZIP、阶段事件、渲染失败和文件发布前校验均有对应证据。 |
| FR-007 | covered | registry 创建、更新、查询、启停、唯一性和权限边界已由 `P0-ACCEPTANCE-EVIDENCE-REPAIR-001` 闭合。 |
| FR-008 | covered | 查询模板、字段映射、脱敏、dataScopeTemplate 执行和非法模板 / datasource / query error 路径均有证据；治理仍有 P1 gap，但不影响本轮 covered 判定。 |
| FR-009 | covered | 权限、可见性、数据范围、脱敏和下载 guard 在受控边界内已覆盖；认证信任边界由 `AUTH-CONTEXT-TRUST-BOUNDARY-001` 闭合。 |
| FR-010 | covered | 审计枚举、任务事件和失败链路已由 contract / api / worker / verify evidence 闭合。 |
| FR-011 | covered | cleanup 先失效再删除、删除失败保留可重试记录已覆盖。 |
| FR-012 | covered | 取消、重试、非法状态和批次边界收口已覆盖。 |
| FR-013 | covered | 幂等、attemptNo、配置快照、锁租约和接管已覆盖。 |
| FR-014 | covered | 采购订单样板注册、字段、脱敏、边界数据和 10 万行证据已覆盖。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | covered | 创建成功、PENDING 和 `queryParams` 32KB 限制已闭合。 |
| AC-002 | covered | 详情响应字段和失败态进度字段已闭合。 |
| AC-003 | covered | 签名 URL / stream 元信息、文件元数据和下载 guard 已闭合。 |
| AC-004 | covered | 正式历史查询维度和权限隔离已闭合。 |
| AC-005 | covered | 同子系统并发上限、DB 抢锁和多实例互斥已闭合。 |
| AC-006 | covered | 超阈值分片 ZIP、空数据仅表头和阶段事件已闭合。 |
| AC-007 | covered | registry create / get / list / update / enable / disable、唯一性和权限边界已闭合。 |
| AC-008 | covered | 注册配置、集中查询模板和 dataScopeTemplate 执行链路已闭合。 |
| AC-009 | covered | 权限、数据范围、脱敏和下载 guard 已闭合。 |
| AC-010 | covered | 审计字段、审计动作和失败链路已闭合。 |
| AC-011 | covered | 过期文件先失效再删除，清理失败保留可重试记录。 |
| AC-012 | covered | PENDING 可取消、FAILED 可重试、EXECUTING 批次边界收口和非法状态已闭合。 |
| AC-013 | covered | 同一 `taskId` 串联幂等、执行尝试、锁租约和配置快照已闭合。 |
| AC-014 | covered | 同幂等范围同摘要返回原任务，摘要冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-015 | covered | worker 抢锁、`attemptNo`、`lockOwner`、`lockExpireAt` 和续租字段已闭合。 |
| AC-016 | covered | 注册配置变更只影响新任务，旧任务和失败重试沿用原快照。 |
| AC-017 | covered | 采购订单样板注册合同已闭合。 |
| AC-018 | covered | 采购订单样板边界数据和 10 万行压测证据已闭合。 |
| AC-019 | covered | 查询执行上下文、模板版本、数据源编码和批次检查点串联已闭合。 |
| AC-020 | covered | 执行阶段事件已闭合。 |
| AC-021 | covered | temp object 到 published object、checksum 校验和发布失败阻断下载已闭合。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件并完成。 |
| AC-E002 | covered | 未注册 `taskCode` 创建失败且不落无效任务。 |
| AC-E003 | covered | 禁用任务返回 `TASK_DISABLED`。 |
| AC-E004 | covered | 查询短暂失败后按批次重试并最终完成。 |
| AC-E005 | covered | object storage put/read/publish 失败映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | covered | 权限不足返回 403，不泄露任务 / 文件详情。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁只有一个实例成功执行。 |
| AC-E009 | covered | `queryParams` 32KB 限制已在创建路径实施。 |
| AC-E010 | covered | 超大导出由 query/file/sample 路径拒绝或失败。 |
| AC-E011 | covered | 执行层拒绝非法模板，注册治理仍有 P1 gap，但验收已闭合。 |
| AC-E012 | covered | 数据源连接 / 凭证类错误收口为 `DATASOURCE_UNAVAILABLE`。 |
| AC-E013 | covered | 查询执行失败按 retry 策略处理，最终失败为 `QUERY_EXECUTION_ERROR`。 |
| AC-E014 | covered | 字段映射不合法收口为 `FIELD_MAPPING_INVALID`。 |
| AC-E015 | covered | 非法或重复重试请求返回非法状态错误。 |
| AC-E016 | covered | 缺少最小字段或认证失败返回权限 / 参数错误并记录 `requestId`。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期后接管延续当前 `attemptNo` 并从 checkpoint 继续。 |
| AC-E020 | covered | 查询批次重试耗尽后任务 `FAILED + QUERY_EXECUTION_ERROR`。 |
| AC-E021 | covered | 超过 100000 行默认上限时拒绝或失败并记录审计。 |
| AC-E022 | covered | 采购订单敏感字段未脱敏时失败为 `MASKING_RULE_ERROR`。 |
| AC-E023 | covered | 游标缺失、重复或非递增时任务失败并收口为 `QUERY_EXECUTION_ERROR`。 |
| AC-E024 | covered | 任务执行沿用创建时快照，不静默放宽字段或阈值。 |
| AC-E025 | covered | 批次字段、顺序或脱敏校验失败会停止写入并收口错误码。 |
| AC-E026 | covered | 发布前校验失败不生成下载地址，错误码为 `FILE_VERIFY_ERROR`。 |
| AC-E027 | covered | XLSX/ZIP renderer 失败收口为 `EXPORT_RENDER_ERROR`，记录摘要和失败原因。 |

## Findings

- `QUERY-TEMPLATE-HARDENING-001`
  - Severity: P1
  - Requirement IDs: `FR-008`, `AC-008`, `AC-E011`
  - Evidence:
    - `src/registry-config/service.ts`
    - `src/query-executor/index.ts`
    - `docs/testing/verify-matrix.md`
  - Risk: 注册持久化前的 datasource/table/function 治理仍偏弱，执行层校验不足以单独证明所有误配置都被前置拦截；当前 fresh evidence 只能证明执行边界已收口，不能替代注册治理前置化。
  - Suggested next task id: `QUERY-TEMPLATE-HARDENING-001`

- `PUBLIC-ERROR-REDACTION-001`
  - Severity: P1
  - Requirement IDs: `FR-010`, `AC-010`, `AC-E012`, `AC-E013`
  - Evidence:
    - `src/routes/respond.ts`
    - `src/query-executor/index.ts`
    - `src/task-api/service.ts`
    - `src/file-service/index.ts`
    - `docs/testing/verify-matrix.md`
  - Risk: 公开错误响应和失败详情仍可能透出底层 message，尤其 task-api、file-service、query-executor 和 respond.ts fallback 路径；当前 fresh evidence 只证明错误收口仍需继续压缩对外文本，不代表完全脱敏。
  - Suggested next task id: `PUBLIC-ERROR-REDACTION-001`

## Closed Findings

| Finding / Task | Status | Fresh evidence |
| --- | --- | --- |
| `RCR-001` / `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001` | closed | `tests/api/export-http-api.test.mjs`、`tests/contract/openapi-route-mapping.contract.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-002` / `FILE-RENDER-ERROR-CONTRACT-REPAIR-001` | closed | `tests/file/export-file-service.test.mjs`、`docs/testing/verify-matrix.md` |
| `CLEANUP-AUDIT-ERROR-CODE-ALIGN-001` | closed | `contracts/openapi.yaml`、`tests/worker/scheduler-worker.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-P0-001` / `AUTH-CONTEXT-TRUST-BOUNDARY-001` | closed | `src/audit-log/auth-context.ts`、`tests/api/export-http-api.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-P0-002` / `DATA-SCOPE-TEMPLATE-ENFORCE-001` | closed | `src/query-executor/index.ts`、`tests/query/query-executor.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-P0-003` / `DOWNLOAD-SIGNED-URL-GUARD-001` | closed | `src/file-service/index.ts`、`tests/file/export-file-service.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-P0-004` / `QUERY-PARAMS-SIZE-LIMIT-001` | closed | `src/task-api/service.ts`、`tests/api/export-http-api.test.mjs`、`tests/contract/openapi-route-mapping.contract.test.mjs`、`docs/testing/verify-matrix.md` |
| `RCR-P0-005` / `P0-ACCEPTANCE-EVIDENCE-REPAIR-001` | closed | `tests/api/export-http-api.test.mjs`、`tests/query/query-executor.test.mjs`、`docs/testing/verify-matrix.md` |

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate，依赖本机 Docker MySQL + 本地 object storage mock。
- `docs/testing/verify-matrix.md` 中的 `REQUIREMENTS-GAP-REPAIR-001`、`P0-ACCEPTANCE-EVIDENCE-REPAIR-001` 和 `RELEASE-001` snapshot 可用于证明当前受控边界内的 covered 判定。
- `npm run test:file` 中的 env-backed local HTTP adapter 只证明生产等价协议链路，不等于外部 live OSS/S3。
- 外部生产 MySQL、外部业务只读库和 live OSS/S3 不属于当前 release gate；后续如要声明 live evidence，必须另开专项验证任务。

## Architecture Constraints

- `truth_source=docs/product/* + docs/architecture/constraints.md`: PASS
- `review_only_no_business_fix`: PASS
- `mock/local/docker/live evidence separated`: PASS
- `forbidden_implementations`: PASS for this review task because本任务只更新 review 产物，没有把 InMemory/mock 冒充生产路径、也没有改写业务边界结论

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `GUIDELINE-SECURITY-001`: guideline - 认证上下文透传必须有可信来源证明 - suggested - `docs/knowledge/guidelines/GUIDELINE-SECURITY-001.md`
- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `PITFALL-REVIEW-001`: pitfall - release gate 通过不能替代逐项异常和安全验收 review - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-001.md`

## Remaining Risks

- 两个 P1 gap 仍需后续 repair：`QUERY-TEMPLATE-HARDENING-001` 和 `PUBLIC-ERROR-REDACTION-001`。
- 本 review 已把 FR / AC / AC-E 判为 `covered`，但 `covered` 只代表受控边界内证据闭合，不等于 live evidence。
- `RELEASE-001` 之外的外部生产 MySQL、外部业务数据源和 live OSS/S3 仍然未声明。
