# 导出服务手动启动 runbook

本文说明在 Windows PowerShell 下手动启动统一导出平台 HTTP 服务的方法。适用于本地联调、演示和技术验收前的快速启动。

## 前提

- 当前目录为项目根目录：`E:\2026\alpha-project\longgang-codex-driver`
- 已安装 Node.js 22 或更高版本。
- 已执行依赖安装：`npm install`
- 如果要调用业务接口，需要准备 MySQL 平台库；仅访问 `/health` 不依赖数据库连接。

## 使用本地测试库启动

仓库 `.env.local` 中保存的是测试库变量 `EXPORT_PLATFORM_TEST_DATABASE_URL`。服务运行时读取的是 `EXPORT_PLATFORM_DATABASE_URL`，所以手动启动时需要先做一次变量映射。

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$dbUrl = (Get-Content .env.local | Where-Object { $_ -match '^EXPORT_PLATFORM_TEST_DATABASE_URL=' }) -replace '^EXPORT_PLATFORM_TEST_DATABASE_URL=', ''
$env:EXPORT_PLATFORM_DATABASE_URL = $dbUrl
$env:EXPORT_PLATFORM_PORT = '3000'

npm run start
```

启动成功后，终端会输出类似内容：

```text
{"event":"export-platform.http.started","host":"0.0.0.0","port":3000}
```

## 直接指定数据库地址启动

如果不用 `.env.local`，可以直接设置平台库地址。

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$env:EXPORT_PLATFORM_DATABASE_URL = 'mysql://root@127.0.0.1:33306/export_platform_test'
$env:EXPORT_PLATFORM_PORT = '3000'

npm run start
```

生产或联调环境不要把真实账号密码写入仓库文档；应通过部署平台 secret、临时 PowerShell 环境变量或受控配置注入。

## 健康检查

服务启动后执行：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

预期返回：

```json
{
  "status": "ok",
  "service": "export-platform",
  "deliveryShape": "independent_microservice",
  "entries": {
    "http": true,
    "worker": true,
    "cleanupJob": true
  }
}
```

也可以在浏览器打开：

```text
http://127.0.0.1:3000/health
```

## 停止服务

如果服务在当前 PowerShell 窗口前台运行，按：

```text
Ctrl+C
```

如果需要按端口查找并停止进程：

```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
$conn | Select-Object LocalAddress,LocalPort,State,OwningProcess

Stop-Process -Id $conn.OwningProcess
```

停止前先确认 `OwningProcess` 确实是本次启动的导出服务，避免误停其他进程。

## 常见问题

### test:api 提示缺少 EXPORT_PLATFORM_TEST_DATABASE_URL

`.env.local` 不会被 `npm run test:api` 自动加载。API 测试读取的是当前 PowerShell 进程里的 `EXPORT_PLATFORM_TEST_DATABASE_URL`。

如果已经有本地或 Docker MySQL 监听在 `127.0.0.1:33306`，可以直接设置：

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$env:EXPORT_PLATFORM_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:33306/export_platform_test'

npm run test:api
```

也可以从 `.env.local` 读取：

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$env:EXPORT_PLATFORM_TEST_DATABASE_URL = (Get-Content .env.local | Where-Object { $_ -match '^EXPORT_PLATFORM_TEST_DATABASE_URL=' }) -replace '^EXPORT_PLATFORM_TEST_DATABASE_URL=', ''

npm run test:api
```

如果 MySQL 没有运行，设置变量也不能让测试通过；需要先启动本地 MySQL 或使用 `demo:local` / Docker 流程拉起测试依赖。

### test:api 是否会请求 demo:local 的 3000 服务

不会。

`demo:local` 和 `test:api` 的运行路径不同：

| 命令 | HTTP 服务来源 | MySQL 来源 | 是否占用 3000 端口 |
| --- | --- | --- | --- |
| `npm run demo:local` | 启动真实本地 HTTP 服务，监听 `http://127.0.0.1:3000` | Docker MySQL `127.0.0.1:33306/export_platform_test` | 是 |
| `npm run test:api` | 测试进程内部创建 Fastify 实例，并用 `app.inject()` 调用 | `EXPORT_PLATFORM_TEST_DATABASE_URL` 指向的本地或 Docker MySQL | 否 |

因此：

- `test:api` 不会请求 `http://127.0.0.1:3000`。
- `test:api` 不需要 `demo:local` 的 HTTP 服务正在运行。
- `test:api` 可以复用 `demo:local` 拉起的 Docker MySQL。
- 如果只跑 `test:api`，只要 MySQL 和 `EXPORT_PLATFORM_TEST_DATABASE_URL` 正确即可。

典型流程是开两个 PowerShell 窗口：

第一个窗口启动 demo，保留前台运行：

```powershell
npm run demo:local
```

第二个窗口复用 demo 拉起的 Docker MySQL 跑 API 测试：

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$env:EXPORT_PLATFORM_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:33306/export_platform_test'

npm run test:api
```

### 为什么 test:api 只有 7 个用例

`npm run test:api` 只跑 `tests/api/*.test.mjs`，当前 API 测试文件里定义的是 7 个聚合场景，不代表整个项目只有 7 个测试。

这些 API 用例内部会执行多次 `app.inject()` 请求，例如注册、创建、幂等、历史、详情、失败、权限、下载、取消、重试等流程会被放在同一个聚合场景里验证。

项目完整测试按边界拆分：

| 命令 | 覆盖边界 |
| --- | --- |
| `npm run test:api` | API / auth / audit / history / state machine |
| `npm run test:db` | DB schema / repositories / durable evidence |
| `npm run test:worker` | scheduler / locks / retry / cleanup polling |
| `npm run test:query` | query executor / datasource adapter / data scope / masking |
| `npm run test:file` | file service / signed download / cleanup / render failures |
| `npm run test:sample` | purchase-order sample / row boundaries / masked output |
| `npm run test:acceptance` | acceptance matrix and API smoke |
| `npm run test:mock-local` | mock/local evidence guards |
| `npm run test:contract` | OpenAPI and route contract drift |
| `npm test` | 基础单测和 contract 子集 |

如果 Docker demo 的 MySQL 已经在运行，可以在另一个 PowerShell 窗口执行更完整的本地验证：

```powershell
cd E:\2026\alpha-project\longgang-codex-driver

$env:EXPORT_PLATFORM_TEST_DATABASE_URL = 'mysql://root@127.0.0.1:33306/export_platform_test'

npm run test:db
npm run test:worker
npm run test:query
npm run test:file
npm run test:sample
npm run test:acceptance
npm run test:mock-local
```

完整验收报告入口是：

```powershell
npm run test:acceptance:full-report
```

这个命令覆盖范围更大、运行时间更长，并依赖 Docker / mock 本地环境。

### demo:local 提示 Docker daemon 不可用

`npm run demo:local` 会通过 Docker 拉起本地依赖。如果 Docker Desktop 没有启动，会出现类似错误：

```text
BLOCKED - 需要人工介入: demo:local requires a running Docker daemon.
```

先启动 Docker Desktop：

```powershell
Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
```

等待 Docker daemon 可用：

```powershell
docker info
```

确认可用后重新执行：

```powershell
npm run demo:local
```

如果 3000 端口已有手动启动的服务，建议先停止，避免 demo 过程端口冲突：

```powershell
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force
}
```

### 端口 3000 已被占用

检查占用进程：

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress,LocalPort,State,OwningProcess
```

可以换一个端口启动：

```powershell
$env:EXPORT_PLATFORM_PORT = '3001'
npm run start
```

健康检查地址同步改为：

```powershell
Invoke-RestMethod http://127.0.0.1:3001/health
```

### 健康检查通过但业务接口失败

`/health` 只证明 HTTP 服务启动成功，不证明 MySQL、对象存储、业务只读数据源或认证网关已经接通。

业务接口失败时优先检查：

- `EXPORT_PLATFORM_DATABASE_URL` 是否设置。
- MySQL 是否可访问。
- migration 是否已执行。
- 认证上下文请求头是否完整。
- 注册配置是否已创建并启用。

### npm 命令不可用

Windows 下可以显式使用 npm 的 PowerShell 入口：

```powershell
& 'C:\Program Files\nodejs\npm.ps1' run start
```

## 相关命令

```powershell
# 类型检查
npm run typecheck

# 架构检查
npm run arch:check

# API 测试
npm run test:api

# 本地 demo
npm run demo:local
```

更多生产依赖接入说明见 `docs/operations/production-data-integration-runbook.md`。
