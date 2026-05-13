# Branch Protection Checklist 模板

## 1. 受保护分支

- [ ] `main`
- [ ] `release/*`
- [ ] `hotfix/*`

## 2. Required Status Checks

- [ ] `lint`
- [ ] `typecheck`
- [ ] `unit-test`
- [ ] `build`
- [ ] `contract-validate`
- [ ] `e2e`
- [ ] `visual-regression`
- [ ] `codex-stage1-review`
- [ ] `codex-stage2-review`

说明:

- GitHub required checks 对 GitHub Actions 使用的是 **job name**，不是 step 名。
- required checks 使用的 job 名必须在所有 workflow 中唯一，避免出现歧义。
- 如果某个 required check job 依赖其他 job，建议配合 `needs` + `always()`，确保检查名始终实际出现。

## 3. 合并策略

- [ ] 禁止绕过 required status checks
- [ ] 禁止在 checks 缺失时自动合并
- [ ] 仅允许 squash / merge / rebase 中的指定策略
- [ ] L2/L3 风险变更必须人工审批

## 4. Review 策略

- [ ] 至少 1 位 reviewer
- [ ] 高风险目录要求指定 owner 审核
- [ ] AI 自动 PR 不得自审自合

## 5. 特权与例外

- 可 bypass 的角色:
- 可 bypass 的场景:
- 需要补追溯记录的场景:

## 6. 上线前检查

- [ ] 回滚方案可用
- [ ] smoke test 已运行
- [ ] 关键监控已开启
