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
| 生产 repository | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | available / requires-real-mysql | `src/repositories/`、`tests/db/export-repositories.test.mjs`、`npm run test:db` |
| scheduler worker | FR-005 / FR-010 / FR-012 / FR-013 | available / requires-real-mysql | `src/workers/scheduler-worker.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:worker` |
| query executor | FR-006 / FR-008 / FR-009 / FR-014 | production-path wired / requires-real-mysql | `src/query-executor/`、`tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实 MySQL 或外部数据源不可用时记录 `BLOCKED - 需要人工介入`，不得把 file/sample 口径写成已通过 |
| file service / cleanup job | FR-003 / FR-006 / FR-011 / FR-014 | file-service production-path wired / cleanup job production entry + poll-once wired / requires-real-mysql；`npm run test:file` 同时覆盖生产等价 object-storage adapter 失败态与本地 HTTP server 驱动的 env-backed adapter，证明 `createObjectStorageFromEnv()` 可完成 put/read/publish/download URL 协议链路，但不宣称 live OSS/S3 release evidence；环境变量缺失时 `createObjectStorageFromEnv()` 仍必须 `BLOCKED - 需要人工介入` | `src/file-service/index.ts`、`src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`src/scheduler/worker.ts`、`tests/file/export-file-service.test.mjs`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:file`、`npm run test:worker` |
| purchase-order sample | FR-014 | executable sample contract / requires-real-mysql；`npm run test:sample` 通过公开 registry/task/download service + worker + production-equivalent object-storage adapter 串联样板证据，不宣称 live OSS/S3 release evidence | `src/sample-purchase-order/index.ts`、`src/query-executor/index.ts`、`src/file-service/index.ts`、`tests/sample/purchase-order-sample.test.mjs`、`npm run test:sample`；真实 MySQL 不可用时记录 `BLOCKED - 需要人工介入`；若要声明真实对象存储已验证，必须改用环境驱动对象存储并在不可达时 BLOCKED |
| API / DB / worker 集成测试 | FR-001 - FR-014 | available / requires-real-mysql | `tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs`、`tests/worker/scheduler-worker.test.mjs` |
| 旧内存实现与旧 trace | FR-001 - FR-014 | removed | 不作为证据 |

## 计划验证入口

| 阶段 | 命令 / 证据 | 最低要求 |
| --- | --- | --- |
| 文档与队列重建 | `git diff --check` | 文档、JSON、任务队列无格式错误 |
| 契约复核 | `npx --yes @redocly/cli@1.34.5 lint contracts/openapi.yaml` | 契约可解析，公开 operation 与需求矩阵一致；`x-contract-implementation-trace` 必须保留 operation 到 handler、service、repository / adapter、DB、worker、audit、file 和测试的后续映射，且 `audit[]` 中每个 action 都必须存在于 `components.schemas.AuditEvent.properties.action.enum`，公开错误码必须来自 `components.schemas.ResponseCode` |
| 当前文档差异检查 | `git diff --check -- contracts docs/testing/verify-matrix.md` | 契约文档和验证矩阵无空白错误；该检查只能证明格式正确，不能证明 feature_impl 已完成 |
| 脚手架架构检查 | `npm run arch:check` | `scripts/arch-check.ts` 必须校验 server / worker / job entry、OpenAPI route 映射、替身禁用、migration 覆盖和测试脚本完整性 |
| 当前脚手架单测 | `npm test` | 只覆盖脚手架可静态验证的入口、脚本和矩阵声明，不把 DB/API/worker blocked 项写成必跑失败测试 |
| API 集成测试 | `npm run test:api` | 公开 route/handler 与 OpenAPI operation 对齐，并要求 `EXPORT_PLATFORM_TEST_DATABASE_URL` 连接真实 MySQL；MySQL 不可达时明确 BLOCKED |
| DB 集成测试 | `npm run test:db` | migration、repository、事务/锁行为必须连接真实 MySQL；未设置 `EXPORT_PLATFORM_TEST_DATABASE_URL` 时明确 BLOCKED |
| worker 集成测试 | `npm run test:worker` | DB polling、原子抢锁、租约续租、过期接管、批次边界取消和 FAILED 重试边界必须连接真实 MySQL；未设置 `EXPORT_PLATFORM_TEST_DATABASE_URL` 时明确 BLOCKED |
| query-executor 验证 | `npm run test:query` | 模板绑定、数据范围、字段映射、脱敏、批次检查点和失败收口必须连接真实 MySQL；外部数据源不可达时明确 BLOCKED |
| file-service 验证 | `npm run test:file` | temp object、checksum 校验、published object、真实 XLSX OOXML 包与 ZIP 分片二进制解析、下载 guard 必须连接真实 MySQL；对象存储证据必须同时覆盖生产等价 adapter 失败态和本地 HTTP server 驱动的 env-backed `createObjectStorageFromEnv()` put/read/publish/download URL 流程，不能写成 live OSS/S3 已验证；环境变量缺失时明确 BLOCKED |
| sample 样板验证 | `npm run test:sample` | 采购订单样板必须覆盖 `0/1/20000/20001/100000/100001` 行边界、脱敏、真实 XLSX/ZIP 二进制解析、公开 create/download service 链路和 10 万行默认批次压测证据；真实 MySQL 不可达时明确 BLOCKED；live 对象存储不可达时不得把 adapter 证据写成 release 已验证 |
| mock-first local/dev evidence 映射 | `npm run arch:check`、`npm run test:mock-local`、`npm test`、scoped `git diff --check` | FR-001 - FR-014 均可获得 mock-first local/dev evidence、联调入口和失败态演练映射；该结果不是 RELEASE-001 PASS 证据，不能替代 API / DB / worker / query / file / sample 或 live OSS/S3 release gate |
| release 验证 | `RELEASE-001 fresh evidence snapshot`（2026-05-15） | 最新 release trace 显示 API gate 因缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 被阻塞，DB/worker/query/file/sample 本轮未执行；真实/live object storage smoke 也仍无仓内自动化证据，因此 release 结论必须保持 BLOCKED，不能写成 fully passed；mock-first 说明见 `docs/testing/mock-first-release-plan.md`，但它不是 release gate |

## RELEASE-001 fresh release evidence snapshot（2026-05-15）

| 验证项 | 关联需求 | 状态 | 证据 / 归因 |
| --- | --- | --- | --- |
| API 集成测试 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | BLOCKED - 需要人工介入 | 最新 release trace 显示 `npm run test:api` 在缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 时即停止，当前 API gate 未通过；该结果不能写成历史通过记录 |
| DB 集成测试 | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | 本轮未执行 / 当前 blocked | 由于 API gate 先被阻塞，DB 集成测试本轮未执行，不能沿用历史通过记录作为当前 release evidence |
| Worker 集成测试 | FR-005 / FR-010 / FR-012 / FR-013 | 本轮未执行 / 当前 blocked | 由于 API gate 先被阻塞，worker 集成测试本轮未执行，不能沿用历史通过记录作为当前 release evidence |
| Query executor 验证 | FR-006 / FR-008 / FR-009 / FR-014 | 本轮未执行 / 当前 blocked | 由于 API gate 先被阻塞，query executor 验证本轮未执行，不能沿用历史通过记录作为当前 release evidence |
| File service 验证 | FR-003 / FR-006 / FR-009 / FR-014 | 本轮未执行 / 当前 blocked | 由于 API gate 先被阻塞，file service 验证本轮未执行；历史 adapter/local HTTP 证据可保留，但不能写成当前历史通过记录或 live OSS/S3 release evidence |
| Sample 样板验证 | FR-014 | 本轮未执行 / 当前 blocked | 由于 API gate 先被阻塞，sample 样板验证本轮未执行；历史 adapter/local HTTP 证据可保留，但不能写成当前历史通过记录或 live object storage release evidence |
| Live object storage release evidence | FR-003 / FR-006 / FR-011 / FR-014 | BLOCKED - 需要人工介入 | `npm run test:object-storage-live` 是 release gate 的真实/live object storage smoke 入口；当前配置仍是 placeholder-only，且真实桶写入需显式设置 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`，命令会明确 BLOCKED。该项不能用历史 adapter/local HTTP 结果替代当前 release evidence |
| 契约 / 基线校验 | FR-001 - FR-014 | 基础校验已通过 / 已执行通过 | `npm audit --audit-level=high --registry=https://registry.npmjs.org`、`npm run arch:check`、`npm run typecheck`、`npm run test:contract`、`npm test`、`npx --yes @redocly/cli@1.34.5 lint contracts/openapi.yaml` 及 scoped `git diff --check` 均已通过；该项只能证明基础校验完成，不能代替 API/DB/worker/query/file/sample 或 live object storage release evidence |

> 结论：`RELEASE-001` 当前状态为 `BLOCKED`。最新 release trace 显示 API gate 因缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL` 停止，DB、worker、query、file、sample 本轮未执行，live object storage 也仍然 blocked；历史通过记录只能作为旧证据保留，不能写成当前 fully passed。mock-first 只用于本地开发、联调和失败态演练，详情见 `docs/testing/mock-first-release-plan.md`，它不能替代 release gate。

## Requirement 验证入口

| Req ID | 后续验证类型 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| FR-001 | contract / API / DB | HTTP handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-002 | contract / API / DB | HTTP detail handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-003 | contract / API / file | file-service production-path wired with temp object / checksum / publish / download metadata guard; cleanup job invalidates metadata before object delete and records cleanup audit/event | `src/file-service/index.ts`、`src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`tests/file/export-file-service.test.mjs`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:file`、`npm run test:worker`；`npm run test:file` 同时覆盖生产等价 adapter 与本地 HTTP env-backed adapter，后者只证明 `createObjectStorageFromEnv()` 协议链路，不得写成 live OSS/S3 已验证；环境变量缺失时必须记录 `BLOCKED - 需要人工介入` |
| FR-004 | contract / API / DB | HTTP list handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-005 | DB / worker | DB lease repository and worker polling available / requires-real-mysql | `src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-006 | query / file / worker | query executor production-path wired / file-service production-path wired with temp object / checksum / publish / ZIP metadata guard; sample boundary coverage executable-by `SAMPLE-PURCHASE-ORDER-001` | `src/query-executor/`、`src/file-service/index.ts`、`src/scheduler/worker.ts`、`src/repositories/export-file.repository.ts`、`tests/query/`、`tests/worker/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`tests/api/export-http-api.test.mjs`、`npm run test:file`、`npm run test:sample`；`npm run test:file` 覆盖 env-backed HTTP adapter 的发布与下载 URL 流程，`npm run test:sample` 覆盖默认批次 10 万行不丢批次；真实 MySQL 不可用时记录 `BLOCKED - 需要人工介入`，对象存储 adapter 证据不得冒充 live release evidence |
| FR-007 | contract / API / DB | registry HTTP handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/registry-config/service.ts`、`src/repositories/export-registry.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-008 | query / DB / security | query executor production-path wired / requires-real-mysql | `src/query-executor/`、`tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实 MySQL 或外部数据源不可用时记录 `BLOCKED - 需要人工介入` |
| FR-009 | API / query / security | API auth context consumed / query executor production-path wired + file-service production-path wired with signed-url download metadata guard | `src/audit-log/auth-context.ts`、`src/task-api/service.ts`、`src/file-service/index.ts`、`src/repositories/export-file.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/query/`、`tests/worker/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`npm run test:file`、`npm run test:sample`；`npm run test:file` 覆盖 env-backed adapter 生成并可访问的 download URL；真实依赖不可用时记录 `BLOCKED - 需要人工介入`，adapter 级对象存储证据不得写成 live release 已验证 |
| FR-010 | audit / API / worker | API and worker audit writes wired / requires-real-mysql | `src/audit-log/service.ts`、`src/repositories/export-audit.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-011 | file / cleanup job | cleanup job production-path wired with expired scan / metadata invalidation / object delete / retry audit | `src/cleanup-job/index.ts`、`src/jobs/cleanup-job.ts`、`src/repositories/export-file.repository.ts`、`tests/file/export-file-service.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`docs/testing/verify-matrix.md`；对象存储 adapter 证据不得写成 live release 已验证；环境变量缺失或 MySQL 不可用时记录 `BLOCKED - 需要人工介入` |
| FR-012 | API / worker / state-machine | cancel/retry HTTP boundary and worker batch-cancel boundary wired / requires-real-mysql | `src/task-api/service.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs` |
| FR-013 | API / DB / worker | create idempotency, config snapshot, worker lease takeover and attemptNo retry boundary wired / requires-real-mysql | `src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-014 | sample / pressure / end-to-end | purchase-order sample contract executable / query executor production-path wired / file-service production-path wired with temp object / checksum / publish / download metadata guard | `src/sample-purchase-order/index.ts`、`src/query-executor/index.ts`、`src/file-service/index.ts`、`src/repositories/export-file.repository.ts`、`tests/query/`、`tests/file/export-file-service.test.mjs`、`tests/sample/purchase-order-sample.test.mjs`、`tests/api/export-http-api.test.mjs`、`npm run test:sample`、`npm run test:file`；`npm run test:file` 额外覆盖 env-backed HTTP adapter，`npm run test:sample` 覆盖公开 create/download service、worker、下载审计、最终文件脱敏断言和默认批次 10 万行；真实 MySQL 不可用时记录 `BLOCKED - 需要人工介入`，对象存储 adapter 证据不得冒充 live release evidence |
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
- 没有真实依赖时必须记录 `BLOCKED - 需要人工介入`，不得用测试替身绕过。
- `STACK-ADR-001` 当前是 design-baseline；后续 `feature_impl` 不得只靠文档和 `git diff --check` 通过，必须先具备 `npm run arch:check` 所需的入口、路由映射和 migration 证据。
