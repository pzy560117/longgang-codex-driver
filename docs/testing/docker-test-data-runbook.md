# Docker 测试数据运行手册

本手册对应 `DOCKER-TEST-DATA-AUTOMATION-001`。它只用于本机 docker/mock 验证和人工测试准备，不是 live OSS/S3 或外部生产 MySQL 证据。

## 前置条件

- Docker Desktop 已安装。
- Node.js 满足 `package.json` 的 `engines.node`。
- 当前工作区依赖已安装。

## 一键验证

```powershell
npm run test:docker-local
```

该命令会执行：

1. 自动检查 Docker daemon；不可达时尝试启动 Docker Desktop 并等待。
2. 创建或复用本机 Docker MySQL 容器 `export-platform-mysql-local`。
3. 设置 `EXPORT_PLATFORM_TEST_DATABASE_URL` 和 `EXPORT_PLATFORM_DATABASE_URL` 指向本机测试库。
4. 创建或复用本机 Docker MinIO 容器 `export-platform-minio-local`，并自动初始化 bucket。
5. 设置 `EXPORT_PLATFORM_OBJECT_STORAGE_DRIVER=s3` 和 MinIO 访问参数。
6. 运行 `scripts/docker-test-seed.mjs` 执行 migration，并 seed `purchase_orders_sample` / `purchase_orders_view` 与 `purchase-order-export` registry，默认写入 `10,000` 条样例数据。
7. 运行 API、DB、worker、query、file、sample 和 object-storage smoke 验证。

## 证据边界

- 该入口的证据形态是 `docker/mock`。
- MySQL 依赖是本机 Docker MySQL。
- object storage 依赖是本机 Docker MinIO。
- 该入口不是 live evidence，不是 live OSS/S3 证据，也不证明外部生产 MySQL 可用。

## 常见 BLOCKED

Docker daemon 不可达：

```text
BLOCKED - 需要人工介入
```

处理方式：

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
docker info
npm run test:docker-local
```

现有容器端口或数据库名不匹配时，脚本会停止并提示删除或重建本机测试容器。不要把该脚本指向外部生产数据库。
