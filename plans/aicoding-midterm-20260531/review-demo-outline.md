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

备选命令：

```powershell
npm run test:acceptance
```

如需要展示完整受控验收：

```powershell
npm run test:acceptance:full-report
```

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
- 不要把本地 mock 环境说成生产环境。
- 不要在评审中临时新增未经验证的功能范围。

## 4. 评审结论建议

> 当前阶段已形成 AICoding 工程化试点样板：以统一导出平台为业务载体，通过 Harness 将需求、架构约束、任务执行、测试验证、执行轨迹和复盘材料串成闭环。当前成果可支撑中期评审和下一阶段团队推广，但生产上线仍需真实环境接入和客户侧联调验证。
