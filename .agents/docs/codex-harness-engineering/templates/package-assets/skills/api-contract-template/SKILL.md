---
name: api-contract-template
description: API 契约模板
---

# API 契约模板

前端代码完成后，提取 API 契约供后端实现。

## API 契约：[接口名称]

### 基本信息
| 属性 | 值 |
|------|-----|
| 接口名称 | |
| 请求路径 | /api/v1/xxx |
| 请求方法 | GET/POST/PUT/DELETE |
| 关联页面 | |
| 关联需求 | Req-XXX |

### 请求参数

#### Query 参数（GET请求）
| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| page | number | ❌ | 页码，默认1 | 1 |
| pageSize | number | ❌ | 每页条数，默认10 | 10 |
| status | string | ❌ | 状态筛选 | pending |
| keyword | string | ❌ | 关键词搜索 | 订单 |

#### Body 参数（POST/PUT请求）
```json
{
  "name": "string, 必填, 名称, 2-50字符",
  "description": "string, 选填, 描述, 最多500字符",
  "status": "string, 必填, 枚举: draft/pending/approved"
}
```

### 响应结构

#### 成功响应
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "string",
        "name": "string",
        "status": "string",
        "createTime": "YYYY-MM-DD HH:mm:ss",
        "updateTime": "YYYY-MM-DD HH:mm:ss"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 错误响应
```json
{
  "code": 400001,
  "message": "参数校验失败",
  "data": null
}
```

### 错误码定义
| 错误码 | 含义 | 前端处理 |
|--------|------|----------|
| 400001 | 参数校验失败 | 显示具体字段错误 |
| 401001 | 未登录 | 跳转登录页 |
| 403001 | 无权限 | 显示无权限提示 |
| 404001 | 资源不存在 | 显示404页面 |
| 500001 | 服务器错误 | 显示通用错误提示 |

### 幂等性（写操作必填）
| 属性 | 值 |
|------|-----|
| 是否幂等 | 是/否 |
| 幂等键 | X-Idempotency-Key header |
| 有效期 | 24小时 |

