# 测试数据矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**最后更新**: 2026-05-15
**负责人**: RELEASE-001

## 当前状态

- 当前 RELEASE-001 已通过本机 Docker MySQL + 本地 object storage mock 的受控 release gate；以下条目保留为当前矩阵的可执行数据入口，历史通过记录仅能作为旧证据。
- live object storage smoke 仍属于外部生产/live 验证范围，不得写入本机受控 release evidence。
- 这些条目在历史上曾被称为 fixture 计划说明；当前应按可执行数据入口理解，不表示仓库当前没有业务实现。

| 场景 / Req ID | Data ID | 初始化方式 | 重置方式 | 边界 / 负向用例 | 负责人 |
| --- | --- | --- | --- | --- | --- |
| FR-001 | seed-create-base-001 | 历史基线：最初用来说明创建任务所需的最小认证上下文、`clientRequestId` 和合法 `queryParams`；当前已转为可执行回归数据入口 | 清理任务表和审计记录 | 0/1 次创建、幂等命中、未注册、禁用、权限不足 | RELEASE-001 |
| FR-002 | seed-progress-001 | 历史基线：最初用来说明 `PENDING`、`EXECUTING`、`COMPLETED`、`FAILED` 四类任务记录；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 回滚任务状态和进度数据 | 进度为空、错误信息缺失、无权限查看 | RELEASE-001 |
| FR-003 | seed-download-001 | 历史基线：最初用来说明已发布对象、临时对象、过期对象与文件元信息；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理 OSS key、文件引用和下载记录 | 仅完成态可下载、签名 URL 与 stream、EXPIRED、校验失败、未发布对象 | RELEASE-001 |
| FR-004 | seed-history-001 | 历史基线：最初用来说明不同 `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode` 的任务集；当前已用于回归 | 清理历史查询数据 | 普通用户仅本人、管理员全局、空分页、权限拒绝 | RELEASE-001 |
| FR-005 | seed-lock-001 | 历史基线：最初用来说明同一 `subsystemCode` 的多实例调度、`lockOwner`、`lockExpireAt`、`leaseRenewedAt`；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理锁记录和调度记录 | 0/1 并发、锁接管、租约过期、数据库时间漂移 | RELEASE-001 |
| FR-006 | seed-split-001 | 历史基线：最初用来说明 0、1、20000、20001、100000、100001 行导出数据集；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理分片文件、ZIP 清单和事件日志 | 空数据仅表头、超阈值分片打包、批次边界事件缺失 | RELEASE-001 |
| FR-007 | seed-registry-001 | 历史基线：最初用来说明注册、更新、查询、启停、并发上限、保留期、单文件阈值、最大导出量和支持格式；当前已用于回归 | 回滚注册配置和快照 | taskCode 重复、disabled、配置同步失败、权限不足 | RELEASE-001 |
| FR-008 | seed-contract-001 | 历史基线：最初用来说明 datasourceCode、parameter schema、queryTemplateVersion、fieldMapping、maskingPolicy、cursorField、orderRule、batchSize；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 回滚契约版本和配置摘要 | 非法模板、未声明参数、未注册字段、原始 SQL、数据源不可用 | RELEASE-001 |
| FR-009 | seed-auth-001 | 历史基线：最初用来说明 operatorId、tenantId、roleCodes、orgScope、requestId 的最小上下文；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理认证上下文输入 | 权限不足、orgScope 不足、下载拒绝、脱敏失败 | RELEASE-001 |
| FR-010 | seed-audit-001 | 历史基线：最初用来说明 CREATE、DISPATCH、EXECUTE_START、EXECUTE_SUCCESS、EXECUTE_FAILED、CANCEL_REQUEST、CANCEL_DONE、RETRY_REQUEST、DOWNLOAD、EXPIRE_MARK、CLEANUP_FAILED 事件样本；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理审计表 | 事件缺失、字段缺失、顺序错误、请求链路断裂 | RELEASE-001 |
| FR-011 | seed-cleanup-001 | 历史基线：最初用来说明过期文件、可下载文件、不可下载标记和待清理对象；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 恢复过期标记和对象存储引用 | 先删后标、清理失败重试、410 失效结果 | RELEASE-001 |
| FR-012 | seed-cancel-retry-001 | 历史基线：最初用来说明 `PENDING`、`EXECUTING`、`FAILED`、`CANCELED` 任务与执行尝试记录；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 回滚任务状态、尝试序号和取消标记 | 非法状态重试、批次边界取消、同任务单活跃尝试 | RELEASE-001 |
| FR-013 | seed-idempotency-001 | 历史基线：最初用来说明相同/不同 `tenantId + operatorId + taskCode + clientRequestId` 组合与参数摘要；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 清理幂等索引、快照和锁记录 | 幂等命中、幂等冲突、锁接管、快照沿用、attemptNo 递增 | RELEASE-001 |
| FR-014 | seed-purchase-order-001 | 历史基线：最初用来说明采购订单样板数据；当前仅可作为历史数据入口，不能作为当前 release 历史通过记录 依据 | 回滚样板数据、字段映射和脱敏结果 | 0/1/20000/20001/100000/100001 行、敏感字段、游标异常、样板压测 | RELEASE-001 |

## 规则

- 每个 P0/P1 场景都应标明所需的 seed 或 fixture 数据。
- 负向和权限场景不应依赖临时手工准备。
- 破坏性场景必须定义重置或隔离策略。
- 历史基线说明仅作追溯用途，不再表示当前仓库状态。
- 任何 live object storage smoke 相关 fixture 仅用于外部生产/live 验证，不属于本机受控 release gate。
