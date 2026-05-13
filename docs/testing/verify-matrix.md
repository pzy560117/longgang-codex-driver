# 验证矩阵

**功能**:
**任务 ID**:
**生成时间**:

| 检查项 | 命令 / 证据 | 必需 | 退出码 / 结论 | 报告路径 |
| --- | --- | --- | --- | --- |
| 验收 / 示例 | `ACCEPTANCE_EXAMPLES.md` + `ACCEPTANCE_CRITERIA.md` | P0/P1 必需 | | |
| 追溯 | `TRACEABILITY_MATRIX.md` | P0/P1 必需 | | |
| 静态检查 | `git diff --check` | 必需 | | |
| 类型检查 | | 项目相关 | | |
| Lint | | 项目相关 | | |
| 单元 | | 代码变更时必需 | | |
| 组件 | | UI 变更时必需 | | |
| 契约 | | API / 数据变更时必需 | | |
| API 集成 | | 后端变更时必需 | | |
| 受影响测试 | changed-code-related tests | 业务逻辑变更时必需 | | |
| E2E | | P0/P1 主流程变更时必需 | | |
| P0 回归 | 核心 P0 场景 | 发布前必需 | | |
| 视觉一致性 | `visual-parity-review.md` | UI 变更时必需 | | |
| 覆盖率 | `coverage-summary.json` | 如策略适用 | | |

## 最终规则

最终交付要求每一行必需项都有 fresh evidence，或提供明确的 BLOCKED / exemption 记录并获得 owner 批准。
Stage 17 只应确认新鲜度与回归状态；缺失的验收示例或首次测试范围定义不应在这里补写。
