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
| STACK-ADR-001 设计 / 计划基线 | FR-001 / FR-002 / FR-003 / FR-004 / FR-005 / FR-006 / FR-007 / FR-008 / FR-009 / FR-010 / FR-011 / FR-012 / FR-013 / FR-014 | design / planned | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md` |
| OpenAPI 契约 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | available / production-boundary-reviewed | `contracts/openapi.yaml`、`contracts/README.md` |
| 生产 HTTP 服务入口 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-012 / FR-013 | available / route-handler-service-db wired | `src/server.ts`、`src/routes/route-manifest.ts`、`src/task-api/service.ts`、`src/registry-config/service.ts`、`src/audit-log/service.ts`、`tests/api/export-http-api.test.mjs` |
| MySQL schema / migration | FR-001 - FR-014 | available / production-boundary | `migrations/001_initial_export_platform_schema.sql`、`migrations/001_initial_export_platform.ts`、`migrations/003_task_api_visibility_fields.ts`、`migrations/004_task_tenant_visibility_field.ts`、`src/db/migrator.ts`、`npm run arch:check` |
| 生产 repository | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | available / requires-real-mysql | `src/repositories/`、`tests/db/export-repositories.test.mjs`、`npm run test:db` |
| scheduler worker | FR-005 / FR-010 / FR-012 / FR-013 | available / requires-real-mysql | `src/workers/scheduler-worker.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`npm run test:worker` |
| query executor | FR-006 / FR-008 / FR-009 / FR-014 | planned-by `QUERY-EXECUTOR-001` | `tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实 MySQL 或外部数据源不可用时记录 `BLOCKED - 需要人工介入` |
| file service / cleanup job | FR-003 / FR-006 / FR-011 / FR-014 | planned-by `FILE-SERVICE-001` + `CLEANUP-JOB-001` | `tests/file/`、`tests/api/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实对象存储不可用时记录 `BLOCKED - 需要人工介入` |
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
| file-service 验证 | `npm run test:file` | temp object、checksum 校验、published object、ZIP 分片和下载 guard 必须连接真实对象存储或其生产等价环境；依赖不可达时明确 BLOCKED |
| sample 样板验证 | `npm run test:sample` | 采购订单样板必须覆盖 `0/1/20000/20001/100000/100001` 行边界、脱敏、ZIP 和压测证据；真实 MySQL 或对象存储不可达时明确 BLOCKED |
| release 验证 | deferred until `SAMPLE-PURCHASE-ORDER-001` | API、DB、worker 已有真实 MySQL 任务级证据；query/file/cleanup/sample 仍需先由后续任务补齐，不能提前 release |

## RELEASE-001 队列修复快照（2026-05-14）

| 验证项 | 关联需求 | 状态 | 证据 / 归因 |
| --- | --- | --- | --- |
| API 集成测试 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | completed-before-release | `TASK-API-HTTP-001` 已使用真实 `EXPORT_PLATFORM_TEST_DATABASE_URL` 验证 `npm run test:api` |
| DB 集成测试 | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | completed-before-release | `DB-SCHEMA-001` 与 `SCHEDULER-WORKER-001` 已使用真实 MySQL 验证 `npm run test:db` |
| Worker 集成测试 | FR-005 / FR-010 / FR-012 / FR-013 | completed-before-release | `SCHEDULER-WORKER-001` 已使用真实 MySQL 验证 `npm run test:worker` |
| Query executor 验证 | FR-006 / FR-008 / FR-009 / FR-014 | planned-by `QUERY-EXECUTOR-001` | 当前只具备任务入口，必须先实现生产路径 |
| File service 验证 | FR-003 / FR-006 / FR-009 / FR-014 | planned-by `FILE-SERVICE-001` | 当前只具备任务入口，必须先实现生产路径 |
| Cleanup job 验证 | FR-003 / FR-011 | planned-by `CLEANUP-JOB-001` | 当前只具备任务入口，必须先实现生产路径 |
| Sample 样板验证 | FR-014 | planned-by `SAMPLE-PURCHASE-ORDER-001` | 当前只具备任务入口，必须先实现生产路径 |

> 结论：`RELEASE-001` 不应直接依赖 `QUERY-FILE-SAMPLE-PLAN-001`。release 已延后到 `SAMPLE-PURCHASE-ORDER-001` 之后，避免 query/file/cleanup/sample 仍未实现时提前收口。

## Requirement 验证入口

| Req ID | 后续验证类型 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| FR-001 | contract / API / DB | HTTP handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-002 | contract / API / DB | HTTP detail handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-003 | contract / API / file | planned-by `FILE-SERVICE-001` + `CLEANUP-JOB-001` | `contracts/openapi.yaml`、`tests/file/`、`tests/api/`、`docs/testing/verify-matrix.md`；真实对象存储不可用时记录 `BLOCKED - 需要人工介入` |
| FR-004 | contract / API / DB | HTTP list handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/task-api/service.ts`、`tests/api/export-http-api.test.mjs` |
| FR-005 | DB / worker | DB lease repository and worker polling available / requires-real-mysql | `src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-006 | query / file / worker | planned-by `QUERY-EXECUTOR-001` + `FILE-SERVICE-001` + `SAMPLE-PURCHASE-ORDER-001` | `tests/query/`、`tests/file/`、`tests/worker/`、`tests/sample/`、`docs/testing/verify-matrix.md`；真实 MySQL 或对象存储不可用时记录 `BLOCKED - 需要人工介入` |
| FR-007 | contract / API / DB | registry HTTP handler-service-repository wired / requires-real-mysql | `contracts/openapi.yaml`、`src/registry-config/service.ts`、`src/repositories/export-registry.repository.ts`、`tests/api/export-http-api.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-008 | query / DB / security | planned-by `QUERY-EXECUTOR-001` | `tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实 MySQL 或外部数据源不可用时记录 `BLOCKED - 需要人工介入` |
| FR-009 | API / query / security | API auth context consumed / query+file planned-by `QUERY-EXECUTOR-001` + `FILE-SERVICE-001` | `src/audit-log/auth-context.ts`、`tests/api/export-http-api.test.mjs`、`tests/query/`、`tests/file/`、`docs/testing/verify-matrix.md`；真实依赖不可用时记录 `BLOCKED - 需要人工介入` |
| FR-010 | audit / API / worker | API and worker audit writes wired / requires-real-mysql | `src/audit-log/service.ts`、`src/repositories/export-audit.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-011 | file / cleanup job | planned-by `CLEANUP-JOB-001` | `tests/file/`、`tests/worker/`、`docs/testing/verify-matrix.md`；真实对象存储不可用时记录 `BLOCKED - 需要人工介入` |
| FR-012 | API / worker / state-machine | cancel/retry HTTP boundary and worker batch-cancel boundary wired / requires-real-mysql | `src/task-api/service.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs` |
| FR-013 | API / DB / worker | create idempotency, config snapshot, worker lease takeover and attemptNo retry boundary wired / requires-real-mysql | `src/task-api/service.ts`、`src/repositories/export-task.repository.ts`、`src/repositories/export-lease.repository.ts`、`src/scheduler/worker.ts`、`tests/api/export-http-api.test.mjs`、`tests/worker/scheduler-worker.test.mjs`、`tests/db/export-repositories.test.mjs` |
| FR-014 | sample / pressure / end-to-end | planned-by `SAMPLE-PURCHASE-ORDER-001` | `tests/sample/`、`tests/query/`、`tests/file/`、`docs/testing/verify-matrix.md`；真实 MySQL 或对象存储不可用时记录 `BLOCKED - 需要人工介入` |
| STACK-ADR-001 | design / planned / arch-check | available / DB repository boundary added | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md`、`scripts/arch-check.ts`、`src/db/migrator.ts`、`src/repositories/`、`npm run arch:check`、`npm run test:db` |

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
- `STACK-ADR-001` 当前仍是 design / planned 基线；后续 `feature_impl` 不得只靠文档和 `git diff --check` 通过，必须先具备 `npm run arch:check` 所需的入口、路由映射和 migration 证据。
