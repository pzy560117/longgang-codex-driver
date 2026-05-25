# Docker 集成导出性能测试报告

**结论**: PASS
**环境**: Docker integration stack
**入口命令**: `npm run test:integration-performance`

## 指标定义

| 指标 | 含义 |
| --- | --- |
| `rowCount` | 本轮导出总行数 |
| `durationMs` | 从创建任务到任务进入 `COMPLETED` 的总耗时 |
| `fileSize` | 导出文件大小（字节） |
| `partCount` | 最终导出分片数 |
| `throughputRowsPerSec` | 平均吞吐量，按 `rowCount / durationSec` 计算 |
| `taskId` | 本轮导出任务 ID |
| `publishedStorageKey` | MinIO 已发布对象键 |

## 结果表

| 行数 | 总耗时(ms) | 总耗时(s) | 文件大小(bytes) | 分片数 | 吞吐量(rows/s) | task_id |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1000 | 6401 | 6.40 | 64490 | 1 | 156.23 | `exp_e2935454-4ecd-428a-ae2f-f0d0b7e20e83` |
| 10000 | 95066 | 95.07 | 619237 | 1 | 105.19 | `exp_75a01caf-49eb-42b1-a534-a48f6e17de93` |
| 50000 | 499812 | 499.81 | 995885 | 3 | 100.04 | `exp_33ec85ef-f601-4a06-94ed-963086af1029` |
| 100000 | 494352 | 494.35 | 995740 | 5 | 202.28 | `exp_5712fd98-5ab8-47a5-9426-082fd5b328d8` |

## 说明

- 本报告用于记录 Docker integration stack 下的性能基线。
- 该报告不声明外部生产 live evidence。
- 当前已拿到 `1000`、`10000`、`50000`、`100000` 四档基线结果。
- `50000` 与 `100000` 行场景都会输出 ZIP；当前观测分片数分别为 `3` 和 `5`。
- 自动性能测试过程中，真实下载文件会保存到 [tests/integration/artifacts](/E:/2026/alpha-project/longgang-codex-driver/tests/integration/artifacts)。
- 当前基线显示：
  - `1000` 行吞吐量最高，但文件体量最小，固定开销占比明显
  - `10000` 行总耗时约 `95s`
  - `50000` 行总耗时约 `499.81s`
  - `100000` 行总耗时约 `494.35s`
- `50000` 与 `100000` 耗时接近，说明当前链路的瓶颈不只在纯行数增长，还可能受到批处理、ZIP 发布、对象存储写入或轮询窗口影响，后续需要单独做更细粒度分解。

## batchSize A/B

为确认当前慢点是否主要来自批次过小，针对 `10000` 行在 Docker integration stack 下做了 `batchSize` A/B：

| batchSize | 总耗时(ms) | 总耗时(s) | 吞吐量(rows/s) | 结论 |
| --- | ---: | ---: | ---: | --- |
| 500 | 95066 | 95.07 | 105.19 | 当前默认值，明显偏慢 |
| 2000 | 26784 | 26.78 | 373.36 | 明显改善 |
| 5000 | 8246 | 8.25 | 1212.71 | 当前观测最佳 |

结论：

- `batchSize=500` 是当前性能问题的主要放大器之一。
- 仅调整 `batchSize`，`10000` 行导出耗时即可从约 `95s` 降到约 `8s`。
- 在不改查询模型和文件模型的前提下，优先把默认 `batchSize` 提升到 `5000` 是当前性价比最高的优化。

## 当前默认值

- 当前样板与集成 seed 默认 `batchSize` 已从 `500` 调整为 `5000`。
- 代码入口：
  - [src/sample-purchase-order/index.ts](/E:/2026/alpha-project/longgang-codex-driver/src/sample-purchase-order/index.ts)
  - [src/query-executor/index.ts](/E:/2026/alpha-project/longgang-codex-driver/src/query-executor/index.ts)

## 完整链路口径（create -> execute -> MinIO -> download）

以下结果按完整链路口径统计，不是只算到 `COMPLETED`：

| 行数 | create->COMPLETED | 下载元数据 | 实际下载 | 端到端总耗时 | 分片数 | 端到端吞吐量(rows/s) | task_id |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 10000 | 10.23s | 21ms | 39ms | 10.29s | 1 | 971.53 | `exp_769f765f-ff16-4d72-80fe-2ab7e122fc92` |
| 50000 | 46.70s | 20ms | 41ms | 46.77s | 3 | 1069.08 | `exp_bc4a1b5f-1512-4678-93bc-963572f26b4a` |
| 100000 | 99.95s | 29ms | 51ms | 100.03s | 5 | 999.66 | `exp_8c93559b-2585-41d8-906e-562dcfa574b8` |

说明：

- 在当前 Docker integration stack 下，下载阶段本身很轻，主要耗时仍集中在查询、执行、渲染、打包和对象存储发布阶段。
- 以完整链路口径看，`10000` 行约 `10.29s`、`50000` 行约 `46.77s`、`100000` 行约 `100.03s`。
- 这组数据比优化前的 `batchSize=500` 结果明显改善，说明默认批次提升已经实际反映到端到端性能上。

## 本次完整重跑结论

在重新清场并重启 Docker integration stack 后，再次按完整链路口径执行功能和性能验证，结论如下：

- 功能链路：
  - `integration stack completes export task end-to-end`: `23.10s`
  - `integration stack rejects unsigned requests`: `PASS`
- 性能链路：
  - `10000` 行完整链路端到端耗时维持在约 `10s` 级
  - 下载元数据和实际下载阶段仍然只有几十毫秒级
  - 当前主要耗时仍集中在导出执行阶段，而不是下载阶段

这意味着：

- “从发起导出到 MinIO 再到下载表格”的完整链路已经能够稳定重跑；
- 当前优化后的默认 `batchSize=5000` 已经把完整链路 `10000` 行压到可接受区间；
- 后续如果继续优化，应优先拆解查询重放、渲染/ZIP 和对象存储发布阶段，而不是下载阶段。
