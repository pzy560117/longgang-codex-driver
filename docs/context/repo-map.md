# Repo Map：统一导出平台

**Feature ID**: `FEAT-EXPORT-PLATFORM-001`
**最后更新**: 2026-05-13

## 1. 当前仓库真实目录

| 路径 | 现状 | 用途 |
| --- | --- | --- |
| `AGENTS.md` | 已存在 | 仓库入口规则 |
| `docs/harness/` | 已存在 | 运行、知识、验证协议 |
| `docs/product/` | 已存在 | PRD、页面清单、难点研究、验收、需求矩阵、状态矩阵 |
| `docs/testing/` | 已存在 | 追溯、数据、测试、验证矩阵 |
| `docs/context/` | 已创建 | feature pack、repo map、architecture brief |
| `plans/` | 已创建 | 后续 dev-plan 落点 |
| `contracts/` | 当前不存在 | 后续 OpenAPI / schema / 契约测试落点 |
| `tests/` | 当前不存在 | 后续契约、后端、调度、查询、文件、样板测试落点 |
| `src/` | 当前不存在 | 后续服务实现落点，不可假设已存在 |
| `packages/` | 当前不存在 | 后续若拆分共享包或客户端，可作为候选落点 |
| `traces/` | 已存在 | 运行证据与 fresh evidence |

## 2. 可写落点

| 目标 | 可写路径 | 说明 |
| --- | --- | --- |
| 需求分析文档 | `docs/context/feature-pack.md` | 需求摘要、模块边界、拆分建议 |
| 仓库地图 | `docs/context/repo-map.md` | 真实目录、owned path、后续创建目录 |
| 架构摘要 | `docs/context/architecture-brief.md` | 模块边界、数据流、风险、验收顺序 |
| 追溯矩阵 | `docs/testing/TRACEABILITY_MATRIX.md` | FR-001 至 FR-014 全覆盖 |
| 测试数据矩阵 | `docs/testing/TEST_DATA_MATRIX.md` | 边界数据和 fixture 规划 |
| 测试矩阵 | `docs/testing/test-matrix.md` | planned / blocked-by-contract 占位 |
| 验证矩阵 | `docs/testing/verify-matrix.md` | 后续验证命令占位与证据路径 |
| 开发计划 | `plans/features/export-platform.dev-plan.md` | 供后续实现任务直接执行 |

## 3. 后续需创建目录

| 目录 | 作用 | 备注 |
| --- | --- | --- |
| `contracts/` | OpenAPI、schema、契约测试输入 | 当前不存在，后续先创建 |
| `tests/` | 契约、后端、调度、查询、文件、样板测试 | 当前不存在，后续先创建 |
| `src/` | 服务实现 | 当前不存在，不应在分析阶段假设存在 |
| `packages/` | 共享包、客户端、领域抽象 | 仅作为候选，不应强行预设 |
| `plans/features/` | 计划文档 | 当前已创建 |

## 4. 目录风险

- 当前仓库无业务代码目录，不能把 `src/` 写成唯一 owned path。
- 当前所有验证矩阵都必须明确 `planned` 或 `blocked-by-contract`，否则会误导后续实现任务。
- `contracts/` 和 `tests/` 的创建顺序应早于 `src/`，否则后续实现缺少契约锚点。

## 5. Knowledge References

- `DECISION-HARNESS-001` / Harness 从执行闭环扩展为知识闭环 / `docs/knowledge/decisions/DECISION-HARNESS-001.md` / used_in: 解释为何 repo map 需要同时服务实现和归档
- `GUIDELINE-RULES-001` / 规则必须短入口、深文档、可验证 / `docs/knowledge/guidelines/GUIDELINE-RULES-001.md` / used_in: 约束 repo map 只写可验证的真实落点

## 6. Knowledge Outputs

- none
