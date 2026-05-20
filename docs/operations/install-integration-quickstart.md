# 安装与接入快速手册

本文面向第一次接手统一导出平台的人。目标是先回答两个问题：

- 怎么把服务跑起来？
- 怎么把它接到真实生产依赖？

如果只想先看效果，走“本地试跑”。如果要上服务器，走“服务器安装”。如果要接生产，走“真实依赖接入”。

## 1. 这套系统由什么组成

统一导出平台不是一个单进程服务。它至少有 7 个部分：

| 部分 | 作用 | 谁负责 |
| --- | --- | --- |
| HTTP 服务 | 对外提供创建导出、查询、下载、配置管理 API | 接手研发 / 运维 |
| Scheduler worker | 从平台库取待执行任务，查询业务数据并生成文件 | 接手研发 / 运维 |
| Cleanup job | 清理过期文件和元数据 | 接手研发 / 运维 |
| 平台 MySQL | 保存任务、配置、锁、文件元信息、审计 | DBA |
| 业务只读数据源 | 提供要导出的业务数据 | 业务系统负责人 / DBA |
| 对象存储网关 | 保存导出文件并生成下载 URL | 运维 / 存储平台 |
| 认证网关 | 给请求加操作者、租户、角色、组织范围和签名头 | 网关 / 安全 |

因此安装不等于只启动 `npm run start`。生产至少要同时跑 3 个进程：HTTP、scheduler worker、cleanup job。

## 2. 本地试跑

适用场景：你还没有生产数据库、对象存储和网关，只想确认项目能跑。

需要先安装：

- Node.js 22 或更高版本。
- npm。
- Git。
- Docker Desktop 或等价 Docker daemon。

在仓库根目录执行：

```powershell
npm ci
npm run demo:local
```

看到 `demo:local ready.` 后，在另一个 PowerShell 窗口检查：

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

如果要只跑 smoke：

```powershell
npm run demo:local:smoke
```

本地试跑会自动准备：

- Docker MySQL：`127.0.0.1:33306/export_platform_test`
- 本地 object storage mock
- 本地 HTTP 服务：`http://127.0.0.1:3000`
- 演示用测试数据

注意：本地试跑只能证明开发链路能跑，不能当作生产接入证据。

## 3. 服务器安装

适用场景：你有一台测试服务器、staging 服务器或部署平台，想把服务先跑起来。

### 3.1 准备服务器

服务器需要：

| 项 | 要求 |
| --- | --- |
| Node.js | 22 或更高 |
| npm | 随 Node.js 安装 |
| Git | 能拉取仓库 |
| 网络 | 能访问平台 MySQL、业务只读源、对象存储网关 |
| 进程管理 | 部署平台、systemd、PM2、Kubernetes 或等价方式 |

当前仓库还没有生产 `Dockerfile` 和 `build` 脚本，所以最直接的安装方式是源码部署：

```powershell
git clone <repo-url> export-platform-service
Set-Location export-platform-service
git checkout <deploy-commit-sha>
npm ci
```

Linux 服务器使用等价命令：

```bash
git clone <repo-url> export-platform-service
cd export-platform-service
git checkout <deploy-commit-sha>
npm ci
```

如果你的平台只能部署 Docker 镜像，需要先补 `Dockerfile` 和镜像验证任务，不能直接把本文的源码部署命令改写成“镜像已支持”。

### 3.2 配置环境变量

先不要把真实密码写进 `.env` 文件提交到仓库。真实值应该放到部署平台或 secret manager。

最少需要这些变量：

```text
EXPORT_PLATFORM_ENVIRONMENT=staging
EXPORT_PLATFORM_HOST=0.0.0.0
EXPORT_PLATFORM_PORT=3000
EXPORT_PLATFORM_PUBLIC_BASE_URL=https://<export-platform-host>

EXPORT_PLATFORM_DATABASE_URL=mysql://<platform_user>:<platform_password>@<platform_mysql_host>:3306/<platform_db>?ssl=true

EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT=https://<object-storage-gateway>
EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET=<bucket>
EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX=release-smoke
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=false
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=false

EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET=<download-url-signing-secret>
EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET=<auth-context-signing-secret>
EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS=<tenant-001,tenant-002>

EXPORT_PLATFORM_WORKER_ID=export-worker-staging-001
EXPORT_PLATFORM_CLEANUP_WORKER_ID=export-cleanup-staging-001
EXPORT_PLATFORM_SCHEDULER_POLL_MS=5000
EXPORT_PLATFORM_CLEANUP_POLL_MS=60000
```

接业务数据时，再为每个业务只读源增加一项：

```text
EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL=mysql://<readonly_user>:<readonly_password>@<business_mysql_host>:3306/<business_db>?ssl=true
```

这里的 `PURCHASE_RO` 来自 `datasourceCode=purchase-ro`。规则是把 `datasourceCode` 转成大写，并把 `-` 转成 `_`。

### 3.3 启动 3 个进程

在部署平台里配置 3 个独立进程：

```powershell
npm run start
npm run worker:scheduler
npm run job:cleanup
```

三个进程不能互相替代：

- 只启动 HTTP：只能接请求，不能真正执行导出。
- 只启动 worker：不能接外部 API。
- 不启动 cleanup：过期文件和元数据不会被清理。

### 3.4 检查安装是否成功

先查 HTTP：

```powershell
curl.exe -fsS "https://<export-platform-host>/health"
```

返回里应看到：

```json
{
  "status": "ok"
}
```

再查日志：

| 进程 | 应看到的日志 |
| --- | --- |
| HTTP | `export-platform.http.started` |
| Scheduler worker | `export-platform.scheduler.started` |
| Cleanup job | `export-platform.cleanup.started` |

到这里只能说明“服务安装并启动成功”，还不代表“业务接入成功”。

## 4. 真实依赖接入

真实接入建议先做 staging，再做 pre-prod，最后 production。不要第一步直接接全量生产数据。

### 4.1 找谁要什么

| 要什么 | 找谁 | 拿到什么 |
| --- | --- | --- |
| 平台库 | DBA | 平台 MySQL 地址、库名、运行期账号、migration 账号、备份方案 |
| 业务只读源 | 业务系统负责人 / DBA | 只读连接串、业务视图、字段说明、验收查询 |
| 对象存储 | 运维 / 存储平台 | HTTP gateway endpoint、bucket、smoke prefix、权限说明 |
| 认证网关 | 网关 / 安全 | `X-Auth-Context-*` 签名规则和共享签名密钥 |
| 管理租户 | 产品 / 业务负责人 | 哪些 tenant 可以注册和修改导出配置 |
| registry 配置 | 业务负责人 / 接手研发 | `taskCode`、参数 schema、查询模板、字段映射、脱敏规则 |

真实密码、token、secret 只进 secret manager，不进文档。

### 4.2 接入顺序

按这个顺序做：

1. 先接平台库。
2. 执行平台库 migration。
3. 启动 HTTP、scheduler worker、cleanup job。
4. 接对象存储并跑 smoke。
5. 接认证网关签名。
6. 接一个业务只读源。
7. 注册一个最小 registry 配置。
8. 创建一个小范围导出任务。
9. 验证文件下载、审计和脱敏。
10. 验证失败态。

不要先接全量业务数据。第一条任务应使用小时间窗、小组织范围和低风险数据。

### 4.3 平台库怎么接

平台库是导出平台自己的数据库，不是业务库。

它保存：

- 导出任务。
- registry 配置。
- worker 锁和 checkpoint。
- 文件元信息。
- 审计日志。

当前仓库有 migration 代码和 `migrations/`，但没有生产 `db:migrate` 脚本。生产有两种做法：

1. 推荐：先补受控 migration job。
2. 临时：DBA 按 `migrations/` 审核并执行，执行前必须备份。

不能让 HTTP 服务启动时自动改生产库。

### 4.4 对象存储怎么接

当前实现需要的是 HTTP object storage gateway，不是直接填 OSS/S3 endpoint。

网关需要支持：

- `PUT /{bucket}/{storageKey}` 写入对象。
- `GET /{bucket}/{storageKey}` 读取对象。
- 通过 copy 语义发布对象。
- 生成可访问的下载 URL。

接入后，在 smoke 窗口临时设置：

```text
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=false
```

然后执行：

```powershell
npm run test:object-storage-live
```

通过后把 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES` 改回 `false`。

如果只有原生 OSS/S3，没有兼容 HTTP gateway，就需要先新增 native adapter。

### 4.5 认证网关怎么接

所有业务 API 都需要上游网关传入认证上下文，核心请求头包括：

```text
X-Operator-Id
X-Tenant-Id
X-Role-Codes
X-Org-Scope
X-Request-Id
X-Auth-Context-Signature
X-Auth-Context-Issued-At
X-Auth-Context-Signature-Algorithm
```

当前签名算法只接受 `HMAC-SHA256`。签名密钥来自：

```text
EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET
```

如果没有这些头，请求会被当作未认证或签名无效。生产不能让前端或普通调用方自己伪造这些头，必须由可信网关生成。

### 4.6 业务只读源怎么接

每个导出配置都有一个 `datasourceCode`。例如：

```text
datasourceCode = purchase-ro
```

对应环境变量：

```text
EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL=mysql://<readonly_user>:<readonly_password>@<business_host>:3306/<business_db>?ssl=true
```

业务只读账号必须满足：

- 只能 `SELECT`。
- 不能 `INSERT`、`UPDATE`、`DELETE`。
- 不能 DDL。
- 不能执行危险存储过程。
- 能访问 registry 查询模板里用到的视图或表。

### 4.7 registry 配置怎么接

registry 配置告诉平台“某个导出任务该查哪个数据源、允许哪些参数、导出哪些字段、怎么脱敏”。

最少要准备：

| 字段 | 说明 |
| --- | --- |
| `taskCode` | 导出任务编码，例如 `purchase-order-export` |
| `subsystemCode` | 业务子系统 |
| `datasourceCode` | 对应只读数据源 |
| `parameterSchema` | 允许的查询参数 |
| `queryTemplate` | 只读 SELECT 模板 |
| `fieldMappings` | 导出字段、标题、顺序、敏感标记 |
| `maskingPolicy` | 脱敏规则 |
| `dataScopeTemplate` | 租户、组织、操作者范围 |
| `batchSize` | 每批查询数量 |
| `singleFileMaxRows` | 单文件最大行数 |
| `exportMaxRows` | 单次导出最大行数 |

先注册一个最小配置，不要一次接全量字段和全量数据。

## 5. 怎么判断“安装成功”和“接入成功”

安装成功只需要满足：

- `npm ci` 成功。
- 3 个进程都启动。
- `/health` 返回 `status=ok`。
- 进程日志没有配置缺失或连接失败。

接入成功必须额外满足：

- 平台库 migration 成功。
- 对象存储 smoke 成功。
- 网关签名请求能通过，缺签名会失败。
- 业务只读源能查询小范围数据。
- registry 配置能保存并读取。
- 小范围导出任务能从 `PENDING` 到 `COMPLETED`。
- 文件能下载，checksum 正确。
- 敏感字段已脱敏。
- 审计可追溯。
- 失败态有证据：缺签名、无权限、未注册任务、参数错误、数据源不可用、对象存储失败。

缺少这些证据时，只能说“安装完成”或“接入准备完成”，不能说“生产接入完成”。

## 6. 最常见卡点

| 卡点 | 处理 |
| --- | --- |
| 不知道先跑哪个命令 | 本地先跑 `npm ci` 和 `npm run demo:local`；服务器先跑 `npm ci`，再配置 3 个进程。 |
| 只有一台服务器 | 也要配置 3 个进程，可以在同一台机器上跑，但进程必须独立。 |
| 没有生产 MySQL 权限 | 找 DBA 提供平台库和 migration 方案，不能用内存库或本地库代替。 |
| 不知道业务库怎么配 | 先确定 `datasourceCode`，再按规则配置 `EXPORT_PLATFORM_DATASOURCE_<CODE>_URL`。 |
| 对象存储是 OSS/S3 | 先确认有没有 HTTP gateway；没有就要新增 native adapter。 |
| 不知道 API 怎么鉴权 | 找网关团队接 `X-Auth-Context-*` 签名头。 |
| 想直接全量上线 | 不建议。先 staging 小范围任务，再灰度放量。 |
| 想用 Docker 部署 | 当前仓库未提供生产 Dockerfile，需要先补镜像任务。 |

## 7. 下一步读什么

| 你要做什么 | 继续读 |
| --- | --- |
| 按上线工单逐步执行 | `docs/operations/production-deployment-tutorial.md` |
| 收集生产配置 | `docs/operations/production-config-questionnaire.md` |
| 理解每个变量 | `docs/operations/production-deployment-config-runbook.md` |
| 接业务库、对象存储、网关 | `docs/operations/production-data-integration-runbook.md` |
| 做平台库 migration | `docs/operations/production-migration-runbook.md` |
| 记录真实验证证据 | `docs/operations/production-live-evidence-template.md` |
