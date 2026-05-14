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
| 生产 HTTP 服务入口 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-012 / FR-013 | available / scaffold | `src/server.ts`、`src/routes/route-manifest.ts`、`tests/server.test.mjs` |
| MySQL schema / migration | FR-001 - FR-014 | available / scaffold | `migrations/001_initial_export_platform_schema.sql`、`npm run arch:check` |
| 生产 repository | FR-001 - FR-014 | blocked-by-next-task | 待实现 DB repository 任务 |
| scheduler worker | FR-005 / FR-010 / FR-012 / FR-013 | available / entry-only | `src/workers/scheduler-worker.ts`；DB 抢锁实现待 worker 任务 |
| query executor | FR-006 / FR-008 / FR-009 / FR-014 | blocked-by-next-task | 待实现 query 任务 |
| file service / cleanup job | FR-003 / FR-006 / FR-011 / FR-014 | available / cleanup-entry-only | `src/jobs/cleanup-job.ts`；file service 实现待后续任务 |
| API / DB / worker 集成测试 | FR-001 - FR-014 | blocked-by-next-task | 待实现 API / DB / worker 联调任务 |
| 旧内存实现与旧 trace | FR-001 - FR-014 | removed | 不作为证据 |

## 计划验证入口

| 阶段 | 命令 / 证据 | 最低要求 |
| --- | --- | --- |
| 文档与队列重建 | `git diff --check` | 文档、JSON、任务队列无格式错误 |
| 契约复核 | `npx --yes @redocly/cli@1.34.5 lint contracts/openapi.yaml` | 契约可解析，公开 operation 与需求矩阵一致；`x-contract-implementation-trace` 必须保留 operation 到 handler、service、repository / adapter、DB、worker、audit、file 和测试的后续映射，且 `audit[]` 中每个 action 都必须存在于 `components.schemas.AuditEvent.properties.action.enum`，公开错误码必须来自 `components.schemas.ResponseCode` |
| 当前文档差异检查 | `git diff --check -- contracts docs/testing/verify-matrix.md` | 契约文档和验证矩阵无空白错误；该检查只能证明格式正确，不能证明 feature_impl 已完成 |
| 脚手架架构检查 | `npm run arch:check` | `scripts/arch-check.ts` 必须校验 server / worker / job entry、OpenAPI route 映射、替身禁用、migration 覆盖和测试脚本完整性 |
| 当前脚手架单测 | `npm test` | 只覆盖脚手架可静态验证的入口、脚本和矩阵声明，不把 DB/API/worker blocked 项写成必跑失败测试 |
| API 集成测试 | blocked-by-next-task | 公开 route/handler 与 OpenAPI operation 对齐 |
| DB 集成测试 | blocked-by-next-task | migration、repository、事务/锁行为可验证 |
| worker 集成测试 | blocked-by-next-task | DB polling、抢锁、续租、接管、取消和重试边界可验证 |
| release 验证 | 待实现任务补齐 | fresh evidence 覆盖 P0/P1、失败态和 BLOCKED 项 |

## Requirement 验证入口

| Req ID | 后续验证类型 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| FR-001 | contract / API / DB | blocked-by-next-task | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-002 | contract / API / DB | blocked-by-next-task | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-003 | contract / API / file | blocked-by-next-task | `contracts/openapi.yaml`、待创建 file 测试 |
| FR-004 | contract / API / DB | blocked-by-next-task | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-005 | DB / worker | blocked-by-next-task | 待创建 worker 与 DB lease 测试 |
| FR-006 | query / file / worker | blocked-by-next-task | 待创建 query/file/worker 测试 |
| FR-007 | contract / API / DB | blocked-by-next-task | `contracts/openapi.yaml`、待创建 registry 测试 |
| FR-008 | query / DB / security | blocked-by-next-task | 待创建 query template 与数据范围测试 |
| FR-009 | API / query / security | blocked-by-next-task | 待创建认证上下文、权限、脱敏测试 |
| FR-010 | audit / API / worker | blocked-by-next-task | 待创建审计链路测试 |
| FR-011 | file / cleanup job | blocked-by-next-task | 待创建 cleanup job 测试 |
| FR-012 | API / worker / state-machine | blocked-by-next-task | 待创建取消/重试测试 |
| FR-013 | API / DB / worker | blocked-by-next-task | 待创建幂等、配置快照、锁租约测试 |
| FR-014 | sample / pressure / end-to-end | blocked-by-next-task | 待创建采购订单样板与压测证据 |
| STACK-ADR-001 | design / planned / arch-check | planned | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md`、`scripts/arch-check.ts`、`npm run arch:check` |

## STACK-ADR-001 验证细则

`scripts/arch-check.ts` / `npm run arch:check` 的最低检查项、适用范围和状态如下：

| 项目 | 内容 |
| --- | --- |
| 最低检查项 | `src/server.ts`、`src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts` 存在；`contracts/openapi.yaml` 的公开 operation 可映射到 `src/routes/` 的 route/handler；生产入口不得引用 `InMemory*`、mock 或 fixture；`migrations/` 覆盖 task、registry、lease/checkpoint、file metadata、audit log；`package.json` scripts 包含 `test:contract`、`test:api`、`test:db`、`test:worker`、`test:query`、`test:file`、`test:sample` |
| 适用范围 | 后续 `feature_impl` 的固定架构门禁；适用于脚手架、实现、worker、db、file 和 sample 相关任务 |
| 当前状态 | planned |
| 证据路径 | `docs/context/architecture-brief.md`、`plans/features/export-platform.dev-plan.md`、`scripts/arch-check.ts`、`npm run arch:check` |
| 备注 | `npm run arch:check` 不能被 `git diff --check`、OpenAPI lint、单测或人工检查替代 |

## 最终规则

- `feature_impl` 任务不得只以文档、OpenAPI、内存 repository、mock 或 `git diff --check` 作为完成证据。
- `feature_impl` 任务不得只以“契约存在”或“契约 lint 通过”作为完成证据；还必须满足 handler、repository / adapter、worker、file、DB 和测试的生产路径证据要求。
- 每个实现任务必须从 `docs/architecture/constraints.md` 复制 `architecture_constraints` 和 `forbidden_implementations`。
- 没有真实依赖时必须记录 `BLOCKED - 需要人工介入`，不得用测试替身绕过。
- `STACK-ADR-001` 当前仍是 design / planned 基线；后续 `feature_impl` 不得只靠文档和 `git diff --check` 通过，必须先具备 `npm run arch:check` 所需的入口、路由映射和 migration 证据。
