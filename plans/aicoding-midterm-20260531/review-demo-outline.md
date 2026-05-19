# Review Demo Outline：中期评审演示提纲

## 1. 演示标题

AICoding 工程化 Harness 试点：以统一导出平台为样板的可控开发闭环

## 2. 8 至 12 分钟讲述顺序

### 2.1 项目定位

要点：

- 当前项目不是 AI 写代码 Demo。
- 当前项目验证企业如何把 AI Coding 纳入软件工程过程。
- 统一导出平台是样板工程，Harness 是工程化方法。

建议话术：

> 我们这阶段重点不是证明 AI 能写代码，而是证明 AI Coding 可以被需求、架构约束、任务队列、测试门禁和过程轨迹管理起来。

### 2.2 输入材料

展示路径：

- `docs/product/prd-lite.md`
- `docs/architecture/constraints.md`
- `plans/features/export-platform.dev-plan.md`

要点：

- PRD 定义做什么。
- 架构约束定义不能怎么做。
- dev plan 定义怎么拆、由哪些模块承载、怎么验证。

### 2.3 Harness 执行链路

展示链路：

```text
需求 / Spec
  -> Architecture Constraints
  -> task.json
  -> codex-loop.ps1
  -> codex exec
  -> arch / test / review
  -> progress.txt + traces/
  -> git commit
```

要点：

- AI 不直接自由写代码。
- 每个任务有 owned paths 和 test_command。
- 失败不能标记为完成。
- trace 可以复盘执行过程。

### 2.4 样板工程闭环

展示统一导出平台能力：

```text
创建导出任务
-> 任务入库
-> worker 异步执行
-> 查询状态
-> 文件生成
-> 下载文件
-> 审计与失败记录
```

建议命令：

```powershell
npm run demo:local:smoke
```

2026-05-19 本地彩排结果：

```text
demo:local ready.
MySQL: export-platform-mysql-local at 127.0.0.1:33306/export_platform_test
Object storage mock: http://127.0.0.1:<dynamic-port> bucket=export-platform-local-demo
Health URL: http://127.0.0.1:<dynamic-port>/health
demo:local smoke passed.
```

演示时按以下顺序讲：

1. 先运行 `npm run demo:local:smoke`，说明脚本会准备本地 MySQL、object storage mock、样板采购订单数据和 HTTP 服务。
2. 展示输出中的 `Health URL`，说明服务入口真实启动。
3. 展示输出中的 `POST /api/export/tasks example`，说明创建导出任务的外部入口是 HTTP API，不是内部函数调用。
4. 说明该 smoke 用于中期演示链路校准，完整需求验收仍看 `docs/testing/full-acceptance-test-report.md`。

备选命令：

```powershell
npm run test:acceptance
```

如果直接运行 `npm run test:acceptance`，必须先准备 `EXPORT_PLATFORM_TEST_DATABASE_URL`。本仓库推荐使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command '. .\scripts\docker-test-env.ps1; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run test:acceptance'
```

2026-05-19 彩排结果：4 个 acceptance tests 全部 PASS，覆盖手工 API 流、认证/参数拒绝和 full acceptance report 覆盖检查。

如需要展示完整受控验收：

```powershell
npm run test:acceptance:full-report
```

该命令耗时更长，适合评审前重新生成报告，不建议在 8 至 12 分钟现场演示中完整跑完。

### 2.5 测试和证据

展示路径：

- `docs/testing/full-acceptance-test-report.md`
- `docs/testing/api-acceptance-test-report.md`
- `docs/testing/TRACEABILITY_MATRIX.md`
- `traces/`

要点：

- 当前受控验收覆盖 FR-001 至 FR-014。
- 证据来自本地 Docker MySQL 和本地 object storage mock。
- 不声明外部生产 MySQL、live OSS/S3 或客户真实数据源已验证。

### 2.6 失败态和边界

必须主动说明：

- 真实客户环境接入仍是下一阶段。
- 外部数据源、网关认证上下文、对象存储、部署资源需要甲方或团队配合。
- 企业团队级方案还需要补多人协作、PRD 评审、测试验收、经验回流和可观测性。

### 2.7 下一阶段

建议下一阶段分三组任务：

| 任务组 | 目标 |
| --- | --- |
| 团队化流程 | PRD 评审、架构约束评审、Stage Review、测试验收 |
| 真实环境接入 | 真实 MySQL、真实对象存储、客户只读数据源、网关认证上下文 |
| 过程可观测 | Agent 日志归集、trace 检索、失败复盘、知识沉淀 |

## 3. 不建议展示方式

- 不要只打开代码目录说 AI 写完了。
- 不要只跑一个 API 成功返回。
- 不要现场完整跑 `npm run test:acceptance:full-report`，除非评审时间允许。
- 不要把本地 mock 环境说成生产环境。
- 不要在评审中临时新增未经验证的功能范围。

## 4. 现场演示检查清单

演示前确认：

- Docker 可用，且本机 `33306` 端口没有被非本项目 MySQL 占用。
- `npm run demo:local:smoke` 最近一次输出 `demo:local smoke passed.`。
- `npm run arch:check` 最近一次输出 `Architecture check passed.`。
- 若要跑 acceptance，使用 `scripts/docker-test-env.ps1` 提供 `EXPORT_PLATFORM_TEST_DATABASE_URL`。
- 打开 `docs/testing/full-acceptance-test-report.md`，准备展示证据边界。
- 打开 `plans/aicoding-midterm-20260531/evidence-checklist.md`，准备展示 trace 样例和“可以说 / 不要说”口径。

## 5. 评审结论建议

> 当前阶段已形成 AICoding 工程化试点样板：以统一导出平台为业务载体，通过 Harness 将需求、架构约束、任务执行、测试验证、执行轨迹和复盘材料串成闭环。当前成果可支撑中期评审和下一阶段团队推广，但生产上线仍需真实环境接入和客户侧联调验证。
