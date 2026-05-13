# Architecture Brief：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13

## 1. 架构目标

- 以独立微服务交付统一导出平台。
- 子系统通过 HTTP/Feign 提交任务和认证上下文，不直接加载业务 JAR。
- 平台通过注册配置驱动集中查询、字段映射、脱敏、渲染、调度、审计和清理。
- 平台后端按“任务入口、注册配置、调度执行、查询执行、文件交付、清理作业、审计链路”分层，避免把调度、查询和文件逻辑耦合在单一服务类中。

## 2. 核心边界

| 边界 | 约束 | 说明 |
| --- | --- | --- |
| 认证边界 | 平台不提供登录认证，只消费透传上下文 | 最小字段为 `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId` |
| 数据边界 | 只允许访问注册配置声明的只读数据源或数据中台 | 不得执行原始 SQL |
| 调度边界 | MySQL 轮询 + DB 抢锁 | 锁租约默认 5 分钟，时间判断以数据库时间为准 |
| 执行边界 | 游标分页 + 批次边界续租 | 锁接管延续当前 `attemptNo` |
| 文件边界 | 临时对象先写，校验通过后发布 | 下载只返回已发布对象 |
| 配置边界 | 创建任务时固化配置快照 | 已创建任务与失败重试沿用快照 |
| 审计边界 | 创建、执行、下载、取消、重试、清理都必须留痕 | 必须能通过 `taskId`、`attemptNo`、`requestId` 串联 |

## 3. 后端模块划分

| 模块 | 责任边界 | 主要协作对象 | 实现落点 |
| --- | --- | --- | --- |
| `task-api` | 创建任务、查进度、查历史、下载、取消、重试 | `registry-config`、`audit-log`、`file-service` | API 层只做请求校验、权限校验、幂等判断和状态机入口，不承载查询或渲染实现 |
| `registry-config` | 注册任务、启停、配置查询、配置同步 | `task-api`、`query-executor`、`scheduler` | 保存 taskCode、enabled、并发上限、保留期、单文件阈值、最大导出量、支持格式、数据源、查询模板、字段映射、脱敏策略 |
| `scheduler` | MySQL 轮询、DB 抢锁、租约续租、实例接管、并发控制 | `task-api`、`query-executor` | 仅负责挑选待执行任务并推进执行实例，不直接负责字段映射和文件渲染 |
| `query-executor` | 参数化集中查询、游标分页、批次检查点、数据范围约束 | `registry-config`、`file-service`、`audit-log` | 负责从注册配置读取模板、游标字段、排序规则和参数 schema，并按批次输出数据 |
| `file-service` | 文件分片、XLSX/ZIP 渲染、临时对象写入、发布前校验、下载元信息 | `query-executor`、`cleanup-job`、`task-api` | 文件生成采用临时对象 -> 校验 -> 发布对象的两段式模型 |
| `cleanup-job` | 过期标记、对象清理、失败重试记录 | `file-service`、`task-api` | 先让文件或任务不可下载，再删除对象存储资源 |
| `audit-log` | 审计事件、阶段事件、失败原因、下载日志 | `task-api`、`scheduler`、`query-executor`、`file-service`、`cleanup-job` | 统一记录链路证据，保证 taskId、attemptNo、requestId 可串联 |
| `sample-purchase-order` | 采购订单样板合同 | `registry-config`、`query-executor`、`file-service` | 作为 FR-014 的可执行样板，不引入平台特例实现 |

## 4. FR 证据入口与落点

| FR | 证据入口 | 风险边界 | 后续落点 |
| --- | --- | --- | --- |
| FR-001 | `AC-001`、`AC-E002`、`AC-E003`、`AC-E009`、`state-matrix.yaml` | 注册校验、权限、幂等、参数上限 | `contracts/` 创建接口，`tests/` 创建与幂等测试 |
| FR-002 | `AC-002`、`AC-010`、`state-matrix.yaml` | 进度口径、状态枚举、错误字段 | `contracts/` 详情接口，`tests/` 进度和审计测试 |
| FR-003 | `AC-003`、`AC-E007`、`AC-E017`、`AC-021` | 临时对象/已发布对象边界、下载保护、文件元信息 | `contracts/` 下载和文件元信息契约，`tests/` 文件发布测试 |
| FR-004 | `AC-004`、`requirement-interface-matrix.md` | 正式筛选维度、可见性、分页 | `contracts/` 历史查询契约，`tests/` 列表筛选测试 |
| FR-005 | `AC-005`、`AC-015`、`AC-E008`、`AC-E019` | DB 时间、租约、接管、并发上限 | `contracts/` 调度/锁契约，`tests/` 抢锁测试 |
| FR-006 | `AC-006`、`AC-020`、`AC-E001`、`AC-E004`、`AC-E018` | 游标分页、批次事件、分片/ZIP、空数据 | `contracts/` 执行事件与文件契约，`tests/` 分片测试 |
| FR-007 | `AC-007`、`AC-016`、`page-inventory.md` | taskCode 唯一、启停、快照沿用 | `contracts/` registry/config 契约，`tests/` 注册测试 |
| FR-008 | `AC-008`、`AC-E011`、`AC-E012`、`AC-E013`、`AC-E014`、`AC-E024`、`AC-E025` | 原始 SQL 禁止、参数白名单、字段映射、脱敏和数据范围 | `contracts/` 集中查询契约，`tests/` 契约与错误收口测试 |
| FR-009 | `AC-009`、`AC-E006`、`AC-E016`、`AC-E022` | 认证上下文最小字段、下载 guard、脱敏失败 | `contracts/` 认证上下文与脱敏契约，`tests/` 权限测试 |
| FR-010 | `AC-010`、`AC-019`、`AC-020` | taskId/requestId 串联、阶段事件完整性 | `contracts/` 审计与事件契约，`tests/` 日志串联测试 |
| FR-011 | `AC-011`、`AC-E026` | 先失效再删除、可重试记录 | `contracts/` 清理作业契约，`tests/` 清理测试 |
| FR-012 | `AC-012`、`AC-E015` | 批次边界取消、FAILED 才可重试、禁止重复派发 | `contracts/` 取消/重试契约，`tests/` 状态机测试 |
| FR-013 | `AC-013`、`AC-014`、`AC-015`、`AC-016`、`AC-019` | attemptNo、幂等冲突、锁接管、配置快照 | `contracts/` 创建/快照契约，`tests/` 幂等和接管测试 |
| FR-014 | `AC-017`、`AC-018`、`AC-E022`、`AC-E023` | 样板字段、游标稳定性、压测、敏感字段脱敏 | `contracts/` 样板契约，`tests/` 样板与压测测试 |

## 5. 关键实现落点

### 5.1 任务入口

- 创建任务时必须固化 `requestDigest`、`configSnapshotDigest`、注册配置快照和认证上下文摘要。
- `clientRequestId` 幂等范围固定为 `tenantId + operatorId + taskCode + clientRequestId`。
- 历史查询、详情查询和下载接口都必须重新执行权限校验，不允许只依赖创建时校验结果。

### 5.2 调度与 DB 抢锁

- `scheduler` 只负责调度和实例接管，不负责业务查询语义。
- 抢锁必须使用数据库时间判定 `lockExpireAt`，避免机器时钟漂移。
- 默认锁租约为 5 分钟，worker 只能在批次边界续租。
- 接管场景不得递增 `attemptNo`，只有用户或系统触发 FAILED 重试时才递增。

### 5.3 查询执行与批次检查点

- `query-executor` 必须基于注册配置提供的参数 schema、查询模板、游标字段和排序规则执行。
- 每个批次必须持久化 `lastCursor`、`processedCount`、`filePartNo`、`attemptNo` 和 `retryCount`。
- 接管后的 worker 从最后持久化批次检查点继续，不允许从头重跑整个任务。
- 查询模板和字段映射冲突时必须收口为配置错误或字段映射错误，不得静默放宽字段范围或阈值。

### 5.4 文件交付

- `file-service` 先写临时对象，再执行内容校验、元信息校验和 checksum 校验，最后发布为可下载对象。
- 临时对象不得被下载接口直接暴露，下载只允许返回已发布对象或等价 stream 元信息。
- 文件元信息至少包含 `fileName`、`fileSize`、`contentType`、`storageKey`、`checksum`、`checksumAlgorithm`、`expiresAt`、`attemptNo`。

### 5.5 清理 job

- `cleanup-job` 先把任务或文件引用标记为不可下载，再删除对象存储文件。
- 清理失败必须保留可重试记录和失败原因，不得静默吞掉。

### 5.6 审计链路

- `audit-log` 统一记录 `CREATE`、`DISPATCH`、`EXECUTE_START`、`EXECUTE_SUCCESS`、`EXECUTE_FAILED`、`CANCEL_REQUEST`、`CANCEL_DONE`、`RETRY_REQUEST`、`DOWNLOAD`、`EXPIRE_MARK`、`CLEANUP_FAILED`。
- 审计事件必须保留 `taskId`、`taskCode`、`subsystemCode`、`operatorId`、`action`、`result`、`errorCode`、`requestId` 和发生时间。
- 阶段事件必须能与 `attemptNo`、批次检查点和下载记录串联。

## 6. 数据流

1. 子系统提交创建任务请求，平台校验注册状态、权限和幂等键。
2. 平台落库任务并固化配置快照、请求摘要和审计记录。
3. 调度器轮询待执行任务，按数据库时间抢锁并启动执行尝试。
4. 查询执行器按游标分页读取数据，叠加数据范围约束、字段映射和脱敏策略。
5. 文件渲染器写入临时对象，完成字段校验、内容校验和发布前校验。
6. 平台发布已校验对象并记录下载元信息与交付准备事件。
7. 过期清理任务先标记不可下载，再删除对象存储文件。

## 7. 关键状态

- 对外正式状态：`PENDING`、`EXECUTING`、`COMPLETED`、`FAILED`、`CANCELED`、`EXPIRED`
- 内部取消控制标记：仅作为执行中取消控制，不对外返回
- 执行事件：`QUERY_READY`、`QUERY_BATCH_DONE`、`FILE_PART_WRITTEN`、`PACKAGE_DONE`、`FILE_VERIFIED`、`DELIVERY_READY`

## 8. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 幂等冲突 | 以 `tenantId + operatorId + taskCode + clientRequestId` 为范围，参数摘要不同返回 `IDEMPOTENCY_CONFLICT` |
| 多实例重复执行 | DB 原子抢锁 + 租约续期 + 接管继续当前 `attemptNo` |
| 查询越权 | 强制叠加 `tenantId`、`operatorId`、`roleCodes`、`orgScope` 数据范围约束 |
| 文件误交付 | 临时对象到已发布对象的边界校验，下载只暴露已发布对象 |
| 配置漂移 | 任务创建时固化快照，重试沿用快照 |
| 样板回归 | 采购订单样板以 0/1/20000/20001/100000/100001 行边界和敏感字段脱敏作证据 |

## 9. 模块边界建议

| 模块 | Owned paths 建议 | 说明 |
| --- | --- | --- |
| 契约层 | `contracts/` | 先定义接口、schema、错误码和状态 |
| 测试层 | `tests/`、`docs/testing/` | 先补契约、测试数据和验证矩阵 |
| 实现层 | `src/` | 后续创建，不应在分析阶段假设存在 |
| 共享层 | `packages/` | 仅在拆分共享客户端或抽象时创建 |

## 10. 验收顺序

1. 先 FR-001 / FR-013，确认创建、幂等、快照和锁链路。
2. 再 FR-008 / FR-009，确认集中查询、权限和脱敏。
3. 再 FR-006 / FR-003，确认分片打包、文件发布和下载保护。
4. 再 FR-005 / FR-011 / FR-012，确认调度、清理、取消与重试。
5. 最后 FR-014，确认采购订单样板可作为压测和回归证据。

## 11. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 说明架构 brief 需为后续知识沉淀留出口
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束架构 brief 以可执行边界为主

## 12. Knowledge Outputs

- none
