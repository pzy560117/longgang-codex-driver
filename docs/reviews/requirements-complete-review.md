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
- `docs/testing/verify-matrix.md`
- `task.json`

## Summary

本轮复审结论为 `FAIL`。`CLEANUP-AUDIT-ERROR-CODE-ALIGN-001` 已关闭上一轮 cleanup 失败审计 `errorCode` 契约缺口：`contracts/openapi.yaml` 已公开 `FILE_CLEANUP_DELETE_ERROR`，`tests/contract/openapi-route-mapping.contract.test.mjs` 已守护生产审计 `action/result/errorCode` 均落在公开枚举内，`tests/worker/scheduler-worker.test.mjs` 已断言 cleanup 删除失败写入 `CLEANUP_FAILED / FAILED / FILE_CLEANUP_DELETE_ERROR`。

仍存在 1 个 P0 gap 和 1 个 P1 gap：

- P0: `FR-002 / AC-002` 的任务详情进度契约未由当前 API 实现和测试完整证明。实现固定返回 `totalCount=null`、`progressPercent=0`、`errorCode=null`、`errorMessage=null`，并返回 `events` 字段而不是 OpenAPI 中的 `recentEvents`。
- P1: `AC-E027` 的 XLSX/ZIP 渲染失败异常路径没有实现级错误映射和测试证据。契约声明 `EXPORT_RENDER_ERROR`，但当前 file service 对真实 renderer 抛错没有显式映射，现有测试也未断言该异常验收。

证据边界保持不变：当前 `RELEASE-001` 是本机 Docker MySQL + 本地 object storage mock 的 docker/mock release gate；本 review 不声明外部生产 MySQL 或 live OSS/S3 已验证。

## FR Coverage Matrix

| FR ID | Status | Notes |
| --- | --- | --- |
| FR-001 | covered | 创建任务接口、PENDING 返回、幂等和注册校验已有契约、服务和测试证据。 |
| FR-002 | partially_covered | API 存在，但任务详情未按 AC-002 返回可用 totalCount、progressPercent、失败 errorCode/errorMessage；测试仅断言 taskId。 |
| FR-003 | covered | 下载链路、签名 URL/stream 元信息、文件元数据和过期/权限保护有证据。 |
| FR-004 | covered | 历史查询筛选维度、普通用户可见性和管理员全局查询有证据。 |
| FR-005 | covered | 调度、并发、DB 锁租约、续租和接管有 worker / repository / test 证据。 |
| FR-006 | partially_covered | 分片、ZIP、空数据和阶段事件已覆盖；渲染失败 `EXPORT_RENDER_ERROR` 异常路径缺少实现级映射和测试。 |
| FR-007 | covered | 注册、更新、查询、启停和配置快照链路已有 API / service / repository 证据。 |
| FR-008 | covered | 集中查询模板、字段映射、脱敏策略、数据源不可用和批次重试证据已补齐。 |
| FR-009 | covered | 权限、数据范围、脱敏和下载保护有覆盖。 |
| FR-010 | covered | 审计 action/result/errorCode 公开契约和生产写入已对齐，cleanup 失败路径已补 guard。 |
| FR-011 | covered | 过期标记、不可下载、对象删除失败重试记录和 cleanup 审计已覆盖。 |
| FR-012 | covered | 取消与重试边界、非法状态错误和 worker 批次收口已有证据。 |
| FR-013 | covered | 幂等、执行尝试、配置快照、DB 锁租约和接管有证据。 |
| FR-014 | covered | 采购订单样板集中查询合同、样板链路和边界压测有证据。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | covered | 创建任务返回 taskId 且状态为 PENDING。 |
| AC-002 | partially_covered | status / processedCount 有部分证据；totalCount、progressPercent、errorCode/errorMessage 未按真实进度和失败态返回。 |
| AC-003 | covered | 下载响应、文件元信息和校验保护有证据。 |
| AC-004 | covered | 历史分页筛选和管理员/普通用户可见性已覆盖。 |
| AC-005 | covered | 同子系统并发控制有 scheduler / lease 证据。 |
| AC-006 | covered | 超阈值分片打包和空数据表头文件已覆盖。 |
| AC-007 | covered | 注册创建、更新、查询、启停和配置同步已有证据。 |
| AC-008 | covered | 集中查询模板、schema、字段映射、脱敏策略和数据源约束有证据。 |
| AC-009 | covered | 无权限创建或下载返回 403 并记录审计。 |
| AC-010 | covered | 审计字段、action/result/errorCode 枚举和 cleanup 失败路径已对齐公开契约。 |
| AC-011 | covered | 过期标记、不可下载、删除失败重试和 cleanup audit 有证据。 |
| AC-012 | covered | PENDING 可取消、FAILED 可重试、EXECUTING 批次边界收口有证据。 |
| AC-013 | covered | taskId 串联幂等、执行尝试、锁租约和快照证据可追踪。 |
| AC-014 | covered | 幂等范围和参数摘要一致/冲突行为有证据。 |
| AC-015 | covered | attemptNo、lockOwner、lockExpireAt 和租约续租证据存在。 |
| AC-016 | covered | 已创建任务和失败重试沿用创建时 configSnapshot。 |
| AC-017 | covered | 采购订单样板注册与查询条件、字段和格式契约已覆盖。 |
| AC-018 | covered | 0/1/20000/20001/100000/100001 边界证据已覆盖。 |
| AC-019 | covered | 查询执行上下文、批次检查点和审计串联有证据。 |
| AC-020 | covered | `QUERY_READY`、`QUERY_BATCH_DONE`、`FILE_PART_WRITTEN`、`PACKAGE_DONE`、`FILE_VERIFIED`、`DELIVERY_READY` 有持久化事件证据。 |
| AC-021 | covered | 临时对象到已发布对象的交付模型和校验失败处置有证据。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件。 |
| AC-E002 | covered | 未注册任务创建失败，不落无效任务。 |
| AC-E003 | covered | 任务禁用返回 `TASK_DISABLED`。 |
| AC-E004 | covered | 短暂失败后重试成功的批次 retry loop 有实现和测试证据。 |
| AC-E005 | covered | object storage put/publish 错误映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | covered | 权限不足返回 403，不泄露文件和任务详情。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁仅一个实例成功执行。 |
| AC-E009 | covered | 请求参数过长返回 400。 |
| AC-E010 | covered | 超大导出按配置拒绝或进入更严格控制流。 |
| AC-E011 | covered | 查询模板不存在或不合法收口为 `QUERY_TEMPLATE_INVALID`。 |
| AC-E012 | covered | 数据源不可用或凭证不可用收口为 `DATASOURCE_UNAVAILABLE`。 |
| AC-E013 | covered | 查询执行失败的 retry loop 与最终失败路径有证据。 |
| AC-E014 | covered | 字段映射不合法收口为 `FIELD_MAPPING_INVALID`。 |
| AC-E015 | covered | 非法或重复重试请求返回非法状态错误。 |
| AC-E016 | covered | 认证上下文缺少最小字段可返回权限/参数错误并记录 requestId。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期接管、attemptNo 延续和批次检查点有证据。 |
| AC-E020 | covered | 查询批次重试耗尽已有 retry loop 和耗尽测试路径。 |
| AC-E021 | covered | 超过默认最大导出量的拒绝/更严格控制流有证据。 |
| AC-E022 | covered | 采购订单样板敏感字段脱敏有覆盖。 |
| AC-E023 | covered | 游标不稳定有查询层测试与契约证据。 |
| AC-E024 | covered | 查询模板或字段映射与任务快照冲突有证据。 |
| AC-E025 | covered | 批次字段、顺序和脱敏校验有实现与失败收口证据。 |
| AC-E026 | covered | 文件发布前失败不会生成下载地址，且错误码映射为 `FILE_VERIFY_ERROR`。 |
| AC-E027 | gap | 契约声明 `EXPORT_RENDER_ERROR`，但当前实现和测试没有证明真实 XLSX/ZIP renderer 失败会收口为该错误码并记录渲染输入摘要。 |

## Findings

### RCR-001

- Severity: P0
- Title: task detail progress/error contract is not implemented to AC-002
- Evidence:
  - `docs/product/acceptance-criteria.md`: `AC-002` 要求可查询任务状态、总数、已处理数、进度和错误信息。
  - `contracts/openapi.yaml:1364-1428` 将 `totalCount`、`processedCount`、`progressPercent`、`errorCode`、`errorMessage` 和 `recentEvents` 建模在任务详情响应中。
  - `src/task-api/service.ts:479-485` 固定返回 `totalCount: null`、`progressPercent: 0`、`errorCode: null`、`errorMessage: null`，且字段名为 `events` 而不是契约中的 `recentEvents`。
  - `tests/api/export-http-api.test.mjs:369-375` 任务详情 API 测试只断言 `taskId`，未断言进度、失败信息或 `recentEvents` 契约。
- Risk: P0 的任务进度查询只能证明接口存在，不能证明调用方可获得真实总数、进度百分比和失败原因；`FR-002 / AC-002` 不能声明完全覆盖。
- Suggested next task id: `TASK-DETAIL-PROGRESS-CONTRACT-REPAIR-001`

### RCR-002

- Severity: P1
- Title: XLSX/ZIP render failure is only contracted, not verified by production error mapping
- Evidence:
  - `docs/product/acceptance-criteria.md`: `AC-E027` 要求 XLSX/ZIP 渲染失败时任务 `FAILED`，错误码为 `EXPORT_RENDER_ERROR`，并记录渲染输入摘要和失败原因。
  - `contracts/openapi.yaml:1178-1187` 声明了 `EXPORT_RENDER_ERROR` 响应。
  - `src/file-service/index.ts:133` 调用 `renderFileBody(...)`，`src/file-service/index.ts:320-329` 直接调用 `renderExportPackage(...)`，没有把 renderer 抛出的真实异常显式映射为 `EXPORT_RENDER_ERROR`。
  - `rg -n "EXPORT_RENDER_ERROR" tests` 未发现 file/worker/sample 测试断言真实渲染失败收口。
- Risk: 文件渲染层异常可能被 worker 按默认错误路径收口，而不是产品定义的 `EXPORT_RENDER_ERROR`；`AC-E027` 目前只有契约文字，没有 fresh implementation/test evidence。
- Suggested next task id: `FILE-RENDER-ERROR-CONTRACT-REPAIR-001`

## Closed Previous Findings

| Previous Finding | Status | Fresh evidence |
| --- | --- | --- |
| AUDIT-CONTRACT-ALIGN-001 | closed | `tests/contract/openapi-route-mapping.contract.test.mjs` 守护审计 action/result/errorCode 枚举；API/worker 测试覆盖失败审计。 |
| TASK-HISTORY-ADMIN-SCOPE-001 | closed | `tests/api/export-http-api.test.mjs` 覆盖普通用户只见本人任务、管理员历史查询可见跨租户全局任务。 |
| CONFIG-SNAPSHOT-REPLAY-001 | closed | API/query/worker 测试覆盖创建时完整 configSnapshot 和旧任务按快照执行。 |
| QUERY-BATCH-RETRY-001 | closed | worker 测试覆盖 retryCount/backoffMs、短暂失败后成功和耗尽失败。 |
| DATASOURCE-ADAPTER-ERROR-001 | closed | query/worker 测试覆盖连接/凭证错误收口为 `DATASOURCE_UNAVAILABLE`。 |
| FILE-STORAGE-ERROR-MAPPING-001 | closed | file/worker 测试覆盖 put/publish 失败映射为 `FILE_VERIFY_ERROR`。 |
| CLEANUP-AUDIT-ERROR-CODE-001 | closed | OpenAPI enum、contract guard 和 worker cleanup failure 测试已覆盖 `FILE_CLEANUP_DELETE_ERROR`。 |

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate，已通过。
- `npm run test:mock-local` 是本任务 test_command 的 local/dev 守护，不替代 docker/mock release gate，也不证明 live。
- 本次 review 不声明外部生产 MySQL 或 live OSS/S3 已验证。
- `docs/architecture/constraints.md` 已明确当前 Definition of Done 不要求 live evidence，但禁止把 mock/local/docker evidence 写成 live evidence。

## Architecture Constraints

- `truth_source=docs/product/* + docs/architecture/constraints.md`: PASS - 本 review 以上述文件作为判定基线。
- `review_only_no_business_fix`: PASS - 本任务只更新 review 产物，不修改业务实现。
- `mock/local/docker/live evidence separated`: PASS - 结论只声明 docker/mock release gate 和 local/dev 守护，不升级为 live evidence。
- `forbidden_implementations`: PASS - 未以 InMemory/mock/fixture 作为生产实现完成证据。

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `PITFALL-REVIEW-001`: pitfall - release gate 通过不能替代逐项异常验收 review - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-001.md`
- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `GUIDELINE-CONTRACT-RESPONSE-001`: guideline - API 测试必须断言 OpenAPI 中的关键响应字段而非只断言状态码/taskId - suggested - `docs/knowledge/guidelines/GUIDELINE-CONTRACT-RESPONSE-001.md`
