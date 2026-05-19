# Evidence Checklist：中期评审证据清单

## 1. 证据分层

| 层级 | 作用 | 当前路径 | 状态 |
| --- | --- | --- | --- |
| 需求真相源 | 说明要做什么 | `docs/product/prd-lite.md` | 已有 |
| 架构约束 | 说明交付形态、边界和禁止实现 | `docs/architecture/constraints.md` | 已有 |
| 开发计划 | 说明任务拆分、模块和验证顺序 | `plans/features/export-platform.dev-plan.md` | 已有 |
| 需求追溯 | 说明 FR 到测试和证据路径 | `docs/testing/TRACEABILITY_MATRIX.md` | 已有 |
| 全量验收报告 | 说明本地受控验收结果 | `docs/testing/full-acceptance-test-report.md` | 已有，2026-05-18 报告为 PASS；评审前建议重跑 |
| API 验收报告 | 说明 API smoke 和手工验收路径 | `docs/testing/api-acceptance-test-report.md` | 已有，2026-05-18 报告为 PASS；评审前建议重跑 |
| 执行轨迹 | 说明任务执行和 review 过程 | `traces/` | 已有，已筛选代表性样例 |
| 运行脚本 | 说明可复现演示和验证命令 | `package.json`、`scripts/` | 已有 |

## 2. 评审可用证据

### 2.1 可直接作为阶段成果

- PRD-Lite 覆盖 FR-001 至 FR-014。
- Architecture Constraints Packet 明确独立微服务、HTTP API、worker、MySQL、测试替身边界。
- `src/` 已有主要后端模块边界。
- `package.json` 已有 `arch:check`、`typecheck`、分层测试、demo 和 full acceptance report 命令。
- `docs/testing/full-acceptance-test-report.md` 记录本地 Docker MySQL + 本地 object storage mock 验收 PASS。

### 2.2 可演示但需要说明边界

- `npm run demo:local:smoke`
- `npm run test:acceptance`
- `npm run test:acceptance:full-report`
- `npm run test:object-storage-live`

说明：

- `test:object-storage-live` 在当前报告中由本地 object storage mock 和显式 allow flags 驱动，只能算 docker/mock smoke。
- 当前证据不等同于外部生产对象存储验收。

### 2.3 需要人工确认的证据

- 最新 full acceptance report 是否要在 2026-05-31 评审前重新生成并固化。
- 客户样本代码和文档是否允许进入评审材料。
- 是否已有客户服务器多 Agent 环境的可展示日志。
- OpenAI API 转发服务器是否可展示成本、稳定性或调用记录。
- OpenClaw 日志归集是否已有截图或查询样例。

## 3. 代表性证据包

### 3.1 需求与架构证据

| 证据 | 路径 | 可讲内容 |
| --- | --- | --- |
| 产品需求 | `docs/product/prd-lite.md` | FR-001 至 FR-014，覆盖创建、查询、调度、文件、审计、清理、样板 |
| 架构约束 | `docs/architecture/constraints.md` | independent microservice、HTTP、worker、MySQL、测试替身和禁止实现 |
| 架构 brief | `docs/context/architecture-brief.md` | 模块边界、数据流、FR 落点、技术栈和架构检查 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` | 任务拆分、owned paths、验证顺序和证据路径 |
| 需求追溯 | `docs/testing/TRACEABILITY_MATRIX.md` | FR 到 API、测试层、证据路径和风险的映射 |

### 3.2 验收与测试证据

| 证据 | 路径 / 命令 | 当前可引用结论 |
| --- | --- | --- |
| 全量验收 | `docs/testing/full-acceptance-test-report.md` | 2026-05-18 PASS，覆盖 FR-001 至 FR-014 |
| API 验收 | `docs/testing/api-acceptance-test-report.md` | 2026-05-18 PASS，覆盖创建、幂等、详情、历史、取消、认证拒绝 |
| 架构检查 | `npm run arch:check` | 检查生产入口、route manifest、migration、禁止替身等架构门禁 |
| 接受度测试 | `npm run test:acceptance` | 轻量校验 API 验收流和 full acceptance report 任务覆盖 |
| 完整受控验收 | `npm run test:acceptance:full-report` | 可在评审前重跑，生成新的全量报告 |

### 3.3 代表性 trace 样例

| Trace | 状态 | 适合展示的点 |
| --- | --- | --- |
| `traces/REQUIREMENTS-COMPLETE-REVIEW-001-20260517-101311.json` | passed | 需求完整性复审，说明不是只靠实现自证 |
| `traces/PUBLIC-ERROR-REDACTION-001-20260517-100346.json` | passed | 公开错误脱敏，说明安全和错误边界被测试约束 |
| `traces/DEFAULT-QUERY-RETRY-ALIGNMENT-001-20260517-093622.json` | passed | 查询重试和 worker 行为，说明异步执行不是演示假流程 |
| `traces/TASK-CANCEL-ATOMICITY-001-20260517-092918.json` | passed | 取消原子性，说明状态机和并发边界有验证 |

这些 trace 可作为评审演示中的“过程可追踪”证据。演示时不需要展开完整 JSON，只展示 `task_id`、`status`、`test_command` 和关联任务即可。

## 4. 缺口清单

| 缺口 | 影响 | 建议处理 |
| --- | --- | --- |
| 外部生产 MySQL 未验收 | 不能声明生产 DB 接入完成 | 下一阶段真实环境接入任务 |
| live OSS/S3 未验收 | 不能声明生产对象存储完成 | 下一阶段对象存储 smoke |
| 客户真实业务数据源未联调 | 不能声明客户生产链路打通 | 需要甲方提供只读数据源和字段口径 |
| 团队级多人协作机制未固化 | 不能包装成成熟企业级方案 | 补 PRD 评审、任务评审、review gate、交接流程 |
| 过程可观测性仍分散 | 复盘成本高 | 接入日志归集和 trace 索引 |
| 经验回流机制待补 | 难以复制到其他业务 | 建立知识条目和模板任务 |

## 5. 评审证据使用口径

| 场景 | 可以说 | 不要说 |
| --- | --- | --- |
| 本地受控验收 | FR-001 至 FR-014 已在 Docker/local MySQL + 本地 object storage mock 下完成受控验收 | 已完成生产上线验收 |
| 对象存储 | 已有本地 object storage mock smoke，能验证文件发布、下载和清理链路 | live OSS/S3 已验证 |
| 业务数据源 | 平台具备只读数据源和数据中台接入边界 | 已接入客户真实业务数据源 |
| AI Coding | Harness 能把任务、执行、验证和 trace 串成工程闭环 | AI 自动完成全部工程交付 |
| 团队推广 | 已有方法和样板，下一阶段补团队协作和环境迁移 | 已是成熟企业团队级方案 |

## 6. 建议评审前补跑命令

最低口径：

```powershell
npm run arch:check
npm run typecheck
npm run test:acceptance
git diff --check
```

演示口径：

```powershell
npm run demo:local:smoke
```

完整本地受控验收口径：

```powershell
npm run test:acceptance:full-report
```

补跑后需要检查：

- `docs/testing/full-acceptance-test-report.md` 结论为 PASS。
- `docs/testing/api-acceptance-test-report.md` 如被重跑，结论为 PASS。
- 报告没有写入 secret、password、token、真实连接串。
- `git diff --check -- docs/testing plans/aicoding-midterm-20260531` 通过。

## 7. 完成声明模板

建议使用：

> 当前阶段已完成 AICoding 工程化试点的本地受控闭环验证。统一导出平台在 Docker/local MySQL 与本地 object storage mock 条件下完成需求、架构、实现、测试和证据链闭环，可作为中期评审样板。生产级外部 MySQL、live OSS/S3、客户真实数据源和团队级协作机制属于下一阶段接入与推广范围。

避免使用：

- 已经生产上线。
- 已经完成客户真实环境验证。
- AI 已经自动完成全部开发。
- 该方案已经是成熟企业级标准方案。
