# 验证矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: ANALYSIS-001
**生成时间**: 2026-05-13

> 当前文件用于补齐分析阶段的验证入口。当前仓库无应用代码，因此契约、后端、调度、查询、文件和样板验证均应标记为 `planned` 或 `blocked-by-contract`，不得伪装成已存在的 `src` 测试。

| 检查项 | 关联需求 | 命令 / 证据 | 必需 | 退出码 / 结论 | 报告路径 |
| --- | --- | --- | --- | --- | --- |
| 产品真相源对齐 | FR-001 / FR-014 | `docs/product/prd-lite.md`、`page-inventory.md`、`difficulty-research.md`、`acceptance-criteria.md`、`requirement-interface-matrix.md`、`state-matrix.yaml` | 必需 | planned | `docs/testing/TRACEABILITY_MATRIX.md` |
| 需求追溯矩阵 | FR-001 - FR-014 | `docs/testing/TRACEABILITY_MATRIX.md` | 必需 | planned | `docs/testing/TRACEABILITY_MATRIX.md` |
| 测试数据矩阵 | FR-001 - FR-014 | `docs/testing/TEST_DATA_MATRIX.md` | 必需 | planned | `docs/testing/TEST_DATA_MATRIX.md` |
| 测试计划矩阵 | FR-001 - FR-014 | `docs/testing/test-matrix.md` | 必需 | planned | `docs/testing/test-matrix.md` |
| 契约验证占位 | FR-001 / FR-003 / FR-008 / FR-013 / FR-014 | `contracts/openapi.yaml`、契约测试、API/调度/查询/文件/样板验证命令 | 后续任务必需 | blocked-by-contract | `contracts/`、`tests/`、`traces/` |
| 后端验证占位 | FR-001 / FR-002 / FR-004 / FR-005 / FR-006 / FR-007 / FR-009 / FR-010 / FR-011 / FR-012 / FR-013 / FR-014 | 后端单测、集成测、调度测、查询测、文件测、样板测 | 后续任务必需 | blocked-by-contract | `tests/`、`traces/` |
| 文件与样板验证占位 | FR-003 / FR-006 / FR-011 / FR-014 | 文件发布校验、ZIP 打包、过期清理、采购订单样板压测 | 后续任务必需 | blocked-by-contract | `tests/`、`traces/` |
| 静态检查 | FR-001 - FR-014 | `git diff --check` | 必需 | PASS / FAIL | `traces/` |

## 计划中的验证命令占位

- `contract`: `powershell -NoProfile -Command "npm run test:contract"` 或等价契约校验命令，需在后续 `contracts/` 落地后补齐。
- `backend`: `powershell -NoProfile -Command "npm run test:backend"` 或等价后端单测命令。
- `scheduler`: `powershell -NoProfile -Command "npm run test:scheduler"` 或等价调度测试命令。
- `query`: `powershell -NoProfile -Command "npm run test:query"` 或等价查询测试命令。
- `file`: `powershell -NoProfile -Command "npm run test:file"` 或等价文件校验命令。
- `sample`: `powershell -NoProfile -Command "npm run test:sample"` 或等价采购订单样板测试命令。

## 最终规则

- ANALYSIS-001 只负责补齐追溯、测试数据、测试计划和验证占位，不把占位命令伪装成可执行实现。
- 后续实现任务必须从本矩阵推导 `affected tests`、证据路径和契约路径。
- release 前每个必需项都要有 fresh evidence，或提供明确的 `BLOCKED - 需要人工介入` 记录。
