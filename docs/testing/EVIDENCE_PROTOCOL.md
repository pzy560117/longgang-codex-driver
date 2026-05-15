# 证据协议

**功能 / 项目**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: RELEASE-001
**最后更新**: 2026-05-15
**负责人**: RELEASE-001

## 1. 必需证据

| 证据类型 | 关联需求 | 当前任务要求 | 路径 / 命令 |
| --- | --- | --- | --- |
| 产品真相源对齐 | FR-001 - FR-014 | 引用 `docs/product/*`，不得把聊天补充或旧模板当作需求来源。 | `docs/product/prd-lite.md`、`acceptance-criteria.md`、`requirement-interface-matrix.md`、`state-matrix.yaml` |
| 追溯矩阵 | FR-001 - FR-014 | 每个 FR 至少有验收、测试层级、seed 和后续验证入口。 | `docs/testing/TRACEABILITY_MATRIX.md` |
| 测试数据 | FR-001 - FR-014 | 每个 FR 对齐一个 seed 或可执行数据入口，并声明重置策略。 | `docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/test-data-plan.md` |
| 风险与回归 | FR-001 - FR-014 | 高风险项、P0/P1 回归集合和 live object storage BLOCKED 项必须可定位；mock-first 证据只能作为 local/dev 边界说明，不能覆盖 release evidence。 | `docs/testing/RISK_BASED_TEST_PLAN.md`、`docs/testing/REGRESSION_PLAN.md`、`docs/testing/mock-first-release-plan.md` |
| 验证命令 | FR-001 - FR-014 | RELEASE-001 执行当前 release gate，不伪造未接入的 live object storage 证据。 | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1` |
| 执行记录 | FR-001 - FR-014 | 记录 driver 实现、Stage 1、测试、Stage 2 的日志和结论。 | `progress.txt`、`traces/RELEASE-001-*` |

## 2. 新鲜度规则

- 证据必须来自当前变更集和当前 driver 会话；复用旧日志时必须说明其只作为历史背景。
- 历史分析入口只作为追溯背景，不能等同 PASS。
- live object storage 缺少真实 endpoint / bucket 或 smoke 写入授权时，必须记录 `BLOCKED - 需要人工介入`。
- mock-first 相关证据只能标记为 `local/dev evidence`；本地 HTTP object storage adapter、fixture seed、fake 外部数据源都不能覆盖真实 MySQL 或 live object storage release evidence。
- 最终 release 证据必须包含退出码、命令、trace 路径、Requirement ID、测试文件或验证矩阵入口。
- 若验证失败，必须在 `progress.txt` 记录失败阶段、失败原因和下一步，不得手工把任务标记为通过。

## 3. 证据字段

后续实现任务和 release 任务至少记录：

| 字段 | 说明 | 关联需求 |
| --- | --- | --- |
| `taskId` | 串联创建、执行、下载、取消、重试和审计。 | FR-001 / FR-010 / FR-013 |
| `requestId` | 串联 API 调用、权限失败和审计。 | FR-009 / FR-010 |
| `attemptNo` | 区分锁接管、失败重试和文件发布。 | FR-005 / FR-012 / FR-013 |
| `configSnapshot` | 证明已创建任务和 FAILED 重试沿用原配置。 | FR-007 / FR-013 |
| `lockOwner` / `lockExpireAt` / `leaseRenewedAt` | 证明 DB 锁租约和续租行为。 | FR-005 / FR-013 |
| `batchCheckpoint` | 证明查询批次、重试和取消边界。 | FR-006 / FR-008 / FR-012 |
| `storageKey` / `checksum` / `checksumAlgorithm` | 证明文件校验、发布和下载保护。 | FR-003 / FR-006 / FR-011 |
| `seedId` | 串联测试数据和验收场景。 | FR-001 - FR-014 |

## 4. 失败证据

- 权限失败：保留 `requestId`、操作者上下文、403 结论和审计事件。
- 查询失败：保留模板版本、数据源编码、参数摘要、批次检查点和错误码。
- 文件失败：保留临时对象、校验值、发布状态、清理记录和错误码。
- 调度失败：保留锁持有者、租约时间、接管实例、`attemptNo` 和批次检查点。
- 样板失败：保留采购订单 seed、行数边界、字段映射、敏感字段脱敏和游标证据。
