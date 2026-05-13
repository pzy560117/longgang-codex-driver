# 实施指南

## 目标

把当前包接入新项目，并跑通单工作区的 driver-first 闭环。

## 步骤

1. 运行 `bootstrap-codex-harness.ps1`。
2. 提交 bootstrap 基线，确保 Git 工作区干净。
3. 先用 `smoke-task.json` 做首次自检，确认 driver、trace、progress 和验证入口正常。
4. 补齐 `docs/product/`、`docs/design/`、`docs/context/dev-plan.md`。
5. 在生成真实 `task.json` 之前，先补齐 `docs/testing/ACCEPTANCE_CRITERIA.md`、`ACCEPTANCE_EXAMPLES.md`、`TRACEABILITY_MATRIX.md`、`TEST_STRATEGY.md`、`TEST_DATA_MATRIX.md`、`RISK_BASED_TEST_PLAN.md`、`REGRESSION_PLAN.md`、`EVIDENCE_PROTOCOL.md`、`test-matrix.md`、`verify-matrix.md`。
6. 用 `project-task-template.json` 生成真实 `task.json`。
7. 运行 `doctor.ps1`、`verify.ps1`、`codex-loop.ps1 -RunUntilDone`。

## 原则

- 不在未提交的混合改动上启动 driver。
- 不保留额外执行工作区和外部 worker 说明。
- 正式任务队列建立前，先让 testing truth source 成为实现前 gate。
- Stage 17 只做 fresh evidence、affected tests 和回归确认，不承担第一次补测试范围。
- 所有完成声明都必须回到 `progress.txt`、`traces/` 和验证命令。
