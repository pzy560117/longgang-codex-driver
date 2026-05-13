# Codex Harness Engineering 最佳实践包

**日期**: 2026-04-16  
**适用环境**: Windows + PowerShell + Codex CLI + Git 仓库  
**目标**: 把 Codex 从一次性对话工具升级为可复用、可审计、可验证的自动化工程执行系统。

## 0. 从哪里开始

如果这是你第一次进入这个目录，先读 `START-HERE.md`，再读 `mode-matrix.md` 理解当前唯一保留的 `full` driver-first 主链路。

## 1. 当前范围

这套文档和模板当前只保留单工作区、单 driver 的执行模型：

```text
task.json
  -> codex-loop.ps1
  -> codex exec
  -> lint/build/test/eval
  -> progress.txt + trace.json
  -> task.json passes=true
  -> git commit
```

额外 Git 执行工作区、外部 worker 编排、控制面状态机和相关模板已经从当前包中移除。

## 2. 主要内容

| 文件 | 用途 |
| --- | --- |
| `README.md` | 当前目录总览 |
| `START-HERE.md` | 首次进入目录时的分流入口 |
| `mode-matrix.md` | full 模式的职责、状态源、提交责任、trace 责任和验证入口 |
| `best-practices.md` | 任务、上下文、权限、测试、阻塞、提交、回归沉淀的最佳实践 |
| `implementation-flow.md` | 从 `agent/` 包结构出发说明安装、bootstrap、driver、验证、知识归档和同步的整体实现流程 |
| `harness-analysis-and-practice.md` | GitHub 调研后的 Harness 工程分析、当前 `agent/` 目录评估和改进路线图 |
| `harness-quality-model.md` | 定义好的、好用的、完整的 Harness 工程质量模型、成熟度和评分标准 |
| `harness-improvement-plan.md` | 基于质量模型和源码审计的 Harness 改进计划，说明每项改哪里、怎么改、如何验收 |
| `implementation-guide.md` | 在当前 Windows + Codex CLI 工程中落地的步骤 |
| `global-rules-and-bootstrap.md` | 全局规则写法、新项目接入和新环境初始化教程 |
| `codex-global-rules-example.md` | `~/.codex/AGENTS.md` 和 `~/.codex/config.toml` 的推荐配置示例与分层边界 |
| `templates/` | 可复制模板集中目录 |
| `templates/docs/project-agents-template.md` | 根据不同项目事实生成项目根 `AGENTS.md` / 子目录 `AGENTS.md` / `CLAUDE.md` 组合的通用模板 |

## 3. 快速使用方式

1. 先读 `START-HERE.md`。
2. 再读 `global-rules-and-bootstrap.md` 和 `codex-global-rules-example.md`。
3. 读 `mode-matrix.md`，确认当前项目使用 full driver-first 主链路。
4. 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\docs\codex-harness-engineering\templates\bootstrap-codex-harness.ps1 -ProjectRoot .
```

5. 如果这是一个刚初始化的全新仓库，先提交一次 bootstrap 基线，避免 driver 因未解释改动直接阻塞。
6. 如果需要把根 `AGENTS.md` 调整为项目专属规则，按 `templates/docs/project-agents-template.md` 扫描项目事实后裁剪生成，不要原样套模板。
7. 首次接入时，建议先用 `templates/runtime/smoke-task.json` 验证主链路；一旦 spec / plan 确认，就改用 `templates/runtime/project-task-template.json` 生成正式 `task.json` 并切回 driver。
8. 正式任务队列落盘前，先补齐 `docs/testing/ACCEPTANCE_CRITERIA.md`、`docs/testing/ACCEPTANCE_EXAMPLES.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md` 等测试左移真相源。
9. 运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
```

## 4. 推荐项目结构

```text
<project-root>/
  AGENTS.md
  task.json
  progress.txt
  codex-loop.ps1
  .codex/
    task-run-profile.json
  docs/
    harness/
      architecture.md
      new-project-usage.md
      regression-rules.md
      sandbox-policy.md
      task-session-strategy.md
      trace-format.md
    testing/
      ACCEPTANCE_CRITERIA.md
      ACCEPTANCE_EXAMPLES.md
      TEST_STRATEGY.md
      TRACEABILITY_MATRIX.md
      RISK_BASED_TEST_PLAN.md
      REGRESSION_PLAN.md
      EVIDENCE_PROTOCOL.md
      TEST_DATA_MATRIX.md
      test-matrix.md
      verify-matrix.md
  traces/
    <task-id>-<timestamp>.json
```

## 5. 参考资料

- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- OpenAI Codex non-interactive mode: https://developers.openai.com/codex/noninteractive
- OpenAI Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- OpenAI Codex MCP: https://developers.openai.com/codex/mcp
- OpenAI Codex hooks: https://developers.openai.com/codex/hooks
- OpenAI Codex GitHub Action: https://developers.openai.com/codex/github-action
- OpenAI Harness Engineering: https://openai.com/index/harness-engineering/
