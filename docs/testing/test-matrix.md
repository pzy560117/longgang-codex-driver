# 测试矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**会话**: RELEASE-001
**最后更新**: 2026-05-15

## 当前状态

- API / DB / worker / query / file / sample 链路已完成 fresh-pass 验证，当前矩阵中的对应项应按已实现状态理解。
- live object storage gate 仍然 BLOCKED：必须具备真实 endpoint / bucket，并显式设置 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 后，才能补充在线 smoke 证据。
- 下表保留少量历史基线表述，仅用于说明最初的分析来源，不代表当前仓库状态。

| Requirement ID | 优先级 | 页面 / 组件 | 状态 | API / 契约 | 测试层级 | 测试用例 ID | 测试数据 | 负责人 | 证据路径 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FR-001 | P0 | 无前端页面；创建任务接口 | PENDING | `POST /api/export/tasks` | contract / api / backend / verify | TM-001 | `seed-create-base-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-002 | P0 | 无前端页面；任务详情/进度接口 | PENDING / EXECUTING / COMPLETED / FAILED | `GET /api/export/tasks/{taskId}` | contract / api / backend / verify | TM-002 | `seed-progress-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-003 | P0 | 无前端页面；下载接口与文件服务 | COMPLETED / EXPIRED | `GET /api/export/tasks/{taskId}/download` | contract / file / api / backend / verify | TM-003 | `seed-download-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-004 | P0 | 无前端页面；历史查询接口 | default / empty / permission_denied | `GET /api/export/tasks` | contract / api / backend / verify | TM-004 | `seed-history-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-005 | P0 | 无前端页面；调度器与 DB 抢锁 | PENDING / EXECUTING | Scheduler + DB lock | contract / scheduler / backend / verify | TM-005 | `seed-lock-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-006 | P0 | 无前端页面；worker、文件渲染与打包 | EXECUTING / COMPLETED | 执行事件契约、文件渲染契约 | contract / backend / file / verify | TM-006 | `seed-split-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-007 | P0 | 无前端页面；registry/config APIs | default / disabled / permission_denied | registry/config APIs | contract / backend / verify | TM-007 | `seed-registry-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-008 | P0 | 无前端页面；集中查询契约 | default / invalid_template / datasource_unavailable / query_execution_error / field_mapping_invalid / masking_rule_error | 集中查询契约 | contract / backend / query / verify | TM-008 | `seed-contract-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-009 | P0 | 无前端页面；认证、权限和脱敏 | permission_denied / masking_error | 认证上下文契约、数据范围契约 | contract / backend / api / verify | TM-009 | `seed-auth-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-010 | P0 | 无前端页面；审计与任务事件 | all | 审计契约、任务事件契约 | contract / backend / verify | TM-010 | `seed-audit-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-011 | P1 | 无前端页面；过期清理作业 | EXPIRED | cleanup job | contract / scheduler / file / verify | TM-011 | `seed-cleanup-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-012 | P1 | 无前端页面；取消/重试接口 | CANCELED / PENDING / FAILED / EXECUTING | `POST /api/export/tasks/{taskId}/cancel`、`POST /api/export/tasks/{taskId}/retry` | contract / api / backend / verify | TM-012 | `seed-cancel-retry-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-013 | P0 | 无前端页面；创建、调度和快照链路 | default / conflict / processing / error | create API + Scheduler + task snapshot | contract / scheduler / backend / verify | TM-013 | `seed-idempotency-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |
| FR-014 | P0 | 无前端页面；采购订单样板合同 | default / empty / long_content / error | 采购订单样板契约 | contract / backend / query / file / verify | TM-014 | `seed-purchase-order-001` | RELEASE-001 | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` | fresh-pass |

## 覆盖规则

- 每条 P0/P1 需求都必须出现在这个矩阵中。
- 每条 P0/P1 行都必须指向一个验收示例或场景 ID。
- 当前状态以 `fresh-pass` 为准；只有 live object storage smoke 写入仍可能因为真实 endpoint / bucket 缺失而保持 BLOCKED。
- API / 数据变更必须映射到契约和 API 集成证据。
- 计划中的实现任务应能够从这个矩阵推导出 affected tests。
- `TRACEABILITY_MATRIX.md`、`TEST_DATA_MATRIX.md`、`ACCEPTANCE_EXAMPLES.md` 必须形成闭环引用，避免 test-matrix 单独承担证据角色。
