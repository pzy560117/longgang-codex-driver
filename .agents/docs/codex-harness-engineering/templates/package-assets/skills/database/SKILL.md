---
name: database
description: Database Skill
---

# Database Skill

数据库设计、建模和查询优化最佳实践。

## 数据库设计原则

### 范式化设计
- **1NF**: 字段原子性，不可再分
- **2NF**: 消除部分依赖
- **3NF**: 消除传递依赖
- 适度反范式化以提升查询性能

### 命名规范
```
表名: 小写复数，下划线分隔
  users, order_items, user_profiles

字段名: 小写，下划线分隔
  created_at, user_id, is_active

主键: id 或 表名_id
外键: 关联表名_id
索引: idx_表名_字段名
```

## 表设计模板

```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status TINYINT DEFAULT 1 COMMENT '0:禁用 1:正常',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL COMMENT '软删除时间',
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 索引优化

### 索引选择原则
- 高选择性字段优先
- 覆盖查询常用字段
- 联合索引遵循最左前缀
- 避免过度索引

### 联合索引设计
```sql
-- 查询: WHERE a = ? AND b = ? ORDER BY c
CREATE INDEX idx_a_b_c ON table(a, b, c);

-- 最左前缀匹配
✅ WHERE a = ?
✅ WHERE a = ? AND b = ?
✅ WHERE a = ? AND b = ? AND c = ?
❌ WHERE b = ?
❌ WHERE b = ? AND c = ?
```

### 索引失效场景
```sql
-- 避免这些写法
WHERE YEAR(created_at) = 2024  -- 函数操作
WHERE name LIKE '%keyword%'     -- 前导通配符
WHERE status != 1               -- 否定条件
WHERE id + 1 = 100              -- 表达式计算
```

## 查询优化

### EXPLAIN 分析
```sql
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
```

关注指标：
- **type**: 至少达到 range，避免 ALL
- **key**: 确认使用了预期索引
- **rows**: 扫描行数越少越好
- **Extra**: 避免 Using filesort、Using temporary

### 分页优化
```sql
-- 避免大偏移量
❌ SELECT * FROM orders LIMIT 100000, 20;

-- 使用游标分页
✅ SELECT * FROM orders WHERE id > 100000 ORDER BY id LIMIT 20;

-- 延迟关联
✅ SELECT * FROM orders o
   INNER JOIN (SELECT id FROM orders ORDER BY id LIMIT 100000, 20) t
   ON o.id = t.id;
```

## 事务与锁

### 事务隔离级别
| 级别 | 脏读 | 不可重复读 | 幻读 |
|------|------|------------|------|
| READ UNCOMMITTED | ✅ | ✅ | ✅ |
| READ COMMITTED | ❌ | ✅ | ✅ |
| REPEATABLE READ | ❌ | ❌ | ✅ |
| SERIALIZABLE | ❌ | ❌ | ❌ |

### 锁优化
- 尽量使用行锁而非表锁
- 事务尽量短小
- 按固定顺序访问表和行
- 合理设置锁等待超时

## ORM 最佳实践

### N+1 问题
```python
# ❌ N+1 查询
users = User.query.all()
for user in users:
    print(user.orders)  # 每次循环都查询

# ✅ 预加载
users = User.query.options(joinedload(User.orders)).all()
```

### 批量操作
```python
# ❌ 逐条插入
for item in items:
    db.session.add(Item(**item))
    db.session.commit()

# ✅ 批量插入
db.session.bulk_insert_mappings(Item, items)
db.session.commit()
```

