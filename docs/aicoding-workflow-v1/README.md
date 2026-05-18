# AICoding 企业级开发流程 v1 沟通包

本目录用于支撑后续对外讲述、团队讨论和优化共创。当前项目已经具备 Harness、任务队列、架构约束、验证矩阵、review 和证据链，本目录不重新定义一套流程，而是把已有内容转成团队能听懂、能质疑、能补充、能落地的沟通材料。

## 使用场景

| 场景 | 推荐材料 | 目标 |
| --- | --- | --- |
| 向领导或技术负责人说明项目价值 | `narrative.md` | 把重点从“AI 写代码”转成“企业级研发闭环” |
| 组织团队讨论怎么优化 | `discussion-workshop.md` | 收集产品、业务、技术、测试、运维不同视角的问题 |
| 会后整理改进项 | `optimization-backlog-template.md` | 把讨论意见沉淀成可排序、可验证的 backlog |

## 核心口径

一句话：

> 这个项目验证的不是 AI 能不能写代码，而是 AI Coding 能不能进入企业级研发流程：需求可输入，过程可查看，质量可验收，结果可复盘，经验可复制。

三条边界：

- 导出功能是样板案例，不是 AICoding 流程的全部目标。
- 现有 Harness 是流程底座，不需要在汇报中重新发明概念。
- 后续讨论重点是找出哪些环节还不透明、不稳定、不好用或不好验收。

## 建议会议节奏

### 30 分钟版本

| 时间 | 内容 | 输出 |
| --- | --- | --- |
| 5 分钟 | 说明为什么要做 AICoding 流程 | 对齐问题背景 |
| 10 分钟 | 展示导出功能样板链路 | 让团队看到真实过程证据 |
| 10 分钟 | 按角色收集问题 | 得到待优化清单 |
| 5 分钟 | 确认下一轮行动 | 形成 owner、优先级和验证方式 |

### 60 分钟版本

| 时间 | 内容 | 输出 |
| --- | --- | --- |
| 10 分钟 | 背景、目标和成功标准 | 对齐 AICoding 的企业级定位 |
| 15 分钟 | 导出功能样板 walkthrough | 展示需求、任务、执行、验证、review、commit 链路 |
| 15 分钟 | 证据地图和质量门禁评审 | 判断技术负责人是否能验收 |
| 15 分钟 | 分角色讨论优化点 | 收集产品、业务、技术、测试、运维意见 |
| 5 分钟 | 收口 backlog 和下一步 | 明确 P0/P1/P2 改进项 |

## 讨论前准备

- 确认当前对外展示的导出功能验收结论，不把未完成或失败的验证写成 PASS。
- 准备仓库路径、关键文档路径、测试报告路径、review 路径和 trace/commit 路径。
- 明确哪些证据是本机或 Docker/mock 证据，哪些还没有接入真实生产依赖。
- 预先说明本次会议目标是优化流程，不是评判某个 AI 工具好坏。

## 相关现有资料

- 产品计划：`docs/product/aicoding-workflow-v1-plan.md`
- Harness 入口：`AGENTS.md`
- Harness 架构：`docs/harness/architecture.md`
- 任务会话策略：`docs/harness/task-session-strategy.md`
- 架构约束包：`docs/architecture/constraints.md`
- 验证矩阵：`docs/testing/verify-matrix.md`
- 全量验收报告：`docs/testing/full-acceptance-test-report.md`
- 需求完整性 review：`docs/reviews/requirements-complete-review.md`
