---
name: error-handling
description: Error Handling Skill
---

# Error Handling Skill

异常处理、日志记录和监控最佳实践。

## 错误处理原则

### 错误分类
| 类型 | 示例 | 处理方式 |
|------|------|----------|
| 业务错误 | 用户不存在、余额不足 | 返回明确错误码和消息 |
| 验证错误 | 参数格式错误 | 返回字段级错误详情 |
| 系统错误 | 数据库连接失败 | 记录日志，返回通用错误 |
| 未知错误 | 未捕获异常 | 记录完整堆栈，告警 |

### 错误响应格式
```json
{
  "code": 40001,
  "message": "用户名或密码错误",
  "details": null,
  "requestId": "req-abc123",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### 验证错误响应
```json
{
  "code": 42201,
  "message": "参数验证失败",
  "details": [
    {
      "field": "email",
      "message": "邮箱格式不正确"
    },
    {
      "field": "password",
      "message": "密码长度至少8位"
    }
  ]
}
```

## 异常处理模式

### 全局异常处理
```python
# Python FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "code": 50000,
            "message": "服务器内部错误",
            "requestId": request.state.request_id
        }
    )
```

```javascript
// Node.js Express
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.id
  });
  
  res.status(500).json({
    code: 50000,
    message: '服务器内部错误',
    requestId: req.id
  });
});
```

### 自定义业务异常
```python
class BusinessError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message

class UserNotFoundError(BusinessError):
    def __init__(self, user_id: int):
        super().__init__(40401, f"用户 {user_id} 不存在")

# 使用
raise UserNotFoundError(user_id=123)
```

## 日志规范

### 日志级别
| 级别 | 用途 |
|------|------|
| DEBUG | 调试信息，生产环境关闭 |
| INFO | 关键业务流程记录 |
| WARN | 潜在问题，不影响功能 |
| ERROR | 错误，需要关注 |
| FATAL | 严重错误，服务不可用 |

### 结构化日志
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "ERROR",
  "message": "Failed to process order",
  "service": "order-service",
  "requestId": "req-abc123",
  "userId": 12345,
  "orderId": "ORD-001",
  "error": {
    "type": "PaymentError",
    "message": "Insufficient balance",
    "stack": "..."
  },
  "duration": 150
}
```

### 日志配置
```javascript
// Winston 配置
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'my-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## 监控告警

### 关键指标
```
错误率 = 错误请求数 / 总请求数
P99 延迟 = 99% 请求的响应时间
可用性 = 正常运行时间 / 总时间
```

### 告警规则
```yaml
# Prometheus AlertManager 示例
groups:
  - name: api-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API 错误率超过 5%"
          
      - alert: HighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 延迟超过 1 秒"
```

## 前端错误处理

### 全局错误捕获
```javascript
// React Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    logger.error('React error', { error, errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### API 错误处理
```javascript
// Axios 拦截器
axios.interceptors.response.use(
  response => response,
  error => {
    const { response } = error;
    
    if (response?.status === 401) {
      // 跳转登录
      router.push('/login');
    } else if (response?.status >= 500) {
      // 显示通用错误
      toast.error('服务器错误，请稍后重试');
    }
    
    return Promise.reject(error);
  }
);
```

## 重试策略

```javascript
// 指数退避重试
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

