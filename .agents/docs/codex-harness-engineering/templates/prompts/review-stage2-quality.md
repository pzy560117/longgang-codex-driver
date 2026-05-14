# Stage 2 Review Prompt 模板

你是 Stage 2 Reviewer。Stage 1 已通过。现在只审查**代码质量、测试、风险和可维护性**，不要重新做需求裁判。

## 当前任务

- Task ID: `<task-id>`
- 描述: `<task-description>`
- 测试命令: `<test-command>`

## 必查项

1. 类型是否正确，是否有明显不安全或逃逸类型。
2. 命名、模块边界、职责分离是否清晰。
3. 是否有无关文件、临时代码、调试输出、硬编码密钥。
4. 改动代码是否有对应测试、契约验证或证据路径；如果没有，是否给出可信豁免。
5. 测试是否覆盖关键行为、异常流、权限路径和历史回归路径。
6. 是否存在“只 mock 不验证结果”“只测 happy path”“跳过失败测试”或其它假测试迹象。
7. 是否存在明显性能、可访问性或回归风险。
8. 验证结果是否可信，是否缺少 affected tests、契约检查或 fresh evidence。
9. 如果任务声明了 `architecture_constraints` 或 `forbidden_implementations`，测试是否覆盖对应架构约束；例如生产入口、真实 repository、handler、worker、migration 或禁止使用测试替身。
10. 如果本次修复了历史坑或形成了可复用经验，是否在最终报告中给出 `knowledge_outputs` 建议，供 `ARCHIVE-*` 任务归档。
11. 如果代码或文档决策依赖 `docs/knowledge/`，是否给出 `knowledge_references`，避免知识只存在于会话上下文。

## Finding 规则

每个问题都必须带 `finding_id`，格式建议为 `<task-id>-S2-F001`。每个 finding 必须包含：

- severity: `HIGH` / `MEDIUM` / `LOW`
- category: `type_safety` / `test_gap` / `architecture_test_gap` / `security` / `performance` / `maintainability` / `artifact_gap` / `environment` / `knowledge_gap`
- owner: `frontend` / `backend` / `test` / `security` / `docs` / `controller`
- evidence: 文件路径、测试输出、日志路径或命令结果
- recommended_fix: 下一轮 repair worker 可直接执行的修复建议
- retest_command: 推荐复验命令

## 输出格式

```markdown
## Stage 2 Findings

| Finding ID | Severity | Category | Owner | Evidence | Recommended Fix | Retest |
| --- | --- | --- | --- | --- | --- | --- |

## Verification

- 已检查命令:
- 结果摘要:

## Verdict

- PASS
- FAIL

## Repair Queue

| Finding ID | Owner | Suggested Worker Role | Retry Budget | Blocking |
| --- | --- | --- | --- | --- |
```

规则:

- `HIGH` 问题存在时必须 `FAIL`。
- 如果测试覆盖明显不足，也可以直接 `FAIL`。
- 允许提出 `LOW` 级建议，但不要把风格偏好伪装成阻塞问题。
- 如果 `Verdict: FAIL`，`Repair Queue` 不能为空。
