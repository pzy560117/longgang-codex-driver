---
name: api-integration
description: 前后端联调与 Mock
---

# 前后端联调工作流

本项目前后端技术栈与联调架构说明。

## 架构总览

```
┌─────────────┐  /api/v1/*   ┌───────────────┐  lb://service  ┌─────────────────┐
│  Vue 3 前端  │ ──────────→ │ Spring Cloud  │ ────────────→ │  微服务集群       │
│  Vite :5173  │   proxy     │ Gateway :8080 │    Nacos       │  auth / script   │
│  Arco Design │             │ JWT Filter    │    路由发现     │  session/booking │
│  Pinia       │             │ StripPrefix=2 │               │  stats/recommend │
└─────────────┘             └───────────────┘               └─────────────────┘
```

### 技术栈一览

| 层级 | 技术 | 备注 |
|------|------|------|
| 前端框架 | Vue 3 + TypeScript | `script-kill-frontend/` |
| UI 组件 | Arco Design Web Vue 2.57+ | `@arco-design/web-vue` |
| 状态管理 | Pinia 3.x | |
| HTTP 客户端 | Axios 1.13+ | 封装在 `src/utils/http.ts` |
| 构建工具 | Vite (rolldown-vite) | 代理 `/api/v1` → `:8080` |
| 后端网关 | Spring Cloud Gateway | `:8080`，Nacos 服务发现 |
| 认证 | JWT (Bearer Token) | Gateway 统一鉴权 |
| API 文档 | Knife4j Gateway 聚合 | `http://localhost:8080/doc.html` |
| 测试 | Vitest (前端) / Pytest (E2E) | |

---

## 1. Vite 代理配置

```typescript
// script-kill-frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://localhost:8080',  // Gateway 端口
        changeOrigin: true
        // 注意: 不要 rewrite 路径，Gateway 通过 StripPrefix=2 处理
      }
    }
  }
})
```

> [!IMPORTANT]
> Gateway 的 `StripPrefix=2` 会移除前两段路径（`/api/v1`），实际到达微服务的路径为 `/auth/**`、`/scripts/**` 等。前端统一使用 `/api/v1/xxx` 即可。

---

## 2. Gateway 路由映射

| 前端请求路径 | Gateway 路由 | 目标服务 | 服务内路径 |
|-------------|-------------|---------|-----------|
| `/api/v1/auth/**` | `auth-service` | `lb://auth-service` | `/auth/**` |
| `/api/v1/scripts/**` | `script-service` | `lb://script-service` | `/scripts/**` |
| `/api/v1/dms/**` | `script-service` | `lb://script-service` | `/dms/**` |
| `/api/v1/sessions/**` | `session-service` | `lb://session-service` | `/sessions/**` |
| `/api/v1/bookings/**` | `booking-service` | `lb://booking-service` | `/bookings/**` |
| `/api/v1/orders/**` | `booking-service` | `lb://booking-service` | `/orders/**` |
| `/api/v1/stats/**` | `stats-service` | `lb://stats-service` | `/stats/**` |
| `/api/v1/recommendations/**` | `recommend-service` | `lb://recommend-service` | `/recommendations/**` |

---

## 3. HTTP 请求封装

项目已在 `src/utils/http.ts` 中封装了统一的 HTTP 客户端：

### 统一响应格式

```typescript
// 后端 Result<T> 结构
interface ApiResult<T> { code: number; message: string; data: T }

// 前端标准响应
interface ApiResponse<T> { success: boolean; data: T; message: string; code: number }
```

**约定**: `code === 0` 表示业务成功，其他值为业务错误码。

### 编写 API 模块

```typescript
// src/api/script.ts
import http from '@/utils/http'
import type { ApiResponse } from '@/utils/http'

/** 剧本列表 */
export interface ScriptVO {
  id: number
  name: string
  type: string
  minPlayers: number
  maxPlayers: number
}

/** 获取剧本列表 */
export function fetchScripts(params?: { type?: string; page?: number; size?: number }) {
  return http.get<ApiResponse<ScriptVO[]>>('/scripts', { params })
}

/** 获取单个剧本 */
export function fetchScriptById(id: number) {
  return http.get<ApiResponse<ScriptVO>>(`/scripts/${id}`)
}
```

### 在 Vue 组件中调用

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchScripts, type ScriptVO } from '@/api/script'
import { Message } from '@arco-design/web-vue'

const scripts = ref<ScriptVO[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  const res = await fetchScripts()
  if (res.data.success) {
    scripts.value = res.data.data
  } else {
    Message.error(res.data.message)
  }
  loading.value = false
})
</script>
```

---

## 4. 联调启动流程

### 前置条件

```bash
# 1. 启动基础设施
#    - MySQL 8.x (端口 3306)
#    - Redis (端口 6379)
#    - Nacos (端口 8848)

# 2. 启动后端微服务（按依赖顺序）
#    Gateway → Auth → Script → Session → Booking → Stats → Recommend

# 3. 验证服务注册
#    访问 Nacos 控制台: http://localhost:8848/nacos
#    确认所有服务已注册

# 4. 验证 API 文档
#    访问 Knife4j: http://localhost:8080/doc.html
#    查看各服务 API 接口

# 5. 启动前端
cd script-kill-frontend
npm run dev
# → http://localhost:5173
```

### 环境变量

```bash
# .env.development（默认，走 Vite 代理）
VITE_API_BASE_URL=/api/v1

# .env.production（生产，直连网关或 Nginx）
VITE_API_BASE_URL=https://api.example.com/api/v1
```

---

## 5. 常见联调问题排查

### 快速诊断表

| 症状 | 可能原因 | 排查步骤 |
|------|---------|---------|
| 前端 404 | 路径不匹配 | 对照 Gateway 路由表，检查 `StripPrefix` |
| 前端 502 | 服务未启动 | 检查 Nacos 服务列表 |
| 前端 401 | Token 缺失/过期 | F12 → Network → 检查 Authorization 头 |
| 前端 403 | JWT Filter 拦截 | 检查 Gateway 白名单（如 `/auth/login`） |
| CORS 报错 | Gateway 未配置 CORS | 在 Gateway 添加 `CorsWebFilter` |
| 数据为空 | 数据库无数据 | 检查 Flyway 迁移是否成功 |
| 响应格式错误 | 后端未用 `Result<T>` | 检查 Controller 返回值 |

### Gateway CORS 配置

```java
// script-kill-gateway/.../config/CorsConfig.java
@Configuration
public class CorsConfig {
    @Bean
    public CorsWebFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOrigin("http://localhost:5173");
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}
```

> [!TIP]
> 开发环境推荐使用 Vite 代理而非 CORS，避免跨域问题。生产环境由 Nginx 代理，同样无 CORS 问题。

### 路径映射调试

```bash
# 验证 Gateway 路由是否生效
curl -v http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'

# 直连微服务验证（绕过 Gateway）
curl http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

---

## 6. 联调 & E2E 验证清单

### 接口层联调

- [ ] 接口路径与 Gateway 路由一致
- [ ] 请求方法正确（GET / POST / PUT / DELETE）
- [ ] Query 参数 vs Body 参数格式正确
- [ ] 响应结构遵循 `{ code, message, data }` 约定
- [ ] 错误码定义前后端一致（参照 Knife4j 文档）
- [ ] JWT Token 正确传递和校验
- [ ] 分页参数约定一致（`page` / `size`）
- [ ] 时间格式统一（ISO 8601 / 时间戳）

### 业务流联调

- [ ] 用户注册 → 登录 → 获取 Token 完整流程
- [ ] 剧本 CRUD 操作
- [ ] 场次创建和查询
- [ ] 预约/取消预约流程
- [ ] 并发预约不超卖

### E2E 验证

```bash
# 运行 pytest E2E 测试
cd script-kill-backend/e2e-tests
pip install -r requirements.txt
pytest -v --tb=short
```

---

## 7. 调试技巧

### 前端请求日志

```typescript
// 在 src/utils/http.ts 中已可扩展
if (import.meta.env.DEV) {
  http.interceptors.request.use((config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data || config.params)
    return config
  })
  http.interceptors.response.use((response) => {
    console.log(`[API] ← ${response.config.url}`, response.data)
    return response
  })
}
```

### 后端日志定位

```bash
# 查看 Gateway 日志（路由匹配）
# 在 application.yml 中临时开启:
# logging.level.org.springframework.cloud.gateway: DEBUG

# 查看具体微服务日志
# 各微服务的 logs/ 目录或控制台输出
```

### 使用 Knife4j 测试

1. 打开 `http://localhost:8080/doc.html`
2. 选择目标服务（如 `auth-service`）
3. 找到目标接口，填入参数
4. 发送请求，对比前端期望的响应格式
