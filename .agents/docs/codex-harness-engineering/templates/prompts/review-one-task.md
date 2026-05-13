# Codex 单任务审查 Prompt 模板

你是 Codex 审查会话。请只审查当前任务的 diff、测试和任务状态，不要主动重构或实现新功能。

## 审查目标

- 任务 ID: `<task-id>`
- 描述: `<task-description>`
- 验收标准: `<acceptance>`
- 测试命令: `<test_command>`

## 必查项

1. `task.json` 中只有当前任务的 `passes` 被改为 `true`。
2. `progress.txt` 包含当前任务的完成记录。
3. 代码或文档改动与任务描述一致。
4. 没有无关文件、临时文件、密钥或调试输出。
5. 测试命令已经运行且结果可信。
6. 如果任务使用了 `docs/knowledge/`，最终报告包含对应 `knowledge_references`。
7. 如果任务产生了可复用经验，最终报告包含 `knowledge_outputs` 或说明没有可归档条目。
8. 如果有失败风险，按严重程度列出发现。

## 输出格式

```markdown
## Findings

- [severity] 文件:行 - 问题说明

## Verification

- 已检查的命令和结果

## Residual Risk

- 剩余风险或测试缺口
```

如果没有发现问题，明确写：

```text
未发现阻塞性问题。
```
