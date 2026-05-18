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
