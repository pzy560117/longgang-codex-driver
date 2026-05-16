# Requirements Complete Review: REQUIREMENTS-COMPLETE-REVIEW-001

Verdict: FAIL

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
- `docs/testing/TRACEABILITY_MATRIX.md`
- `docs/testing/ACCEPTANCE_EXAMPLES.md`
- `docs/testing/verify-matrix.md`
- `task.json`

## Summary

本轮复审以产品需求和架构约束为基准，逐项核对 FR-001 至 FR-014、AC-001 至 AC-021、AC-E001 至 AC-E027。当前结论为 `FAIL`：上一轮 `FR-002 / AC-002` 与 `AC-E027` 缺口已由 repair 任务关闭，但复审发现新的 P0/P1 缺口，主要集中在认证上下文可信边界、查询数据范围、下载签名 URL、32KB 参数限制和若干 P0 验收测试证据不足。

证据边界保持严格分层：`RELEASE-001` 是本机 Docker MySQL + 本地 object storage mock 的 docker/mock release gate；本 review 不声明外部生产 MySQL、外部业务数据源或 live OSS/S3 已验证。

## FR Coverage Matrix

| FR ID | Status | Evidence / Notes |
| --- | --- | --- |
| FR-001 | partially_covered | 创建、幂等和禁用任务有证据；`queryParams` 32KB 限制缺少生产校验与 API 测试。 |
| FR-002 | covered | 任务详情进度、失败字段和 `recentEvents` 已由 repair 任务补齐。 |
| FR-003 | partially_covered | 下载接口和文件元信息有证据；签名 URL 当前只是拼接 `expiresAt`，缺少不可伪造签名与 10 分钟 TTL 证据。 |
| FR-004 | partially_covered | 历史查询实现支持正式筛选维度；`status/subsystemCode` 筛选组合缺少显式 API 测试，且管理员上下文可信边界缺失。 |
| FR-005 | covered | MySQL 轮询、DB 抢锁、并发限制、续租和接管由 worker / DB 测试覆盖。 |
| FR-006 | covered | 空数据、分片、ZIP、阶段事件和 renderer 失败 `EXPORT_RENDER_ERROR` 已覆盖。 |
| FR-007 | partially_covered | registry 创建、启停和持久化有证据；API update/get/list/唯一性/无权限配置操作测试证据不足。 |
| FR-008 | partially_covered | 查询模板、字段映射和脱敏主路径有证据；`dataScopeTemplate` 未被执行层强制使用，SQL/模板治理偏弱。 |
| FR-009 | partially_covered | 权限、可见性和脱敏有局部证据；认证头可伪造、数据范围未覆盖 operator/role/template、签名 URL 不可伪造性不足。 |
| FR-010 | partially_covered | 审计枚举和事件有证据；公开错误 message 可能透出底层异常原文。 |
| FR-011 | covered | cleanup 先失效再删除、删除失败保留重试记录已覆盖。 |
| FR-012 | covered | 取消、重试、非法状态和批次边界收口已覆盖。 |
| FR-013 | covered | 幂等、attemptNo、配置快照、锁租约和接管已覆盖。 |
| FR-014 | covered | 采购订单样板注册、字段、脱敏、边界数据和 10 万行证据已覆盖。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | partially_covered | 创建成功证据存在；超长 `queryParams` 未在生产创建路径拦截。 |
| AC-002 | covered | 详情响应字段 `status/totalCount/processedCount/progressPercent/errorCode/errorMessage/recentEvents` 已覆盖。 |
| AC-003 | partially_covered | 下载元信息和 guard 有证据；签名 URL 不可伪造性和 10 分钟 TTL 未满足。 |
| AC-004 | partially_covered | `taskCode/createdBy/fileFormat/createdAtRange` 有测试；`status/subsystemCode` 缺少显式筛选断言。 |
| AC-005 | covered | 同子系统并发上限、DB 抢锁和多实例互斥有证据。 |
| AC-006 | covered | 超阈值分片 ZIP、空数据仅表头、文件渲染和阶段事件已覆盖。 |
| AC-007 | partially_covered | create/enable/disable 有测试；update/get/list/重复 taskCode 的 API 证据不足。 |
| AC-008 | partially_covered | 查询模板主路径有证据；注册前强校验、数据源 allowlist、`dataScopeTemplate` 执行证据不足。 |
| AC-009 | partially_covered | 详情/下载 403 有测试；认证上下文可信校验、创建/配置无权限审计、签名 URL 防绕过不足。 |
| AC-010 | partially_covered | 审计字段和枚举有证据；公开错误信息脱敏边界不足。 |
| AC-011 | covered | 过期文件先失效再删除，清理失败保留可重试记录。 |
| AC-012 | covered | PENDING 取消、FAILED 重试、EXECUTING 批次边界收口和非法状态已覆盖。 |
| AC-013 | covered | 同一 `taskId` 可串联幂等、执行尝试、锁租约和配置快照。 |
| AC-014 | covered | 相同幂等范围同摘要返回原任务，摘要冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-015 | covered | worker 抢锁记录 `attemptNo`、`lockOwner`、`lockExpireAt`、`leaseRenewedAt`。 |
| AC-016 | covered | 注册配置变更只影响新任务，旧任务和 FAILED 重试沿用原快照。 |
| AC-017 | covered | 采购订单样板注册包含数据源、参数、模板、字段、脱敏、游标和格式。 |
| AC-018 | covered | 采购订单样板覆盖 `0/1/20000/20001/100000/100001` 行边界。 |
| AC-019 | covered | 查询执行上下文、模板版本、数据源编码、批次检查点和审计串联有证据。 |
| AC-020 | covered | 执行阶段事件有证据；失败渲染另有 `PACKAGE_FAILED` 诊断事件。 |
| AC-021 | covered | temp object 到 published object、checksum 校验、发布失败阻断下载已覆盖。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件并完成。 |
| AC-E002 | partially_covered | 实现有 `TASK_NOT_REGISTERED` 分支；缺少未注册创建失败且不落任务的 API 测试。 |
| AC-E003 | covered | 禁用任务返回 `TASK_DISABLED`。 |
| AC-E004 | covered | 查询短暂失败后按批次重试并最终完成。 |
| AC-E005 | covered | object storage put/read/publish 失败映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | partially_covered | 403 不泄露任务/文件有局部证据；请求头伪造 admin 的负向验证缺失。 |
| AC-E007 | covered | 文件过期返回 `FILE_EXPIRED` / 410。 |
| AC-E008 | covered | 多实例重复抢锁只有一个实例成功执行。 |
| AC-E009 | gap | `contracts/openapi.yaml` 声明 32KB 限制，但 `src/task-api/service.ts` 创建路径未校验。 |
| AC-E010 | covered | 超大导出由 query/file/sample 路径拒绝或失败。 |
| AC-E011 | partially_covered | 执行层会拒绝非法模板；注册落库前模板治理和 allowlist 不足。 |
| AC-E012 | covered | 数据源连接/凭证类错误收口为 `DATASOURCE_UNAVAILABLE`。 |
| AC-E013 | covered | 查询执行失败按 retry 策略处理，最终失败为 `QUERY_EXECUTION_ERROR`。 |
| AC-E014 | covered | 字段映射不合法收口为 `FIELD_MAPPING_INVALID`。 |
| AC-E015 | covered | 非法或重复重试请求返回非法状态错误。 |
| AC-E016 | partially_covered | 缺少最小字段会 401；但认证上下文来源可信性未验证。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期后接管延续当前 `attemptNo` 并从 checkpoint 继续。 |
| AC-E020 | covered | 查询批次重试耗尽后任务 `FAILED + QUERY_EXECUTION_ERROR`。 |
| AC-E021 | covered | 超过 100000 行默认上限时拒绝或失败，并记录审计。 |
| AC-E022 | covered | 采购订单敏感字段未脱敏时失败为 `MASKING_RULE_ERROR`。 |
| AC-E023 | partially_covered | 实现有游标缺失/重复/非递增 guard；缺少对应负向 query 测试。 |
| AC-E024 | covered | 任务执行沿用创建时快照，不静默放宽字段或阈值。 |
| AC-E025 | covered | 批次字段、顺序或脱敏校验失败会停止写入并收口错误码。 |
| AC-E026 | covered | 发布前校验失败不生成下载地址，错误码为 `FILE_VERIFY_ERROR`。 |
| AC-E027 | covered | XLSX/ZIP renderer 失败收口为 `EXPORT_RENDER_ERROR`，记录摘要和失败原因。 |

## Findings

### RCR-P0-001: Auth context trust boundary is not enforced

- Severity: P0
- Requirement IDs: `FR-009`, `AC-009`, `AC-E006`, `AC-E016`
- Evidence:
  - `src/audit-log/auth-context.ts:46-63` 直接从 `x-operator-id`、`x-tenant-id`、`x-role-codes`、`x-org-scope`、`x-request-id` 构造认证上下文。
  - `src/audit-log/auth-context.ts:26-27` 将请求头中的 `EXPORT_ADMIN` 作为管理员判断。
  - `src/task-api/service.ts:624-633` 管理员历史查询可不受租户过滤。
- Risk: 能直连服务的调用方可伪造管理员或跨租户上下文，绕过任务可见性和下载权限。
- Suggested next task id: `AUTH-CONTEXT-TRUST-BOUNDARY-001`

### RCR-P0-002: query data scope ignores operatorId, roleCodes, and registry dataScopeTemplate

- Severity: P0
- Requirement IDs: `FR-008`, `FR-009`, `AC-008`, `AC-009`
- Evidence:
  - `docs/product/prd-lite.md` 要求查询叠加 `tenantId`、`operatorId`、`roleCodes`、`orgScope` 数据范围约束。
  - `src/query-executor/index.ts:352-364` 只构造 `tenantId + orgScope`。
  - `src/query-executor/index.ts:393-405` 硬编码 `tenantId = ? AND orgId IN (...)`，未使用 registry `dataScopeTemplate`。
- Risk: 同租户同组织内不同操作人或角色的数据隔离无法证明，可能导出越权数据。
- Suggested next task id: `DATA-SCOPE-TEMPLATE-ENFORCE-001`

### RCR-P0-003: signed URL is not cryptographically signed and uses file retention expiry

- Severity: P0
- Requirement IDs: `FR-003`, `FR-009`, `AC-003`, `AC-009`
- Evidence:
  - `src/file-service/index.ts:117-120` 的 `createDownloadUrl` 只追加 `expiresAt` 查询参数，没有签名。
  - `src/file-service/index.ts:166-168` 文件 `expiresAt` 是保留期过期时间。
  - `src/task-api/service.ts:840` 下载接口用文件保留期 `file.expiresAt` 创建下载 URL，而不是 10 分钟签名 URL TTL。
- Risk: URL 泄露后可能绕过平台鉴权和下载审计长期访问对象。
- Suggested next task id: `DOWNLOAD-SIGNED-URL-GUARD-001`

### RCR-P0-004: queryParams 32KB limit is only contracted, not implemented

- Severity: P0
- Requirement IDs: `FR-001`, `AC-E009`
- Evidence:
  - `contracts/openapi.yaml` 声明 `queryParams` 不得超过 32768 bytes，错误码为 `QUERY_PARAMS_TOO_LARGE`。
  - `src/task-api/service.ts:451-615` 创建任务路径计算 digest 并落库，但未检查序列化后的 `queryParams` 字节数。
  - `tests/api/export-http-api.test.mjs` 未覆盖超长 `queryParams` 创建失败。
- Risk: 超长参数可能绕过产品限制进入持久化、审计和后续查询执行链路。
- Suggested next task id: `QUERY-PARAMS-SIZE-LIMIT-001`

### RCR-P0-005: P0 acceptance evidence is incomplete for history, registry, permission, and cursor negative cases

- Severity: P0
- Requirement IDs: `AC-004`, `AC-007`, `AC-009`, `AC-E002`, `AC-E023`
- Evidence:
  - `tests/api/export-http-api.test.mjs` 覆盖历史查询的 `taskCode/createdBy/fileFormat/createdAtRange`，未显式断言 `status/subsystemCode` 筛选。
  - registry API 有 create/enable/disable 证据，但 update/get/list、重复 taskCode 或配置无权限操作的 API 证据不足。
  - `src/task-api/service.ts:483-492` 有未注册任务分支，但 API 测试未断言不落无效任务。
  - `src/query-executor/index.ts:673` 有游标重复/非递增 guard，但 query 测试未覆盖缺失/重复/非递增游标负向数据。
- Risk: P0/P1 需求虽有实现入口，但验收证据不足，release 回归无法定位这些边界是否漂移。
- Suggested next task id: `P0-ACCEPTANCE-EVIDENCE-REPAIR-001`

### RCR-P1-001: SQL/template governance is too weak before registry persistence

- Severity: P1
- Requirement IDs: `FR-008`, `AC-008`, `AC-E011`
- Evidence:
  - `src/registry-config/service.ts:141-186` 在 upsert 时保存 `datasourceCode/queryTemplate/dataScopeTemplate`，未见 datasource allowlist、AST/table allowlist 或函数治理。
  - `src/query-executor/index.ts:300-317` 只在执行层做 SELECT/unsafe token/placeholder 校验。
  - `src/query-executor/index.ts:416-418` 使用 `CompiledQuery.raw` 执行拼装 SQL。
- Risk: 管理员误配或认证边界被绕过时，非法或高成本查询可进入执行阶段。
- Suggested next task id: `QUERY-TEMPLATE-HARDENING-001`

### RCR-P1-002: public error responses can expose raw internal messages

- Severity: P1
- Requirement IDs: `FR-010`, `AC-010`, `AC-E012`, `AC-E013`
- Evidence:
  - `src/routes/respond.ts:22-25` 对未知错误直接返回 `error.message`。
  - `src/query-executor/index.ts:793-803` 将底层 datasource / query 错误 message 包装到公开错误。
  - `src/task-api/service.ts:251-254` 任务详情可能从 checkpoint 读取公开 `errorMessage`。
- Risk: 数据源地址、SQL 片段、账号、对象存储内部错误等敏感信息可能进入 API 响应或任务详情。
- Suggested next task id: `PUBLIC-ERROR-REDACTION-001`

## Closed Findings

| Finding / Task | Status | Fresh evidence |
| --- | --- | --- |
| `RCR-001` / `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001` | closed | `tests/api/export-http-api.test.mjs` 覆盖 PENDING、checkpoint、FAILED 详情；`tests/contract/openapi-route-mapping.contract.test.mjs` 守护 schema。 |
| `RCR-002` / `FILE-RENDER-ERROR-CONTRACT-REPAIR-001` | closed | `tests/file/export-file-service.test.mjs` 覆盖 XLSX/ZIP renderer 失败、`PACKAGE_FAILED` 事件、scheduler 最终 `FAILED + EXPORT_RENDER_ERROR` 审计。 |
| `CLEANUP-AUDIT-ERROR-CODE-ALIGN-001` | closed | cleanup 删除失败写入 `CLEANUP_FAILED / FAILED / FILE_CLEANUP_DELETE_ERROR`，且 ResponseCode 已公开。 |

## Evidence Boundary

- `RELEASE-001`: docker/mock release gate；依赖本机 Docker MySQL + 本地 object storage mock。
- `npm run test:mock-local`: local/dev 守护；不能替代 API/DB/worker/query/file/sample 或 release gate。
- `npm run test:file` 中 env-backed local HTTP adapter 只证明生产等价协议链路，不等于外部 live OSS/S3。
- 外部生产 MySQL、外部业务只读库和 live OSS/S3 不属于当前 release gate；后续如要声明 live evidence，必须另开专项验证任务。

## Architecture Constraints

- `truth_source=docs/product/* + docs/architecture/constraints.md`: PASS - 本 review 以上述文件作为判定基线。
- `review_only_no_business_fix`: PASS - 本任务只更新 review 产物，不修改业务实现、任务状态、trace 或 progress。
- `mock/local/docker/live evidence separated`: PASS - 完成结论限定为 local/Docker/mock，未升级为 live。
- `forbidden_implementations`: FAIL - 当前没有 InMemory/mock 冒充生产路径，但若声称 P0 权限、数据范围、签名 URL 已完成，会违反“不得把不完整生产边界伪装成完成”的约束。

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `GUIDELINE-SECURITY-001`: guideline - 认证上下文透传必须有可信来源证明 - suggested - `docs/knowledge/guidelines/GUIDELINE-SECURITY-001.md`
- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `PITFALL-REVIEW-001`: pitfall - release gate 通过不能替代逐项异常和安全验收 review - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-001.md`

## Remaining Risks

- Review 产物列出的 P0/P1 findings 未在本任务内修复；后续应拆分进入 repair 队列。
- 本任务验证命令不重复执行完整 docker/mock release gate；完整 release evidence 以 `docs/testing/verify-matrix.md` 中 `RELEASE-001` 为准。
