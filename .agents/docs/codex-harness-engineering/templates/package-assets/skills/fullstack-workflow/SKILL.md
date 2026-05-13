---
name: fullstack-workflow
description: Fullstack Development Workflow
---

# Fullstack Development Workflow

前后端分离开发流程：前端先行 → Mock 数据 → 后端开发 → 联调 → 测试。

## 流程概览

```
Phase 1: 前端先行 ──→ Phase 2: 后端联调 ──→ Phase 3: 自动化测试
```

## 相关 Skills

| 阶段 | Skill 文件 | 说明 |
|------|-----------|------|
| Phase 1 | mock-strategy.md | Mock 工具选型与配置 |
| Phase 2 | api-integration.md | 联调配置与问题排查 |
| Phase 3 | webapp-testing.md | E2E 测试与 CI/CD |

## Phase 1: 前端先行

### API 契约定义

```yaml
# openapi.yaml
openapi: 3.0.3
paths:
  /users:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
```

```bash
npx openapi-typescript openapi.yaml -o src/api/types.generated.ts
```

### 统一响应格式

```typescript
interface ApiResponse<T> {
  code: number;      // 0=成功
  message: string;
  data: T;
}
```

## Phase 2: 后端联调

详见 `api-integration.md`

```bash
# 切换到联调模式
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api
```

### 检查清单

- [ ] 接口路径一致
- [ ] 响应格式一致
- [ ] 错误码一致
- [ ] 认证方式一致

## Phase 3: 自动化测试

详见 `webapp-testing.md`

## 项目结构

```
src/
├── api/           # API 层
├── mocks/         # Mock 层
└── config/        # 配置
```

