# Acceptance Criteria 模板

> 目标: 把需求写成可以直接转化为测试、review 和验收证据的条目。

## 1. 功能验收

| AC ID | 关联需求 | 验收标准 | 优先级 | 验证方式 | 状态 |
| --- | --- | --- | --- | --- | --- |
| AC-001 | FR-001 | GIVEN [前置条件], WHEN [用户动作], THEN [可观察结果] | P0 | e2e / 手工验收 / 单测 | Draft |
| AC-002 | FR-001 | WHEN [事件], THE [系统] SHALL [响应] | P0 | 单测 / 集成测试 | Draft |

## 2. 异常与边界验收

| AC ID | 场景 | 触发条件 | 预期行为 | 验证方式 |
| --- | --- | --- | --- | --- |
| AC-E001 | 空数据 | | 展示空态和可恢复操作 | story / e2e |
| AC-E002 | 接口失败 | | 展示错误态和重试入口 | story / e2e |
| AC-E003 | 权限不足 | | 隐藏或禁用受限操作 | e2e / 权限测试 |

## 3. 契约验收

- [ ] `contracts/openapi.yaml` 已更新或确认不需要更新。
- [ ] client / types / mock 已同步或确认不适用。
- [ ] 错误码、枚举、分页、空值语义已明确。
- [ ] breaking change 已评估。

## 4. 质量验收

- [ ] lint 通过。
- [ ] typecheck 通过。
- [ ] unit / integration 通过。
- [ ] build 通过。
- [ ] 文档改动运行 `git diff --check`。

## 5. UI 验收

- [ ] stories 覆盖 `default / empty / loading / error`。
- [ ] 关键权限、禁用、长文本和移动端状态已覆盖。
- [ ] e2e 覆盖主流程和至少一个异常流。
- [ ] visual regression 已更新或通过。

## 6. 文档验收

- [ ] `prd-lite.md`、`page-inventory.md`、`state-matrix.yaml` 一致。
- [ ] `design-brief.md`、`component-map.md`、`screen-states.md` 一致。
- [ ] 关键限制、禁改区、BLOCKED 条件已记录。
- [ ] Open Questions 已关闭或明确阻塞后续阶段。
