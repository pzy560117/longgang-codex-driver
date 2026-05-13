---
name: property-testing
description: 属性测试 (Property-Based Testing) 指南
---

# 属性测试 (Property-Based Testing) 指南

使用 fast-check 进行属性驱动测试的规范和最佳实践。

## 核心概念

属性测试通过验证代码在所有有效输入上都满足某些属性（不变量）来测试代码正确性。

### 与单元测试的区别

| 特性 | 单元测试 | 属性测试 |
|------|----------|----------|
| 输入 | 手动指定具体值 | 自动生成随机值 |
| 覆盖 | 有限的边界情况 | 广泛的输入空间 |
| 断言 | 具体的预期结果 | 通用的属性/不变量 |
| 用途 | 具体示例验证 | 通用规则验证 |

## fast-check 基础

### 安装

```bash
npm install -D fast-check
```

### 基本用法

```typescript
import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Property Tests', () => {
  it('should satisfy property', () => {
    fc.assert(
      fc.property(
        fc.string(),  // 生成器
        (input) => {  // 属性函数
          // 返回 true 表示属性满足
          return input.length >= 0;
        }
      ),
      { numRuns: 100 }  // 至少运行 100 次
    );
  });
});
```

## 常用生成器

### 基础类型

```typescript
// 字符串
fc.string()                    // 任意字符串
fc.string({ minLength: 1 })    // 非空字符串
fc.hexaString()                // 十六进制字符串
fc.emailAddress()              // 邮箱地址

// 数字
fc.integer()                   // 整数
fc.integer({ min: 0, max: 100 })
fc.nat()                       // 自然数 (>=0)
fc.float()                     // 浮点数

// 布尔
fc.boolean()

// 数组
fc.array(fc.integer())
fc.array(fc.string(), { minLength: 1, maxLength: 10 })

// 对象
fc.record({
  name: fc.string(),
  age: fc.nat(),
})
```

### 组合生成器

```typescript
// 可选值
fc.option(fc.string())  // string | null

// 联合类型
fc.oneof(fc.string(), fc.integer())

// 常量
fc.constant('fixed-value')

// 从数组中选择
fc.constantFrom('a', 'b', 'c')

// 条件过滤
fc.string().filter(s => s.length > 0)

// 映射转换
fc.integer().map(n => n * 2)
```

### 自定义生成器

```typescript
// 自定义用户生成器
const userArb = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  age: fc.integer({ min: 18, max: 120 }),
  role: fc.constantFrom('admin', 'user', 'guest'),
});

// 自定义密码生成器
const passwordArb = fc.string({ minLength: 8, maxLength: 128 })
  .filter(p => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p));
```

## 常见属性模式

### 1. 往返属性 (Round-Trip)

```typescript
// Property: 序列化后反序列化应得到原值
// Validates: Requirements X.Y
it('serialization round-trip', () => {
  fc.assert(
    fc.property(userArb, (user) => {
      const serialized = JSON.stringify(user);
      const deserialized = JSON.parse(serialized);
      return deepEqual(user, deserialized);
    }),
    { numRuns: 100 }
  );
});
```

### 2. 幂等性 (Idempotence)

```typescript
// Property: 操作执行两次应与执行一次结果相同
// Validates: Requirements X.Y
it('normalize is idempotent', () => {
  fc.assert(
    fc.property(fc.string(), (input) => {
      const once = normalize(input);
      const twice = normalize(normalize(input));
      return once === twice;
    }),
    { numRuns: 100 }
  );
});
```

### 3. 不变量 (Invariant)

```typescript
// Property: 排序后数组长度不变
// Validates: Requirements X.Y
it('sort preserves length', () => {
  fc.assert(
    fc.property(fc.array(fc.integer()), (arr) => {
      const sorted = sort(arr);
      return sorted.length === arr.length;
    }),
    { numRuns: 100 }
  );
});
```

### 4. 变换属性 (Metamorphic)

```typescript
// Property: 过滤后长度应小于等于原长度
// Validates: Requirements X.Y
it('filter reduces or maintains length', () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer()),
      fc.func(fc.boolean()),
      (arr, predicate) => {
        const filtered = arr.filter(predicate);
        return filtered.length <= arr.length;
      }
    ),
    { numRuns: 100 }
  );
});
```

### 5. 错误条件 (Error Conditions)

```typescript
// Property: 无效输入应抛出错误
// Validates: Requirements X.Y
it('rejects invalid input', () => {
  const invalidEmailArb = fc.string()
    .filter(s => !s.includes('@'));
  
  fc.assert(
    fc.property(invalidEmailArb, (invalidEmail) => {
      try {
        validateEmail(invalidEmail);
        return false;  // 应该抛出错误
      } catch {
        return true;   // 正确抛出错误
      }
    }),
    { numRuns: 100 }
  );
});
```

## 测试配置

### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.property.test.ts'],
    testTimeout: 30000,  // 属性测试可能需要更长时间
  },
});
```

### 属性测试配置

```typescript
fc.assert(
  fc.property(...),
  {
    numRuns: 100,           // 最少运行次数
    seed: 12345,            // 固定种子（可复现）
    verbose: true,          // 详细输出
    endOnFailure: true,     // 失败时立即停止
  }
);
```

## 调试失败的测试

### 查看反例

```typescript
fc.assert(
  fc.property(fc.string(), (input) => {
    console.log('Testing with:', input);  // 打印测试输入
    return someCondition(input);
  }),
  { verbose: true }
);
```

### 使用固定种子复现

```typescript
// 失败时会输出种子，使用该种子复现
fc.assert(
  fc.property(...),
  { seed: 1234567890 }  // 使用失败时的种子
);
```

### 缩小反例

fast-check 自动缩小反例到最小失败输入，便于调试。

## 最佳实践

1. **每个属性一个测试**：便于定位问题
2. **至少 100 次迭代**：确保足够覆盖
3. **注释属性来源**：标注对应的需求
4. **使用有意义的生成器**：约束到有效输入空间
5. **避免过度约束**：让生成器探索边界情况
6. **结合单元测试**：属性测试补充而非替代单元测试

## 与需求的映射

```typescript
/**
 * Property 1: 密码强度计算一致性
 * *For any* 有效密码，强度计算应返回一致的结果
 * **Validates: Requirements 1.1, 1.2**
 */
it('password strength is consistent', () => {
  fc.assert(
    fc.property(validPasswordArb, (password) => {
      const strength1 = calculateStrength(password);
      const strength2 = calculateStrength(password);
      return strength1 === strength2;
    }),
    { numRuns: 100 }
  );
});
```

