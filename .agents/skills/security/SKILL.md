---
name: security
description: Security Skill
---

# Security Skill

安全编码实践和常见漏洞防护。

## 认证与授权

### 密码安全
```python
# ✅ 使用 bcrypt/argon2 哈希
import bcrypt
password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))

# ❌ 禁止明文存储或简单哈希
password_hash = md5(password)  # 不安全
password_hash = sha256(password)  # 不够安全
```

### JWT 最佳实践
```javascript
// Token 配置
{
  algorithm: 'RS256',        // 使用非对称加密
  expiresIn: '15m',          // 短期有效
  issuer: 'your-app',
  audience: 'your-api'
}

// 必须验证
- 签名有效性
- 过期时间 (exp)
- 签发者 (iss)
- 受众 (aud)
```

### 会话管理
- 登录后重新生成 Session ID
- 设置合理的会话超时
- 支持强制登出所有设备
- 敏感操作要求重新认证

## 输入验证

### 验证原则
- 白名单优于黑名单
- 服务端必须验证（不信任客户端）
- 验证数据类型、长度、格式、范围

### SQL 注入防护
```python
# ❌ 字符串拼接
query = f"SELECT * FROM users WHERE id = {user_id}"

# ✅ 参数化查询
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# ✅ ORM
User.query.filter_by(id=user_id).first()
```

### XSS 防护
```javascript
// ❌ 直接插入 HTML
element.innerHTML = userInput;

// ✅ 文本内容
element.textContent = userInput;

// ✅ 使用框架的自动转义
// React: {userInput} 自动转义
// Vue: {{ userInput }} 自动转义
```

### CSRF 防护
```html
<!-- 表单中包含 CSRF Token -->
<form method="POST">
  <input type="hidden" name="_csrf" value="{{ csrf_token }}">
</form>
```

```javascript
// API 请求携带 Token
headers: {
  'X-CSRF-Token': getCsrfToken()
}
```

## 敏感数据处理

### 数据分类
| 级别 | 示例 | 处理要求 |
|------|------|----------|
| 高敏感 | 密码、密钥、身份证 | 加密存储，脱敏显示 |
| 中敏感 | 手机号、邮箱、地址 | 脱敏显示 |
| 低敏感 | 昵称、头像 | 常规保护 |

### 脱敏规则
```javascript
// 手机号: 138****8888
phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')

// 邮箱: t***@example.com
email.replace(/(.{1}).*(@.*)/, '$1***$2')

// 身份证: 110***********1234
idCard.replace(/(\d{3})\d{11}(\d{4})/, '$1***********$2')
```

### 密钥管理
```bash
# ❌ 硬编码
API_KEY = "sk-1234567890"

# ✅ 环境变量
API_KEY = os.environ.get('API_KEY')

# ✅ 密钥管理服务
# AWS Secrets Manager / HashiCorp Vault
```

## HTTP 安全头

```nginx
# 必须配置的安全头
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

## 日志安全

```python
# ❌ 记录敏感信息
logger.info(f"User login: {username}, password: {password}")

# ✅ 脱敏记录
logger.info(f"User login: {username}, password: [REDACTED]")

# 必须记录的安全事件
- 登录成功/失败
- 权限变更
- 敏感数据访问
- 异常操作
```

## 依赖安全

```bash
# 定期检查依赖漏洞
npm audit
pip-audit
snyk test

# 锁定依赖版本
package-lock.json
requirements.txt (pinned versions)
```

