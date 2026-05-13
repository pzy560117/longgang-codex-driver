# Feedback / Evolution Loop 模板

## 1. 目标

把重复出现的用户修正、审查失败和回归问题，从“聊天提醒”升级成“仓库规则”。

## 2. 反馈来源

- 用户直接纠正
- Stage 1 review 失败
- Stage 2 review 失败
- verify 失败
- E2E / visual regression 失败
- 发布后回滚或线上事故

## 3. 反馈记录格式

| 日期 | 来源 | 触发信号 | 具体问题 | 临时修复 | 可沉淀规则 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-22 | review | Stage 1 FAIL | 设计稿未同步更新 | 补设计稿 | UI 变更前必须更新设计稿 | open |

## 4. 升级规则

- 同类反馈出现 1 次: 记录到反馈表。
- 同类反馈出现 2 次: 加入检查清单或 review 必查项。
- 同类反馈出现 3 次及以上: 升级为模板、driver、Skill 或治理规则。

## 5. 处理优先级

1. 能被确定性脚本拦截的，优先脚本化。
2. 能被 review 清单拦截的，加入 Stage 1 / Stage 2 模板。
3. 能被真相源文档避免的，补 Product / Design / DEV-PLAN 模板。
4. 最后才是单纯写经验说明。

## 6. 常见升级方向

- 需求误解 -> 更新 `prd-lite.md` / `acceptance-criteria.md`
- 设计缺口 -> 更新 `design-brief.md` / `screen-states.md`
- 任务切分过粗 -> 更新 `dev-plan.md`
- 审查漏项 -> 更新 Stage 1 / Stage 2 review 模板
- 验证不足 -> 更新 `verify.ps1`、`test_command`、CI

## 7. Session 启动检查

新 session 开始前，至少确认：

- 有没有未处理的高频反馈
- 有没有需要毕业为正式规则的事项
- 当前模板是否已经同步这些规则

## 8. 完成标准

- 反馈不只被记录，而且被归类。
- 高频问题已经迁移到模板、脚本或检查清单。
- 同一类错误不会反复依赖人工口头提醒。
