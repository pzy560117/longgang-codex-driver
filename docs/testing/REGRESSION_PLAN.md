# 回归计划

**功能 / 发布版本**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: RELEASE-001
**最后更新**: 2026-05-15
**负责人**: RELEASE-001

## 状态说明

- 最新 release trace 显示 API gate 因缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 被阻塞；DB / worker / query / file / sample 本轮未执行，不能再写成历史通过记录。
- live object storage smoke 仍为 BLOCKED，需真实 endpoint / bucket 与 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`；当前 release 证据不能用 adapter/local HTTP 结果替代。
- 下方保留的“当前状态”仅表示回归集合的执行记录，不再沿用预实现口径。

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
| REG-P0-001 | FR-001 / FR-013 | 创建任务、幂等命中、幂等冲突、快照沿用 | `seed-create-base-001`、`seed-idempotency-001` | 本轮未执行 / 当前 blocked |
| REG-P0-002 | FR-002 / FR-004 / FR-010 | 任务详情、进度、历史分页、本人/管理员可见性、审计字段 | `seed-progress-001`、`seed-history-001`、`seed-audit-001` | 本轮未执行 / 当前 blocked |
| REG-P0-003 | FR-005 / FR-012 / FR-013 | 多实例抢锁、租约续租、锁接管、取消、FAILED 重试 | `seed-lock-001`、`seed-cancel-retry-001` | 本轮未执行 / 当前 blocked |
| REG-P0-004 | FR-007 / FR-008 | 注册配置、disabled、查询模板、字段映射、游标字段 | `seed-registry-001`、`seed-contract-001` | 本轮未执行 / 当前 blocked |
| REG-P0-005 | FR-003 / FR-006 / FR-011 | 空数据、单文件、ZIP、校验失败、下载、过期清理 | `seed-download-001`、`seed-split-001`、`seed-cleanup-001` | 本轮未执行 / 当前 blocked |
| REG-P0-006 | FR-009 / FR-014 | 权限拒绝、数据范围、联系人脱敏、采购订单 10 万行边界 | `seed-auth-001`、`seed-purchase-order-001` | 本轮未执行 / 当前 blocked |

## 3. P1 回归集合

| 回归 ID | 需求 | 必测场景 | Seed | 当前状态 |
| --- | --- | --- | --- | --- |
| REG-P1-001 | FR-011 | 过期标记、410 失效、清理失败可重试 | `seed-cleanup-001` | 本轮未执行 / 当前 blocked |
| REG-P1-002 | FR-012 | PENDING 取消、EXECUTING 批次边界取消、非法状态返回 `INVALID_TASK_STATE` | `seed-cancel-retry-001` | 本轮未执行 / 当前 blocked |

## 4. 发布证据

- verify 摘要：`powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('git diff --check')` 只能证明文档格式正确，不能证明当前 release 已完成。
- 契约验证：CONTRACT-001 已完成，相关结果已收敛到 `contracts/` 与 `docs/testing/verify-matrix.md`。
- 发布结论：当前 release 为 BLOCKED，API gate 因缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 停止，DB / worker / query / file / sample / live object storage 本轮未执行。
- 当前证据路径：`progress.txt`、`traces/RELEASE-001-*`、`docs/testing/verify-matrix.md`。
- 当前 release 仍为 BLOCKED，原因包括 `EXPORT_PLATFORM_TEST_DATABASE_URL` 缺失导致 API gate 停止，以及 live object storage smoke 前置条件缺失；API、DB、worker、query、file、sample 仍不得写成已通过，必须保留真实环境前置条件与验证入口。
