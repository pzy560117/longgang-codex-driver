# MOCK-FIRST RELEASE 计划

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务**: RELEASE-001
**状态**: BLOCKED
**最新 trace**: `traces/RELEASE-001-20260515-070412.json`
**session**: `traces/RELEASE-001-e5b34ad7c4354a38bb4cc9b93449b344/`

## 当前结论

- `MOCK-FIRST-001` 已完成，mock-first 当前阶段只保留 local/dev evidence 结论，不再继续推动 release 自动队列。
- `MOCK-INTEGRATION-001` 是 mock-first 后续的本地联调验收任务，用于补齐 FR-001 至 FR-014 的主流程、失败态和证据归档，不产出 release evidence。
- `LOCAL-RELEASE-REHEARSAL-001` 是 release 前的 mock/local rehearsal evidence 任务，用本地 MySQL 与本地 object storage mock 先压通 API / DB / worker / query / file / sample 集成命令。
- `RELEASE-001` 当前最新状态是 `BLOCKED`。
- `RELEASE-001` 现被外部哨兵依赖 `REAL-RELEASE-ENV-READY` 挂起；在人工确认真实 release 依赖就绪前，它不应继续被 stop hook 或续跑逻辑视为当前可自动运行任务。
- 已通过的基础 gate 包括 `npm audit`、`npm run arch:check`、`npm run typecheck`、`npm run test:contract`、`npm test`、`Redocly OpenAPI lint`。
- 当前阻塞点是缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL`。
- live object storage 仍需要真实 endpoint、bucket、credential，以及 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`。

## 队列边界

- mock-first 是当前已完成的先行阶段；它的职责是产出 local/dev evidence，并明确哪些 release 证据仍依赖真实环境。
- `MOCK-INTEGRATION-001` 依赖 `MOCK-FIRST-001`，是 release 前的本地验收归档任务；driver 应先执行它，再考虑 `RELEASE-001`。
- `LOCAL-RELEASE-REHEARSAL-001` 依赖 `MOCK-INTEGRATION-001`，用于在不接正式 live 依赖的前提下，通过 `npm run release:local-rehearsal` 连接本地 MySQL 与本地 object storage mock，提前暴露 API / DB / worker / query / file / sample 集成问题。
- `LOCAL-RELEASE-REHEARSAL-001` 不能解除 `REAL-RELEASE-ENV-READY`，不能作为 `RELEASE-001 PASS` 证据，也不能替代真实 MySQL 或 live OSS/S3 release evidence。
- `REAL-RELEASE-ENV-READY` 是 `RELEASE-001` 的外部哨兵依赖，表示以下条件均已由人工配置并确认：
  - 真实 MySQL `EXPORT_PLATFORM_TEST_DATABASE_URL` 已可用于 release gate。
  - live object storage 的 endpoint、bucket、credential 已配置完成。
  - `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 已显式开启，可执行真实 smoke writes。
- 在 `REAL-RELEASE-ENV-READY` 未满足前，driver / stop hook / continuation gate 都不应把 `RELEASE-001` 当作当前 runnable task。
- 只有真实依赖准备完成后，才恢复 driver 执行 `RELEASE-001` 的 release gate。

## mock-first 的边界

- mock-first 只用于本地开发、联调和失败态演练。
- mock-first 可以使用本地 HTTP object storage adapter、fixture seed、受控 fake 外部数据源。
- `MOCK-INTEGRATION-001` 只补充本地集成验收与证据归档，不补充真实环境 release gate。
- mock-first 不得作为 `RELEASE-001` PASS 证据。
- mock-first 不得替代 live OSS/S3 证据。
- mock-first 不得替代真实 MySQL 证据。
- mock-first 不得作为 `FR-001` 到 `FR-014` 的 release evidence。

## LOCAL-RELEASE-REHEARSAL-001 本地彩排边界

本任务状态: passed / mock/local rehearsal evidence。

`npm run release:local-rehearsal` 默认启动本地 object storage mock；如显式设置环境变量覆盖对象存储端点，也只能用于本地 rehearsal 的受控演练。无论使用默认 mock 还是显式覆盖，任务都必须连接本地 MySQL，且结果只能归类为 mock/local rehearsal evidence。MySQL URL 可以通过当前进程环境变量、`-DatabaseUrl` 参数，或本地未跟踪的 `.env.local` / `-EnvFile` 提供。

| 验收项 | 预期命令 | Release 边界 |
| --- | --- | --- |
| 本地 rehearsal 入口 | `npm run release:local-rehearsal` | 默认以本地 object storage mock 进入 rehearsal；即使显式覆盖对象存储端点，也只允许在本地 rehearsal 中使用。任务必须连接本地 MySQL，且只能产出 mock/local rehearsal evidence，不能解除 `REAL-RELEASE-ENV-READY`。 |
| API / DB / worker / query / file / sample | `npm run test:api`、`npm run test:db`、`npm run test:worker`、`npm run test:query`、`npm run test:file`、`npm run test:sample` | 可以提前暴露生产路径集成问题，但仍是 mock/local rehearsal evidence，不是 release evidence，也不能替代 `RELEASE-001`。 |
| object storage | 默认本地 mock；显式 env 覆盖只限 local rehearsal；`npm run test:object-storage-live` 仅用于真实 release smoke | 本地 object storage mock 不是 live OSS/S3；live smoke 仍需真实 endpoint、bucket、credential 与 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`。 |

若本地 MySQL 或本地 object storage mock 未准备好，`LOCAL-RELEASE-REHEARSAL-001` 必须输出 `BLOCKED - 需要人工介入`，不得把缺失环境写成通过。该任务即使通过，也只能作为 mock/local rehearsal evidence，不能推动 `RELEASE-001` 退出 `BLOCKED`。

## LOCAL-RELEASE-REHEARSAL-001 本地彩排结果

本轮状态: passed / mock/local rehearsal evidence。

| 验收项 | 结果 | Release 边界 |
| --- | --- | --- |
| `npm run release:local-rehearsal` | PASS | 使用本地 MySQL 配置与脚本启动的本地 object storage mock 完成本地彩排；证据只归类为 mock/local rehearsal evidence。 |
| API / DB / worker / query / file / sample | PASS | 已依次执行 `npm run test:api`、`npm run test:db`、`npm run test:worker`、`npm run test:query`、`npm run test:file`、`npm run test:sample`，用于提前暴露本地集成问题，不替代 `RELEASE-001`、真实 MySQL、live object storage 或正式 release evidence。 |
| live object storage smoke | SKIPPED / BLOCKED | 因当前 object storage endpoint 为本地 mock，`npm run test:object-storage-live` 被明确跳过；live OSS/S3 仍需真实 endpoint、bucket、credential 与 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 后单独验证。 |

`RELEASE-001` 仍保持 BLOCKED；`REAL-RELEASE-ENV-READY` 仍是外部哨兵依赖。`LOCAL-RELEASE-REHEARSAL-001` 的通过结果不能解除该哨兵，也不能写成 release gate 通过。

## MOCK-INTEGRATION-001 本地验收结果

本轮状态: accepted / local-dev-only。

| 验收项 | 结果 | Release 边界 |
| --- | --- | --- |
| `npm run arch:check` | PASS | 只证明架构检查可执行，不替代真实 MySQL、DB 抢锁或 live object storage release evidence。 |
| `npm run test:mock-local` | PASS | 只证明 FR-001 至 FR-014 的本地主流程、失败态演练、对象存储本地协议链路和文档边界断言成立。 |
| `npm test` | PASS | 只证明基础单测与静态文档断言通过，不替代 API / DB / worker / query / file / sample 集成测试。 |
| scoped `git diff --check` | PASS | 只证明本任务相关文件无空白错误，不证明任何真实依赖已接通。 |

`RELEASE-001` 仍保持 BLOCKED；`REAL-RELEASE-ENV-READY` 仍是外部哨兵依赖。只有人工确认真实 MySQL `EXPORT_PLATFORM_TEST_DATABASE_URL` 与 live object storage endpoint、bucket、credential、`EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 均可用于 release gate 后，才允许恢复 release 验证。

## mock-first local/dev evidence 映射

`MOCK-FIRST-001` 负责建立 local/dev evidence 基线；`MOCK-INTEGRATION-001` 负责把以下 FR-001 至 FR-014 的主流程、失败态和证据归档同步到本地验收文档 `docs/testing/mock-first-acceptance.md`，并保持其不是 release evidence。

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
- `LOCAL-RELEASE-REHEARSAL-001` 的结果只能标记为 `mock/local rehearsal evidence`，默认 object storage 为本地 mock，显式 env 覆盖也不改变证据边界。
- `MOCK-INTEGRATION-001` 只负责本地验收归档，不能把 local/dev 结果扩写为 release gate 通过。
- mock-first 证据只能用于说明本地链路、联调用例和失败态，不可覆盖 release gate。
- mock-first 证据可以作为 FR-001 到 FR-014 的映射索引，但不能替代 API / DB / worker / query / file / sample 集成证据。
- 若真实依赖缺失，仍必须保留 `BLOCKED - 需要人工介入`。
