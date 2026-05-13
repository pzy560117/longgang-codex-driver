# DEV-PLAN：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13
**用途**: 给后续实现任务提供可直接执行的拆分、边界、验证顺序和证据路径。

## 1. 计划目标

- 先把契约、测试矩阵和证据路径固定，再进入实现。
- 当前仓库无业务代码，所有实现任务必须先落到 `contracts/` 和 `tests/` 的骨架。
- 任一任务都不能假设已有 `src/` 或 `packages/`。

## 2. 任务拆分

| 阶段 | 目标 | 主要产物 | 依赖 | 验收顺序 |
| --- | --- | --- | --- | --- |
| P1 | 固定分析与测试左移材料 | `docs/context/*`、`docs/testing/*` | 产品真相源 | 最先 |
| P2 | 创建契约骨架 | `contracts/openapi.yaml`、schema、错误码、状态矩阵 | P1 | FR-001/003/008/013/014 先验收 |
| P3 | 创建测试骨架 | `tests/` 中契约、后端、调度、查询、文件、样板测试目录 | P2 | planned / blocked-by-contract 转为可执行 |
| P4 | 实现 task-api 与 registry-config | 创建、查询、历史、下载、注册、启停、幂等 | P2/P3 | FR-001、FR-004、FR-007、FR-013 |
| P5 | 实现 scheduler 与 query-executor | 抢锁、租约、游标、数据范围、批次事件 | P2/P3 | FR-005、FR-006、FR-008、FR-010 |
| P6 | 实现 file-renderer 与 cleanup-job | 临时对象、发布、过期清理、下载保护 | P2/P3 | FR-003、FR-011 |
| P7 | 实现 cancel/retry 和权限/脱敏 | 状态机、内部取消、权限和脱敏收口 | P2/P3 | FR-009、FR-012 |
| P8 | 实现采购订单样板 | 样板合同、边界数据、10 万行压测证据 | P2/P3/P4/P5/P6/P7 | FR-014 |

## 3. 模块边界与 owned paths

| 模块 | 建议 owned paths | 备注 |
| --- | --- | --- |
| 需求与测试文档 | `docs/context/`、`docs/testing/` | 已可直接写入 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` | 已创建 |
| 契约 | `contracts/` | 后续创建 |
| 测试 | `tests/` | 后续创建 |
| 服务实现 | `src/` | 后续创建，不预设结构 |
| 共享抽象 | `packages/` | 仅在确有拆分需要时创建 |

## 4. 验证顺序

1. `git diff --check`
2. 契约文件校验
3. 契约测试
4. 后端单测
5. 调度和查询测试
6. 文件生成与清理测试
7. 采购订单样板压测和证据检查

## 5. 后续实现任务建议

- 任务 A：落 `contracts/openapi.yaml`，先固定 FR-001 至 FR-014 的接口、状态、错误码和样板契约。
- 任务 B：落 `tests/contract/`，为创建、查询、下载、注册、调度、文件和样板建立最小测试骨架。
- 任务 C：落 `src/`，先完成 task-api、registry-config 和 scheduler 的最小可用链路。
- 任务 D：补 query-executor 与 file-renderer，最后接 cleanup-job 和样板压测。

## 6. 验收顺序说明

- 先验收 FR-001、FR-013，确认任务创建、幂等、配置快照和锁租约。
- 再验收 FR-008、FR-009，确认查询契约、数据范围和脱敏。
- 再验收 FR-006、FR-003、FR-011，确认分片、文件发布和过期清理。
- 再验收 FR-012，确认取消和重试状态机。
- 最后验收 FR-014，确认采购订单样板可作为主样板和压测证据。

## 7. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 解释计划输出同时服务实现和知识沉淀
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束 dev-plan 以可执行任务为主

## 8. Knowledge Outputs

- none
