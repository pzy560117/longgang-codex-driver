---
name: refactoring
description: 重构指南
---

# 重构指南

## 触发条件
重构、代码优化、技术债务、代码整理

## 重构原则

### 何时重构
- 添加新功能前，先重构相关代码
- 修复 Bug 时，顺便改善代码结构
- Code Review 发现问题时
- 代码重复超过 3 处

### 重构前提
- 有足够的测试覆盖
- 小步前进，频繁提交
- 一次只做一种重构

## 常见重构模式

### 提取函数
```typescript
// ❌ 重构前
function processOrder(order: Order) {
  // 验证逻辑
  if (!order.items.length) throw new Error('Empty order');
  if (!order.customer) throw new Error('No customer');
  // 计算逻辑
  let total = 0;
  for (const item of order.items) {
    total += item.price * item.quantity;
  }
  // 保存逻辑...
}

// ✅ 重构后
function processOrder(order: Order) {
  validateOrder(order);
  const total = calculateTotal(order.items);
  saveOrder(order, total);
}

function validateOrder(order: Order) {
  if (!order.items.length) throw new Error('Empty order');
  if (!order.customer) throw new Error('No customer');
}

function calculateTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```


### 用多态替换条件
```typescript
// ❌ 重构前
function getPrice(product: Product): number {
  switch (product.type) {
    case 'book': return product.basePrice * 0.9;
    case 'electronic': return product.basePrice * 1.1;
    default: return product.basePrice;
  }
}

// ✅ 重构后
interface PriceStrategy {
  calculate(basePrice: number): number;
}

class BookPriceStrategy implements PriceStrategy {
  calculate(basePrice: number) { return basePrice * 0.9; }
}

class ElectronicPriceStrategy implements PriceStrategy {
  calculate(basePrice: number) { return basePrice * 1.1; }
}
```

### 引入参数对象
```typescript
// ❌ 重构前
function createUser(name: string, email: string, age: number, role: string) {}

// ✅ 重构后
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  role: string;
}
function createUser(params: CreateUserParams) {}
```

## 代码异味识别

| 异味 | 表现 | 解决方案 |
|------|------|---------|
| 过长函数 | 超过 30 行 | 提取函数 |
| 过长参数列表 | 超过 3 个参数 | 引入参数对象 |
| 重复代码 | 相似逻辑多处出现 | 提取公共函数 |
| 过大的类 | 职责过多 | 拆分类 |
| 数据泥团 | 多个数据总是一起出现 | 提取数据类 |

## 最佳实践
- 重构和功能开发分开提交
- 保持测试通过状态
- 使用 IDE 重构工具
- 记录重构决策和原因

