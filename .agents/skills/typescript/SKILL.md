---
name: typescript
description: TypeScript 开发指南
---

# TypeScript 开发指南

## 触发条件
类型定义、泛型、类型推断、TS 配置、类型错误

## 类型定义最佳实践

### 优先使用 interface 定义对象类型
```typescript
// ✅ 推荐
interface User {
  id: string;
  name: string;
  email: string;
}

// 使用 type 的场景：联合类型、交叉类型、映射类型
type Status = 'pending' | 'success' | 'error';
type UserWithRole = User & { role: string };
```

### 避免 any，使用 unknown
```typescript
// ❌ 避免
function parse(data: any) { return data.value; }

// ✅ 推荐
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return String((data as { value: unknown }).value);
  }
  throw new Error('Invalid data');
}
```

## 泛型

### 基础泛型
```typescript
/**
 * 通用响应包装器
 */
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 使用
const response: ApiResponse<User[]> = await fetchUsers();
```

### 泛型约束
```typescript
/**
 * 确保对象有 id 属性
 */
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

### 条件类型
```typescript
type NonNullable<T> = T extends null | undefined ? never : T;
type ExtractArray<T> = T extends (infer U)[] ? U : never;
```

## 实用工具类型

```typescript
// 部分可选
type PartialUser = Partial<User>;

// 全部必填
type RequiredUser = Required<User>;

// 选取部分属性
type UserBasic = Pick<User, 'id' | 'name'>;

// 排除部分属性
type UserWithoutEmail = Omit<User, 'email'>;

// 只读
type ReadonlyUser = Readonly<User>;

// 记录类型
type UserMap = Record<string, User>;
```

## 类型守卫

```typescript
/**
 * 类型守卫函数
 */
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}

// 使用
if (isUser(data)) {
  console.log(data.name); // 类型安全
}
```

## 常见 tsconfig 配置

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  }
}
```

## 常见错误处理

### TS2322: 类型不匹配
```typescript
// 检查赋值两边类型是否一致
// 使用类型断言或修正数据结构
```

### TS2345: 参数类型错误
```typescript
// 检查函数参数类型定义
// 确保传入参数符合预期
```

### TS7006: 隐式 any
```typescript
// 为参数添加明确类型注解
function handler(event: MouseEvent) { }
```

