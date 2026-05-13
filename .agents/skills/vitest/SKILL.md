---
name: vitest
description: Vitest 测试指南
---

# Vitest 测试指南

Vitest 单元测试和集成测试的配置与最佳实践。

## 配置

### 基础配置 (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### E2E 配置 (vitest.e2e.config.ts)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.e2e.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
```

## 测试结构

### 单元测试

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MyModule } from './MyModule';

describe('MyModule', () => {
  let module: MyModule;

  beforeEach(() => {
    module = new MyModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      const result = module.methodName('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      expect(() => module.methodName('')).toThrow('Invalid input');
    });
  });
});
```

### 异步测试

```typescript
describe('AsyncModule', () => {
  it('should resolve async operation', async () => {
    const result = await asyncOperation();
    expect(result).toBeDefined();
  });

  it('should reject on error', async () => {
    await expect(failingOperation()).rejects.toThrow('Error message');
  });
});
```

## 常用断言

```typescript
// 相等性
expect(value).toBe(expected);           // 严格相等 (===)
expect(value).toEqual(expected);        // 深度相等
expect(value).toStrictEqual(expected);  // 严格深度相等

// 真值
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// 数字
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3, 5);

// 字符串
expect(value).toMatch(/pattern/);
expect(value).toContain('substring');

// 数组
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(array).toEqual(expect.arrayContaining([1, 2]));

// 对象
expect(obj).toHaveProperty('key');
expect(obj).toHaveProperty('key', 'value');
expect(obj).toMatchObject({ key: 'value' });

// 异常
expect(() => fn()).toThrow();
expect(() => fn()).toThrow('message');
expect(() => fn()).toThrow(ErrorClass);

// 异步
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Mock

### 函数 Mock

```typescript
import { vi } from 'vitest';

// 创建 mock 函数
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');
mockFn.mockImplementation((x) => x * 2);

// 验证调用
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
```

### 模块 Mock

```typescript
import { vi } from 'vitest';

// Mock 整个模块
vi.mock('./module', () => ({
  default: vi.fn(),
  namedExport: vi.fn(),
}));

// Mock 部分模块
vi.mock('./module', async () => {
  const actual = await vi.importActual('./module');
  return {
    ...actual,
    specificFn: vi.fn(),
  };
});
```

### Spy

```typescript
import { vi } from 'vitest';

const obj = {
  method: () => 'original',
};

const spy = vi.spyOn(obj, 'method');
spy.mockReturnValue('mocked');

obj.method();  // 'mocked'
expect(spy).toHaveBeenCalled();

spy.mockRestore();  // 恢复原始实现
```

## 测试文件组织

```
src/
├── module/
│   ├── Module.ts
│   ├── Module.test.ts          # 单元测试
│   └── Module.property.test.ts # 属性测试
tests/
├── e2e/
│   ├── fixtures.ts             # 测试 fixtures
│   └── feature.e2e.ts          # E2E 测试
└── integration/
    └── feature.integration.ts  # 集成测试
```

## 常用命令

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 运行特定文件
npx vitest run src/module/Module.test.ts

# 运行匹配模式的测试
npx vitest run --grep "should handle"

# 覆盖率报告
npm run test:coverage

# E2E 测试
npm run test:e2e
```

## 最佳实践

1. **测试文件命名**：`*.test.ts` 或 `*.spec.ts`
2. **测试描述清晰**：使用 `should` 开头描述预期行为
3. **单一职责**：每个测试只验证一个行为
4. **避免测试实现细节**：测试行为而非实现
5. **使用 beforeEach 重置状态**：确保测试隔离
6. **Mock 外部依赖**：文件系统、网络、数据库等
7. **测试边界情况**：空值、边界值、异常情况

