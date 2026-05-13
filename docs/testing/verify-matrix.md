# 验证矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: INIT-001
**生成时间**: 2026-05-13

> 当前文件是 handoff 阶段的最小验证入口。完整验收示例、追溯矩阵、测试数据矩阵、风险计划和回归计划由 `ANALYSIS-001` 基于 `docs/product/*` 补齐。

| 检查项 | 关联需求 | 命令 / 证据 | 必需 | 退出码 / 结论 | 报告路径 |
| --- | --- | --- | --- | --- | --- |
| 产品真相源存在 | FR-001 / FR-014 | `docs/product/prd-lite.md`、`page-inventory.md`、`difficulty-research.md`、`acceptance-criteria.md`、`requirement-interface-matrix.md`、`state-matrix.yaml` | 必需 | 待 driver fresh evidence | `traces/` |
| 任务队列结构 | FR-001 / FR-014 | `task.json` 中所有任务具备 `requirement_ids`、`owned_paths`、`context_files`、`produces_artifacts`、`acceptance`、`test_command`、`execution.mode=single` | 必需 | 待 driver fresh evidence | `traces/` |
| Handoff 边界 | FR-001 / FR-014 | `task.json.runtime.handoff` 声明 product truth sources、testing current entry、future plan entry 和 driver single-task 边界 | 必需 | 待 driver fresh evidence | `traces/` |
| 静态检查 | FR-001 / FR-014 | `git diff --check` | 必需 | 待 driver fresh evidence | `traces/` |
| Testing 完整矩阵 | FR-001 - FR-014 | `ACCEPTANCE_CRITERIA.md`、`ACCEPTANCE_EXAMPLES.md`、`TRACEABILITY_MATRIX.md`、`TEST_DATA_MATRIX.md`、`test-matrix.md` | ANALYSIS-001 必需 | planned | `docs/testing/` |
| 契约与实现验证 | FR-001 - FR-014 | `contracts/openapi.yaml`、契约测试、API/调度/查询/文件/样板验证命令 | 后续任务必需 | planned | `contracts/`、`tests/`、`traces/` |

## 最终规则

- INIT-001 只验证产品真相源、队列结构、handoff 边界和 `git diff --check`。
- P0/P1 的完整验收示例、追溯、测试数据和风险矩阵必须在 ANALYSIS-001 产出，不得把当前模板文件当成已完成口径。
- release 前每个必需项都要有 fresh evidence，或提供明确的 BLOCKED / exemption 记录。
