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
| OpenAPI 契约 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | available / needs re-review | `contracts/openapi.yaml` |
| 生产 HTTP 服务入口 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-012 / FR-013 | not-started | 待创建 |
| MySQL schema / migration | FR-001 - FR-014 | not-started | 待创建 |
| 生产 repository | FR-001 - FR-014 | not-started | 待创建 |
| scheduler worker | FR-005 / FR-010 / FR-012 / FR-013 | not-started | 待创建 |
| query executor | FR-006 / FR-008 / FR-009 / FR-014 | not-started | 待创建 |
| file service / cleanup job | FR-003 / FR-006 / FR-011 / FR-014 | not-started | 待创建 |
| API / DB / worker 集成测试 | FR-001 - FR-014 | not-started | 待创建 |
| 旧内存实现与旧 trace | FR-001 - FR-014 | removed | 不作为证据 |

## 计划验证入口

| 阶段 | 命令 / 证据 | 最低要求 |
| --- | --- | --- |
| 文档与队列重建 | `git diff --check` | 文档、JSON、任务队列无格式错误 |
| 契约复核 | `contracts/openapi.yaml` lint 或等价命令 | 契约可解析，公开 operation 与需求矩阵一致 |
| 脚手架架构检查 | `npm run arch:check` 或等价命令 | server / worker / migration / forbidden implementation 检查通过 |
| API 集成测试 | 待脚手架任务创建 | 公开 route/handler 与 OpenAPI operation 对齐 |
| DB 集成测试 | 待 DB schema 任务创建 | migration、repository、事务/锁行为可验证 |
| worker 集成测试 | 待 scheduler 任务创建 | DB polling、抢锁、续租、接管、取消和重试边界可验证 |
| release 验证 | 待实现任务补齐 | fresh evidence 覆盖 P0/P1、失败态和 BLOCKED 项 |

## Requirement 验证入口

| Req ID | 后续验证类型 | 当前状态 | 证据路径 |
| --- | --- | --- | --- |
| FR-001 | contract / API / DB | not-started | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-002 | contract / API / DB | not-started | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-003 | contract / API / file | not-started | `contracts/openapi.yaml`、待创建 file 测试 |
| FR-004 | contract / API / DB | not-started | `contracts/openapi.yaml`、待创建 API/DB 测试 |
| FR-005 | DB / worker | not-started | 待创建 worker 与 DB lease 测试 |
| FR-006 | query / file / worker | not-started | 待创建 query/file/worker 测试 |
| FR-007 | contract / API / DB | not-started | `contracts/openapi.yaml`、待创建 registry 测试 |
| FR-008 | query / DB / security | not-started | 待创建 query template 与数据范围测试 |
| FR-009 | API / query / security | not-started | 待创建认证上下文、权限、脱敏测试 |
| FR-010 | audit / API / worker | not-started | 待创建审计链路测试 |
| FR-011 | file / cleanup job | not-started | 待创建 cleanup job 测试 |
| FR-012 | API / worker / state-machine | not-started | 待创建取消/重试测试 |
| FR-013 | API / DB / worker | not-started | 待创建幂等、配置快照、锁租约测试 |
| FR-014 | sample / pressure / end-to-end | not-started | 待创建采购订单样板与压测证据 |

## 最终规则

- `feature_impl` 任务不得只以文档、OpenAPI、内存 repository、mock 或 `git diff --check` 作为完成证据。
- 每个实现任务必须从 `docs/architecture/constraints.md` 复制 `architecture_constraints` 和 `forbidden_implementations`。
- 没有真实依赖时必须记录 `BLOCKED - 需要人工介入`，不得用测试替身绕过。
