# Requirements Complete Review: FEAT-EXPORT-PLATFORM-001

Verdict: FAIL

## Truth Source

- `docs/product/*` 与 `docs/architecture/constraints.md` 是本次 review 的基准。
- 其中 `docs/product/prd-lite.md`、`docs/product/acceptance-criteria.md`、`docs/product/requirement-interface-matrix.md`、`docs/product/state-matrix.yaml` 定义产品口径、验收口径、接口映射和状态边界。
- `docs/architecture/constraints.md` 定义交付形态、API/worker/DB 边界、测试替身策略和禁止实现。

## 总结

当前实现对大部分 FR、AC 和异常验收已有证据，但存在 6 个 P0/P1 缺口，足以导致 Review 结论为 FAIL。

主要风险集中在：

- 审计 action/result/errorCode 契约漂移，公开契约与真实实现不一致。
- 历史查询管理员全局可见性与产品口径不一致。
- 任务配置快照只保存 digest，执行时仍依赖当前 registry，无法证明旧任务和失败重试沿用原配置快照。
- 查询批次重试策略缺失，短暂失败不能按验收要求进入批次重试成功或重试耗尽链路。
- `DATASOURCE_UNAVAILABLE` 的可执行路径缺失，契约有定义但实现与测试证据不足。
- 对象存储上传/发布失败的错误映射与验收不一致。

## FR 覆盖矩阵

| FR ID | 状态 | 说明 |
| --- | --- | --- |
| FR-001 | covered | 创建任务接口、PENDING 返回和幂等链路已有契约、服务和测试证据。 |
| FR-002 | covered | 任务详情/进度查询有 API、服务和测试映射。 |
| FR-003 | covered | 下载链路、签名 URL/stream 元信息和文件元数据证据已覆盖。 |
| FR-004 | partially_covered | 历史查询筛选维度和同租户权限边界有证据，但管理员全局可见性被 `tenantId` 固定过滤。 |
| FR-005 | covered | 调度和 DB 锁边界已有 worker / repository / test 证据。 |
| FR-006 | covered | 分片、打包和样板批次链路已有证据。 |
| FR-007 | covered | 注册、启停和配置链路已有 API / service / repository 证据。 |
| FR-008 | partially_covered | 集中查询模板、字段映射和脱敏策略有实现与测试，但数据源不可用/批次重试的证据链不完整。 |
| FR-009 | partially_covered | 权限、脱敏和下载保护有覆盖，但审计 result contract drift 影响对外一致性。 |
| FR-010 | gap | 审计动作/结果/错误码契约漂移，导致公开审计契约不可稳定消费。 |
| FR-011 | partially_covered | cleanup 行为有实现证据，但审计 action/result/errorCode 漂移影响验收稳定性。 |
| FR-012 | covered | 取消与重试边界、非法状态错误和 worker 收口已有证据。 |
| FR-013 | partially_covered | 幂等、执行尝试和 DB 锁租约已有证据，但配置快照沿用只保存 digest，旧任务执行仍依赖当前 registry。 |
| FR-014 | covered | 采购订单样板的集中查询合同、样板链路和压测边界已有证据。 |

## AC 覆盖矩阵

| AC ID | 状态 | 说明 |
| --- | --- | --- |
| AC-001 | covered | 创建任务 1 秒返回 taskId、PENDING 状态的证据齐备。 |
| AC-002 | covered | 任务状态、总数、已处理数、进度和错误信息可查询。 |
| AC-003 | covered | 下载响应、文件元信息和过期前下载保护有证据。 |
| AC-004 | gap | 历史分页筛选有证据，但管理员按权限查看全局未按产品口径落实。 |
| AC-005 | covered | 同子系统并发控制有 scheduler / lease 证据。 |
| AC-006 | covered | 超阈值分片打包和空数据表头文件已覆盖。 |
| AC-007 | covered | 注册创建、更新、查询、启停和配置同步已有证据。 |
| AC-008 | covered | 集中查询模板、schema、字段映射、脱敏策略和数据源约束有证据。 |
| AC-009 | covered | 无权限创建或下载返回 403 并记录审计。 |
| AC-010 | gap | 审计日志契约 drift 导致创建、执行、失败、下载、取消、重试的追溯字段不稳定。 |
| AC-011 | partially_covered | 过期标记、不可下载和清理失败记录有链路，但结果口径仍受审计 drift 影响。 |
| AC-012 | covered | PENDING 可取消、FAILED 可重试、EXECUTING 批次边界收口有证据。 |
| AC-013 | covered | taskId 串联幂等、执行尝试、锁租约和快照证据可追踪。 |
| AC-014 | covered | 幂等范围和参数摘要一致/冲突行为有证据。 |
| AC-015 | covered | attemptNo、lockOwner、lockExpireAt 和租约续租证据存在。 |
| AC-016 | gap | 当前任务只保存 `configSnapshotDigest`，执行时读取当前 registry 并做 digest 相等校验，无法证明旧任务和失败重试沿用原完整配置快照。 |
| AC-017 | covered | 采购订单样板注册与查询条件、字段和格式契约已覆盖。 |
| AC-018 | covered | 0/1/20000/20001/100000/100001 边界证据已覆盖。 |
| AC-019 | partially_covered | 批次检查点、重试和失败上下文有证据，但批次重试耗尽与短暂失败成功链路不完整。 |
| AC-020 | covered | 阶段事件链路可追踪。 |
| AC-021 | covered | 临时对象到已发布对象的交付模型和校验失败处置有证据。 |

## AC-E 覆盖矩阵

| AC-E ID | 状态 | 说明 |
| --- | --- | --- |
| AC-E001 | covered | 空数据生成仅表头文件。 |
| AC-E002 | covered | 未注册任务创建失败，不落无效任务。 |
| AC-E003 | covered | 任务禁用返回 `TASK_DISABLED`。 |
| AC-E004 | gap | 短暂失败后重试成功缺少明确 retry loop 证据，当前无法证明按批次重试策略完成。 |
| AC-E005 | partially_covered | object storage put/publish 错误被映射为 `EXPORT_RENDER_ERROR`，与验收要求的 `FILE_VERIFY_ERROR` 不一致。 |
| AC-E006 | covered | 权限不足返回 403。 |
| AC-E007 | covered | 文件过期返回 410 或等价失效结果。 |
| AC-E008 | covered | 多实例重复抢锁仅一个实例成功执行。 |
| AC-E009 | covered | 请求参数过长返回 400。 |
| AC-E010 | covered | 超大导出按配置拒绝或进入更严格控制流。 |
| AC-E011 | covered | 查询模板不存在或不合法收口为 `QUERY_TEMPLATE_INVALID`。 |
| AC-E012 | gap | `DATASOURCE_UNAVAILABLE` 仅有契约定义，缺少 src/tests 可执行路径。 |
| AC-E013 | partially_covered | 查询执行失败最终 FAILED / `QUERY_EXECUTION_ERROR` 有证据，但按批次重试策略处理的 retry loop 缺失，与 RCR-002 一致。 |
| AC-E014 | covered | 字段映射不合法收口为 `FIELD_MAPPING_INVALID`。 |
| AC-E015 | covered | 非法或重复重试请求返回非法状态错误。 |
| AC-E016 | covered | 认证上下文缺少最小字段可返回权限/参数错误并记录 requestId。 |
| AC-E017 | covered | 文件校验值不匹配拒绝交付并进入失败处置链路。 |
| AC-E018 | covered | 幂等键冲突返回 `IDEMPOTENCY_CONFLICT`。 |
| AC-E019 | partially_covered | 锁租约过期接管、attemptNo 延续和批次检查点有证据，但失败/重试/接管混合场景的完整链路仍有缺口。 |
| AC-E020 | gap | 查询批次重试耗尽无明确 retry loop 和耗尽测试路径。 |
| AC-E021 | covered | 超过默认最大导出量的拒绝/更严格控制流有证据。 |
| AC-E022 | partially_covered | 采购订单样板敏感字段脱敏有覆盖，但审计 drift 影响证据稳定性。 |
| AC-E023 | partially_covered | 游标不稳定有查询层测试与契约证据，但批次/重试耗尽场景仍不完整。 |
| AC-E024 | gap | 快照冲突现在直接按当前 registry digest 不一致失败，缺少沿用创建时完整配置快照后的冲突判定证据。 |
| AC-E025 | partially_covered | 批次字段/顺序/脱敏校验有实现痕迹，但与重试和失败收口的证据不完全。 |
| AC-E026 | partially_covered | 文件发布前失败不会生成下载地址，但 put/publish 失败错误码映射为 `EXPORT_RENDER_ERROR`，与产品要求的 `FILE_VERIFY_ERROR` 不一致。 |
| AC-E027 | partially_covered | `EXPORT_RENDER_ERROR` 有实现映射，但缺少明确 XLSX/ZIP 渲染失败测试。 |

## Findings

### RCR-001

- Severity: P0
- Title: audit action/result/errorCode contract drift
- Evidence:
  - `docs/product/prd-lite.md` 要求审计动作至少覆盖 `EXPIRE_MARK`、`CLEANUP_FAILED`。
  - `contracts/openapi.yaml` 的 `AuditEvent.action` 枚举包含 `REGISTRY_QUERY`、`EXPIRE_MARK`、`CLEANUP_FAILED`，`result` 枚举为 `SUCCESS` / `FAILED` / `ACCEPTED`。
  - `src/task-api/service.ts` 与 `src/registry-config/service.ts` 在拒绝审计时写入 `FAILURE`。
  - `src/registry-config/service.ts` 使用 `REGISTRY_LIST`。
  - `src/cleanup-job/index.ts` 使用 `CLEANUP_DELETE` 与 `FILE_CLEANUP_DELETE_ERROR`。
  - `tests/worker/scheduler-worker.test.mjs` 断言 `CLEANUP_DELETE`。
- Risk: FR-010 / AC-010 的审计契约无法稳定消费，公开契约与真实审计实现不一致，后续查询、归档和联调都会出现口径漂移。
- Suggested next task id: `AUDIT-CONTRACT-ALIGN-001`

### RCR-002

- Severity: P0
- Title: admin global task history visibility missing
- Evidence:
  - `docs/product/acceptance-criteria.md` 的 `AC-004` 要求普通用户仅看本人任务，管理员按权限查看全局。
  - `src/task-api/service.ts:373-383` 的 `listExportTasks()` 固定传入 `tenantId: auth.tenantId`，管理员也无法跨租户查看全局。
  - `tests/api/export-http-api.test.mjs:412-423` 明确断言跨租户管理员查询不到其他租户任务。
- Risk: FR-004 / AC-004 的管理员全局历史查询合同未实现，跨租户或全局运营场景会被错误过滤；如果产品实际只允许同租户全局，需要回写产品真相源收窄口径。
- Suggested next task id: `TASK-HISTORY-ADMIN-SCOPE-001`

### RCR-003

- Severity: P0
- Title: config snapshot replay missing
- Evidence:
  - `docs/product/acceptance-criteria.md` 的 `AC-016` 要求配置变更只影响新创建任务，已创建任务和失败重试沿用原任务配置快照。
  - `src/task-api/service.ts` 创建任务时保存 `configSnapshotDigest`，但未持久化完整 registry/query/mapping/masking 快照。
  - `src/query-executor/index.ts:87-96` 执行时读取当前 registry，并在 digest 不一致时直接 `QUERY_TEMPLATE_INVALID`，这更像“发现配置变更后失败”，不是沿用原快照。
  - `tests/query/query-executor.test.mjs` 未覆盖“创建后 registry 更新，旧任务/失败重试仍按旧快照执行”的场景。
- Risk: FR-013 / AC-016 / AC-E024 的快照隔离无法证明，配置变更可能破坏已创建任务或失败重试的执行口径。
- Suggested next task id: `CONFIG-SNAPSHOT-REPLAY-001`

### RCR-004

- Severity: P0
- Title: query batch retry policy missing
- Evidence:
  - `docs/product/acceptance-criteria.md` 的 `AC-E004`、`AC-E020` 明确要求短暂失败重试成功和批次重试耗尽。
  - `src/scheduler/worker.ts` 的 `processAcquiredLease` 在 `catch` 中直接 `markTaskTerminal` 为 `FAILED` 并写 `EXECUTE_FAILED`。
  - `tests/query/query-executor.test.mjs` 只覆盖 `retryCount=0` 和错误直接 reject，没有短暂失败重试成功或重试耗尽测试。
- Risk: 短暂数据源/查询失败无法按产品口径重试，FR-008 / FR-010 / FR-013 的证据不足，批次级恢复能力不可验证。
- Suggested next task id: `QUERY-BATCH-RETRY-001`

### RCR-005

- Severity: P0
- Title: datasource unavailable execution path missing
- Evidence:
  - `contracts/openapi.yaml` 定义了 `DATASOURCE_UNAVAILABLE`。
  - `src/query-executor/index.ts` 没有 `DATASOURCE_UNAVAILABLE` 分支，仅记录 `datasourceCode` 并在 SQL 错误时走 `queryExecutionError`。
  - `tests/query/query-executor.test.mjs` 没有 `DATASOURCE_UNAVAILABLE` 场景。
- Risk: 只读数据源或凭证不可用时无法按 `AC-E012` 收口，实际可能被误归类为 `QUERY_EXECUTION_ERROR`，影响 FR-008 的异常合同。
- Suggested next task id: `DATASOURCE-ADAPTER-ERROR-001`

### RCR-006

- Severity: P1
- Title: object storage upload/publish failure error mapping partial
- Evidence:
  - `docs/product/acceptance-criteria.md` 的 `AC-E005` 要求 OSS 上传失败收口为 `FILE_VERIFY_ERROR`。
  - `src/file-service/index.ts` 将 `putObject` / `publishObject` 失败映射为 `EXPORT_RENDER_ERROR`，而 `read` / checksum 失败才映射为 `FILE_VERIFY_ERROR`。
  - `tests/file/export-file-service.test.mjs` 只覆盖 checksum `FILE_VERIFY_ERROR`，未覆盖 put/publish 失败映射。
- Risk: 文件依赖失败错误码与验收口径不一致，外部调用方会收到不同于产品要求的错误分类。
- Suggested next task id: `FILE-STORAGE-ERROR-MAPPING-001`

## Evidence Boundary

- `RELEASE-001` 是 docker/mock release gate。
- 本次 review 不得声明外部生产 MySQL 或 live OSS/S3 已验证。
- `docs/architecture/constraints.md` 已明确当前 release gate 不要求 live evidence，外部 live 验证不属于本次完成条件。

## Knowledge References

- `DECISION-HARNESS-001`: Harness 从执行闭环扩展为知识闭环 - used_in: review 输出 knowledge references/outputs - `docs/knowledge/decisions/DECISION-HARNESS-001.md`
- `GUIDELINE-RULES-001`: 规则必须短入口、深文档、可验证 - used_in: review 以 truth source 和验证边界给出 findings - `docs/knowledge/guidelines/GUIDELINE-RULES-001.md`

## Knowledge Outputs

- `PITFALL-REVIEW-001`: draft, “release gate 通过不能替代逐项异常验收 review”, target `docs/knowledge/pitfalls/PITFALL-REVIEW-001.md`
- `GUIDELINE-EVIDENCE-001`: draft, “mock/local/docker/live evidence 分层命名”, target `docs/knowledge/guidelines/GUIDELINE-EVIDENCE-001.md`

## Remaining Risks

- 外部 live MySQL 和 live OSS/S3 不属于当前完成条件。
- 真实依赖验证需要另开任务，不能用当前 docker/mock release gate 直接替代。
