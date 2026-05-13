---
name: webapp-testing
description: Web App Testing Skill
---

# Web App Testing Skill

Web 应用自动化测试：E2E 测试、DevTools MCP、CI/CD 集成。

## 测试策略

| 类型 | 工具 | 用途 |
|------|------|------|
| E2E | Playwright / DevTools MCP | 模拟用户操作 |
| 组件 | Vitest + Testing Library | 组件逻辑验证 |
| API | MSW | Mock 接口测试 |

## DevTools MCP 测试

### 核心原则

```markdown
## 禁止事项
- ❌ 不要直接 navigate 到目标页面（除首页）
- ❌ 不要直接操作 DOM 或执行 JS
- ❌ 不要跳过中间步骤

## 必须遵循
- ✅ 从首页开始，通过点击导航
- ✅ 模拟真实用户操作路径
- ✅ 每次操作前 take_snapshot 获取最新 uid
- ✅ 等待页面加载完成再操作
```

### 测试执行示例

```
测试：用户登录

步骤 1: 打开首页
- mcp_chrome_devtools_navigate_page(url: "http://localhost:5173")
- mcp_chrome_devtools_take_snapshot()

步骤 2: 点击登录
- mcp_chrome_devtools_click(uid: "登录按钮uid")
- mcp_chrome_devtools_wait_for(text: "登录")

步骤 3: 填写表单
- mcp_chrome_devtools_fill(uid: "邮箱uid", value: "test@example.com")
- mcp_chrome_devtools_fill(uid: "密码uid", value: "password123")

步骤 4: 提交
- mcp_chrome_devtools_click(uid: "提交按钮uid")
- mcp_chrome_devtools_wait_for(text: "仪表盘")

步骤 5: 验证
- mcp_chrome_devtools_take_snapshot()
- 确认页面包含用户信息
```

## Playwright 测试

```typescript
// tests/e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('登录成功', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登录' }).click();
  
  await page.getByLabel('邮箱').fill('test@example.com');
  await page.getByLabel('密码').fill('password123');
  await page.getByRole('button', { name: '登录' }).click();
  
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByTestId('user-avatar')).toBeVisible();
});

test('登录失败', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '登录' }).click();
  
  await page.getByLabel('邮箱').fill('test@example.com');
  await page.getByLabel('密码').fill('wrong');
  await page.getByRole('button', { name: '登录' }).click();
  
  await expect(page.getByText('用户名或密码错误')).toBeVisible();
});
```

## 测试用例模板

```markdown
# 测试用例：[功能名称]

## 基本信息
- 用例ID: TC-XXX-001
- 优先级: P0/P1/P2
- 前置条件: [描述]

## 测试步骤

### 步骤 1: [操作]
- 操作: [具体操作]
- 预期: [预期结果]

## 验证点
- [ ] [验证点1]
- [ ] [验证点2]
```

## CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:unit
      
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
        env:
          VITE_USE_MOCK: 'true'
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 常见问题

| 问题 | 解决 |
|------|------|
| 元素找不到 | 等待元素可见或使用更稳定的选择器 |
| 测试不稳定 | 增加等待、使用 waitFor |
| CI 超时 | 增加 timeout 或优化测试 |

