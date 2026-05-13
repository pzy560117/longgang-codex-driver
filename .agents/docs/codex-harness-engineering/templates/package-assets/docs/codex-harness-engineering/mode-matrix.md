# Harness Mode Matrix

## 1. Summary

当前安装包只保留 `full` 模式。SpecKit 的 `.specify/`、`workflows/speckit.*` 和 `speckit-*` skills 仍随 full 包安装，但它们服务于 `task.json + codex-loop.ps1` 的 driver-first 主链路，不再提供独立轻量 stop hook 安装形态。

| 字段 | full |
| --- | --- |
| 适用场景 | 长期业务项目、需求收敛、实现、验证和归档都走同一套 driver 闭环 |
| 状态源 | `task.json` |
| 执行入口 | `codex-loop.ps1` |
| 提交责任 | driver |
| trace 责任 | driver 写 `traces/*.json` |
| 验证入口 | `doctor.ps1`、`verify.ps1`、task `test_command` |
| 禁区 | 不手改 `task.json`、`progress.txt`、`traces/`；不绕过任务依赖和验证命令 |

## 2. Installation Outputs

| 模式 | 必备安装产物 |
| --- | --- |
| full | `AGENTS.md`、`codex-loop.ps1`、`doctor.ps1`、`verify.ps1`、`env-check.ps1`、`task.json`、`.codex/*`、`docs/harness/*`、`docs/testing/*`、`.agents/rules/*`、`.agents/workflows/*`、`.agents/.specify/*`、`.agents/skills/*` |

## 3. Ownership Rules

| 字段 | full |
| --- | --- |
| 当前任务边界 | `task.json` 当前 task 的 `owned_paths`、`dependencies`、`test_command` |
| 提交者 | `codex-loop.ps1` 或任务收尾流程 |
| 失败记录 | `progress.txt` + `traces/*.json` |
| 允许的运行产物 | `task.json`、`progress.txt`、`traces/`、显式 `non_blocking_dirty_paths` |

## 4. SpecKit Usage

SpecKit 仍用于生成或完善 `spec.md`、`plan.md`、testing truth sources 和任务拆解输入。方案确认后，应把结果转成 `project-task-template.json` / `task.json`，再交给 `codex-loop.ps1` 执行。
