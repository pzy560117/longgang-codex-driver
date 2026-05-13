# Codex Harness Engineering Start Here

这份文档只做一件事：

- 帮第一次进入 `codex-harness-engineering/` 的人快速判断应该先读什么、先做什么。

## 路线 A：先理解方法论

推荐阅读顺序：

1. `README.md`
2. `mode-matrix.md`
3. `global-rules-and-bootstrap.md`
4. `implementation-guide.md`

## 路线 B：把 Harness 接到一个新项目

推荐阅读顺序：

1. `README.md`
2. `mode-matrix.md`
3. `global-rules-and-bootstrap.md`
4. `implementation-guide.md`

建议执行顺序：

1. 确认目标目录本身是 Git 仓库。
2. 运行 `templates/bootstrap-codex-harness.ps1`。
3. 如果这是全新仓库，先提交一次 bootstrap 基线。
4. 需要项目专属 `AGENTS.md` 时，按 `templates/docs/project-agents-template.md` 扫描项目事实后裁剪生成。
5. 先使用 `templates/runtime/smoke-task.json` 做首次自检。
6. 补齐 `docs/testing/ACCEPTANCE_EXAMPLES.md`、`TRACEABILITY_MATRIX.md`、`TEST_DATA_MATRIX.md` 等实现前 testing truth source。
7. 通过后再替换为真实业务 `task.json`。

## 路线 C：给现有项目补自动化

推荐阅读顺序：

1. `README.md`
2. `mode-matrix.md`
3. `global-rules-and-bootstrap.md`
4. `implementation-guide.md`

## 最短路径

1. 读 `README.md`
2. 读 `mode-matrix.md`
3. 跑 `templates/bootstrap-codex-harness.ps1`
4. 提交 bootstrap 基线
5. 用 `templates/runtime/smoke-task.json` 跑一次 smoke
6. 补 testing truth source，再进入 `implementation-guide.md`
