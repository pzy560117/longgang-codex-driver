# 验证矩阵

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务 ID**: CONTRACT-001
**生成时间**: 2026-05-13

> 当前文件用于补齐分析和契约阶段的验证入口。当前仓库无应用代码，因此后端、调度、查询、文件和样板验证仍应标记为 `planned` 或 `blocked-by-contract`，不得伪装成已存在的 `src` 测试。CONTRACT-001 已落地 `contracts/openapi.yaml` 作为对外 API 与错误码契约锚点。

| 检查项 | 关联需求 | 命令 / 证据 | 必需 | 退出码 / 结论 | 报告路径 |
| --- | --- | --- | --- | --- | --- |
| 产品真相源对齐 | FR-001 / FR-014 | `docs/product/prd-lite.md`、`page-inventory.md`、`difficulty-research.md`、`acceptance-criteria.md`、`requirement-interface-matrix.md`、`state-matrix.yaml` | 必需 | planned | `docs/testing/TRACEABILITY_MATRIX.md` |
| 需求追溯矩阵 | FR-001 - FR-014 | `docs/testing/TRACEABILITY_MATRIX.md` | 必需 | planned | `docs/testing/TRACEABILITY_MATRIX.md` |
| 测试数据矩阵 | FR-001 - FR-014 | `docs/testing/TEST_DATA_MATRIX.md` | 必需 | planned | `docs/testing/TEST_DATA_MATRIX.md` |
| 测试计划矩阵 | FR-001 - FR-014 | `docs/testing/test-matrix.md` | 必需 | planned | `docs/testing/test-matrix.md` |
| 验收示例索引 | FR-001 - FR-014 | `docs/testing/ACCEPTANCE_EXAMPLES.md` | 必需 | planned | `docs/testing/ACCEPTANCE_EXAMPLES.md` |
| OpenAPI 契约定义 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | `contracts/openapi.yaml`、`contracts/README.md` | 必需 | contract-defined | `contracts/openapi.yaml`、`contracts/README.md` |
| 契约验证入口 | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | `powershell -NoProfile -Command ".\verify.ps1 -Commands 'git diff --check'; npx --yes @redocly/cli lint contracts/openapi.yaml"` | 必需 | current-command-defined | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/verify-matrix.md`、`plans/features/export-platform.dev-plan.md` |
| 后端验证占位 | FR-001 / FR-002 / FR-004 / FR-005 / FR-006 / FR-007 / FR-009 / FR-010 / FR-011 / FR-012 / FR-013 / FR-014 | 后端单测、集成测、调度测、查询测、文件测、样板测 | 后续任务必需 | blocked-by-contract | `tests/`、`traces/` |
| 文件与样板验证占位 | FR-003 / FR-006 / FR-011 / FR-014 | 文件发布校验、ZIP 打包、过期清理、采购订单样板压测 | 后续任务必需 | blocked-by-contract | `tests/`、`traces/` |
| 静态检查 | FR-001 - FR-014 | `git diff --check` | 必需 | PASS / FAIL | `traces/` |

## 计划中的验证命令占位

- `contract-static`: `powershell -NoProfile -ExecutionPolicy Bypass -File .\verify.ps1 -Commands @('git diff --check')`，当前用于校验契约和文档改动无 diff 空白错误。
- `contract-openapi`: `npx --yes @redocly/cli lint contracts/openapi.yaml`，当前用于校验 OpenAPI 结构、引用和响应绑定；后续可封装为 `npm run test:contract`。
- `backend`: `powershell -NoProfile -Command "npm run test:backend"` 或等价后端单测命令。
- `scheduler`: `powershell -NoProfile -Command "npm run test:scheduler"` 或等价调度测试命令。
- `query`: `powershell -NoProfile -Command "npm run test:query"` 或等价查询测试命令。
- `file`: `powershell -NoProfile -Command "npm run test:file"` 或等价文件校验命令。
- `sample`: `powershell -NoProfile -Command "npm run test:sample"` 或等价采购订单样板测试命令。
- `verify`: `powershell -NoProfile -Command "npm run test:verify"` 或等价整体验证命令，待实现任务定义后补充。
- 以上命令仅为后续占位，不表示当前仓库已存在对应脚本或 package scripts。

## Requirement 验证入口

| Req ID | 后续验证类型 | 占位命令 | 当前状态 | 证据路径 |
| --- | --- | --- | --- | --- |
| FR-001 | contract / backend | `powershell -NoProfile -Command "npm run test:export-platform:fr001"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-002 | contract / backend / query | `powershell -NoProfile -Command "npm run test:export-platform:fr002"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`docs/testing/verify-matrix.md`、`traces/` |
| FR-003 | contract / file | `powershell -NoProfile -Command "npm run test:export-platform:fr003"` | contract-defined / file-blocked | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-004 | contract / backend / query | `powershell -NoProfile -Command "npm run test:export-platform:fr004"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-005 | backend / scheduler | `powershell -NoProfile -Command "npm run test:export-platform:fr005"` | blocked-by-contract | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`contracts/`、`tests/`、`traces/` |
| FR-006 | backend / sample | `powershell -NoProfile -Command "npm run test:export-platform:fr006"` | blocked-by-contract | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-007 | contract / backend | `powershell -NoProfile -Command "npm run test:export-platform:fr007"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-008 | contract / backend | `powershell -NoProfile -Command "npm run test:export-platform:fr008"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-009 | contract / backend / auth | `powershell -NoProfile -Command "npm run test:export-platform:fr009"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-010 | contract / backend / audit | `powershell -NoProfile -Command "npm run test:export-platform:fr010"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-011 | backend / file | `powershell -NoProfile -Command "npm run test:export-platform:fr011"` | blocked-by-contract | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-012 | contract / backend / state-machine | `powershell -NoProfile -Command "npm run test:export-platform:fr012"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-013 | contract / backend | `powershell -NoProfile -Command "npm run test:export-platform:fr013"` | contract-defined / backend-blocked | `contracts/openapi.yaml`、`contracts/README.md`、`docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |
| FR-014 | sample / pressure | `powershell -NoProfile -Command "npm run test:export-platform:fr014"` | blocked-by-contract | `docs/testing/TRACEABILITY_MATRIX.md`、`docs/testing/TEST_DATA_MATRIX.md`、`tests/`、`traces/` |

## 最终规则

- ANALYSIS-001 只负责补齐追溯、测试数据、测试计划和验证占位，不把占位命令伪装成可执行实现。
- CONTRACT-001 只负责补齐对外 API、注册配置、状态和错误码契约，不把后端、调度、文件或样板测试伪装成已存在实现。
- 后续实现任务必须从本矩阵推导 `affected tests`、证据路径和契约路径。
- release 前每个必需项都要有 fresh evidence，或提供明确的 `BLOCKED - 需要人工介入` 记录。
