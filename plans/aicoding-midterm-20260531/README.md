# AICoding 中期评审收口计划

## 1. 定位

本目录用于把当前项目收口为 2026-05-31 前可评审、可演示、可交接的 AICoding 工程化阶段成果。

当前项目不再按“AI 工具试用”表达，而按“企业级 AICoding 工程化 Harness 试点”表达。统一导出平台是工程化试点样板，Harness 是方法和过程控制主体。

## 2. 当前仓库实际状态

| 维度 | 当前状态 | 评审口径 |
| --- | --- | --- |
| 产品需求 | `docs/product/prd-lite.md` 已定义统一导出平台 FR-001 至 FR-014 | 有明确业务需求与验收范围 |
| 架构约束 | `docs/architecture/constraints.md` 已定义独立微服务、HTTP、worker、MySQL、测试替身边界 | AI Coding 受架构约束控制，不是自由生成 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` 已拆出模块、owned paths、验证顺序 | 已形成可执行工程计划 |
| 实现结构 | `src/` 已包含 task-api、scheduler、query-executor、file-service、cleanup-job、audit-log 等模块 | 已具备后端样板工程形态 |
| 测试与证据 | `docs/testing/full-acceptance-test-report.md` 显示本机 Docker MySQL + 本地 object storage mock 验收链路 PASS | 可证明受控本地环境闭环，不声明生产上线 |
| Harness 机制 | `task.json -> codex-loop.ps1 -> verify/test -> progress/traces -> commit` 是仓库默认主链路 | 评审重点是可管理、可验证、可追踪、可复盘 |

## 3. 中期评审目标

到 2026-05-31，交付目标不是扩大功能范围，而是打透两个闭环：

1. AICoding 工程化闭环：需求、架构约束、任务拆解、执行、验证、trace、复盘、提交。
2. 数据导出微服务样板闭环：创建任务、查询状态、异步执行、生成文件、下载文件、失败记录、测试证据。

## 4. 目录文件

| 文件 | 用途 |
| --- | --- |
| `plan.md` | 总体阶段计划、目标、里程碑、风险 |
| `task-breakdown.md` | 可转入 `task.json` 的任务拆解 |
| `review-demo-outline.md` | 月底评审叙事和演示脚本 |
| `evidence-checklist.md` | 证据清单、缺口和验收口径 |

## 5. 工作原则

- 不把 PoC 说成生产上线。
- 不只展示代码结果，必须展示 Harness 过程证据。
- 不新增大范围业务需求，优先收口现有统一导出平台样板。
- 不用内存实现、mock repository 或 fixture 冒充生产路径。
- 外部生产 MySQL、live OSS、客户真实数据源未接入时，必须明确为下一阶段依赖。
