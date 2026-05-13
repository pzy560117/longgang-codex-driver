# Repo Map 模板

## 1. 仓库目标

- 项目一句话描述:
- 主要用户:
- 核心业务域:

## 2. 从哪里开始读

- 第一步先读: `AGENTS.md`
- 第二步再读: `docs/ai/architecture-brief.md`
- 第三步按任务进入:

## 3. 关键目录

| 路径 | 用途 | 可修改性 | 备注 |
| --- | --- | --- | --- |
| `apps/` | 应用入口 | 可改 | |
| `packages/` | 共享模块 | 可改 | |
| `contracts/` | OpenAPI / schema 真相源 | 先改这里 | |
| `stories/` | UI 状态与视觉验证 | 可改 | |
| `tests/` | 测试与回归 | 可改 | |
| `docs/` | 文档真相源 | 可改 | |
| `generated/` | 生成代码 | 谨慎 | 由脚本覆盖 |

## 4. 关键依赖关系

- 前端依赖:
- 后端依赖:
- contract 生成物:
- 测试依赖:

## 5. 常用命令

```powershell
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## 6. 禁改区

- 默认禁止自动修改的目录:
- 涉及密钥/支付/权限的目录:
- 只能人工审批后修改的文件:

## 7. 任务入口

- Feature plan 所在位置:
- Product docs 所在位置:
- Design docs 所在位置:
- Contract 所在位置:
