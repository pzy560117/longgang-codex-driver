# MOCK-FIRST 本地联调验收

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务**: MOCK-INTEGRATION-001
**验收定位**: mock-first local/dev integration acceptance

## 验收范围

- 仅覆盖本地开发与联调阶段的主流程、失败态演练和证据归档。
- 命令入口固定为 `npm run arch:check`、`npm run test:mock-local`、`npm test` 与 scoped `git diff --check`。
- 证据归档固定落在 `tests/mock-local/`、本文件、`docs/testing/mock-first-release-plan.md` 与 `docs/testing/verify-matrix.md`。
- 本任务不是 release evidence，不替代真实 MySQL、live object storage、`npm run test:api`、`npm run test:db`、`npm run test:worker`、`npm run test:query`、`npm run test:file` 或 `npm run test:sample`。

## MOCK-INTEGRATION-001 执行证据

本轮结论: accepted / local-dev-only。

| 命令 | 结果 | local/dev evidence 归档 |
| --- | --- | --- |
| `npm run arch:check` | PASS | 证明生产 HTTP server、scheduler worker、cleanup job、OpenAPI route 映射、migration 与禁用替身检查仍可执行；不证明真实 MySQL 或 live object storage 已接通。 |
| `npm run test:mock-local` | PASS | 覆盖 `tests/mock-local/` 中 FR-001 至 FR-014 的本地主流程、失败态演练、本地 HTTP object storage adapter 协议链路和 release 边界断言。 |
| `npm test` | PASS | 保持基础单测和契约文档断言通过；不替代 `npm run test:api`、`npm run test:db`、`npm run test:worker`、`npm run test:query`、`npm run test:file` 或 `npm run test:sample`。 |
| scoped `git diff --check` | PASS | 检查 `task.json`、`package.json`、`tests/mock-local`、本文件、`docs/testing/mock-first-release-plan.md` 与 `docs/testing/verify-matrix.md` 无空白错误。 |

证据路径:

- `tests/mock-local/mock-integration-flow.test.mjs`: FR-001 至 FR-014 本地主流程、失败态演练、审计链路和 local/dev-only 标记。
- `tests/mock-local/object-storage-local.test.mjs`: 本地 HTTP object storage adapter 的 put/read/publish/download URL 协议链路，以及缺少对象存储环境变量时的 BLOCKED 口径。
- `tests/mock-local/mock-integration-acceptance-docs.test.mjs`: 本文件、release 计划和验证矩阵的执行证据、release 边界与哨兵依赖断言。
- `docs/testing/mock-first-release-plan.md`: RELEASE-001 与 docker/mock release gate 的边界。
- `docs/testing/verify-matrix.md`: MOCK-INTEGRATION-001 的 accepted / local-dev-only 归档状态。

边界: 本轮结果不是 release evidence；不得替代 docker/mock release gate。`RELEASE-001` 的通过状态只能来自 `scripts/release-verify.ps1` 完整验证。

## FR-001 至 FR-014 覆盖

| Req ID | local/dev 主流程与失败态覆盖 | Release 边界 |
| --- | --- | --- |
| FR-001 | 覆盖创建任务契约、幂等字段、注册态映射和 mock-first 命令入口；失败态只演练未注册、禁用、权限不足、参数过长的归档口径。 | 不替代真实 MySQL 下的 API / DB 集成证据。 |
| FR-002 | 覆盖进度字段、错误字段、详情可见性和本地文档映射；失败态只归档不存在任务、无权查看和失败详情场景。 | 不替代真实 MySQL 下的任务详情 API / DB 证据。 |
| FR-003 | 覆盖本地 HTTP object storage adapter 的 put/read/publish/download URL 协议链路与临时对象到发布对象路径；失败态归档缺少 endpoint / bucket 时的 BLOCKED 口径。 | 不替代 live OSS/S3、真实下载链路或 release gate。 |
| FR-004 | 覆盖历史查询筛选口径、权限可见性和分页边界的本地联调入口；失败态归档普通用户越权、管理员全局查询和空分页。 | 不替代真实 MySQL 下的列表 API / DB 证据。 |
| FR-005 | 覆盖 scheduler / worker / migration 入口存在性与本地调度联调入口；失败态归档多实例抢锁、并发上限和租约边界的验证入口。 | 不替代真实 MySQL 下的 worker / DB 抢锁证据。 |
| FR-006 | 覆盖分片、ZIP、空数据、阶段事件、文件发布链路的本地入口；失败态归档渲染失败、字段校验失败和超量导出。 | 不替代真实 MySQL、file service 或 live object storage 证据。 |
| FR-007 | 覆盖 registry/config API 入口、启停语义和契约追踪；失败态归档重复 taskCode、禁用配置、配置同步失败和无权限操作。 | 不替代 registry 的真实 API / DB 证据。 |
| FR-008 | 覆盖集中查询模板、参数 schema、字段映射、脱敏策略和只读数据源约束的本地入口；失败态归档非法模板、未声明参数、原始 SQL、数据源不可用和字段映射错误。 | 不替代真实 MySQL 或外部只读数据源证据。 |
| FR-009 | 覆盖认证上下文、权限、数据范围、脱敏风险与下载协议的本地联调入口；失败态归档权限不足、认证字段缺失、下载拒绝和脱敏失败。 | 不替代真实权限、数据范围或 live storage 证据。 |
| FR-010 | 覆盖审计日志、事件日志、requestId 串联和失败阶段字段入口；失败态归档审计缺字段、事件缺失、失败阶段和上一成功阶段。 | 不替代真实审计表、任务事件或 worker / DB 证据。 |
| FR-011 | 覆盖对象操作接口本地演练和 cleanup job 入口存在性；失败态归档先标记不可下载再删对象、删除失败重试和 410 失效口径。 | 不替代 cleanup job、真实 MySQL 或 live OSS/S3 证据。 |
| FR-012 | 覆盖取消 / 重试 API 入口、状态机风险、attemptNo 语义和验证入口；失败态归档 PENDING 取消、FAILED 重试、EXECUTING 批次边界取消和非法状态重试。 | 不替代真实任务状态机和 worker 证据。 |
| FR-013 | 覆盖幂等、attemptNo、配置快照、锁租约字段和追踪入口；失败态归档幂等冲突、锁过期接管、续租和 FAILED 重试 attemptNo 递增。 | 不替代真实 MySQL 锁租约、快照或 worker 证据。 |
| FR-014 | 覆盖采购订单样板契约、查询字段、脱敏字段、边界数据和本地对象存储协议链路入口；失败态归档 `0/1/20000/20001/100000/100001` 行、敏感字段未脱敏和游标异常。 | 不替代真实 MySQL、sample 压测或 live OSS/S3 证据。 |

## 证据归档要求

- 所有结论必须明确标记为 `local/dev evidence` 或 `failure drill`，不得写成 release pass。
- 若真实 MySQL 或 live object storage 缺失，只能记录边界与阻塞原因，不能将替身链路回写为生产完成。
- 验收结论需要与 `docs/testing/mock-first-release-plan.md` 和 `docs/testing/verify-matrix.md` 保持一致。
