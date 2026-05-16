# DEV-PLAN：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-15
**用途**: 给后续实现任务提供可直接执行的拆分、边界、验证顺序和证据路径。

## 当前实现与验证状态

- RELEASE-001 当前 release gate 已通过：证据来自本机 Docker MySQL + 本地 object storage mock 的 docker/mock release gate，而不是外部生产 MySQL、live OSS/S3 或外部业务数据源。
- `REQUIREMENTS-GAP-REPAIR-001` 的六个 P0/P1 repair 已有 fresh evidence；但完整需求复审仍需由 `REQUIREMENTS-COMPLETE-REVIEW-001` 后续重跑确认，不能直接等同于最终复审完成。
- 历史通过记录可以保留为旧证据，但不能覆盖当前 docker/mock release evidence，也不能把 live evidence 写成已验证。
- 以下内容保留计划分层和任务入口，但其中的历史扩展措辞应理解为原始计划背景，不是当前 truth source。

## 1. 计划目标

- 先把契约、测试矩阵和证据路径固定，再进入实现。
- 当前仓库的实现与验证已覆盖 RELEASE-001 主链路；`contracts/README.md` 作为契约入口已存在，配套契约和测试结果已纳入当前验证闭环。
- 任一后续任务不能倒退到预实现口径，必须基于当前实现态继续演进。
- `STACK-ADR-001` 已要求后续实现 owned paths 必须按 `src/routes/`、`src/task-api/`、`src/registry-config/`、`src/scheduler/`、`src/query-executor/`、`src/file-service/`、`src/cleanup-job/`、`src/audit-log/`、`src/repositories/`、`src/db/`、`migrations/`、`scripts/arch-check.ts`、`tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` 拆分，不能只写笼统 `src/` 或 `tests/`。

## 2. 任务拆分

| 阶段 | 目标 | 主要产物 | 依赖 | 验收顺序 |
| --- | --- | --- | --- | --- |
| P1 | 固定分析与测试左移材料 | `docs/context/*`、`docs/testing/*` | 产品真相源 | 最先 |
| P2 | 补齐契约骨架 | `contracts/README.md`、`contracts/openapi.yaml`、`contracts/api/`、`contracts/scheduler/`、`contracts/query/`、`contracts/file/`、`contracts/audit/`、`contracts/sample/` | P1 | CONTRACT-001 已落 `contracts/openapi.yaml`；FR-001/002/003/004/007/008/009/010/012/013 先验收 |
| P3 | 测试骨架与回归归档 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` | P2 | 历史基线说明转为归档，当前状态以最新 release 证据为准；旧 历史通过记录 只能作历史记录，不能替代当前 blocked 口径 |
| P4 | 实现 task-api 与 registry-config | 创建、查询、历史、下载、进度/详情、注册、启停、幂等；创建成功响应必须回传 `idempotencyScope` | P2/P3 | FR-001、FR-002、FR-004、FR-007、FR-013 |
| P5 | 实现 scheduler 与 query-executor | 抢锁、租约、游标、数据范围、批次事件 | P2/P3 | FR-005、FR-006、FR-008、FR-010 |
| P6 | 实现 file-service | 临时对象、发布校验、下载元信息、分片打包 | P2/P3/P5 | FR-003、FR-006、FR-009 |
| P7 | 实现 cleanup-job | 过期失效、对象删除、失败重试记录 | P2/P3/P6 | FR-003、FR-011 |
| P8 | 实现采购订单样板 | 样板合同、边界数据、10 万行压测证据 | P2/P3/P5/P6/P7 | FR-014 |

## 3. 模块边界与 owned paths

| 模块 | 建议 owned paths | 备注 |
| --- | --- | --- |
| 需求与测试文档 | `docs/context/`、`docs/testing/` | 已可直接写入 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` | 已创建 |
| 契约 | `contracts/README.md`、`contracts/openapi.yaml`、`contracts/api/`、`contracts/scheduler/`、`contracts/query/`、`contracts/file/`、`contracts/audit/`、`contracts/sample/` | `contracts/README.md` 已存在；当前契约与验证口径已纳入 RELEASE-001 状态 |
| 测试 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` | 当前测试层用于承载当前 release blocked 下的回归与证据；历史 历史通过记录 仅可作为旧记录 |
| 服务实现 | `src/routes/`、`src/task-api/`、`src/registry-config/`、`src/scheduler/`、`src/query-executor/`、`src/file-service/`、`src/cleanup-job/`、`src/audit-log/`、`src/repositories/`、`src/db/` | 当前实现态已覆盖主要模块边界 |
| 迁移与检查 | `migrations/`、`scripts/arch-check.ts` | 当前验证闭环的一部分，不再表述为预实现脚手架 |
| 运行入口 | `src/server.ts`、`src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts`、`src/config/` | 当前运行入口口径用于已实现链路与回归验证 |
| 共享抽象 | `packages/` | 仅在确有拆分需要时创建 |

## 4. 后续实现任务依赖

| 任务 | 直接依赖 | 说明 |
| --- | --- | --- |
| T1 契约总入口 | P1 | CONTRACT-001 已复核并扩展 `contracts/README.md`，落地 `contracts/openapi.yaml`，先定住 FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 的接口、状态和错误码；创建成功响应必须显式返回 `idempotencyScope` |
| T2 API 契约 | T1 | 先落 `contracts/api/`，覆盖创建、进度、历史、下载、取消、重试和注册接口 |
| T3 scheduler 契约 | T1 | 再落 `contracts/scheduler/`，覆盖 DB 抢锁、租约、续租、接管、批次检查点 |
| T4 query 契约 | T1 | 再落 `contracts/query/`，覆盖参数 schema、查询模板、字段映射、脱敏和数据范围 |
| T5 file 契约 | T1 | 再落 `contracts/file/`，覆盖临时对象、发布、校验、下载元信息和清理前置标记 |
| T6 audit 契约 | T1 | 再落 `contracts/audit/`，覆盖阶段事件、下载日志和失败原因串联 |
| T7 sample 契约 | T1 | 再落 `contracts/sample/`，覆盖采购订单样板查询条件、字段顺序、脱敏和压测证据 |
| T8 测试骨架 | T2-T7 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` 先建立目录和基础用例 |
| T9 task-api / registry-config | T2、T4、T6 | 依赖创建、查询进度/详情、历史、下载、注册和配置快照契约；覆盖 FR-002 的查询入口 |
| T10 scheduler / query-executor | T3、T4、T6 | 依赖 DB lock、游标分页、批次事件和数据范围契约 |
| T11 file-service / cleanup-job | T5、T6 | 依赖文件元信息、发布边界和过期清理契约 |
| T12 cancel/retry / auth-mask | T2、T4、T6 | 依赖状态机、认证上下文和脱敏契约 |
| T13 purchase-order sample | T7、T8、T9、T10、T11、T12 | 依赖主链路稳定后再补样板压测和边界证据 |

## 4.1 QUERY-FILE-SAMPLE-PLAN-001 落盘任务表

| Task ID | 目标 | Dependencies | Owned paths | Verification | Evidence entry |
| --- | --- | --- | --- | --- | --- |
| `QUERY-EXECUTOR-001` | 落地集中查询、参数 schema、字段映射、脱敏、数据范围和批次检查点 | `QUERY-FILE-SAMPLE-PLAN-001`、`TASK-API-HTTP-001`、`SCHEDULER-WORKER-001` | `src/query-executor/`、`src/repositories/`、`src/audit-log/`、`tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md` | `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('npm run arch:check','npm run test:query','npm run test:worker','npm run test:db','git diff --check -- task.json plans docs/testing/verify-matrix.md')` | `tests/query/`、`tests/worker/`、`docs/testing/verify-matrix.md`；历史 历史通过记录 仅作旧证据，当前 release 仍 blocked 时不得作为 completion/pass 依据 |
| `FILE-SERVICE-001` | 落地临时对象写入、checksum 校验、发布、下载元信息和分片 ZIP | `QUERY-EXECUTOR-001` | `src/file-service/`、`src/task-api/`、`src/repositories/`、`tests/file/`、`tests/api/`、`docs/testing/verify-matrix.md` | `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('npm run arch:check','npm run test:file','npm run test:api','npm run test:db','git diff --check -- task.json plans docs/testing/verify-matrix.md')` | `tests/file/`、`tests/api/`、`docs/testing/verify-matrix.md`；历史 历史通过记录 仅作旧证据，live object storage smoke 仍 blocked，不能写成当前通过 |
| `CLEANUP-JOB-001` | 落地 cleanup job entry、先失效后删除和失败重试记录 | `FILE-SERVICE-001` | `src/cleanup-job/`、`src/jobs/`、`src/repositories/`、`tests/file/`、`tests/worker/`、`docs/testing/verify-matrix.md` | `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('npm run arch:check','npm run test:file','npm run test:worker','npm run test:db','git diff --check -- task.json plans docs/testing/verify-matrix.md')` | `tests/file/`、`tests/worker/`、`docs/testing/verify-matrix.md`；历史 历史通过记录 仅作旧证据 |
| `SAMPLE-PURCHASE-ORDER-001` | 用采购订单样板回归标准 registry/query/file/audit 链路和 10 万行证据 | `QUERY-EXECUTOR-001`、`FILE-SERVICE-001`、`CLEANUP-JOB-001` | `src/query-executor/`、`src/file-service/`、`src/audit-log/`、`tests/sample/`、`tests/query/`、`tests/file/`、`docs/testing/verify-matrix.md` | `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('npm run arch:check','npm run test:sample','npm run test:query','npm run test:file','npm run test:db','git diff --check -- task.json plans docs/testing/verify-matrix.md')` | `tests/sample/`、`tests/query/`、`tests/file/`、`docs/testing/verify-matrix.md`；历史 历史通过记录 仅作旧证据，live object storage smoke 仍需真实环境 |

## 5. 验证顺序

1. `git diff --check`
2. `contracts/` 目录结构与 README 约定校验
3. 契约文件校验
4. `npm run arch:check`
5. `QUERY-EXECUTOR-001`: `npm run test:query`、`npm run test:worker`、`npm run test:db`
6. `FILE-SERVICE-001`: `npm run test:file`、`npm run test:api`、`npm run test:db`
7. `CLEANUP-JOB-001`: `npm run test:file`、`npm run test:worker`、`npm run test:db`
8. `SAMPLE-PURCHASE-ORDER-001`: `npm run test:sample`、`npm run test:query`、`npm run test:file`、`npm run test:db`
9. 真实 MySQL、对象存储或采购订单样板外部依赖不可达时输出 `BLOCKED - 需要人工介入`，不得用替身补齐 release 证据

## 5.1 架构决策到实现任务映射

| 架构决策 | 约束 | 后续任务必须落点 | 验证影响 |
| --- | --- | --- | --- |
| HTTP 框架与入口 | Fastify + Node.js 20+，生产入口为 `src/server.ts`、`src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts` | `src/routes/`、`src/task-api/`、`src/scheduler/`、`src/file-service/`、`src/cleanup-job/` | HTTP 服务、worker 和 job 启动方式一致 |
| DB 客户端与迁移 | Kysely + `mysql2`，迁移由 Kysely Migrator 或等价 TypeScript runner 承担 | `src/db/`、`migrations/`、`tests/db/` | 真实 MySQL 客户端、schema 和 migration 可验证 |
| 测试层级 | Vitest，按 contract / api / db / worker / query / file / sample 分层 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` | 后续 feature_impl 必须能落到具体测试层 |
| DB 抢锁与租约 | `lockOwner + lockExpireAt + leaseRenewedAt`，时间以数据库时间为准，默认租约 5 分钟 | `contracts/scheduler/`、`tests/worker/`、`src/scheduler/` | FR-005 / FR-013 的抢锁、续租、接管测试 |
| 执行尝试 | `attemptNo` 按任务隔离；锁接管不递增，FAILED 重试才递增 | `contracts/api/`、`contracts/scheduler/`、`contracts/audit/`、`tests/api/`、`tests/worker/` | 取消/重试、失败证据和文件路径测试 |
| 配置快照 | 创建任务时固化注册配置、请求摘要和认证上下文摘要 | `contracts/api/`、`contracts/query/`、`src/task-api/`、`src/registry-config/` | 幂等冲突、快照沿用、模板冲突测试 |
| 批次检查点 | 至少包含 `lastCursor`、`processedCount`、`filePartNo`、`attemptNo`、`retryCount` | `contracts/scheduler/`、`contracts/query/`、`tests/worker/`、`tests/query/` | 接管继续、批次重试和压测证据 |
| 临时对象发布 | `tempStorageKey -> checksum -> publishedStorageKey -> deliveryReadyAt` | `contracts/file/`、`tests/file/`、`src/file-service/` | 未发布对象不可下载、校验失败不交付 |
| 认证上下文 | 最小字段 `operatorId`、`tenantId`、`roleCodes`、`orgScope`、`requestId` | `contracts/api/`、`contracts/query/`、`tests/api/`、`tests/query/` | 任务可见性、数据范围、下载权限测试 |
| 审计链路 | 动作审计 + 阶段事件必须能按 `taskId/attemptNo/requestId` 串联 | `contracts/audit/`、`tests/api/`、`tests/worker/`、`src/audit-log/` | FR-010 与所有失败态证据 |
| 架构检查 | 入口、契约映射、生产入口禁用替身、migration 覆盖和脚本完整性 | `scripts/arch-check.ts`、`tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/`、`migrations/`、`package.json` | `npm run arch:check` 是后续 feature_impl 的必跑入口之一 |

## 6. 阶段输出

| 阶段 | 必须输出 | 说明 |
| --- | --- | --- |
| P1 | `docs/context/*`、`docs/testing/*`、`plans/features/export-platform.dev-plan.md` | 分析与测试左移材料必须闭环 |
| P2 | `contracts/openapi.yaml`、schema、错误码、状态矩阵、`migrations/` 初始约定 | 先固定实现门槛 |
| P3 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` 基础测试骨架 | 为后续实现提供 affected tests |
| P4 | task-api 与 registry-config 可执行骨架 | 覆盖创建、查询、注册、幂等 |
| P5 | scheduler 与 query-executor 可执行骨架 | 覆盖抢锁、游标、批次、数据范围 |
| P6 | file-renderer 与 cleanup-job 可执行骨架 | 覆盖发布边界与过期清理 |
| P7 | cancel/retry 与权限/脱敏可执行骨架 | 覆盖状态机和安全边界 |
| P8 | 采购订单样板证据 | 覆盖边界数据、压测和脱敏校验 |

## 7. 后续实现任务建议

- `QUERY-EXECUTOR-001` 只负责 query-executor 生产链路，不承担 file-service、cleanup-job 或采购订单样板特例实现。
- `FILE-SERVICE-001` 只负责文件发布与下载元信息，不承担 cleanup 删除逻辑。
- `CLEANUP-JOB-001` 只负责先失效再删除和失败重试记录，不重写 query/file 主链路。
- `SAMPLE-PURCHASE-ORDER-001` 只负责样板合同和边界证据，必须复用标准 registry/query/file/audit 链路，不新增采购订单平台特例接口。

## 8. 验收顺序说明

- 先验收 FR-001、FR-002、FR-013，确认任务创建、查询进度/详情、幂等、配置快照和锁租约。
- 再验收 `QUERY-EXECUTOR-001`，覆盖 FR-008、FR-009 和 FR-006 的批次事件、数据范围、脱敏与模板约束。
- 再验收 `FILE-SERVICE-001` 与 `CLEANUP-JOB-001`，覆盖 FR-003、FR-006、FR-011 的发布、下载保护和过期清理。
- 再验收 FR-012，确认取消和重试状态机。
- 最后验收 `SAMPLE-PURCHASE-ORDER-001`，确认 FR-014 可作为主样板和压测证据，且真实依赖不可用时明确 BLOCKED。

## 8.1 CONTRACT-001 契约验证入口

当前契约任务的 当前证据 命令：

```powershell
powershell -NoProfile -Command ".\verify.ps1 -Commands 'git diff --check'; npx --yes @redocly/cli lint contracts/openapi.yaml"
```

后续测试骨架任务可把当前 `npx --yes @redocly/cli lint contracts/openapi.yaml` 封装为 `npm run test:contract`，并继续保留 `docs/testing/verify-matrix.md` 中的 `contract-openapi` 证据入口。

### 8.2 STACK-ADR-001 架构检查入口

后续实现任务必须把 `npm run arch:check` 落到 `scripts/arch-check.ts`，并确保该命令成为 `feature_impl` 的固定验证入口。实现阶段不得只靠文档、`git diff --check` 或 OpenAPI 通过来宣称完成。

## 9. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 解释计划输出同时服务实现和知识沉淀
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束 dev-plan 以可执行任务为主

## 10. Knowledge Outputs

- none
