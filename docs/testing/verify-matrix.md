# 验证矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**当前基线**: 2026-05-14 fresh-start

> 本矩阵从无实现、无旧运行证据的状态重新开始。当前仓库只保留产品真相源、架构约束、OpenAPI 契约和计划文档；不再承认此前内存 service、Vitest 单测或旧 trace 为生产实现证据。

## 当前状态

| 检查项 | 关联需求 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| 产品真相源 | FR-001 - FR-014 | available | `docs/product/` |
| 架构约束包 | FR-001 - FR-014 | available | `docs/architecture/constraints.md` |
| 架构 brief | FR-001 - FR-014 | available | `docs/context/architecture-brief.md` |
| STACK-ADR-001 设计基线 | FR-001 / FR-002 / FR-003 / FR-004 / FR-005 / FR-006 / FR-007 / FR-008 / FR-009 / FR-010 / FR-011 / FR-012 / FR-013 / FR-014 | design-baseline / implemented-by-release | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md` |
| OpenAPI 契约 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | available / production-boundary-reviewed | `contracts/openapi.yaml`、`contracts/README.md` |
| 生产 HTTP 服务入口 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-012 / FR-013 | available / route-handler-service-db wired | `src/server.ts`、`src/routes/route-manifest.ts`、`src/task-api/service.ts`、`src/registry-config/service.ts`、`src/audit-log/service.ts`、`tests/api/export-http-api.test.mjs` |
| MySQL schema / migration | FR-001 - FR-014 | available / production-boundary | `migrations/001_initial_export_platform_schema.sql`、`migrations/001_initial_export_platform.ts`、`migrations/003_task_api_visibility_fields.ts`、`migrations/004_task_tenant_visibility_field.ts`、`src/db/migrator.ts`、`npm run arch:check` |
| 生产 repository | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | available / local-or-docker-mysql | `src/repositories/`、`tests/db/export-repositories.test.mjs`、`npm run test:db` |
| scheduler worker | FR-005 / FR-010 / FR-012 / FR-013 | available / local-or-docker-mysql | `src/workers/scheduler-worker.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:worker` |
| query executor | FR-006 / FR-008 / FR-009 / FR-014 | production-path wired / local-or-docker-mysql | `src/query-executor/`、`tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；测试数据由本机/Docker MySQL 自动建表和 seed；不得把 file/sample 口径写成已通过 |
| file service / cleanup job | FR-003 / FR-006 / FR-011 / FR-014 | file-service production-path wired / cleanup job production entry + poll-once wired / local-or-docker-mysql；`npm run test:file` 同时覆盖生产等价 object-storage adapter 失败态与本地 HTTP server 驱动的 env-backed adapter，证明 `createObjectStorageFromEnv()` 可完成 put/read/publish/download URL 协议链路，但不宣称 live OSS/S3 release evidence；环境变量缺失时 `createObjectStorageFromEnv()` 仍必须 `BLOCKED - 需要人工介入` | `src/file-service/index.ts`、`src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`src/scheduler/worker.ts`、`tests/file/export-file-service.test.mjs`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:file`、`npm run test:worker` |
| purchase-order sample | FR-014 | executable sample contract / local-or-docker-mysql；`npm run test:sample` 通过公开 registry/task/download service + worker + production-equivalent object-storage adapter 串联样板证据，不宣称 live OSS/S3 release evidence | `src/sample-purchase-order/index.ts`、`src/query-executor/index.ts`、`src/file-service/index.ts`、`tests/sample/purchase-order-sample.test.mjs`、`npm run test:sample`；本机/Docker MySQL 会自动建表并写入测试数据；若要声明外部对象存储已验证，必须另开 live 专项验证 |
| API / DB / worker 集成测试 | FR-001 - FR-014 | available / local-or-docker-mysql | `tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs`、`tests/worker/scheduler-worker.test.mjs` |
| 旧内存实现与旧 trace | FR-001 - FR-014 | removed | 不作为证据 |

## 计划验证入口

| 阶段 | 命令 / 证据 | 最低要求 |
| --- | --- | --- |
| 文档与队列重建 | `git diff --check` | 文档、JSON、任务队列无格式错误 |
| 契约复核 | `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml` | 契约可解析，公开 operation 与需求矩阵一致；`x-contract-implementation-trace` 必须保留 operation 到 handler、service、repository / adapter、DB、worker、audit、file 和测试的后续映射，且 `audit[]` 中每个 action 都必须存在于 `components.schemas.AuditEvent.properties.action.enum`，公开错误码必须来自 `components.schemas.ResponseCode` |
| 当前文档差异检查 | `git diff --check -- contracts docs/testing/verify-matrix.md` | 契约文档和验证矩阵无空白错误；该检查只能证明格式正确，不能证明 feature_impl 已完成 |
| 脚手架架构检查 | `npm run arch:check` | `scripts/arch-check.ts` 必须校验 server / worker / job entry、OpenAPI route 映射、替身禁用、migration 覆盖和测试脚本完整性 |
| 当前脚手架单测 | `npm test` | 只覆盖脚手架可静态验证的入口、脚本和矩阵声明，不把 DB/API/worker blocked 项写成必跑失败测试 |
| API 集成测试 | `npm run test:api` | 公开 route/handler 与 OpenAPI operation 对齐，并要求 `EXPORT_PLATFORM_TEST_DATABASE_URL` 连接本机或 Docker MySQL；release gate 会自动自举 Docker MySQL |
| DB 集成测试 | `npm run test:db` | migration、repository、事务/锁行为必须连接本机或 Docker MySQL；release gate 会自动建库、建表并写入测试数据 |
| worker 集成测试 | `npm run test:worker` | DB polling、原子抢锁、租约续租、过期接管、批次边界取消和 FAILED 重试边界必须连接本机或 Docker MySQL；release gate 会自动提供 DB URL |
| query-executor 验证 | `npm run test:query` | 模板绑定、数据范围、字段映射、脱敏、批次检查点和失败收口必须连接本机或 Docker MySQL；外部业务数据源以受控测试数据模拟 |
| file-service 验证 | `npm run test:file` | temp object、checksum 校验、published object、真实 XLSX OOXML 包与 ZIP 分片二进制解析、下载 guard 必须连接本机或 Docker MySQL；对象存储证据必须同时覆盖生产等价 adapter 失败态和本地 HTTP server 驱动的 env-backed `createObjectStorageFromEnv()` put/read/publish/download URL 流程，不能写成 live OSS/S3 已验证 |
| sample 样板验证 | `npm run test:sample` | 采购订单样板必须覆盖 `0/1/20000/20001/100000/100001` 行边界、脱敏、真实 XLSX/ZIP 二进制解析、公开 create/download service 链路和 10 万行默认批次压测证据；测试数据由本机/Docker MySQL seed；live 对象存储不属于当前完成条件 |
| mock-first local/dev evidence 映射 | `npm run arch:check`、`npm run test:mock-local`、`npm test`、scoped `git diff --check` | `MOCK-FIRST-001` 负责建立 FR-001 - FR-014 的 mock-first local/dev evidence 基线；`MOCK-INTEGRATION-001` 负责补齐本地主流程、失败态和证据归档，并同步到 `docs/testing/mock-first-acceptance.md`。本轮结果只用于本地开发、联调和 failure drill，不是 RELEASE-001 PASS 证据，不能替代 API / DB / worker / query / file / sample 或 docker/mock release gate；mock-first 说明见 `docs/testing/mock-first-release-plan.md`，但它不是 docker/mock release gate |
| 本地 release rehearsal | `npm run release:local-rehearsal` | `LOCAL-RELEASE-REHEARSAL-001` 默认使用本地 object storage mock，显式 env 覆盖也只允许在本地 rehearsal 中使用；同时必须连接本地 MySQL 先压通 API / DB / worker / query / file / sample 集成命令。MySQL URL 可由当前进程环境变量、`-DatabaseUrl` 参数或本地未跟踪的 `.env.local` / `-EnvFile` 提供。证据只能标记为 mock/local rehearsal，不能替代 `RELEASE-001` 的 docker/mock release gate；缺少本地依赖时必须输出 `BLOCKED - 需要人工介入` |
| 本地 demo | `npm run demo:local`、`npm run demo:local:smoke` | `LOCAL-DEMO-001` 负责本机演示入口、自动 migration/seed、runbook 和健康检查 smoke。它使用本机 Docker MySQL 与本地 object storage mock，只产出 local demo / local smoke evidence，不是 release evidence，不能替代 `LOCAL-RELEASE-REHEARSAL-001` 或 `RELEASE-001`。 |
| 测试实践映射守护 | `npm run test:mock-local`、scoped `git diff --check` | `TEST-PRACTICE-MATRIX-001` 负责把关键 test script 显式映射到 task id、需求范围、依赖形态和 evidence 边界，并由 `tests/mock-local/test-practice-matrix.test.mjs` 守护 package scripts、task test_command 与本矩阵不漂移。该任务不替代任何功能测试或 release gate，只防止测试实践失去 task 归属。 |
| release 验证 | `RELEASE-001 docker/mock release gate`（2026-05-15） | `RELEASE-001` 已通过 docker/mock release gate。`scripts/release-verify.ps1` 在缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 时复用或创建本机 Docker MySQL `export-platform-mysql-local`，并启动本地 object storage mock 执行 smoke。该 gate 是本机受控 release 验证；外部生产 MySQL 或 live OSS/S3 不属于当前完成条件；release 结论来自 docker/mock release gate，未直接沿用 mock-first 或 local rehearsal 结果。 |

## 测试实践到 task 映射

| 测试实践 | package script / 命令 | task 归属 | 需求范围 | 依赖形态 | evidence 边界 |
| --- | --- | --- | --- | --- | --- |
| 基础架构与契约静态检查 | `npm run arch:check`、`npm run typecheck`、`npm run test:contract`、OpenAPI lint | `SERVICE-SCAFFOLD-001`、`CONTRACT-REVIEW-001`、`TEST-PRACTICE-MATRIX-001`、`RELEASE-001` | FR-001 - FR-014 | 本地静态 / 契约文件 | 只能证明入口、路由映射、契约和类型边界；不能替代 API / DB / worker / query / file / sample 集成证据。 |
| 基础单测 | `npm test` | `SERVICE-SCAFFOLD-001`、`MOCK-FIRST-001`、`MOCK-INTEGRATION-001`、`RELEASE-001` | FR-001 - FR-014 | 本地进程 | 覆盖基础脚手架、文档守护和轻量 HTTP 行为；不能替代本机/Docker MySQL 集成测试。 |
| API 集成测试 | `npm run test:api` | `TASK-API-HTTP-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | MySQL；release 时由 Docker MySQL 自举 | 证明公开 HTTP route/handler/service/repository 链路；release 只算 docker/mock，外部生产 MySQL 不属于当前完成条件。 |
| DB 集成测试 | `npm run test:db` | `DB-SCHEMA-001`、`SCHEDULER-WORKER-001`、`QUERY-EXECUTOR-001`、`FILE-SERVICE-001`、`CLEANUP-JOB-001`、`SAMPLE-PURCHASE-ORDER-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | MySQL；release 时由 Docker MySQL 自举 | 证明 migration、repository、锁和持久化边界；未设置 MySQL 时必须 BLOCKED，不能降级为内存替身。 |
| Worker 集成测试 | `npm run test:worker` | `SCHEDULER-WORKER-001`、`QUERY-EXECUTOR-001`、`CLEANUP-JOB-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-005 / FR-010 / FR-012 / FR-013 | MySQL；release 时由 Docker MySQL 自举 | 证明 polling、租约、接管、取消、重试和 cleanup 调度边界；不替代 query/file/sample 的内容级断言。 |
| Query executor 验证 | `npm run test:query` | `QUERY-EXECUTOR-001`、`SAMPLE-PURCHASE-ORDER-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-006 / FR-008 / FR-009 / FR-014 | MySQL；外部数据源以受控测试数据模拟 | 证明模板绑定、数据范围、脱敏、字段映射和 checkpoint；不声明外部业务库 live 已接入。 |
| File service 验证 | `npm run test:file` | `FILE-SERVICE-001`、`CLEANUP-JOB-001`、`SAMPLE-PURCHASE-ORDER-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | MySQL + production-equivalent adapter；release 时使用本地 object storage mock | 证明 temp/checksum/publish/download/cleanup；本地 HTTP adapter 和 docker/mock smoke 不能写成外部 live OSS/S3 已验证。 |
| Sample 样板验证 | `npm run test:sample` | `SAMPLE-PURCHASE-ORDER-001`、`LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-014 | MySQL + production-equivalent adapter；release 时使用本地 object storage mock | 证明采购订单样板、0/1/20000/20001/100000/100001 行边界、XLSX/ZIP 和公开 create/download 链路；live 对象存储不属于当前完成条件。 |
| Mock-first local/dev 验收 | `npm run test:mock-local` | `MOCK-FIRST-001`、`MOCK-INTEGRATION-001`、`TEST-PRACTICE-MATRIX-001` | FR-001 - FR-014 | 本地 mock / 文档守护 | 只证明本地开发、失败态演练、文档边界和测试实践映射；不是 release evidence。 |
| Object storage smoke | `npm run test:object-storage-live` | `LOCAL-RELEASE-REHEARSAL-001`、`RELEASE-001` | FR-003 / FR-006 / FR-011 / FR-014 | local rehearsal 可跳过；docker/mock release 显式允许本地 smoke；外部 live 需另行配置 | 在 `RELEASE-001` 中只声明 docker/mock release evidence；外部 live OSS/S3 验证必须另开任务，不得覆盖当前结论。 |
| 本地 release rehearsal | `npm run release:local-rehearsal` | `LOCAL-RELEASE-REHEARSAL-001` | FR-001 - FR-014 | 本地 MySQL + 本地 object storage mock | 只用于本机彩排 API / DB / worker / query / file / sample 链路；不能替代 `RELEASE-001` docker/mock release gate。 |
| 本地 demo | `npm run demo:local`、`npm run demo:local:smoke` | `LOCAL-DEMO-001` | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-014 | 本机 Docker MySQL + 本地 object storage mock + 本地 seed 数据 | 只用于人工演示、runbook 示例和 `GET /health` smoke；不是 release evidence，不能替代 API / DB / worker / query / file / sample 全链路验证，也不能写成外部 MySQL 或 live OSS/S3 证据。 |
| Docker/mock release gate | `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1` | `RELEASE-001` | FR-001 - FR-014 | 本机 Docker MySQL + 本地 object storage mock | 当前 release 结论来源；外部生产 MySQL 或 live OSS/S3 不属于当前完成条件。 |

## RELEASE-001 fresh release evidence snapshot（2026-05-15）

| 验证项 | 关联需求 | 状态 | 证据 / 归因 |
| --- | --- | --- | --- |
| API 集成测试 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 后执行 `npm run test:api`，2/2 passed。 |
| DB 集成测试 | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 后执行 `npm run test:db`，3/3 passed。 |
| Worker 集成测试 | FR-005 / FR-010 / FR-012 / FR-013 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 后执行 `npm run test:worker`，11/11 passed。 |
| Query executor 验证 | FR-006 / FR-008 / FR-009 / FR-014 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 后执行 `npm run test:query`，8/8 passed。 |
| File service 验证 | FR-003 / FR-006 / FR-009 / FR-014 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 与本地 object storage mock 后执行 `npm run test:file`，9/9 passed。 |
| Sample 样板验证 | FR-014 | PASS / docker-mock-release | `release-verify.ps1` 自举本机 Docker MySQL 与本地 object storage mock 后执行 `npm run test:sample`，9/9 passed，包含 0/1/20000/20001/100000/100001 行边界。 |
| Docker/mock object storage smoke | FR-003 / FR-006 / FR-011 / FR-014 | PASS / docker-mock-release | `scripts/release-verify.ps1` 启动本地 object storage mock，设置 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true` 和 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=true` 后执行 `npm run test:object-storage-live`，smoke passed。该项只声明 docker/mock release evidence，不声明外部 live OSS/S3 已验证。 |
| 契约 / 基线校验 | FR-001 - FR-014 | 已执行通过 / 本轮前置门槛通过 | 当前 release gate 使用 `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml`；该项只能证明契约和前置校验完成，不能代替 API/DB/worker/query/file/sample 或 live object storage release evidence |

> 结论：`RELEASE-001` 已通过 docker/mock release gate。2026-05-15 22:16 +08:00 前后执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1`，脚本自举本机 Docker MySQL 与本地 object storage mock 后完整通过 audit、arch、typecheck、contract、base tests、OpenAPI lint、API、DB、worker、query、file、sample、object-storage smoke 和 scoped `git diff --check`。

## MOCK-INTEGRATION-001 local/dev acceptance

| 验证项 | 关联需求 | 状态 | 证据 / 归因 |
| --- | --- | --- | --- |
| 本地集成验收归档 | FR-001 - FR-014 | accepted / local-dev-only | `MOCK-INTEGRATION-001` 已执行 `npm run arch:check`、`npm run test:mock-local`、`npm test` 与 scoped `git diff --check`，并把 FR-001 - FR-014 的主流程、失败态和证据归档同步到 `docs/testing/mock-first-acceptance.md`、`docs/testing/mock-first-release-plan.md` 与本矩阵；该任务不是 release evidence，不替代 docker/mock release gate |
| 本地 release rehearsal | FR-001 - FR-014 | passed / mock/local rehearsal | `LOCAL-RELEASE-REHEARSAL-001` 已通过 `npm run release:local-rehearsal` 连接本地 MySQL 与本地 object storage mock，先执行 API、DB、worker、query、file 和 sample 集成命令；证据只能写成 mock/local rehearsal，不是 RELEASE-001 PASS 证据，不能替代 docker/mock release gate |

## LOCAL-RELEASE-REHEARSAL-001 mock/local rehearsal result（2026-05-15）

| 验证项 | 关联需求 | 状态 | 证据 / 归因 |
| --- | --- | --- | --- |
| 本地 release rehearsal 入口 | FR-001 - FR-014 | PASS / mock-local-only | `npm run release:local-rehearsal` 已执行通过；脚本使用本地 MySQL 配置，并启动本地 object storage mock。该结果只证明 mock/local rehearsal 链路可运行，不是 `RELEASE-001` PASS 证据。 |
| API / DB / worker / query / file / sample 集成命令 | FR-001 - FR-014 | PASS / mock-local-only | 本轮依次通过 `npm run arch:check`、`npm run typecheck`、`npm run test:contract`、`npm test`、`npm run test:api`、`npm run test:db`、`npm run test:worker`、`npm run test:query`、`npm run test:file`、`npm run test:sample`。其中 API / DB / worker / query / file / sample 只作为本地彩排证据，不替代正式 release evidence。 |
| Docker/mock object storage smoke | FR-003 / FR-006 / FR-011 / FR-014 | PASS / docker-mock-release | `RELEASE-001` 已由 `release-verify.ps1` 独立启动本地 object storage mock 并执行 docker/mock smoke。 |
| Release gate 边界 | FR-001 - FR-014 | PASS / docker/mock gate | `RELEASE-001` 已通过 docker/mock release gate；本地彩排未替代该 gate 的完整验证。 |

> 结论：`LOCAL-RELEASE-REHEARSAL-001` 在 2026-05-15 通过本地 mock/local rehearsal；该结论只说明本地 MySQL 与本地 object storage mock 下 API、DB、worker、query、file 和 sample 集成链路已压通。`RELEASE-001` 已单独执行并通过 docker/mock release gate。

## Requirement 验证入口

| Req ID | 后续验证类型 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| FR-001 | contract / API / DB | HTTP handler-service-repository wired / local-or-docker-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-002 | contract / API / DB | HTTP detail handler-service-repository wired / local-or-docker-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-003 | contract / API / file | file-service production-path wired with temp object / checksum / publish / download metadata guard; cleanup job invalidates metadata before object delete and records cleanup audit/event | `src/file-service/index.ts`、`src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`tests/file/export-file-service.test.mjs`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:file`、`npm run test:worker`；`npm run test:file` 同时覆盖生产等价 adapter 与本地 HTTP env-backed adapter，后者只证明 `createObjectStorageFromEnv()` 协议链路，不得写成 live OSS/S3 已验证；环境变量缺失时必须记录 `BLOCKED - 需要人工介入` |
| FR-004 | contract / API / DB | HTTP list handler-service-repository wired / local-or-docker-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-005 | DB / worker | DB lease repository and worker polling available / local-or-docker-mysql | `src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-006 | query / file / worker | query executor production-path wired / file-service production-path wired with temp object / checksum / publish / ZIP metadata guard; sample boundary coverage executable-by `SAMPLE-PURCHASE-ORDER-001` | `src/query-executor/`、`src/file-service/index.ts`、`src/scheduler/worker.ts`、`src/repositories/export-file.repository.ts`、`tests/query/`、`tests/worker/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`tests/api/export-http-api.test.mjs`、`npm run test:file`、`npm run test:sample`；`npm run test:file` 覆盖 env-backed HTTP adapter 的发布与下载 URL 流程，`npm run test:sample` 覆盖默认批次 10 万行不丢批次；本机/Docker MySQL 与测试数据由 release gate 提供，对象存储 adapter 证据不得冒充 live release evidence |
| FR-007 | contract / API / DB | registry HTTP handler-service-repository wired / local-or-docker-mysql | `contracts/openapi.yaml`、`src/registry-config/service.ts`、`src/repositories/export-registry.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-008 | query / DB / security | query executor production-path wired / local-or-docker-mysql | `src/query-executor/`、`tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；外部业务数据源以受控测试数据模拟 |
| FR-009 | API / query / security | API auth context consumed / query executor production-path wired + file-service production-path wired with signed-url download metadata guard | `src/audit-log/auth-context.ts`、`src/task-api/service.ts`、`src/file-service/index.ts`、`src/repositories/export-file.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/query/`、`tests/worker/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`npm run test:file`、`npm run test:sample`；`npm run test:file` 覆盖 env-backed adapter 生成并可访问的 download URL；本机/Docker MySQL 与测试数据由 release gate 提供，adapter 级对象存储证据不得写成 live release 已验证 |
| FR-010 | audit / API / worker | API and worker audit writes wired / local-or-docker-mysql | `src/audit-log/service.ts`、`src/repositories/export-audit.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-011 | file / cleanup job | cleanup job production-path wired with expired scan / metadata invalidation / object delete / retry audit | `src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`tests/file/export-file-service.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`docs/testing/verify-matrix.md`；对象存储 adapter 证据不得写成 live release 已验证；环境变量缺失或 MySQL 不可用时记录 `BLOCKED - 需要人工介入` |
| FR-012 | API / worker / state-machine | cancel/retry HTTP boundary and worker batch-cancel boundary wired / local-or-docker-mysql | `src/task-api/service.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs` |
| FR-013 | API / DB / worker | create idempotency, config snapshot, worker lease takeover and attemptNo retry boundary wired / local-or-docker-mysql | `src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-014 | sample / pressure / end-to-end | purchase-order sample contract executable / query executor production-path wired / file-service production-path wired with temp object / checksum / publish / download metadata guard | `src/sample-purchase-order/index.ts`、`src/query-executor/index.ts`、`src/file-service/index.ts`、`src/repositories/export-file.repository.ts`、`tests/query/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`tests/api/export-http-api.test.mjs`、`npm run test:sample`、`npm run test:file`；`npm run test:file` 额外覆盖 env-backed HTTP adapter，`npm run test:sample` 覆盖公开 create/download service、worker、下载审计、最终文件脱敏断言和默认批次 10 万行；本机/Docker MySQL 与测试数据由 release gate 提供，对象存储 adapter 证据不得冒充 live release evidence |
| STACK-ADR-001 | design-baseline / arch-check | available / DB repository boundary added | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md`、`scripts/arch-check.ts`、`src/db/migrator.ts`、`src/repositories/`、`npm run arch:check`、`npm run test:db` |

## STACK-ADR-001 验证细则

`scripts/arch-check.ts` / `npm run arch:check` 的最低检查项、适用范围和状态如下：

| 项目 | 内容 |
| --- | --- |
| 最低检查项 | `src/server.ts`、`src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts` 存在；`contracts/openapi.yaml` 的公开 operation 可映射到 `src/routes/` 的 route/handler；生产入口不得引用 `InMemory*`、mock 或 fixture；`migrations/` 覆盖 task、registry、lease/checkpoint、file metadata、audit log；`src/db/migrator.ts` 和 `src/repositories/index.ts` 存在；`package.json` scripts 包含 `test:contract`、`test:api`、`test:db`、`test:worker`、`test:query`、`test:file`、`test:sample` |
| 适用范围 | 后续 `feature_impl` 的固定架构门禁；适用于脚手架、实现、worker、db、file 和 sample 相关任务 |
| 当前状态 | available / DB repository boundary added |
| 证据路径 | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md`、`scripts/arch-check.ts`、`src/db/migrator.ts`、`src/repositories/`、`npm run arch:check`、`npm run test:db` |
| 备注 | `npm run arch:check` 不能被 `git diff --check`、OpenAPI lint、单测或人工检查替代 |

## 最终规则

- `feature_impl` 任务不得只以文档、OpenAPI、内存 repository、mock 或 `git diff --check` 作为完成证据。
- `feature_impl` 任务不得只以“契约存在”或“契约 lint 通过”作为完成证据；还必须满足 handler、repository / adapter、worker、file、DB 和测试的生产路径证据要求。
- 每个实现任务必须从 `docs/architecture/constraints.md` 复制 `architecture_constraints` 和 `forbidden_implementations`。
- 没有本机/Docker MySQL、本地 object storage mock 或任务声明依赖时必须记录 `BLOCKED - 需要人工介入`，不得用内存替身绕过。
- `STACK-ADR-001` 当前是 design-baseline；后续 `feature_impl` 不得只靠文档和 `git diff --check` 通过，必须先具备 `npm run arch:check` 所需的入口、路由映射和 migration 证据。
- `LOCAL-RELEASE-REHEARSAL-001` 的结果只能算 mock/local rehearsal evidence；`RELEASE-001` 的正式 release evidence 来自 `release-verify.ps1` 自举本机 Docker MySQL 与本地 object storage mock 的完整 docker/mock release gate。
