# DEV-PLAN：需求驱动完整 Review

**Feature ID**: `FEAT-REQUIREMENTS-COMPLETE-REVIEW-001`
**建议 Task ID**: `REQUIREMENTS-COMPLETE-REVIEW-001`
**创建日期**: 2026-05-16
**用途**: 以产品需求真相源为基准，对统一导出平台当前实现、契约、测试和证据做完整反查 review，输出可执行缺口清单和后续修复任务建议。

## 1. 需求分析

用户当前要求不是继续补单点功能，而是：

- 先从 `docs/product/*` 重新理解真实需求。
- 用需求逐条审查当前实现是否完整覆盖。
- 审查范围必须覆盖产品、架构、OpenAPI、服务实现、DB、worker、query、file、sample、测试和 evidence 边界。
- 如发现缺口，应形成新的任务或后续修复队列，而不是直接修改已有完成任务的历史结论。

## 2. Truth Sources

本 review 必须以这些文件为准：

- `docs/product/prd-lite.md`
- `docs/product/acceptance-criteria.md`
- `docs/product/requirement-interface-matrix.md`
- `docs/product/state-matrix.yaml`
- `docs/architecture/constraints.md`
- `contracts/openapi.yaml`
- `docs/testing/verify-matrix.md`
- `task.json`

## 3. Review 维度

| 维度 | 重点问题 | 输出 |
| --- | --- | --- |
| FR 覆盖 | FR-001 至 FR-014 是否都有契约、实现、测试和 evidence | requirement coverage table |
| AC 覆盖 | AC-001 至 AC-021、AC-E001 至 AC-E027 是否有对应测试或明确 gap | acceptance coverage table |
| API 契约 | OpenAPI operation、错误码、状态、响应字段是否与 PRD/AC 一致 | contract findings |
| 状态机 | PENDING/EXECUTING/COMPLETED/FAILED/CANCELED/EXPIRED 与内部 cancel flag 是否无外泄 | state findings |
| DB/worker | MySQL schema、锁租约、接管、重试、checkpoint 是否符合需求 | persistence findings |
| query/file/sample | 查询模板、脱敏、分片、ZIP、10 万行、文件校验和下载保护是否闭环 | domain findings |
| 证据边界 | mock/local/docker/live 是否清晰，不互相替代 | evidence findings |
| 测试实践 | package script、task test_command、verify-matrix、守护测试是否一致 | test governance findings |

## 4. 产物

建议产物：

- `docs/reviews/requirements-complete-review.md`
- `docs/reviews/requirements-complete-review.findings.json`
- `task.json` 中新增 `REQUIREMENTS-COMPLETE-REVIEW-001`

`docs/reviews/requirements-complete-review.md` 至少包含：

- 总体结论：PASS / PASS_WITH_GAPS / FAIL
- FR-001 至 FR-014 覆盖矩阵
- AC / AC-E 覆盖矩阵
- P0/P1 缺口清单，带文件路径和建议 task id
- 证据边界结论
- 不应直接修改的历史完成记录说明

## 5. 建议 task.json 条目

```json
{
  "id": "REQUIREMENTS-COMPLETE-REVIEW-001",
  "description": "基于产品需求真相源完整 review 当前实现、契约、测试和证据边界",
  "task_kind": "feature_plan",
  "phase": "requirements-review",
  "gate_profile": "spec_required",
  "priority": 92,
  "dependencies": ["DOCKER-TEST-DATA-AUTOMATION-001"],
  "passes": false,
  "architecture_constraints": [
    "review 必须以 docs/product/* 和 docs/architecture/constraints.md 为 truth source",
    "review 只输出缺口和后续任务建议，不把未修复缺口伪装成完成",
    "mock/local/docker/live evidence 必须分开判定"
  ],
  "forbidden_implementations": [
    "禁止直接改写已有 passes:true 任务的历史完成结论",
    "禁止只因为 release gate 通过就跳过 AC/异常验收逐项检查",
    "禁止把 docker/mock evidence 写成 live evidence",
    "禁止在 review 中直接修业务代码后声称 review 完成"
  ],
  "test_command": "npm run test:mock-local; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git diff --check -- task.json docs/reviews docs/testing plans/features/requirements-complete-review.plan.md"
}
```

## 6. 执行顺序

1. 创建 `docs/reviews/requirements-complete-review.md` 和 findings JSON 骨架。
2. 从 PRD 抽取 FR-001 至 FR-014、AC-001 至 AC-021、AC-E001 至 AC-E027。
3. 对照 OpenAPI、`src/`、`tests/`、`docs/testing/verify-matrix.md` 和 `task.json`。
4. 逐条标记 `covered`、`partially_covered`、`gap`、`not_applicable`。
5. 对 P0/P1 gap 生成建议后续 task id。
6. 跑 review 任务验证命令。
7. 仅在 review 产物完整、验证通过后标记任务完成。

## 7. 初步风险

- 当前 release gate 通过不等于所有异常验收都逐项覆盖。
- 当前 evidence 为 docker/mock，本 review 不能升级为 live evidence。
- 如果发现 P0 缺口，review 任务可以完成，但总体结论必须是 `PASS_WITH_GAPS` 或 `FAIL`，并创建后续修复建议。
