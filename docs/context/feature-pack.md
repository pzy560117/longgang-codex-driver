# Feature Pack：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13
**用途**: 供后续架构、契约、实现和测试任务直接接续。

## 1. 目标摘要

- 统一采购、销售、物流、仓储等子系统的导出入口。
- 导出从同步下载改为异步任务，避免长请求超时。
- 平台统一负责任务、调度、权限、查询执行、字段映射、脱敏、文件渲染、下载保护、审计、清理和结果校验。

## 2. 模块边界

| 模块 | 职责 | 主要输入 | 主要输出 | 风险 |
| --- | --- | --- | --- | --- |
| `task-api` | 创建、查询进度、历史、下载、取消、重试 | 认证上下文、任务参数、幂等键 | `taskId`、状态、下载结果、错误码 | 幂等、权限、状态机 |
| `registry-config` | 注册任务、启停、配置同步、数据源/模板/字段映射/脱敏策略管理 | taskCode、配置摘要、schema、模板版本 | 注册快照、启停结果、配置摘要 | 配置漂移、快照一致性 |
| `scheduler` | MySQL 轮询 + DB 抢锁、租约续租、实例接管 | 待执行任务、锁租约、数据库时间 | `EXECUTING`、`attemptNo`、检查点 | 多实例重复执行 |
| `query-executor` | 集中查询、游标分页、参数校验、数据范围约束 | 任务快照、执行尝试、查询参数、游标 | 批次数据、下一游标、批次事件 | 越权、游标不稳定、超时 |
| `file-renderer` | XLSX/ZIP 渲染、临时对象写入、发布前校验 | 批次数据、字段映射、脱敏结果 | 临时对象、已发布对象、校验值 | 文件损坏、误发布 |
| `cleanup-job` | 过期标记与对象清理 | 过期任务/文件 | 不可下载标记、清理结果 | 误删、残留对象 |
| `audit-log` | 记录创建、调度、执行、下载、取消、重试、清理事件 | 请求、状态、错误码、时间 | 审计链路 | 证据断链 |
| `sample-purchase-order` | 采购订单样板集中查询合同 | `createdAtRange`、`orderStatus` 等 | 样板导出文件、压测证据 | 样板无法证明主链路 |

## 3. 需求覆盖

| Requirement ID | 主要模块 | 验收顺序建议 | 备注 |
| --- | --- | --- | --- |
| FR-001 | `task-api`、`registry-config` | 先契约后创建 | 创建能力是整条链路入口 |
| FR-002 | `task-api`、`audit-log` | 创建后再查进度 | 需先有状态机和审计字段 |
| FR-003 | `task-api`、`file-renderer` | 完成文件发布后验证下载 | 必须确认发布边界 |
| FR-004 | `task-api` | 与创建/进度并行验证 | 受权限与可见性影响 |
| FR-005 | `scheduler` | 先锁后执行 | 必须先有 DB 锁契约 |
| FR-006 | `query-executor`、`file-renderer` | 先批次事件后分片打包 | 与 20000/100000 边界强相关 |
| FR-007 | `registry-config` | 先注册后启停 | 依赖配置快照 |
| FR-008 | `registry-config`、`query-executor` | 先契约后查询 | 是实现前的关键门槛 |
| FR-009 | `task-api`、`query-executor`、`file-renderer` | 权限和脱敏先行 | 高风险安全边界 |
| FR-010 | `audit-log` | 与所有主流程同步 | 必须能串联 taskId / requestId |
| FR-011 | `cleanup-job`、`file-renderer` | 文件发布后再清理 | 不能破坏可追溯性 |
| FR-012 | `task-api`、`scheduler` | 先取消再重试 | 需要明确内部取消边界 |
| FR-013 | `task-api`、`scheduler`、`registry-config` | 先幂等和快照，再接管 | 需要 attemptNo 和锁租约证据 |
| FR-014 | `sample-purchase-order`、`query-executor`、`file-renderer` | 最后做样板压测 | 作为一期开箱证据 |

## 4. 任务拆分建议

1. 先落 `contracts/`，定义创建、查询、下载、注册、调度、文件与样板契约。
2. 再落 `tests/`，补契约测试、后端测试、调度测试、查询测试、文件测试和样板测试骨架。
3. 再进入 `src/` 或后续实现目录，按模块边界逐一接入。
4. 最后补 `traces/` 证据路径和回归矩阵。

## 5. Owned Paths 建议

- 当前仓库真实已存在且可直接写入的落点：`docs/context/`、`docs/testing/`、`docs/product/`、`plans/features/`。
- 后续需要创建但当前不存在的实现落点：`contracts/`、`tests/`、`src/`、`packages/`。
- 不要把 `src/` 当成唯一 owned path；当前仓库还没有业务代码目录，后续任务应先按契约和测试骨架创建落点。

## 6. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 说明分析材料如何沉淀为后续可复用资产
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束 feature pack 只写入口和可验证内容

## 7. Knowledge Outputs

- none
