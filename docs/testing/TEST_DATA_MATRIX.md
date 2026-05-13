# 测试数据矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**最后更新**: 2026-05-13
**负责人**: ANALYSIS-001

| 场景 / Req ID | Data ID | 初始化方式 | 重置方式 | 边界 / 负向用例 | 负责人 |
| --- | --- | --- | --- | --- | --- |
| FR-001 | seed-create-base-001 | 准备已注册且启用的 `taskCode`、最小认证上下文、`clientRequestId` 和合法 `queryParams` | 清理任务表和审计记录 | 0/1 次创建、幂等命中、未注册、禁用、权限不足 | ANALYSIS-001 |
| FR-002 | seed-progress-001 | 准备 `PENDING`、`EXECUTING`、`COMPLETED`、`FAILED` 四类任务记录及对应审计 | 回滚任务状态和进度数据 | 进度为空、错误信息缺失、无权限查看 | ANALYSIS-001 |
| FR-003 | seed-download-001 | 准备已发布对象、临时对象、过期对象、校验通过与校验失败文件元信息 | 清理 OSS key、文件引用和下载记录 | 仅完成态可下载、签名 URL 与 stream、EXPIRED、校验失败、未发布对象 | ANALYSIS-001 |
| FR-004 | seed-history-001 | 准备不同 `taskCode`、`status`、`createdBy`、`createdAtRange`、`fileFormat`、`subsystemCode` 任务集 | 清理历史查询数据 | 普通用户仅本人、管理员全局、空分页、权限拒绝 | ANALYSIS-001 |
| FR-005 | seed-lock-001 | 准备同一 `subsystemCode` 的多实例调度任务、`lockOwner`、`lockExpireAt`、`leaseRenewedAt` | 清理锁记录和调度记录 | 0/1 并发、锁接管、租约过期、数据库时间漂移 | ANALYSIS-001 |
| FR-006 | seed-split-001 | 准备 0、1、20000、20001、100000、100001 行导出数据集 | 清理分片文件、ZIP 清单和事件日志 | 空数据仅表头、超阈值分片打包、批次边界事件缺失 | ANALYSIS-001 |
| FR-007 | seed-registry-001 | 准备注册、更新、查询、启停、并发上限、保留期、单文件阈值、最大导出量和支持格式配置样本 | 回滚注册配置和快照 | taskCode 重复、disabled、配置同步失败、权限不足 | ANALYSIS-001 |
| FR-008 | seed-contract-001 | 准备 datasourceCode、parameter schema、queryTemplateVersion、fieldMapping、maskingPolicy、cursorField、orderRule、batchSize 样本 | 回滚契约版本和配置摘要 | 非法模板、未声明参数、未注册字段、原始 SQL、数据源不可用 | ANALYSIS-001 |
| FR-009 | seed-auth-001 | 准备 operatorId、tenantId、roleCodes、orgScope、requestId 的最小上下文及缺字段样本 | 清理认证上下文输入 | 权限不足、orgScope 不足、下载拒绝、脱敏失败 | ANALYSIS-001 |
| FR-010 | seed-audit-001 | 准备 CREATE、DISPATCH、EXECUTE_START、EXECUTE_SUCCESS、EXECUTE_FAILED、CANCEL_REQUEST、CANCEL_DONE、RETRY_REQUEST、DOWNLOAD、EXPIRE_MARK、CLEANUP_FAILED 事件样本 | 清理审计表 | 事件缺失、字段缺失、顺序错误、请求链路断裂 | ANALYSIS-001 |
| FR-011 | seed-cleanup-001 | 准备过期文件、可下载文件、不可下载标记和待清理对象 | 恢复过期标记和对象存储引用 | 先删后标、清理失败重试、410 失效结果 | ANALYSIS-001 |
| FR-012 | seed-cancel-retry-001 | 准备 `PENDING`、`EXECUTING`、`FAILED`、`CANCELED` 任务与执行尝试记录 | 回滚任务状态、尝试序号和取消标记 | 非法状态重试、批次边界取消、同任务单活跃尝试 | ANALYSIS-001 |
| FR-013 | seed-idempotency-001 | 准备相同/不同 `tenantId + operatorId + taskCode + clientRequestId` 组合与参数摘要 | 清理幂等索引、快照和锁记录 | 幂等命中、幂等冲突、锁接管、快照沿用、attemptNo 递增 | ANALYSIS-001 |
| FR-014 | seed-purchase-order-001 | 准备采购订单样板数据，覆盖订单号、订单状态、供应商、采购组织、采购员、创建时间、总金额、币种、联系人姓名、联系人手机号、`orderId` 游标 | 回滚样板数据、字段映射和脱敏结果 | 0/1/20000/20001/100000/100001 行、敏感字段、游标异常、样板压测 | ANALYSIS-001 |

## 规则

- 每个 P0/P1 场景都应标明所需的 seed 或 fixture 数据。
- 负向和权限场景不应依赖临时手工准备。
- 破坏性场景必须定义重置或隔离策略。
- 当前仓库无代码实现时，数据初始化方式应标记为 `planned fixture`，不得假设已有测试工厂。
