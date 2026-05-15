# 基于风险的测试计划

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: RELEASE-001
**最后更新**: 2026-05-15
**负责人**: RELEASE-001

## 1. 风险分级

| 风险 ID | 需求 / 区域 | 高风险原因 | 测试重点 | Seed / 数据 | 证据路径 |
| --- | --- | --- | --- | --- | --- |
| RISK-001 | FR-001 / FR-013 创建与幂等 | 重复请求、参数摘要冲突和快照复用会直接影响任务唯一性与审计链路。 | 相同 `tenantId + operatorId + taskCode + clientRequestId` 命中原任务；摘要不同返回 `IDEMPOTENCY_CONFLICT`；配置快照不被新配置污染。 | `seed-create-base-001`、`seed-idempotency-001` | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/verify-matrix.md` |
| RISK-002 | FR-005 / FR-013 调度锁租约 | 多实例抢锁、租约续租、过期接管和 `attemptNo` 规则容易产生重复执行或断点丢失。 | 同一子系统并发上限、锁接管只发生在租约过期后、接管延续当前 `attemptNo`、FAILED 重试才递增尝试号。 | `seed-lock-001`、`seed-idempotency-001` | `docs/testing/test-matrix.md`、`traces/` |
| RISK-003 | FR-009 权限与脱敏 | 创建、查询、下载和样板文件涉及租户、组织范围、敏感字段和审计。 | 403 不泄露任务或文件；`orgScope` 不足被拒绝；联系人姓名/手机号不得原文出现在最终文件；脱敏失败进入 `MASKING_RULE_ERROR`。 | `seed-auth-001`、`seed-purchase-order-001` | `docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/ACCEPTANCE_EXAMPLES.md` |
| RISK-004 | FR-008 查询模板与字段映射 | 只读数据源、参数 schema、字段白名单、游标和批次检查点是后续实现的核心契约。 | 非法模板、未声明参数、未注册字段、原始 SQL、游标不稳定、批次字段校验失败。 | `seed-contract-001`、`seed-purchase-order-001` | `plans/features/export-platform.dev-plan.md`、`contracts/` |
| RISK-005 | FR-003 / FR-006 / FR-011 文件发布与清理 | 临时对象、校验、发布、下载和过期清理若顺序错误会暴露未校验文件或留下不可恢复对象。 | 校验通过前不返回下载地址；校验失败不发布对象；过期先标记不可下载再清理；清理失败可重试。 | `seed-download-001`、`seed-split-001`、`seed-cleanup-001` | `docs/testing/verify-matrix.md`、`traces/` |
| RISK-006 | FR-006 / FR-014 采购订单压测与边界 | 0/1/20000/20001/100000/100001 行同时覆盖空文件、单文件、ZIP、默认上限和超量控制。 | 空数据仅表头；20001 行分片 ZIP；100000 行记录耗时、批大小、分片数、续租次数、文件大小和 checksum；100001 行拒绝或进入严格控制流。 | `seed-split-001`、`seed-purchase-order-001` | `docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/test-data-plan.md` |
| RISK-007 | FR-002 / FR-004 / FR-010 状态、历史和审计 | 对外状态、历史可见性和审计字段必须与产品真相源一致，不能暴露内部 `cancel_requested`。 | 任务详情字段完整；普通用户仅本人任务；管理员按权限查询；CREATE/DISPATCH/EXECUTE/DOWNLOAD/CANCEL/RETRY/CLEANUP 事件可串联。 | `seed-progress-001`、`seed-history-001`、`seed-audit-001` | `docs/testing/TRACEABILITY_MATRIX.md`、`progress.txt` |
| RISK-008 | FR-007 注册配置 | 注册启停、配置同步、并发上限、保留期、阈值和支持格式影响后续所有任务。 | `taskCode` 唯一；disabled 拒绝创建；配置变更只影响新任务；已创建任务和 FAILED 重试沿用原快照。 | `seed-registry-001` | `plans/features/export-platform.dev-plan.md`、`docs/context/architecture-brief.md` |

## 2. 优先级规则

- P0 必测：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、FR-007、FR-008、FR-009、FR-010、FR-013、FR-014。
- P1 必测：FR-011、FR-012；发布前至少覆盖主路径、非法状态和负向清理证据。
- 当前 RELEASE-001 已通过本机 Docker MySQL + 本地 object storage mock 的受控 release gate。历史通过记录仅能作为旧证据，不能作为当前 release 依据；文档不应把本机受控 gate 写成外部生产/live OSS。

## 3. 退出条件

- `docs/testing/TRACEABILITY_MATRIX.md`、`TEST_DATA_MATRIX.md`、`test-matrix.md`、`verify-matrix.md` 能追溯 FR-001 至 FR-014。
- 高风险项均有 seed、后续验证层级和证据路径。
- 外部生产/live object storage 不属于当前完成条件；如后续任务声明必须接入外部 live 依赖且不可达，必须在 `progress.txt` 记录 `BLOCKED - 需要人工介入`，不得把 adapter/local HTTP 证据写成 live PASS。本机受控 release gate 仍以 Docker MySQL + 本地 object storage mock 为界。
