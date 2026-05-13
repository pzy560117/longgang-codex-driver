# Requirement Interface Matrix：统一导出平台

> 用于把需求映射到后端 API、调度能力、状态和证据路径。

## 1. 需求到能力映射

| Requirement ID | 需求摘要 | 对应能力 | 状态 | 验收入口 |
| --- | --- | --- | --- | --- |
| FR-001 | 创建导出任务 | `POST /api/export/tasks` | PENDING | AC-001 |
| FR-002 | 查询任务详情/进度 | `GET /api/export/tasks/{taskId}` | PENDING / EXECUTING / COMPLETED / FAILED | AC-002 |
| FR-003 | 下载导出文件 | `GET /api/export/tasks/{taskId}/download` | COMPLETED / EXPIRED | AC-003 |
| FR-004 | 查询任务历史 | `GET /api/export/tasks` | default / empty / permission_denied | AC-004 |
| FR-005 | 调度和并发控制 | Scheduler + DB lock | PENDING / EXECUTING | AC-005 |
| FR-006 | 大数据分片导出 | Worker + file service | EXECUTING / COMPLETED | AC-006 |
| FR-007 | 注册导出任务 / 启停 / 配置 | `POST /api/export/registries` + registry/config APIs | default / disabled / permission_denied | AC-007 |
| FR-008 | 集中查询模板契约 | registry/config + datasource/query template | default / invalid_template / datasource_error / query_error | AC-008 |
| FR-009 | 权限、脱敏、签名 | auth + data scope + masking + download guard | permission_denied / masking_error | AC-009 |
| FR-010 | 审计与失败追踪 | audit log + task event log | all | AC-010 |
| FR-011 | 过期清理 | cleanup job | EXPIRED | AC-011 |
| FR-012 | 取消和重试 | cancel/retry API | CANCELED / PENDING / FAILED | AC-012 |
| FR-013 | 幂等、执行尝试、锁租约和配置快照 | create API + Scheduler + task snapshot | default / conflict / processing / error | AC-013 / AC-014 / AC-015 / AC-016 |
| FR-014 | 采购订单导出样板 | purchase-order query template + platform export flow | default / empty / long_content / error | AC-017 / AC-018 / AC-E022 / AC-E023 |
| FR-008/FR-010/FR-013 | 查询执行上下文与追踪 | query executor + task event log | default / error | AC-019 / AC-020 |
| FR-003/FR-006/FR-011 | 文件临时对象、发布和校验 | file service / OSS | default / error / expired | AC-021 / AC-E026 |

## 2. 反查说明

- 平台负责任务、调度、下载、审计、注册启停、配置同步、集中查询、字段映射、脱敏、文件生成和清理。
- 子系统只负责调用平台任务接口，传递认证上下文和符合注册参数 schema 的业务查询参数。
- 下载能力默认签名 URL，必要场景支持流式下载；两种模式都必须携带文件元信息。
- `FR-004` 历史查询的正式筛选维度为 `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode`；测试层如已先出现更细筛选项，应标记为分析阶段假设而不是既定事实。
- `FR-008` 查询模板契约由注册配置声明数据源、参数 schema、参数化查询模板、字段映射、脱敏策略、数据范围约束、游标字段、排序规则、批大小、行数阈值、保留期和支持格式。
- `FR-012` 取消与重试边界为：PENDING 可取消，FAILED 可重试，EXECUTING 取消按批次边界收口；PENDING/EXECUTING 重试返回非法状态错误且不得重复派发执行。
- `FR-013` 要求创建幂等、执行尝试、锁租约和配置快照形成同一条审计链路；配置变化不得改变已创建任务的执行口径。
- `FR-014` 是一期样板模块合同，不新增平台特例逻辑；它用于证明标准 registry、集中查询模板、调度、文件、权限、审计和下载链路能被一个业务场景完整验证。

## 3. 接口证据字段

| 需求 | 最小证据字段 / 行为 | 说明 |
| --- | --- | --- |
| FR-003 | `downloadUrl`、`expiresAt`、`fileName`、`fileSize` 或等价 stream 元信息 | 用于证明下载保护和文件元信息可追踪 |
| FR-004 | `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode` | 正式历史查询筛选维度 |
| FR-007 | `taskCode` 唯一、`enabled`、并发上限、保留期、单文件行数阈值、最大导出量、支持格式策略 | 注册配置必须能被查询和同步 |
| FR-008 | `datasourceCode`、`queryTemplateVersion`、`parameterSchemaDigest`、`fieldMappingDigest`、`maskingPolicyDigest`、`cursorField` | 用于证明集中查询模板、字段映射和脱敏策略可追溯 |
| FR-009 | `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId`、`dataScopeExpression` | 统一认证上下文和数据范围约束最小字段 |
| FR-010 | `taskId`、`taskCode`、`subsystemCode`、`operatorId`、`action`、`result`、`errorCode`、`requestId`、发生时间 | 审计日志最小字段 |
| FR-012 | `attemptNo` 或等价执行尝试序号、内部取消标记、最终状态 | 用于证明重试不丢审计链路、取消不暴露内部状态 |
| FR-013 | `clientRequestId`、`idempotencyScope`、`requestDigest`、`configSnapshotDigest`、`attemptNo`、`lockOwner`、`lockExpireAt`、`leaseRenewedAt` | 用于证明幂等、防重复执行、配置快照和锁租约行为 |
| FR-006/FR-013 | `cursorField`、`lastCursor`、`processedCount`、`filePartNo`、`batchSize`、`batchRowCount`、`retryCount`、`backoffMs` | 用于证明游标分页、锁接管、批次执行和查询重试证据 |
| FR-014 | `taskCode=purchase-order-export`、`subsystemCode=purchase`、`datasourceCode`、`queryTemplateVersion`、`createdAtRange`、`orderStatus`、`supplierId`、`purchaseOrgId`、`keyword`、字段定义、敏感字段脱敏策略、`cursorField=orderId` | 用于证明采购订单样板集中查询合同可执行 |
| FR-008/FR-010/FR-013 | `taskId`、`attemptNo`、`requestId`、`queryTemplateVersion`、`datasourceCode`、`batchCheckpoint` | 用于证明查询执行上下文和审计串联 |
| FR-003/FR-011 | `tempStorageKey`、`publishedStorageKey`、`checksum`、`checksumVerifiedAt`、`publishedAt`、`deliveryReadyAt` | 用于证明临时对象、发布对象、校验和下载准备状态可追踪 |

## 4. 错误映射

| 场景 | 对外状态 | 错误码 | 验收入口 |
| --- | --- | --- | --- |
| 查询模板不存在或不合法 | `FAILED` | `QUERY_TEMPLATE_INVALID` | AC-E011 |
| 数据源不可用或凭证不可用 | `FAILED` | `DATASOURCE_UNAVAILABLE` | AC-E012 |
| 查询执行失败 | `FAILED` | `QUERY_EXECUTION_ERROR` | AC-E013 |
| 查询批次重试耗尽 | `FAILED` | `QUERY_EXECUTION_ERROR` | AC-E020 |
| 查询模板或字段映射与任务快照冲突 | `FAILED` | `QUERY_TEMPLATE_INVALID` 或 `FIELD_MAPPING_INVALID` | AC-E024 |
| 字段映射不合法 | `FAILED` | `FIELD_MAPPING_INVALID` | AC-E014 |
| 批次字段、顺序或脱敏结果不合法 | `FAILED` | `FIELD_MAPPING_INVALID` 或 `MASKING_RULE_ERROR` | AC-E025 |
| 脱敏规则配置或执行失败 | `FAILED` | `MASKING_RULE_ERROR` | AC-E022 |
| 文件渲染失败 | `FAILED` | `EXPORT_RENDER_ERROR` | AC-E027 |
| OSS 上传失败 | `FAILED` | `FILE_VERIFY_ERROR` | AC-E005 |
| 文件发布前校验失败 | `FAILED` | `FILE_VERIFY_ERROR` | AC-E026 |
| 采购订单游标缺失、重复或非递增 | `FAILED` | `QUERY_EXECUTION_ERROR` | AC-E023 |

## 5. 缺口

| Gap ID | 缺口 | 处理方式 |
| --- | --- | --- |
| GAP-001 | 样板模块字段与表头 | 采购订单导出样板覆盖订单号、订单状态、供应商、采购组织、采购员、创建时间、总金额、币种和脱敏后的联系人信息 |
| GAP-002 | 统一认证上下文字段 | 最小字段锁定为 `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId`；联调只确认字段来源和透传方式 |
| GAP-003 | 查询性能基线 | 采购订单样板以 10 万行导出作为基线证据，记录总耗时、批大小、分片数和查询重试情况 |
| GAP-004 | OSS bucket/path、签名有效期和文件校验值生成方式 | bucket 由环境配置；path 默认 `exports/{subsystemCode}/{taskCode}/{yyyyMMdd}/{taskId}/{attemptNo}/{fileName}`；签名 URL 默认 10 分钟；校验默认 `SHA-256` |
| GAP-005 | 采购订单样板合同是否足够驱动实现和测试 | 已锁定 taskCode、subsystemCode、查询条件、字段顺序、敏感字段、游标字段、边界数据和压测证据 |
