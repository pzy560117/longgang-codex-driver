# 本地 demo runbook

本地 demo 用于把统一导出平台跑成可演示的 HTTP 服务。它不需要外部 MySQL，也不需要外部 OSS/S3；脚本会复用或创建本机 Docker MySQL 和 Docker MinIO，自动 migration，并 seed 测试数据。

## 启动方式

```powershell
npm run demo:local
```

脚本会执行以下动作：

- 复用或创建 Docker MySQL 容器 `export-platform-mysql-local`，默认映射 `127.0.0.1:33306/export_platform_test`。
- 如果同名容器已存在，脚本会校验它仍映射到目标端口且创建时的 `MYSQL_DATABASE` 与 demo 数据库一致；不一致时输出 `BLOCKED - 需要人工介入`。
- 本地 Docker MySQL 和 Docker MinIO 容器会保留，方便重复演示；脚本只清理本次启动的 HTTP server 进程。
- 默认忽略当前 shell 中残留的 `EXPORT_PLATFORM_TEST_DATABASE_URL`，避免把 demo seed 写入外部数据库；setup 脚本也会拒绝非本机 MySQL URL。
- setup 脚本还会拒绝非 demo 数据库名，避免本地 SSH tunnel、Cloud SQL proxy 或本机其他数据库被 migration/seed 污染。
- 启动本地 Docker MinIO，并设置 `EXPORT_PLATFORM_OBJECT_STORAGE_DRIVER=s3`、`EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT`、`EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET`、访问密钥和下载签名密钥。
- 运行 `scripts/docker-test-seed.mjs`，自动 migration，注册 `purchase-order-export` 样板，并向 `purchase_orders_sample` / `purchase_orders_view` 默认 seed `10,000` 条测试数据。
- 启动 `src/server.ts`，默认监听 `http://127.0.0.1:3000`。

如果需要完整本地链路，而不是只起 HTTP，可以运行：

```powershell
npm run stack:local
```

`stack:local` 会在同一套本地 Docker MySQL 和 Docker MinIO 之上同时启动 HTTP、scheduler worker 和 cleanup job。

快速自检可以运行：

```powershell
npm run demo:local:smoke
```

`demo:local:smoke` 会使用同样的本地 Docker MySQL 和 Docker MinIO，启动服务后调用 `GET /health`，随后自动退出。

## API 示例

健康检查：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/health"
```

```bash
curl "http://127.0.0.1:3000/health"
```

创建采购订单导出任务，接口为 `POST /api/export/tasks`：

```bash
curl -X POST "http://127.0.0.1:3000/api/export/tasks" \
  -H "content-type: application/json" \
  -H "x-operator-id: u001" \
  -H "x-tenant-id: tenant-001" \
  -H "x-role-codes: EXPORT_USER" \
  -H "x-org-scope: ORG-001,ORG-002" \
  -H "x-request-id: req-local-demo-create" \
  -d '{"taskCode":"purchase-order-export","subsystemCode":"purchase","fileFormat":"XLSX","clientRequestId":"local-demo-001","queryParams":{"createdAtFrom":"2026-05-01T00:00:00.000Z","createdAtTo":"2026-05-31T23:59:59.000Z","orderStatus":"APPROVED","supplierId":"SUP-DEMO-001","purchaseOrgId":"PO-DEMO","keyword":"DEMO-PO"}}'
```

查询任务历史：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/export/tasks?taskCode=purchase-order-export" `
  -Headers @{
    "x-operator-id" = "u001"
    "x-tenant-id" = "tenant-001"
    "x-role-codes" = "EXPORT_USER"
    "x-org-scope" = "ORG-001,ORG-002"
    "x-request-id" = "req-local-demo-list"
  }
```

## 证据边界

本 runbook 只声明本机 demo 可运行：Docker MySQL、Docker MinIO、自动 migration/seed 测试数据和 HTTP API 示例。它不是外部生产 MySQL 证据，也不是外部 live OSS/S3 证据；外部 live 依赖验证需要单独任务和独立 evidence。
