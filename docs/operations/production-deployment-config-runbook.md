# 生产部署配置 runbook

本文是 `PROD-CONFIG-GOVERNANCE-001` 的配置契约。它只说明统一配置入口、部署变量和验证边界；不声明 staging、pre-prod 或 production live 依赖已经接通。

如果需要从零执行到生产环境，先按 `docs/operations/production-deployment-tutorial.md` 走完整上线步骤；本文只作为配置项解释和配置后验证参考。

## 配置入口

生产代码统一通过 `src/config/env.ts` 的 `loadConfig()` 读取配置，配置对象包含：

| 配置块 | 用途 | 生产路径 |
| --- | --- | --- |
| `http` | 服务监听地址和端口 | `src/server.ts` |
| `mysql` / `databaseUrl` | 平台库连接 | `src/db/kysely.ts` |
| `datasource.urlsByCode` | 业务只读数据源映射 | `src/datasource-adapters/index.ts` |
| `objectStorage` | 对象存储 endpoint、bucket、smoke 策略 | `src/file-service/index.ts`、`src/cleanup-job/index.ts` |
| `security` | 下载 URL 签名、认证上下文签名、管理员租户、公开 base URL | `src/audit-log/auth-context.ts`、`src/task-api/service.ts` |
| `worker` | scheduler 与 cleanup 进程身份 | `src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts` |
| `securityPolicy` | production fail-fast 策略 | `src/config/env.ts` |

## 变量清单

| 变量 | 必填环境 | Secret | 用途 / 来源 |
| --- | --- | --- | --- |
| `EXPORT_PLATFORM_ENVIRONMENT` | 全部 | 否 | `local`、`test`、`staging`、`pre-prod`、`production`。生产使用 `production`。 |
| `EXPORT_PLATFORM_HOST` | 全部 | 否 | HTTP 监听地址，由部署配置提供。 |
| `EXPORT_PLATFORM_PORT` | 全部 | 否 | HTTP 监听端口。 |
| `EXPORT_PLATFORM_PUBLIC_BASE_URL` | production | 否 | 对外下载签名 URL 的平台 base URL，生产不得使用 localhost/example/test endpoint。 |
| `EXPORT_PLATFORM_DATABASE_URL` | production | 是 | 平台库连接串，优先于拆分 MySQL 变量。 |
| `EXPORT_PLATFORM_MYSQL_HOST` / `PORT` / `DATABASE` / `USER` / `PASSWORD` / `SSL` | 非 URL 方式 | `PASSWORD` 是 | 平台库拆分配置。 |
| `EXPORT_PLATFORM_DATASOURCE_<CODE>_URL` | 按 registry 需要 | 是 | 业务只读数据源连接串，`purchase-ro` 对应 `PURCHASE_RO`。 |
| `EXPORT_PLATFORM_DATASOURCES_JSON` | 可选 | 是 | 多数据源映射 JSON，适合部署平台集中注入。 |
| `EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT` | production | 否 | 当前 HTTP 对象存储网关 endpoint。 |
| `EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET` | production | 否 | 导出文件 bucket。 |
| `EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX` | smoke | 否 | live smoke 写入前缀，应使用独立低风险路径。 |
| `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES` | production smoke | 否 | production 模式必须显式设置为 `true` 才允许 smoke 写入。 |
| `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE` | docker/mock only | 否 | 仅 docker/mock release gate 可设为 `true`。 |
| `EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET` | production | 是 | 下载 URL HMAC-SHA256 签名密钥。 |
| `EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET` | production | 是 | 认证网关 auth context HMAC-SHA256 签名密钥。 |
| `EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS` | production | 否 | 允许注册配置管理的租户 CSV；`*` 只允许受控测试或明确授权环境。 |
| `EXPORT_PLATFORM_WORKER_ID` | worker | 否 | scheduler worker 进程身份。 |
| `EXPORT_PLATFORM_CLEANUP_WORKER_ID` | cleanup | 否 | cleanup job 进程身份。 |
| `EXPORT_PLATFORM_SCHEDULER_POLL_MS` | worker | 否 | scheduler 轮询间隔。 |
| `EXPORT_PLATFORM_CLEANUP_POLL_MS` | cleanup | 否 | cleanup 轮询间隔。 |

## Production fail-fast

`EXPORT_PLATFORM_ENVIRONMENT=production` 时，`loadConfig()` 会阻塞以下配置：

- 缺少 `EXPORT_PLATFORM_DATABASE_URL` 或完整拆分 MySQL 配置、对象存储 endpoint/bucket、公开 base URL 或必填签名密钥。
- 平台库、业务数据源、对象存储或公开 base URL 使用 `localhost`、`127.0.0.1`、`.local`、`.test`、`.invalid` 等不安全 endpoint。

普通 HTTP、scheduler worker 和 cleanup job 的运行期建议保持 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=false`。只有执行 `npm run test:object-storage-live` 的 smoke 窗口才临时设置为 `true`；该 smoke 脚本会独立阻塞未显式开启写入的情况。

这些阻塞只证明配置治理生效，不等同于真实依赖可用。真实 live 验证必须另开 `PRODUCTION-LIVE-INTEGRATION-001` 或等价任务。

## 配置后验证

配置变更后按顺序执行：

```powershell
npm run typecheck
npm run arch:check
node --import tsx --test tests/config-env.test.mjs
npm run test:contract
git diff --check -- task.json .env.example src/config src/datasource-adapters src/file-service src/audit-log src/task-api src/workers src/jobs src/cleanup-job tests/config-env.test.mjs tests/contract docs/operations docs/testing/verify-matrix.md
```

外部 staging / pre-prod / production 依赖可用后，再运行 live 专项验证并记录成功态与失败态证据。不能把本地 Docker MySQL、本地 object storage mock、demo 或 rehearsal 报告升级为 live evidence。
