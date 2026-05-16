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
- `docs/testing/verify-matrix.md`
- `task.json`

## Summary

本轮复审结论为 `PASS_WITH_GAPS`。

原先六个 RCR findings 中，除 `CLEANUP-AUDIT-ERROR-CODE-001` 外，其余主漂移均已通过修复证据关闭：

- 审计 action/result 主漂移已修：`src/task-api/service.ts`、`src/registry-config/service.ts` 使用 `FAILED`，registry 查询使用 `REGISTRY_QUERY`；cleanup action 使用 `EXPIRE_MARK` / `CLEANUP_FAILED`。
- 管理员历史全局查询已修：`src/task-api/service.ts:385-400` 管理员 list 不传 `tenantId`；`tests/api/export-http-api.test.mjs:419-443` 断言跨租户管理员 list 可见、detail 仍 403。
- 配置快照回放已修：`src/task-api/service.ts:320-356` 创建任务持久化完整 `configSnapshot`；`src/query-executor/index.ts:222-233` 优先使用 task requestPayload 中 snapshot；`tests/query/query-executor.test.mjs:406-476`、`tests/worker/scheduler-worker.test.mjs:515-600` 覆盖 registry 更新/禁用后旧任务仍按创建时快照执行。
- 查询批次 retry 已修：`src/scheduler/worker.ts:428-455` 写入 `retryCount` / `backoffMs` 并续租；`src/scheduler/worker.ts:773-777` 将 `QUERY_EXECUTION_ERROR` / `DATASOURCE_UNAVAILABLE` 作为可重试批次错误；`tests/worker/scheduler-worker.test.mjs:750-790`、`:816-855`、`:982-1040` 覆盖短暂失败、backoff 和耗尽。
- 数据源不可用已修：`src/query-executor/index.ts:780-795` 映射连接/凭证类错误为 `DATASOURCE_UNAVAILABLE`；`tests/query/query-executor.test.mjs:731-740` 和 `tests/worker/scheduler-worker.test.mjs:1044-1075` 覆盖 query/worker 收口。
- 文件 put/publish 失败映射已修：`src/file-service/index.ts:78-105` 和 `:412-420` 将 put/read/publish 映射为 `FILE_VERIFY_ERROR`；`tests/file/export-file-service.test.mjs:510-558`、`:611-655` 覆盖不发布 metadata 与 worker audit `FILE_VERIFY_ERROR`。

仍有一个 P1 gap：

- `CLEANUP-AUDIT-ERROR-CODE-001`
- cleanup 失败审计写入 `FILE_CLEANUP_DELETE_ERROR`，但 `contracts/openapi.yaml` 的 `ResponseCode` enum 不包含该值，而 `AuditEvent.errorCode` 引用的是 `ResponseCode`。
- 当前测试只断言 `CLEANUP_FAILED` + `FAILED`，未断言 cleanup audit errorCode 落在公开契约枚举内。
- 这会让 FR-010 / FR-011、AC-010 / AC-011 的审计契约边界仍存在 P1 缺口，因此 release gate 不应声明 cleanup 失败路径完全契约一致。

## FR Coverage Matrix

| FR ID | Status | Notes |
| --- | --- | --- |
| FR-001 | covered | 创建任务接口、PENDING 返回和幂等链路已有契约、服务和测试证据。 |
| FR-002 | covered | 任务详情/进度查询有 API、服务和测试映射。 |
| FR-003 | covered | 下载链路、签名 URL/stream 元信息和文件元数据证据已覆盖。 |
| FR-004 | covered | 历史查询筛选维度、同租户权限边界和管理员全局可见性证据已修正。 |
| FR-005 | covered | 调度和 DB 锁边界已有 worker / repository / test 证据。 |
| FR-006 | covered | 分片、打包和样板批次链路已有证据。 |
| FR-007 | covered | 注册、启停和配置链路已有 API / service / repository 证据。 |
| FR-008 | covered | 集中查询模板、字段映射、脱敏策略、数据源不可用与批次重试证据已补齐。 |
| FR-009 | covered | 权限、脱敏和下载保护有覆盖，审计 result contract 已与实现收敛。 |
| FR-010 | partially_covered | 审计主漂移已修，但 cleanup 失败路径的 errorCode 仍未与公开契约枚举完全对齐。 |
| FR-011 | partially_covered | cleanup 行为链路已修正，但 cleanup 失败审计 errorCode 仍有契约缺口。 |
| FR-012 | covered | 取消与重试边界、非法状态错误和 worker 收口已有证据。 |
| FR-013 | covered | 幂等、执行尝试和 DB 锁租约已有证据，配置快照回放也已修正。 |
| FR-014 | covered | 采购订单样板的集中查询合同、样板链路和压测边界已有证据。 |

## AC Coverage Matrix

| AC ID | Status | Notes |
| --- | --- | --- |
| AC-001 | covered | 创建任务 1 秒返回 taskId、PENDING 状态的证据齐备。 |
| AC-002 | covered | 任务状态、总数、已处理数、进度和错误信息可查询。 |
| AC-003 | covered | 下载响应、文件元信息和过期前下载保护有证据。 |
| AC-004 | covered | 历史分页筛选与管理员全局查询已按产品口径落实。 |
| AC-005 | covered | 同子系统并发控制有 scheduler / lease 证据。 |
| AC-006 | covered | 超阈值分片打包和空数据表头文件已覆盖。 |
| AC-007 | covered | 注册创建、更新、查询、启停和配置同步已有证据。 |
| AC-008 | covered | 集中查询模板、schema、字段映射、脱敏策略和数据源约束有证据。 |
| AC-009 | covered | 无权限创建或下载返回 403 并记录审计。 |
| AC-010 | partially_covered | 审计日志契约主漂移已修，但 cleanup 失败路径 errorCode 仍未完全对齐。 |
| AC-011 | partially_covered | 过期标记、不可下载和清理失败记录有链路，但 cleanup 失败审计 errorCode 仍有缺口。 |
| AC-012 | covered | PENDING 可取消、FAILED 可重试、EXECUTING 批次边界收口有证据。 |
| AC-013 | covered | taskId 串联幂等、执行尝试、锁租约和快照证据可追踪。 |
| AC-014 | covered | 幂等范围和参数摘要一致/冲突行为有证据。 |
| AC-015 | covered | attemptNo、lockOwner、lockExpireAt 和租约续租证据存在。 |
| AC-016 | covered | 创建任务时持久化完整 configSnapshot，旧任务和失败重试沿用创建时快照。 |
| AC-017 | covered | 采购订单样板注册与查询条件、字段和格式契约已覆盖。 |
| AC-018 | covered | 0/1/20000/20001/100000/100001 边界证据已覆盖。 |
| AC-019 | covered | 批次检查点、重试和失败上下文有证据，且短暂失败和耗尽链路已补齐。 |
| AC-020 | covered | 阶段事件链路可追踪。 |
| AC-021 | covered | 临时对象到已发布对象的交付模型和校验失败处置有证据。 |

## AC-E Coverage Matrix

| AC-E ID | Status | Notes |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件。 |
| AC-E002 | covered | 未注册任务创建失败，不落无效任务。 |
| AC-E003 | covered | 任务禁用返回 `TASK_DISABLED`。 |
| AC-E004 | covered | 短暂失败后重试成功的批次 retry loop 已有实现和测试证据。 |
| AC-E005 | covered | object storage put/publish 错误已映射为 `FILE_VERIFY_ERROR`。 |
| AC-E006 | covered | 权限不足返回 403。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁仅一个实例成功执行。 |
| AC-E009 | covered | 请求参数过长返回 400。 |
| AC-E010 | covered | 超大导出按配置拒绝或进入更严格控制流。 |
| AC-E011 | covered | 查询模板不存在或不合法收口为 `QUERY_TEMPLATE_INVALID`。 |
| AC-E012 | covered | `DATASOURCE_UNAVAILABLE` 已有契约与可执行路径。 |
| AC-E013 | covered | 查询执行失败的 retry loop 与耗尽路径已有证据。 |
| AC-E014 | covered | 字段映射不合法收口为 `FIELD_MAPPING_INVALID`。 |
| AC-E015 | covered | 非法或重复重试请求返回非法状态错误。 |
| AC-E016 | covered | 认证上下文缺少最小字段可返回权限/参数错误并记录 requestId。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | covered | 锁租约过期接管、attemptNo 延续和批次检查点有证据。 |
| AC-E020 | covered | 查询批次重试耗尽已有明确 retry loop 和耗尽测试路径。 |
| AC-E021 | covered | 超过默认最大导出量的拒绝/更严格控制流有证据。 |
| AC-E022 | covered | 采购订单样板敏感字段脱敏有覆盖。 |
| AC-E023 | covered | 游标不稳定有查询层测试与契约证据。 |
| AC-E024 | covered | 配置快照沿用创建时完整快照后的冲突判定证据已补齐。 |
| AC-E025 | covered | 批次字段/顺序/脱敏校验有实现与失败收口证据。 |
| AC-E026 | covered | 文件发布前失败不会生成下载地址，且错误码映射已与 `FILE_VERIFY_ERROR` 对齐。 |
| AC-E027 | covered | `EXPORT_RENDER_ERROR` 有实现映射并配套渲染失败测试。 |

## Findings

### RCR-001

- Severity: P1
- Title: cleanup audit errorCode not fully aligned with public contract
- Evidence:
  - `src/cleanup-job/index.ts:115-120` 的 cleanup 失败审计写入 `FILE_CLEANUP_DELETE_ERROR`。
  - `contracts/openapi.yaml:1215-1240` 的 `ResponseCode` enum 不包含该值。
  - `contracts/openapi.yaml:1785-1832` 的 `AuditEvent.errorCode` 引用 `ResponseCode`。
  - `tests/worker/scheduler-worker.test.mjs:1178` 只断言 `CLEANUP_FAILED` + `FAILED`，没有断言 errorCode 属于 OpenAPI enum。
- Risk: cleanup 失败路径的审计记录可能不符合公开审计契约，FR-010/FR-011、AC-010/AC-011 的证据边界仍存在 P1 缺口；release gate 不应把该路径声明为完全契约一致。
- Suggested next task id: `CLEANUP-AUDIT-ERROR-CODE-ALIGN-001`

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate，已通过。
- `npm run test:mock-local` 是本任务 test_command 的 local/dev 守护，不替代 docker/mock release gate，也不证明 live。
- 本次 review 不声明外部生产 MySQL 或 live OSS/S3 已验证。
- `docs/architecture/constraints.md` 已明确当前 Definition of Done 不要求 live evidence。

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `PITFALL-REVIEW-001`: pitfall - release gate 通过不能替代逐项异常验收 review - suggested - `docs/knowledge/pitfalls/PITFALL-REVIEW-001.md`
- `GUIDELINE-EVIDENCE-001`: guideline - mock/local/docker/live evidence 分层命名 - suggested - `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`
- `GUIDELINE-AUDIT-CONTRACT-001`: guideline - 审计 errorCode 必须由契约枚举守护 - suggested - `docs/knowledge/guidelines/GUIDELINE-AUDIT-CONTRACT-001.md`
