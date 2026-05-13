---
name: mock-strategy
description: Mock Strategy Skill
---

# Mock Strategy Skill

前端 Mock 数据策略与工具选型。

## 工具对比

| 工具 | 特点 | 适用场景 |
|------|------|----------|
| MSW | 拦截网络请求 | 推荐，最接近真实 |
| json-server | 快速 REST API | 简单 CRUD |
| 手动 Mock | 完全可控 | 复杂逻辑 |

## MSW 配置（推荐）

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.get('/api/users', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page')) || 1;
    
    return HttpResponse.json({
      code: 0,
      message: 'success',
      data: { list: mockUsers, total: 100, page },
    });
  }),
  
  http.get('/api/users/:id', async ({ params }) => {
    const user = mockUsers.find(u => u.id === Number(params.id));
    if (!user) {
      return HttpResponse.json(
        { code: 40401, message: '用户不存在' },
        { status: 404 }
      );
    }
    return HttpResponse.json({ code: 0, data: user });
  }),
];
```

```typescript
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

```typescript
// main.tsx - 条件启用
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCK !== 'true') return;
  const { worker } = await import('./mocks/browser');
  return worker.start({ onUnhandledRequest: 'bypass' });
}

enableMocking().then(() => {
  ReactDOM.createRoot(root).render(<App />);
});
```

## Mock 数据生成

```typescript
// src/mocks/data/users.ts
import { faker } from '@faker-js/faker/locale/zh_CN';

export const mockUsers = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: faker.person.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
  createdAt: faker.date.past().toISOString(),
}));
```

## 环境配置

```bash
# .env.development
VITE_USE_MOCK=true

# .env.development.local（联调时）
VITE_USE_MOCK=false
```

```typescript
// src/config/index.ts
export const config = {
  useMock: import.meta.env.VITE_USE_MOCK === 'true',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
};
```

## 常见问题

| 问题 | 解决 |
|------|------|
| Mock 不生效 | 检查环境变量和 worker 启动 |
| 请求未拦截 | 检查 handler 路径匹配 |
| 类型不一致 | 对照 OpenAPI 契约 |

