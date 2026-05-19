# Evidence Checklist：中期评审证据清单

## 1. 证据分层

| 层级 | 作用 | 当前路径 | 状态 |
| --- | --- | --- | --- |
| 需求真相源 | 说明要做什么 | `docs/product/prd-lite.md` | 已有 |
| 架构约束 | 说明交付形态、边界和禁止实现 | `docs/architecture/constraints.md` | 已有 |
| 开发计划 | 说明任务拆分、模块和验证顺序 | `plans/features/export-platform.dev-plan.md` | 已有 |
| 需求追溯 | 说明 FR 到测试和证据路径 | `docs/testing/TRACEABILITY_MATRIX.md` | 已有 |
| 全量验收报告 | 说明本地受控验收结果 | `docs/testing/full-acceptance-test-report.md` | 已有，需确认是否为最新 |
| API 验收报告 | 说明 API smoke 和手工验收路径 | `docs/testing/api-acceptance-test-report.md` | 已有，需确认是否为最新 |
| 执行轨迹 | 说明任务执行和 review 过程 | `traces/` | 已有，需筛选代表性样例 |
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

- 最新 full acceptance report 是否为 2026-05-31 评审前重新生成。
- 当前 trace 中哪些任务最适合作为演示样例。
- 客户样本代码和文档是否允许进入评审材料。
- 是否已有客户服务器多 Agent 环境的可展示日志。
- OpenAI API 转发服务器是否可展示成本、稳定性或调用记录。
- OpenClaw 日志归集是否已有截图或查询样例。

## 3. 缺口清单

| 缺口 | 影响 | 建议处理 |
| --- | --- | --- |
| 外部生产 MySQL 未验收 | 不能声明生产 DB 接入完成 | 下一阶段真实环境接入任务 |
| live OSS/S3 未验收 | 不能声明生产对象存储完成 | 下一阶段对象存储 smoke |
| 客户真实业务数据源未联调 | 不能声明客户生产链路打通 | 需要甲方提供只读数据源和字段口径 |
| 团队级多人协作机制未固化 | 不能包装成成熟企业级方案 | 补 PRD 评审、任务评审、review gate、交接流程 |
| 过程可观测性仍分散 | 复盘成本高 | 接入日志归集和 trace 索引 |
| 经验回流机制待补 | 难以复制到其他业务 | 建立知识条目和模板任务 |

## 4. 建议评审前补跑命令

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

## 5. 完成声明模板

建议使用：

> 当前阶段已完成 AICoding 工程化试点的本地受控闭环验证。统一导出平台在 Docker/local MySQL 与本地 object storage mock 条件下完成需求、架构、实现、测试和证据链闭环，可作为中期评审样板。生产级外部 MySQL、live OSS/S3、客户真实数据源和团队级协作机制属于下一阶段接入与推广范围。

避免使用：

- 已经生产上线。
- 已经完成客户真实环境验证。
- AI 已经自动完成全部开发。
- 该方案已经是成熟企业级标准方案。
