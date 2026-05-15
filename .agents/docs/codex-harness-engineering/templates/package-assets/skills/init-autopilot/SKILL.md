---
name: init-autopilot
description: Use when starting work in this repository and needing the default startup routine, staged task.json execution flow, and automatic continuation until ready tasks finish or block.
---

# Init Autopilot

本 skill 是这个仓库的默认启动协议。每次进入仓库先读本文件，再决定是先做需求澄清，还是直接进入自动续跑。

## 何时使用

- 刚进入本仓库，需要确定默认工作流
- 根目录存在 `task.json`，希望自动连续执行任务
- 根目录不存在 `task.json`，需要先生成 spec 草稿
- 用户明确要求“自动运行”“继续执行”“不要每次都手动继续”

## 每次会话初始化

1. 读取根目录 `task.json`（如果存在）
2. 读取根目录 `progress.txt`（如果存在）
3. 读取根目录 `AGENTS.md`
4. 若当前目标目录还有更深层 `AGENTS.md` 或工作空间规范，再继续读取
5. 统一使用简体中文输出

## 模式判断

### 模式 A：Spec

触发条件：

- 根目录不存在 `task.json`
- 用户明确要求“创建 spec”“讨论需求”“规划方案”“proposal”“change”

执行规则：

1. 每轮只问必要问题，控制在 1 到 3 个
2. 先形成 `task.json` 草稿
3. 明确提示“请确认后再开始执行”
4. 未收到用户“确认”前，禁止开始实现

### 模式 B：Autopilot

触发条件：

- 根目录已存在 `task.json`
- 用户没有明确要求停留在讨论阶段

执行规则：

1. 优先读取 `task.json.runtime`
2. 选择下一个可执行任务：
   - `passes = false`
   - `priority` 数字最小
   - `dependencies` 全部完成
3. 实现、验证、写入 `progress.txt`
4. 仅在验证通过后，把当前任务更新为完成
5. 单个 Codex 会话只处理一个任务，后续任务由自动驱动器继续启动
6. 只有在“全部完成”“进入阻塞”或“无进展保护触发”时才停止
7. 不要在每个任务后要求用户手动输入“继续”

## 自动驱动器规则

优先顺序：

1. 使用 `task.json.runtime.driver`
2. 若未声明 driver，则回退到仓库默认命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
```

若自动驱动器已可用：

- 先运行驱动器，而不是手工逐个任务续跑
- 驱动器内部使用 `codex exec`，不要再使用旧式 `codex -p`
- 驱动器返回“全部完成”时，直接汇报结果
- 驱动器返回阻塞时，按阻塞模板汇报并停止
- Windows 当前不要依赖 Codex hooks 作为主驱动；hooks 只作为 WSL/Linux 或未来版本增强层

## 验证与提交

每个任务都要遵守：

1. 优先执行任务自己的 `test_command`
2. 若没有 `test_command`，再按项目默认验证方式执行
3. 验证失败时，禁止标记完成
4. 代码、`task.json`、`progress.txt` 应尽量放在同一个提交里
5. 不要回滚与当前任务无关的现有改动

### 测试实践映射防漂移

当任务涉及 `task.json`、`package.json` scripts、`tests/`、`docs/testing/verify-matrix.md`、release gate 或 mock/local/docker/live evidence 边界时，必须先检查并保持测试实践映射：

1. 每个关键 test script 必须有明确 task 归属，不能只有 `package.json` 脚本或只有 release 总门禁。
2. `task.json` 中相关任务必须写清 `test_command`、需求范围、依赖形态和 evidence 边界。
3. `docs/testing/verify-matrix.md` 必须有“测试实践到 task 映射”或等价表，列出 test script、task id、需求范围、依赖形态和 evidence 边界。
4. mock/local rehearsal、docker/mock release、外部 live 验证必须分开描述，不能互相替代。
5. 如果仓库存在 `tests/mock-local/test-practice-matrix.test.mjs` 或同类守护测试，修改上述文件后必须运行覆盖它的测试命令，例如 `npm run test:mock-local`。
6. 新增、删除或改名 test script 时，同步更新 task、verify-matrix 和守护测试；否则不得把任务标记为完成。

## 阻塞处理

遇到下列情况立即停止自动续跑：

- 缺少环境变量或密钥
- 外部服务不可用
- 需要人工授权
- 任务描述矛盾或信息不足

阻塞时必须：

1. 在 `progress.txt` 记录阻塞原因
2. 输出结构化阻塞信息
3. 停止继续执行

阻塞模板：

```text
🚫 BLOCKED - 需要人工介入

**当前任务**: [task-id] [task-description]

**已完成的工作**:
- [已完成部分]

**阻塞原因**:
- [具体原因]

**需要人工操作**:
1. [步骤 1]
2. [步骤 2]

**解除阻塞后优先执行**:
powershell -NoProfile -ExecutionPolicy Bypass -File .\codex-loop.ps1
```

## 快速自检

- 是否已经读取了根目录 `task.json`
- 是否判断清楚当前是 `Spec` 还是 `Autopilot`
- 若可自动续跑，是否已经优先使用 driver
- 是否理解“单个 Codex 会话只做一个任务，driver 负责连续多轮”
- 是否只报告有验证证据的结果
