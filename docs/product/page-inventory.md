# 页面/能力清单：统一导出平台

> 当前仓库不建设新的前端页面，因此这里记录的是后端能力入口和样板模块落点。

## 1. 后端能力清单

| Capability ID | 能力 | 入口 | 角色 | 说明 |
| --- | --- | --- | --- | --- |
| api-001 | 创建导出任务 | `POST /api/export/tasks` | 业务用户/业务系统 | 创建异步任务并返回 `taskId`，支持 `clientRequestId` 幂等 |
| api-002 | 查询任务详情/进度 | `GET /api/export/tasks/{taskId}` | 业务用户/管理员 | 查看状态、进度、错误信息 |
| api-003 | 下载导出文件 | `GET /api/export/tasks/{taskId}/download` | 业务用户/管理员 | 返回签名 URL 或流式文件，并携带文件元信息 |
| api-004 | 查询任务历史 | `GET /api/export/tasks` | 业务用户/管理员 | 按正式筛选维度分页查看历史任务与可见性过滤 |
| api-005 | 取消任务 | `POST /api/export/tasks/{taskId}/cancel` | 业务用户/管理员 | 取消 PENDING 或执行中批次边界任务 |
| api-006 | 重试任务 | `POST /api/export/tasks/{taskId}/retry` | 业务用户/管理员 | 重新执行失败任务 |
| api-007 | 注册导出任务 | registry/config APIs | 子系统开发者/管理员 | 注册 taskCode、更新、查询、启停、并发和保留期等配置 |
| api-008 | 查询模板配置 | registry/config APIs | 平台管理员/子系统开发者 | 配置数据源、参数 schema、参数化查询模板、游标字段、排序规则和批大小 |
| api-009 | 字段映射与脱敏策略 | registry/config APIs | 平台管理员/子系统开发者 | 配置字段编码、表头、类型、顺序、导出标记、敏感字段和脱敏策略 |
| api-010 | 文件元信息与校验 | file service / OSS | 平台/运维 | 记录 storageKey、checksum、checksumAlgorithm、contentType、expiresAt 和 attemptNo |
| api-011 | 执行事件追踪 | task event log | 平台/运维 | 记录查询模板、批次、字段校验、文件发布和交付准备事件 |
| job-001 | 调度执行 | Scheduler | 平台 | 轮询、DB 抢锁、租约续期并执行集中查询导出 |
| job-002 | 过期清理 | Cleanup Job | 平台/运维 | 清理过期文件 |
| sdk-001 | 接入方式 | HTTP/Feign | 子系统开发者 | 调用平台任务接口并传递认证上下文和业务查询参数 |

## 2. 接口边界补充

- 历史查询筛选维度限定为 `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode`；新增筛选项必须先回填 PRD 和验收标准。
- 下载签名 URL 模式返回 `downloadUrl`、`expiresAt`、`fileName`、`fileSize`；stream 模式返回文件流和等价文件元信息。
- registry/config APIs 至少覆盖注册创建、更新、查询、启停、并发上限、保留期、单文件行数阈值、最大导出量、支持格式、数据源、参数 schema、查询模板、字段映射和脱敏策略。
- 取消与重试接口必须防重复派发：FAILED 重试保留原 `taskId` 审计链路并递增执行尝试次数，PENDING/EXECUTING 重试返回非法状态错误且不得产生新的执行。
- 认证上下文最小字段为 `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId`；缺少最小字段时不得继续创建、下载或配置操作。
- 对象存储路径默认按 `exports/{subsystemCode}/{taskCode}/{yyyyMMdd}/{taskId}/{attemptNo}/{fileName}` 生成，签名 URL 默认 10 分钟有效，文件校验默认 `SHA-256`。
- 创建任务的幂等范围为 `tenantId + operatorId + taskCode + clientRequestId`；参数摘要一致返回原任务，参数摘要不同返回 `IDEMPOTENCY_CONFLICT`。
- `queryParams` 默认最大 32KB；单文件默认最大 20000 行；单任务默认最大导出量 100000 行，注册配置可收紧。
- 调度锁默认记录 `lockOwner`、`lockExpireAt` 和 `leaseRenewedAt`；锁时间判断以数据库时间为准。
- 锁租约过期后的实例接管延续当前 `attemptNo`，从批次检查点继续；FAILED 重试才递增 `attemptNo`。
- 注册配置变更只对新任务生效；已创建任务和失败重试沿用任务创建时的配置快照。
- 查询执行必须来自任务快照和当前执行尝试，至少包含 `taskId`、`taskCode`、`subsystemCode`、`attemptNo`、`tenantId`、`operatorId`、`roleCodes`、`orgScope`、`requestId`、`dataScopeExpression`、参数摘要和批次游标。
- 查询执行事件至少覆盖 `QUERY_READY`、`QUERY_BATCH_DONE`、`FILE_PART_WRITTEN`、`PACKAGE_DONE`、`FILE_VERIFIED`、`DELIVERY_READY`。
- 文件服务必须支持临时对象和已发布对象分层；下载接口只能返回已发布且校验通过的对象。

## 3. 样板模块

- 样板模块选 `采购订单导出`。
- 落点优先覆盖：创建时间范围、订单状态、供应商、采购组织、关键词、表头、游标字段、敏感字段、空数据、10 万数据压测。
- 默认字段包括订单号、订单状态、供应商、采购组织、采购员、创建时间、总金额、币种和脱敏后的联系人信息。
- 采购订单样板中的 `standby` 分支、`0/1/20000/20001/100000/100001` 边界、registry/config、集中查询模板、OSS、锁、审计、权限都必须能在测试数据和验证矩阵中找到对应入口。
- 样板注册默认值：`taskCode=purchase-order-export`、`subsystemCode=purchase`、`enabled=true`、`singleFileMaxRows=20000`、`defaultExportMaxRows=100000`、`supportedFormats=[XLSX, ZIP]`。
- 样板查询条件：`createdAtRange` 必填，`orderStatus`、`supplierId`、`purchaseOrgId`、`keyword` 可选；`keyword` 匹配订单号、供应商名称或采购员名称。
- 样板字段顺序：`orderNo`、`orderStatus`、`supplierName`、`purchaseOrgName`、`buyerName`、`createdAt`、`totalAmount`、`currency`、`contactName`、`contactPhone`。
- 样板敏感字段：`contactName`、`contactPhone`；平台必须按注册脱敏策略输出脱敏后值并保存校验证据。
- 样板游标字段：优先 `orderId`，必须稳定递增且唯一；如果使用等价游标字段，必须在注册配置中声明。

## 4. 采购订单样板集中查询合同

| 阶段 | 样板要求 | 验收证据 |
| --- | --- | --- |
| 注册配置 | `taskCode=purchase-order-export`、`subsystemCode=purchase`、只读数据源、参数 schema、查询模板版本、字段顺序、敏感字段、支持格式、`cursorField=orderId`、批大小建议 | 注册配置快照 |
| 参数校验 | `createdAtRange` 必填，`orderStatus`、`supplierId`、`purchaseOrgId`、`keyword` 可选 | 创建请求、参数摘要 |
| 查询执行 | 按游标稳定分页返回数据、下一游标、是否还有更多和批次行数 | 批次检查点、查询日志、重试记录 |
| 字段与脱敏 | 按字段映射输出固定表头，联系人姓名和联系人手机号按脱敏策略处理 | 字段校验、脱敏校验证据 |
| 文件生成 | XLSX/ZIP 主路径由平台渲染 | 分片文件、ZIP 清单、文件校验 |

## 5. 执行证据边界

- 创建证据：`clientRequestId`、`idempotencyScope`、`requestDigest`、`taskId`、`configSnapshotDigest`。
- 调度证据：`attemptNo`、`lockOwner`、`lockExpireAt`、`leaseRenewedAt`、抢锁结果和数据库时间。
- 批次证据：`cursorField`、`lastCursor`、`processedCount`、`filePartNo`、`batchSize`、`batchRowCount`、`retryCount`、`backoffMs`。
- 文件证据：`storageKey`、`fileName`、`fileSize`、`contentType`、`checksum`、`checksumAlgorithm`、`attemptNo`。
- 压测证据：10 万行样板导出必须记录总耗时、分片数、锁续租次数、查询重试次数和最终文件校验值。
- 样板证据：`taskCode`、`subsystemCode`、查询条件、字段定义、敏感字段脱敏策略、`cursorField`、边界行数、分片数和 ZIP 文件清单。
