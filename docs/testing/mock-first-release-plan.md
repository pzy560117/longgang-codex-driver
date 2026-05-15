# MOCK-FIRST RELEASE 计划

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务**: RELEASE-001
**状态**: BLOCKED
**最新 trace**: `traces/RELEASE-001-20260515-070412.json`
**session**: `traces/RELEASE-001-e5b34ad7c4354a38bb4cc9b93449b344/`

## 当前结论

- `MOCK-FIRST-001` 已完成，mock-first 当前阶段只保留 local/dev evidence 结论，不再继续推动 release 自动队列。
- `RELEASE-001` 当前最新状态是 `BLOCKED`。
- `RELEASE-001` 现被外部哨兵依赖 `REAL-RELEASE-ENV-READY` 挂起；在人工确认真实 release 依赖就绪前，它不应继续被 stop hook 或续跑逻辑视为当前可自动运行任务。
- 已通过的基础 gate 包括 `npm audit`、`npm run arch:check`、`npm run typecheck`、`npm run test:contract`、`npm test`、`Redocly OpenAPI lint`。
- 当前阻塞点是缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL`。
- live object storage 仍需要真实 endpoint、bucket、credential，以及 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`。

## 队列边界

- mock-first 是当前已完成的先行阶段；它的职责是产出 local/dev evidence，并明确哪些 release 证据仍依赖真实环境。
- `REAL-RELEASE-ENV-READY` 是 `RELEASE-001` 的外部哨兵依赖，表示以下条件均已由人工配置并确认：
  - 真实 MySQL `EXPORT_PLATFORM_TEST_DATABASE_URL` 已可用于 release gate。
  - live object storage 的 endpoint、bucket、credential 已配置完成。
  - `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 已显式开启，可执行真实 smoke writes。
- 在 `REAL-RELEASE-ENV-READY` 未满足前，driver / stop hook / continuation gate 都不应把 `RELEASE-001` 当作当前 runnable task。
- 只有真实依赖准备完成后，才恢复 driver 执行 `RELEASE-001` 的 release gate。

## mock-first 的边界

- mock-first 只用于本地开发、联调和失败态演练。
- mock-first 可以使用本地 HTTP object storage adapter、fixture seed、受控 fake 外部数据源。
- mock-first 不得作为 `RELEASE-001` PASS 证据。
- mock-first 不得替代 live OSS/S3 证据。
- mock-first 不得替代真实 MySQL 证据。
- mock-first 不得作为 `FR-001` 到 `FR-014` 的 release evidence。

## mock-first local/dev evidence 映射

| Req ID | local/dev evidence | 失败态演练 | Release 边界 |
| --- | --- | --- | --- |
| FR-001 | local/dev evidence: `npm run test:mock-local` 只确认创建任务契约、幂等字段、注册态映射和 mock-first 命令入口可被本地验证引用。 | 失败态: 未注册、禁用、权限不足和参数过长仍以 API / DB 集成测试接真实 MySQL 后确认。 | 不是 release evidence；不得替代 `npm run test:api`、`npm run test:db` 和真实 MySQL 证据。 |
| FR-002 | local/dev evidence: `npm run test:mock-local` 只确认进度字段、错误字段、详情可见性口径和本地文档映射被纳入 mock-first 证据集合。 | 失败态: 不存在任务、无权查看和失败详情仍需 API / DB 集成测试确认。 | 不是 release evidence；不得替代 `npm run test:api` 和真实 MySQL 证据。 |
| FR-003 | local/dev evidence: `tests/mock-local/object-storage-local.test.mjs` 使用本地 HTTP object storage adapter 覆盖 put/read/publish/download URL 协议链路，并保留临时对象到发布对象的路径描述。 | 失败态: 缺少对象存储 endpoint / bucket 时 `createObjectStorageFromEnv()` 明确 BLOCKED。 | 不是 release evidence；不得替代 live OSS/S3、真实下载证据或 release gate。 |
| FR-004 | local/dev evidence: `npm run test:mock-local` 只确认历史查询筛选口径、权限可见性和分页边界被纳入 mock-first 映射。 | 失败态: 普通用户越权、管理员全局查询和空分页仍需 API / DB 集成测试确认。 | 不是 release evidence；不得替代 `npm run test:api` 和真实 MySQL 证据。 |
| FR-005 | local/dev evidence: `npm run arch:check` 与 mock-first 映射只确认 scheduler / worker / migration 入口存在，并记录本地调度联调入口。 | 失败态: 多实例抢锁、并发上限和数据库时间租约仍需 `npm run test:worker` 接真实 MySQL。 | 不是 release evidence；不得替代 DB 抢锁和 worker release 证据。 |
| FR-006 | local/dev evidence: mock-first 只记录分片、ZIP、空数据、阶段事件和文件发布链路的本地联调入口；本地对象存储协议链路由 `tests/mock-local/object-storage-local.test.mjs` 覆盖。 | 失败态: 渲染失败、字段校验失败和超量导出仍需 file / sample 集成测试确认。 | 不是 release evidence；不得替代真实 MySQL、文件服务或 live object storage 证据。 |
| FR-007 | local/dev evidence: `npm run arch:check` 和 mock-first 映射只确认 registry/config API 入口、启停语义和契约追踪存在。 | 失败态: 重复 taskCode、禁用配置、配置同步失败和无权限操作仍需 API / DB 集成测试。 | 不是 release evidence；不得替代 registry 生产 repository 证据。 |
| FR-008 | local/dev evidence: mock-first 只确认集中查询模板、参数 schema、字段映射、脱敏策略和只读数据源约束在本地证据集合中有入口。 | 失败态: 非法模板、未声明参数、原始 SQL、数据源不可用和字段映射错误仍需 query 集成测试。 | 不是 release evidence；不得替代真实 MySQL 或外部只读数据源证据。 |
| FR-009 | local/dev evidence: mock-first 只确认认证上下文、权限、数据范围和脱敏风险被纳入本地联调清单；下载协议可由本地对象存储 adapter 演练。 | 失败态: 权限不足、认证字段缺失、下载拒绝和脱敏失败仍需 API / query / file 集成测试。 | 不是 release evidence；不得替代真实权限、数据范围或 live storage 证据。 |
| FR-010 | local/dev evidence: `npm run arch:check` 和 mock-first 映射只确认审计日志、事件日志、requestId 串联和失败阶段字段入口存在。 | 失败态: 审计缺字段、事件缺失、失败阶段和上一成功阶段仍需 API / worker / DB 集成测试。 | 不是 release evidence；不得替代真实审计表和任务事件证据。 |
| FR-011 | local/dev evidence: mock-first 使用本地对象存储协议链路确认对象操作接口可演练，cleanup job 入口由 `npm run arch:check` 确认。 | 失败态: 先标记不可下载再删对象、删除失败重试和 410 失效仍需 file / worker 集成测试。 | 不是 release evidence；不得替代 cleanup job、真实 MySQL 或 live OSS/S3 证据。 |
| FR-012 | local/dev evidence: mock-first 只确认取消 / 重试 API 入口、状态机风险、attemptNo 语义和验证入口被映射。 | 失败态: PENDING 取消、FAILED 重试、EXECUTING 批次边界取消和非法状态重试仍需 API / worker 集成测试。 | 不是 release evidence；不得替代真实任务状态机和 worker 证据。 |
| FR-013 | local/dev evidence: mock-first 只确认幂等、attemptNo、配置快照、锁租约字段和追踪入口被映射。 | 失败态: 幂等冲突、锁过期接管、续租和 FAILED 重试递增 attemptNo 仍需 DB / worker 集成测试。 | 不是 release evidence；不得替代真实 MySQL 锁租约和快照证据。 |
| FR-014 | local/dev evidence: mock-first 只确认采购订单样板契约、查询字段、脱敏字段、边界数据和本地对象存储协议链路入口存在。 | 失败态: 0/1/20000/20001/100000/100001 行、敏感字段未脱敏和游标异常仍需 sample 集成测试。 | 不是 release evidence；不得替代真实 MySQL、sample 压测或 live OSS/S3 证据。 |

## 退出条件

- 先解除外部哨兵依赖 `REAL-RELEASE-ENV-READY`，即补齐并人工确认真实 MySQL 和 live object storage 环境。
- 不能将 mock-first 结果回写为 `RELEASE-001 PASS`，也不能把 local/dev evidence 当成 release evidence。
- 重新执行 `npm run test:api`。
- 再执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1`，或由 driver 重新跑 release 流程。
- 只有真实环境下的 release evidence 才能推动 `RELEASE-001` 退出 `BLOCKED`。

## 证据约束

- mock-first 证据只能标记为 `local/dev evidence`。
- mock-first 证据只能用于说明本地链路、联调用例和失败态，不可覆盖 release gate。
- mock-first 证据可以作为 FR-001 到 FR-014 的映射索引，但不能替代 API / DB / worker / query / file / sample 集成证据。
- 若真实依赖缺失，仍必须保留 `BLOCKED - 需要人工介入`。
