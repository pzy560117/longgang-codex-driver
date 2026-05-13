# Feature Pack 模板

## 1. 基本信息

- `feature_id`: `FEAT-000`
- `title`: `示例：工单筛选与保存视图`
- `source`: `issue / requirement doc / incident / cron`
- `owner`: `Hermes / PM / Engineer`
- `risk_level`: `L1`
- `auto_merge_allowed`: `false`

## 2. 业务目标

- 这次变更要解决什么问题？
- 成功后的业务结果如何判断？
- 本期不解决什么问题？
- 哪些开放问题会阻塞后续阶段？

## 3. 影响范围

- 页面:
- 接口:
- 目录:
- 数据表:
- 权限:
- 外部系统:

## 4. 需求分析真相源

| 产物 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| PRD-Lite | `docs/product/prd-lite.md` | Draft / Approved / N/A | |
| Page Inventory | `docs/product/page-inventory.md` | Draft / Approved / N/A | |
| State Matrix | `docs/product/state-matrix.yaml` | Draft / Approved / N/A | |
| Acceptance Criteria | `docs/product/acceptance-criteria.md` | Draft / Approved / N/A | |
| Requirement Interface Matrix | `docs/product/requirement-interface-matrix.md` | Draft / Approved / N/A | |
| Difficulty Research | `docs/product/difficulty-research.md` | Draft / Approved / N/A | |

## 5. 设计真相源

| 产物 | 路径 | 状态 | 备注 |
| --- | --- | --- | --- |
| Design Brief | `docs/design/design-brief.md` | Draft / Approved / N/A | |
| Component Map | `docs/design/component-map.md` | Draft / Approved / N/A | |
| Screen States | `docs/design/screen-states.md` | Draft / Approved / N/A | |
| Design Tokens | `docs/design/design-tokens.json` | Draft / Approved / N/A | |
| AI Image Brief | `docs/design/ai-image-brief.md` | Draft / Approved / N/A | |
| UI Image Review | `docs/design/ui-image-review.md` | Draft / Approved / N/A | |
| Image To Frontend Spec | `docs/design/image-to-frontend-spec.md` | Draft / Approved / N/A | |

## 6. 先决条件

- 已存在的能力:
- 依赖功能:
- 环境要求:

## 7. 状态矩阵

- `default`:
- `empty`:
- `loading`:
- `error`:
- `disabled`:
- `permission_denied`:
- `long_content`:
- `responsive/mobile`:

## 8. 变更边界

- 允许修改:
- 禁止修改:
- 生成代码目录:
- 手写代码目录:

## 9. 验收标准

- [ ] 用户可以完成核心流程
- [ ] 异常流有明确行为
- [ ] 文档、contract、代码一致

## 10. 验证命令

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 11. 输出要求

- 需要更新的文档:
- 需要补充的测试:
- 需要生成的 client/types/mock:
- 需要提交的 PR / issue / trace:

## 12. 升级条件

- 哪些情况必须 BLOCKED:
- 哪些情况必须人工审批:
- 哪些情况禁止自动合并:
