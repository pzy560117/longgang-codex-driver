# Difficulty Research：统一导出平台

> 编码前对关键方案做默认决策收敛。本文件保留归档中的核心难点，但按集中查询方案重新组织。

## 1. 难点总览

| Difficulty ID | 难点 | 影响范围 | 风险等级 | 默认决策 |
| --- | --- | --- | --- | --- |
| DR-001 | 子系统接入方式 | create API / auth context | High | 子系统只提交任务和上下文 |
| DR-002 | 数据源访问边界 | datasource registry / credentials | High | 只读账号 + 数据源白名单 |
| DR-003 | 查询模板安全 | query template / parameter schema | High | 参数化模板 + 参数白名单，禁止原始 SQL |
| DR-004 | 权限与数据范围 | auth context / data scope | High | 平台做操作权限、任务可见性和查询数据范围约束 |
| DR-005 | 大数据量导出性能 | query executor / cursor paging | High | 游标分页 + 流式写入 |
| DR-006 | 字段映射与脱敏 | field mapping / masking policy | High | 平台统一字段映射、脱敏和结果校验 |
| DR-007 | 文件生成与交付 | renderer / OSS | Medium | XLSX/ZIP 平台渲染，临时对象校验后发布 |
| DR-008 | 多实例重复执行 | scheduler / lock | High | DB 原子抢锁 + 租约续期 |
| DR-009 | 进度准确性 | progress API / query executor | Medium | 有精确总量则展示百分比，否则展示已处理数和执行状态 |
| DR-010 | 取消执行中任务 | cancel / worker | Medium | PENDING 立即取消，EXECUTING 批次边界取消 |
| DR-011 | 创建幂等与重复提交 | create API / task | High | `clientRequestId` + 参数摘要防重复创建 |
| DR-012 | 配置变更与执行口径漂移 | registry / worker | Medium | 创建任务时固化配置快照 |
| DR-013 | 锁租约、续租与实例故障 | scheduler / worker | High | `lockOwner + lockExpireAt` 租约，数据库时间判定 |
| DR-014 | 查询超时与批次重试 | query executor / worker | Medium | 查询超时 30 秒，批次最多 3 次指数退避 |
| DR-015 | 查询上下文与排查 | query executor / audit / logs | Medium | 任务快照、查询模板版本、数据源编码和批次检查点串联 |
| DR-016 | 文件发布一致性 | file service / OSS / download | High | 临时对象写入，校验通过后发布，下载只暴露已发布对象 |

## 2. 结论摘要

- 一期不引入 MQ 作为主调度依赖。
- 一期不做审批流。
- 平台主线优先保证任务、调度、下载、审计闭环。
- 平台以独立微服务运行，不直接加载业务子系统 JAR。
- 子系统只提交任务和认证上下文，不实现导出数据拉取或文件生成扩展点。
- 平台访问业务只读数据源或数据中台，执行参数化查询模板。
- 查询模板、字段映射、脱敏策略、游标字段和数据范围约束由注册配置统一管理。
- 一期只支持 XLSX/ZIP。
- 平台不得执行调用方传入的原始 SQL。
- `count` 可由查询模板提供精确总数；不支持精确统计时不作为失败，平台降级为仅展示已处理数和执行状态。
- 历史查询筛选维度先收敛为 `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode`，避免测试层先行扩散。
- registry/config 覆盖注册、启停、并发、保留期、单文件行数、最大导出量、支持格式、数据源、参数 schema、查询模板、字段映射和脱敏策略。
- 取消和重试以“防重复派发、保留审计链路”为边界：FAILED 重试递增执行尝试次数，PENDING/EXECUTING 重试不派发执行，EXECUTING 取消只在批次边界收口。
- 认证上下文最小字段锁定为 `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId`，平台据此执行任务可见性、操作权限、下载权限和查询数据范围约束。
- 文件存储以环境 bucket + 规范化 path 组合实现：bucket 可配置，path 默认 `exports/{subsystemCode}/{taskCode}/{yyyyMMdd}/{taskId}/{attemptNo}/{fileName}`，签名 URL 默认 10 分钟，校验算法默认 `SHA-256`。
- 创建任务支持 `clientRequestId` 幂等；相同幂等范围和相同参数摘要返回原 `taskId`，参数摘要不同返回冲突。
- 任务执行以 `attemptNo` 隔离；失败重试递增执行尝试，输出文件、审计和错误原因都必须保留历史证据。
- 调度锁以数据库时间判断租约有效性，默认 5 分钟租约并在批次边界续租。
- 锁租约过期后的实例接管延续当前 `attemptNo` 并从批次检查点继续；FAILED 重试才递增 `attemptNo`。
- 注册配置变更只影响新任务；已创建任务和失败重试沿用创建时的配置快照。
- `queryParams` 默认最大 32KB，单任务默认最大导出量 100000 行，超过阈值需拒绝或进入更严格控制流。
- 查询执行必须携带任务快照、执行尝试上下文、查询模板版本、数据源编码和当前批次游标，避免隐式会话或临时全局变量。
- 文件写入与下载交付之间必须有发布边界：未校验或未发布的临时对象不得被下载接口返回。
- 平台必须记录关键执行阶段事件，作为调度、查询、文件和下载链路的统一排查骨架。

## 3. 样板模块

- 样板模块建议选 `采购订单导出`。
- 样板模块应提供稳定游标字段、字段顺序、敏感字段清单、查询条件示例和压测数据。
- 样板查询条件覆盖创建时间范围、订单状态、供应商、采购组织和关键词。
- 样板默认字段覆盖订单号、订单状态、供应商、采购组织、采购员、创建时间、总金额、币种和脱敏后的联系人信息。
- 样板验证边界覆盖 `0/1/20000/20001/100000/100001` 行数据、空数据仅表头、分片 ZIP、权限不足、文件过期、重复重试和执行中取消。
- 样板注册配置必须包含 datasourceCode、queryTemplateVersion、参数 schema、字段映射、脱敏策略、cursorField=orderId 和 supportedFormats=[XLSX, ZIP]。
- 查询模板按 orderId 或等价唯一游标稳定递增返回数据。
- contactName、contactPhone 由平台按脱敏策略输出脱敏后值。
- XLSX/ZIP 主路径由平台渲染，超过 20000 行自动分片并打包。

## 4. 集中查询错误收口

| 场景 | 对外状态 | 错误码 | 说明 |
| --- | --- | --- | --- |
| 查询模板不存在或不合法 | `FAILED` | `QUERY_TEMPLATE_INVALID` | 记录模板版本和配置摘要 |
| 数据源不可用或凭证不可用 | `FAILED` | `DATASOURCE_UNAVAILABLE` | 记录数据源编码和连接失败原因 |
| 查询执行失败 | `FAILED` | `QUERY_EXECUTION_ERROR` | 可重试性由平台批次策略判断 |
| 查询批次重试耗尽 | `FAILED` | `QUERY_EXECUTION_ERROR` | 记录重试次数和退避时间 |
| 字段映射不合法 | `FAILED` | `FIELD_MAPPING_INVALID` | 记录字段映射摘要和缺失字段 |
| 批次字段、顺序或脱敏结果不合法 | `FAILED` | `FIELD_MAPPING_INVALID` 或 `MASKING_RULE_ERROR` | 停止写入后续批次 |
| 脱敏规则配置或执行失败 | `FAILED` | `MASKING_RULE_ERROR` | 记录脱敏校验失败证据 |
| 文件渲染失败 | `FAILED` | `EXPORT_RENDER_ERROR` | 记录渲染输入摘要和失败原因 |
| OSS 上传失败 | `FAILED` | `FILE_VERIFY_ERROR` | 记录对象存储写入失败原因和临时对象定位或清理记录 |
| 文件发布前校验失败 | `FAILED` | `FILE_VERIFY_ERROR` | 不生成下载地址 |
| 采购订单游标缺失、重复或非递增 | `FAILED` | `QUERY_EXECUTION_ERROR` | 保留批次检查点和游标证据 |

## 5. 调度与幂等默认值

| 项目 | 默认值 | 说明 |
| --- | --- | --- |
| 创建幂等范围 | `tenantId + operatorId + taskCode + clientRequestId` | 防止调用方超时重试造成重复任务 |
| 参数摘要 | 规范化后的 `queryParams + fileFormat + taskCode` 摘要 | 同一幂等键但摘要不同返回 `IDEMPOTENCY_CONFLICT` |
| 锁租约 | 5 分钟 | worker 在批次边界续租，过期后其他实例可抢占 |
| 锁接管 | 延续当前 `attemptNo` | 从批次检查点继续，避免租约过期被误记为失败重试 |
| 时间来源 | 数据库时间 | 避免多实例本机时钟漂移 |
| 查询超时 | 30 秒 | 单批查询执行的默认超时 |
| 查询批次重试 | 最多 3 次指数退避 | 重试耗尽后映射 `QUERY_EXECUTION_ERROR` |
| 配置快照 | 创建任务时固化 | 已创建任务和失败重试默认沿用原快照 |
| 默认导出上限 | 100000 行 | 注册配置可收紧，放宽需有明确配置和审计 |
| 文件发布模型 | 临时对象 -> 校验 -> 已发布对象 | 下载接口只能返回已发布且校验通过的文件 |
| 执行阶段事件 | 六个关键阶段事件 | 覆盖查询、批次、文件、校验和交付准备 |
