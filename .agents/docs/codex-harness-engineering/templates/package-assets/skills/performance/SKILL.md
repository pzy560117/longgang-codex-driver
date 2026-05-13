---
name: performance
description: Performance Skill
---

# Performance Skill

前后端性能优化策略和最佳实践。

## 前端性能优化

### 资源加载优化

```html
<!-- 预加载关键资源 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
<link rel="preconnect" href="https://api.example.com">
<link rel="dns-prefetch" href="https://cdn.example.com">

<!-- 异步加载非关键脚本 -->
<script src="analytics.js" async></script>
<script src="widget.js" defer></script>
```

### 图片优化
```html
<!-- 响应式图片 -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.avif" type="image/avif">
  <img src="image.jpg" loading="lazy" decoding="async" alt="description">
</picture>

<!-- 尺寸提示防止布局偏移 -->
<img src="image.jpg" width="800" height="600" alt="description">
```

### 代码分割
```javascript
// React 懒加载
const Dashboard = React.lazy(() => import('./Dashboard'));

// Vue 异步组件
const Dashboard = () => import('./Dashboard.vue');

// 路由级分割
{
  path: '/dashboard',
  component: () => import('./views/Dashboard.vue')
}
```

### 缓存策略
```javascript
// Service Worker 缓存
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
```

## 后端性能优化

### 缓存层级
```
┌─────────────────────────────────────────┐
│  浏览器缓存 (Cache-Control)              │
├─────────────────────────────────────────┤
│  CDN 缓存                                │
├─────────────────────────────────────────┤
│  应用缓存 (Redis/Memcached)              │
├─────────────────────────────────────────┤
│  数据库查询缓存                          │
└─────────────────────────────────────────┘
```

### Redis 缓存模式
```python
# 缓存穿透防护
def get_user(user_id):
    cache_key = f"user:{user_id}"
    cached = redis.get(cache_key)
    
    if cached == "NULL":  # 空值缓存
        return None
    if cached:
        return json.loads(cached)
    
    user = db.query(User).get(user_id)
    if user:
        redis.setex(cache_key, 3600, json.dumps(user.to_dict()))
    else:
        redis.setex(cache_key, 300, "NULL")  # 缓存空值
    return user
```

### 数据库优化
```sql
-- 只查询需要的字段
SELECT id, name, email FROM users WHERE status = 1;

-- 避免 SELECT *
-- 使用覆盖索引
-- 合理使用 LIMIT
```

### 异步处理
```python
# 耗时任务异步化
from celery import Celery

@celery.task
def send_email(user_id, template):
    # 异步发送邮件
    pass

# 调用时不阻塞
send_email.delay(user_id, 'welcome')
```

## 性能指标

### Core Web Vitals
| 指标 | 良好 | 需改进 | 差 |
|------|------|--------|-----|
| LCP (最大内容绘制) | ≤2.5s | ≤4s | >4s |
| FID (首次输入延迟) | ≤100ms | ≤300ms | >300ms |
| CLS (累积布局偏移) | ≤0.1 | ≤0.25 | >0.25 |

### 监控工具
```javascript
// 性能监控
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(entry.name, entry.startTime, entry.duration);
  }
});
observer.observe({ entryTypes: ['largest-contentful-paint'] });
```

## 常见性能问题

### 内存泄漏
```javascript
// ❌ 未清理的事件监听
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// ✅ 清理副作用
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### 重复渲染
```javascript
// ❌ 每次渲染创建新对象
<Component style={{ color: 'red' }} />

// ✅ 使用 useMemo
const style = useMemo(() => ({ color: 'red' }), []);
<Component style={style} />
```

