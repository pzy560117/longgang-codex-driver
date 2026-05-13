# Contracts 目录约定：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13

## 1. 目录目标

`contracts/` 是统一导出平台的契约入口目录。这里先固定 API、scheduler、query、file、audit 和 sample 的契约边界，再进入实现与测试。

## 2. 目录结构

```text
contracts/
  README.md
  openapi.yaml
  api/
  scheduler/
  query/
  file/
  audit/
  sample/
```

## 3. 契约分区

| 目录 | 约定内容 | 覆盖需求 |
| --- | --- | --- |
| `contracts/api/` | 创建、查询详情、查询历史、下载、取消、重试、注册启停接口 | FR-001, FR-002, FR-004, FR-007, FR-012, FR-013 |
| `contracts/scheduler/` | DB 抢锁、租约、续租、接管、并发控制、批次检查点 | FR-005, FR-013 |
| `contracts/query/` | 参数 schema、查询模板、字段映射、脱敏策略、数据范围、游标分页 | FR-006, FR-008, FR-009, FR-014 |
| `contracts/file/` | 临时对象、发布对象、checksum、下载元信息、清理前置标记 | FR-003, FR-006, FR-011 |
| `contracts/audit/` | 创建、调度、执行、下载、取消、重试、清理审计事件 | FR-010, FR-013 |
| `contracts/sample/` | 采购订单样板查询条件、字段顺序、脱敏和压测证据 | FR-014 |

## 4. 契约编写规则

1. `openapi.yaml` 只放对外 API 的正式入口和状态/错误码锚点。
2. 分区目录里的契约文件按能力拆分，不把所有场景塞进单个大文件。
3. 每个契约必须能回指到至少一个 Requirement ID 和一个验收入口。
4. API 契约、scheduler 契约、query 契约、file 契约、audit 契约和 sample 契约必须保持同一组术语，尤其是 `attemptNo`、`configSnapshotDigest`、`batchCheckpoint`、`storageKey`、`requestId`。
5. 文件发布契约必须明确临时对象和已发布对象的边界，避免下载接口误暴露未发布对象。
6. query 契约必须明确禁止原始 SQL，只允许参数化模板和参数 schema 绑定。
7. scheduler 契约必须明确数据库时间、锁租约和接管规则，不允许依赖本机时间。

## 5. 文件命名建议

| 类型 | 命名建议 | 示例 |
| --- | --- | --- |
| API 契约 | `*.openapi.yaml` 或 `*.md` | `contracts/api/export-tasks.openapi.yaml` |
| Scheduler 契约 | `*.md` | `contracts/scheduler/lease-and-lock.md` |
| Query 契约 | `*.md` 或 `*.schema.json` | `contracts/query/template-and-mapping.md` |
| File 契约 | `*.md` | `contracts/file/publish-and-download.md` |
| Audit 契约 | `*.md` | `contracts/audit/task-events.md` |
| Sample 契约 | `*.md` | `contracts/sample/purchase-order-export.md` |

## 6. 使用顺序

1. 先补 `contracts/openapi.yaml`，锚定对外 API。
2. 再按 `api/`、`scheduler/`、`query/`、`file/`、`audit/`、`sample/` 分区补齐契约说明。
3. 契约定稿后，测试目录按同名能力分区创建，保证测试层和契约层可一一对应。

## 7. 约束

- 不在 `contracts/` 里写实现代码。
- 不用 `contracts/` 替代 `docs/testing/` 的追溯矩阵和验证矩阵。
- 不把样板契约写成平台特例接口，样板必须复用标准平台契约。
