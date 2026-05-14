# DEV-PLAN：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13
**用途**: 给后续实现任务提供可直接执行的拆分、边界、验证顺序和证据路径。

## 1. 计划目标

- 先把契约、测试矩阵和证据路径固定，再进入实现。
- 当前仓库已有 `contracts/README.md`，但无业务代码；所有实现任务必须先补齐 `contracts/` 分区契约和 `tests/` 骨架。
- 任一任务都不能假设已有 `src/` 或 `packages/`。
- `STACK-ADR-001` 已要求后续实现 owned paths 必须按 `src/routes/`、`src/task-api/`、`src/registry-config/`、`src/scheduler/`、`src/query-executor/`、`src/file-service/`、`src/cleanup-job/`、`src/audit-log/`、`src/repositories/`、`src/db/`、`migrations/`、`scripts/arch-check.ts`、`tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` 拆分，不能只写笼统 `src/` 或 `tests/`。

## 2. 任务拆分

| 阶段 | 目标 | 主要产物 | 依赖 | 验收顺序 |
| --- | --- | --- | --- | --- |
| P1 | 固定分析与测试左移材料 | `docs/context/*`、`docs/testing/*` | 产品真相源 | 最先 |
| P2 | 补齐契约骨架 | `contracts/README.md`、`contracts/openapi.yaml`、`contracts/api/`、`contracts/scheduler/`、`contracts/query/`、`contracts/file/`、`contracts/audit/`、`contracts/sample/` | P1 | CONTRACT-001 已落 `contracts/openapi.yaml`；FR-001/002/003/004/007/008/009/010/012/013 先验收 |
| P3 | 创建测试骨架 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` | P2 | planned / blocked-by-contract 转为可执行 |
| P4 | 实现 task-api 与 registry-config | 创建、查询、历史、下载、进度/详情、注册、启停、幂等；创建成功响应必须回传 `idempotencyScope` | P2/P3 | FR-001、FR-002、FR-004、FR-007、FR-013 |
| P5 | 实现 scheduler 与 query-executor | 抢锁、租约、游标、数据范围、批次事件 | P2/P3 | FR-005、FR-006、FR-008、FR-010 |
| P6 | 实现 file-service 与 cleanup-job | 临时对象、发布、过期清理、下载保护 | P2/P3 | FR-003、FR-011 |
| P7 | 实现 cancel/retry 和权限/脱敏 | 状态机、内部取消、权限和脱敏收口 | P2/P3 | FR-009、FR-012 |
| P8 | 实现采购订单样板 | 样板合同、边界数据、10 万行压测证据 | P2/P3/P4/P5/P6/P7 | FR-014 |

## 3. 模块边界与 owned paths

| 模块 | 建议 owned paths | 备注 |
| --- | --- | --- |
| 需求与测试文档 | `docs/context/`、`docs/testing/` | 已可直接写入 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` | 已创建 |
| 契约 | `contracts/README.md`、`contracts/openapi.yaml`、`contracts/api/`、`contracts/scheduler/`、`contracts/query/`、`contracts/file/`、`contracts/audit/`、`contracts/sample/` | `contracts/README.md` 已存在；其余后续创建，按能力分区，不再只写一个空目录 |
| 测试 | `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/` | 后续创建，目录名直接对应验证层 |
| 服务实现 | `src/routes/`、`src/task-api/`、`src/registry-config/`、`src/scheduler/`、`src/query-executor/`、`src/file-service/`、`src/cleanup-job/`、`src/audit-log/`、`src/repositories/`、`src/db/` | 后续创建，按模块边界拆分，不预设单体目录 |
| 迁移与检查 | `migrations/`、`scripts/arch-check.ts` | 后续脚手架必须先创建 |
| 运行入口 | `src/server.ts`、`src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts`、`src/config/` | 后续脚手架必须先创建 |
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

## 5. 验证顺序

1. `git diff --check`
2. `contracts/` 目录结构与 README 约定校验
3. 契约文件校验
4. 契约测试
5. 后端单测
6. 调度和查询测试
7. 文件生成与清理测试
8. 采购订单样板压测和证据检查
9. `npm run arch:check`

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

- 任务 A：已由 CONTRACT-001 复核 `contracts/README.md` 并落 `contracts/openapi.yaml`，先固定 FR-001/002/003/004/007/008/009/010/012/013 的接口、状态、错误码和注册配置契约，包含 FR-002 的查询进度/详情路径，以及创建成功响应的 `idempotencyScope` 证据字段。
- 任务 B：落 `contracts/api/`、`contracts/scheduler/`、`contracts/query/`、`contracts/file/`、`contracts/audit/`、`contracts/sample/`，把能力分区和示例契约先锚住。
- 任务 C：落 `tests/contract/`、`tests/api/`、`tests/db/`、`tests/worker/`、`tests/query/`、`tests/file/`、`tests/sample/`，为创建、查询、进度/详情、下载、注册、调度、文件和样板建立最小测试骨架。
- 任务 D：落 `src/routes/`、`src/task-api/`、`src/registry-config/`、`src/scheduler/`、`src/repositories/`、`src/db/`、`migrations/`，先完成主入口、注册配置、持久化和调度链路的最小可用实现。
- 任务 E：补 `src/query-executor/` 与 `src/file-service/`，最后接 `src/cleanup-job/`、`src/audit-log/`、`src/workers/`、`src/jobs/`、`scripts/arch-check.ts` 和样板压测。
- 任务 F：创建 `scripts/arch-check.ts` 与 `npm run arch:check`，把入口存在性、OpenAPI 路由映射、替身禁用、migration 覆盖和测试脚本完整性做成强制门槛。

## 8. 验收顺序说明

- 先验收 FR-001、FR-002、FR-013，确认任务创建、查询进度/详情、幂等、配置快照和锁租约。
- 再验收 FR-008、FR-009，确认查询契约、数据范围和脱敏。
- 再验收 FR-006、FR-003、FR-011，确认分片、文件发布和过期清理。
- 再验收 FR-012，确认取消和重试状态机。
- 最后验收 FR-014，确认采购订单样板可作为主样板和压测证据。

## 8.1 CONTRACT-001 契约验证入口

当前契约任务的 fresh evidence 命令：

```powershell
powershell -NoProfile -Command ".\verify.ps1 -Commands 'git diff --check'; npx --yes @redocly/cli lint contracts/openapi.yaml"
```

后续测试骨架任务可把当前 `npx --yes @redocly/cli lint contracts/openapi.yaml` 封装为 `npm run test:contract`，并继续保留 `docs/testing/verify-matrix.md` 中的 `contract-openapi` 证据入口。

### 8.2 STACK-ADR-001 架构检查入口

后续脚手架任务必须把 `npm run arch:check` 落到 `scripts/arch-check.ts`，并确保该命令成为后续 `feature_impl` 的固定验证入口。实现阶段不得只靠文档、`git diff --check` 或 OpenAPI 通过来宣称完成。

## 9. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 解释计划输出同时服务实现和知识沉淀
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束 dev-plan 以可执行任务为主

## 10. Knowledge Outputs

- none
