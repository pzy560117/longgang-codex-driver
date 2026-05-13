# 回归计划

**功能 / 发布版本**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: ANALYSIS-001
**最后更新**: 2026-05-13
**负责人**: ANALYSIS-001

## 1. 受影响范围

| 范围 | 关联需求 | 回归原因 | 验证入口 |
| --- | --- | --- | --- |
| 创建、幂等和快照 | FR-001 / FR-013 | 新增统一任务入口、幂等键、参数摘要和配置快照。 | `docs/testing/test-matrix.md` TM-001 / TM-013 |
| 状态、历史和审计 | FR-002 / FR-004 / FR-010 | 任务状态、进度、历史可见性和审计字段成为对外契约。 | `docs/testing/TRACEABILITY_MATRIX.md` |
| 调度与取消重试 | FR-005 / FR-012 / FR-013 | DB 锁租约、批次边界取消和 FAILED 重试影响执行一致性。 | `docs/testing/verify-matrix.md` |
| 查询、字段和脱敏 | FR-008 / FR-009 / FR-014 | 集中查询模板、字段映射、数据范围和敏感字段决定样板输出安全性。 | `docs/testing/TEST_DATA_MATRIX.md` |
| 文件交付与清理 | FR-003 / FR-006 / FR-011 | 临时对象、校验、发布、下载和过期清理需要端到端证据。 | `docs/testing/ACCEPTANCE_EXAMPLES.md` |
| 采购订单样板 | FR-014 | 一期样板必须证明平台通用链路可承接 10 万行边界。 | `plans/features/export-platform.dev-plan.md` |

## 2. P0 回归集合

| 回归 ID | 需求 | 必测场景 | Seed | 当前状态 |
| --- | --- | --- | --- | --- |
| REG-P0-001 | FR-001 / FR-013 | 创建任务、幂等命中、幂等冲突、快照沿用 | `seed-create-base-001`、`seed-idempotency-001` | planned |
| REG-P0-002 | FR-002 / FR-004 / FR-010 | 任务详情、进度、历史分页、本人/管理员可见性、审计字段 | `seed-progress-001`、`seed-history-001`、`seed-audit-001` | planned |
| REG-P0-003 | FR-005 / FR-012 / FR-013 | 多实例抢锁、租约续租、锁接管、取消、FAILED 重试 | `seed-lock-001`、`seed-cancel-retry-001` | planned |
| REG-P0-004 | FR-007 / FR-008 | 注册配置、disabled、查询模板、字段映射、游标字段 | `seed-registry-001`、`seed-contract-001` | blocked-by-contract |
| REG-P0-005 | FR-003 / FR-006 / FR-011 | 空数据、单文件、ZIP、校验失败、下载、过期清理 | `seed-download-001`、`seed-split-001`、`seed-cleanup-001` | planned |
| REG-P0-006 | FR-009 / FR-014 | 权限拒绝、数据范围、联系人脱敏、采购订单 10 万行边界 | `seed-auth-001`、`seed-purchase-order-001` | blocked-by-contract |

## 3. P1 回归集合

| 回归 ID | 需求 | 必测场景 | Seed | 当前状态 |
| --- | --- | --- | --- | --- |
| REG-P1-001 | FR-011 | 过期标记、410 失效、清理失败可重试 | `seed-cleanup-001` | planned |
| REG-P1-002 | FR-012 | PENDING 取消、EXECUTING 批次边界取消、非法状态返回 `INVALID_TASK_STATE` | `seed-cancel-retry-001` | planned |

## 4. 发布证据

- verify 摘要：`powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('git diff --check')`，当前 ANALYSIS-001 必须通过。
- 契约验证：后续 CONTRACT-001 在 `contracts/` 和 `docs/testing/verify-matrix.md` 中补齐。
- 后端 / 调度 / 查询 / 文件验证：后续 CORE/SCHED/QUERY/FILE/SAMPLE 任务落地真实命令。
- 当前证据路径：`progress.txt`、`traces/ANALYSIS-001-*`、`docs/testing/verify-matrix.md`。
- 若某项仍为 `blocked-by-contract`，不得在 release 阶段写 PASS；必须保留 blocker、owner 和下一任务入口。
