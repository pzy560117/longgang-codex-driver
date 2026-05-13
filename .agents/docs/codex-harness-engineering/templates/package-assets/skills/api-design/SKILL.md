---
name: api-design
description: API Design Skill
---

# API Design Skill

RESTful 和 GraphQL API 设计最佳实践。

## RESTful API 规范

### URL 设计原则
- 使用名词复数表示资源：`/users`、`/orders`
- 层级关系用嵌套：`/users/{id}/orders`
- 使用连字符分隔：`/user-profiles`
- 全小写，避免下划线

### HTTP 方法语义
| 方法 | 用途 | 幂等性 |
|------|------|--------|
| GET | 获取资源 | ✅ |
| POST | 创建资源 | ❌ |
| PUT | 全量更新 | ✅ |
| PATCH | 部分更新 | ✅ |
| DELETE | 删除资源 | ✅ |

### 状态码规范
```
2xx 成功
  200 OK - 通用成功
  201 Created - 创建成功
  204 No Content - 删除成功

4xx 客户端错误
  400 Bad Request - 请求格式错误
  401 Unauthorized - 未认证
  403 Forbidden - 无权限
  404 Not Found - 资源不存在
  409 Conflict - 资源冲突
  422 Unprocessable Entity - 验证失败

5xx 服务端错误
  500 Internal Server Error
  502 Bad Gateway
  503 Service Unavailable
```

### 响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "example"
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### 错误响应
```json
{
  "code": 40001,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## 分页设计

### 偏移分页（小数据量）
```
GET /users?page=1&pageSize=20
```

### 游标分页（大数据量）
```
GET /users?cursor=eyJpZCI6MTAwfQ&limit=20
```

## 版本控制

### URL 路径版本（推荐）
```
/api/v1/users
/api/v2/users
```

### Header 版本
```
Accept: application/vnd.api+json; version=1
```

## GraphQL 规范

### Schema 设计
```graphql
type User {
  id: ID!
  email: String!
  profile: Profile
  orders(first: Int, after: String): OrderConnection!
}

type Query {
  user(id: ID!): User
  users(filter: UserFilter, pagination: Pagination): UserConnection!
}

type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
  updateUser(id: ID!, input: UpdateUserInput!): UpdateUserPayload!
}
```

### 命名约定
- Query: 名词，如 `user`、`users`
- Mutation: 动词+名词，如 `createUser`、`deleteOrder`
- Input: `XxxInput`
- Payload: `XxxPayload`

## 安全要点

- 始终使用 HTTPS
- 实现速率限制（Rate Limiting）
- 验证所有输入参数
- 不在 URL 中传递敏感信息
- 使用 JWT 或 OAuth2.0 认证

