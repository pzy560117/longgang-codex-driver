# 测试数据计划

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: RELEASE-001
**Seed 负责人**: RELEASE-001
**重置命令**: 由 API / DB / worker / query / file / sample 测试套件按真实 MySQL 隔离执行
**Seed 命令**: 由对应测试套件创建当前回归数据；live object storage smoke 需真实 endpoint / bucket 与写入授权

## 1. 账号与权限上下文

| 角色 | 最小上下文字段 | 权限 | 覆盖需求 | 用途 |
| --- | --- | --- | --- | --- |
| export_user | `tenantId`、`operatorId`、`roleCodes`、`orgScope`、`requestId` | 创建本人任务、查询本人历史、下载本人完成文件 | FR-001 / FR-003 / FR-004 / FR-009 | 主流程和权限边界 |
| export_admin | `tenantId`、`operatorId`、`roleCodes=EXPORT_ADMIN`、`orgScope=*`、`requestId` | 全局历史查询、注册配置管理、清理审计查看 | FR-004 / FR-007 / FR-010 / FR-011 | 管理和回归集合 |
| export_denied | 缺少角色或 `orgScope` 不覆盖数据 | 无创建、下载或配置权限 | FR-009 / FR-014 | 403、脱敏和数据范围负向 |

## 2. 领域 Seed

| Data ID | 覆盖需求 | 类型 | 初始化合同 | 重置合同 | 边界 / 负向用例 |
| --- | --- | --- | --- | --- | --- |
| seed-create-base-001 | FR-001 | 任务创建 | 已注册启用 `taskCode`、合法 `queryParams`、`clientRequestId` | 清理任务和审计记录 | 未注册、禁用、权限不足 |
| seed-progress-001 | FR-002 | 任务详情 | PENDING、EXECUTING、COMPLETED、FAILED 任务及进度 | 回滚状态和进度 | 进度为空、错误信息缺失 |
| seed-download-001 | FR-003 | 文件下载 | 已发布、临时、过期、校验失败文件元信息 | 清理 OSS key 和下载记录 | 未发布对象、EXPIRED、checksum 失败 |
| seed-history-001 | FR-004 | 历史查询 | 多 `taskCode/status/createdBy/createdAtRange/fileFormat/subsystemCode` 任务集 | 清理历史数据 | 普通用户仅本人、空分页、权限拒绝 |
| seed-lock-001 | FR-005 | 调度锁 | 多实例任务、`lockOwner`、`lockExpireAt`、`leaseRenewedAt` | 清理锁和调度记录 | 重复抢锁、锁接管、数据库时间漂移 |
| seed-split-001 | FR-006 | 分片与打包 | 0、1、20000、20001、100000、100001 行数据集 | 清理分片文件、ZIP 清单、事件日志 | 空数据、ZIP、超量控制 |
| seed-registry-001 | FR-007 | 注册配置 | taskCode、并发上限、保留期、单文件阈值、最大导出量、格式策略 | 回滚配置和快照 | 重复 taskCode、disabled、同步失败 |
| seed-contract-001 | FR-008 | 查询契约 | datasourceCode、parameter schema、queryTemplateVersion、fieldMapping、maskingPolicy、cursorField、orderRule、batchSize | 回滚契约版本 | 非法模板、未声明参数、原始 SQL |
| seed-auth-001 | FR-009 | 权限上下文 | 完整上下文和缺字段样本 | 清理认证输入 | orgScope 不足、下载拒绝、脱敏失败 |
| seed-audit-001 | FR-010 | 审计事件 | CREATE、DISPATCH、EXECUTE、CANCEL、RETRY、DOWNLOAD、EXPIRE、CLEANUP 事件 | 清理审计表 | 事件缺失、字段缺失、顺序错误 |
| seed-cleanup-001 | FR-011 | 过期清理 | 过期文件、可下载文件、不可下载标记、待清理对象 | 恢复过期标记和对象引用 | 先删后标、清理失败重试、410 |
| seed-cancel-retry-001 | FR-012 | 取消与重试 | PENDING、EXECUTING、FAILED、CANCELED 任务和尝试记录 | 回滚状态、尝试序号、取消标记 | 非法状态重试、批次边界取消 |
| seed-idempotency-001 | FR-013 | 幂等和快照 | 相同/不同幂等范围与参数摘要 | 清理幂等索引、快照、锁记录 | 幂等命中、冲突、attemptNo 递增 |
| seed-purchase-order-001 | FR-014 | 采购订单样板 | 订单号、状态、供应商、采购组织、采购员、时间、金额、币种、联系人、`orderId` 游标 | 回滚样板数据、字段映射、脱敏结果 | 0/1/20000/20001/100000/100001 行、敏感字段、游标异常 |

## 3. 边界集合

- 空数据：`seed-split-001` 和 `seed-purchase-order-001` 的 0 行集合，预期仅表头。
- 单文件：1 和 20000 行集合，预期 XLSX 单文件。
- 分片 ZIP：20001 和 100000 行集合，预期 ZIP 分片、批次事件和 checksum。
- 超量：100001 行集合，预期拒绝创建或进入更严格控制流，并记录审计。
- 权限拒绝：`export_denied` 访问创建、历史、下载和配置入口。
- 文件失败：临时对象、未发布对象、校验失败对象和过期对象。

## 4. 重置规则

- 所有 seed 在当前测试实现中必须可重复创建、隔离和清理。
- 历史 seed 合同已转为当前回归数据入口，不得再表达为未实现测试工厂。
- 破坏性场景必须隔离任务、文件对象和审计数据；失败后保留 `taskId`、`requestId`、`attemptNo` 供定位。
