# 生产数据接入 runbook

本文说明统一导出平台后续接入生产依赖时应该怎么接。当前已通过的验收报告只覆盖本机 Docker MySQL、本地 object storage mock、受控测试数据和 production-equivalent adapter；接入真实生产 MySQL、业务只读数据源、对象存储和网关认证时，必须单独形成 live evidence。

## 接入范围

生产接入分成五条边界，不能混在一起验收。所有运行配置先进入 `src/config/env.ts` 的 `loadConfig()`，再由具体模块消费配置对象；业务模块不得新增散落的环境变量读取。

| 边界 | 用途 | 当前代码入口 | 生产接入要求 |
| --- | --- | --- | --- |
| 平台库 | 保存任务、注册配置、锁、检查点、文件元信息、审计日志 | `src/config/env.ts`、`src/db/`、`migrations/` | 使用生产 MySQL 或等价关系型数据库，先备份再执行 migration |
| 业务只读数据源 | 查询导出数据 | `src/datasource-adapters/index.ts`、`src/query-executor/index.ts` | 使用只读账号，按 `datasourceCode` 白名单映射，禁止写权限 |
| 对象存储 | 临时文件、发布文件、下载 URL | `src/file-service/index.ts`、`scripts/object-storage-live-smoke.mjs` | endpoint 必须支持当前 HTTP adapter 语义，或先实现 native OSS/S3 adapter |
| 认证网关 | 传入操作者、租户、角色、组织范围 | `src/audit-log/auth-context.ts` | 网关生成 HMAC-SHA256 auth context 签名头 |
| Worker / cleanup | 异步执行、续租、清理过期文件 | `src/workers/scheduler-worker.ts`、`src/jobs/cleanup-job.ts` | 独立进程运行，连接同一平台库和同一外部依赖 |

## 接入前提

上线前先确认这些条件满足：

- 平台库账号具备建表/迁移权限，运行期账号至少具备平台表读写权限。
- 每个业务数据源只提供只读账号，不允许 `INSERT`、`UPDATE`、`DELETE`、DDL 或存储过程执行权限。
- 业务数据源网络只允许导出平台访问，优先通过内网、安全组或数据库白名单限制。
- 对象存储 bucket 使用独立前缀，例如 `exports/prod/`；smoke 测试前缀使用独立路径，例如 `release-smoke/`。
- 网关和导出平台共享 `EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET`，密钥走部署平台 secret 管理，不写入仓库。
- 下载 URL 签名密钥 `EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET` 必须独立于网关签名密钥。
- 当前 auth context 只有时间窗口新鲜度校验，没有 nonce 防重放存储；如果生产要求一次性请求防重放，需要新增任务实现 nonce store。

## 环境变量

示例只展示占位符，实际值放到部署平台 secret 或运行时环境变量，不提交到仓库。

```powershell
# HTTP
$env:EXPORT_PLATFORM_ENVIRONMENT = "production"
$env:EXPORT_PLATFORM_HOST = "0.0.0.0"
$env:EXPORT_PLATFORM_PORT = "3000"
$env:EXPORT_PLATFORM_PUBLIC_BASE_URL = "https://<export-platform-public-host>"

# 平台库：二选一，优先 DATABASE_URL
$env:EXPORT_PLATFORM_DATABASE_URL = "mysql://<platform_user>:<platform_password>@<platform_host>:3306/<platform_db>?ssl=true"
# 或拆分配置
$env:EXPORT_PLATFORM_MYSQL_HOST = "<platform_host>"
$env:EXPORT_PLATFORM_MYSQL_PORT = "3306"
$env:EXPORT_PLATFORM_MYSQL_DATABASE = "<platform_db>"
$env:EXPORT_PLATFORM_MYSQL_USER = "<platform_user>"
$env:EXPORT_PLATFORM_MYSQL_PASSWORD = "<platform_password>"
$env:EXPORT_PLATFORM_MYSQL_SSL = "true"

# 业务只读数据源：datasourceCode=purchase-ro 时会读取 PURCHASE_RO
$env:EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL = "mysql://<readonly_user>:<readonly_password>@<business_host>:3306/<business_db>?ssl=true"

# 多数据源也可以统一放 JSON
$env:EXPORT_PLATFORM_DATASOURCES_JSON = '{"purchase-ro":{"url":"mysql://<readonly_user>:<readonly_password>@<business_host>:3306/<business_db>?ssl=true"}}'

# 对象存储。当前实现要求 endpoint/bucket 支持 HTTP PUT、read、publish copy 和下载 URL 访问语义。
$env:EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = "https://<object-storage-gateway>"
$env:EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = "<bucket>"
$env:EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX = "release-smoke"
$env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES = "true"
$env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE = "false"
$env:EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = "<download-url-signing-secret>"

# 认证网关签名
$env:EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET = "<auth-context-signing-secret>"
$env:EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS = "<tenant-001,tenant-002>"

# Worker / cleanup
$env:EXPORT_PLATFORM_WORKER_ID = "export-worker-prod-001"
$env:EXPORT_PLATFORM_CLEANUP_WORKER_ID = "export-cleanup-prod-001"
$env:EXPORT_PLATFORM_SCHEDULER_POLL_MS = "5000"
$env:EXPORT_PLATFORM_CLEANUP_POLL_MS = "60000"
```

`EXPORT_PLATFORM_ENVIRONMENT=production` 会启用 fail-fast：缺少必填 secret、对象存储 endpoint/bucket、公开 base URL、平台库 URL或完整拆分 MySQL 配置，或使用 localhost / `.local` / `.test` / `.invalid` endpoint 时会直接阻塞。生产 smoke 写入必须显式设置 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`，并使用独立 smoke prefix。

## 对象存储适配说明

`createObjectStorageFromEnv()` 当前不是 AWS S3 或阿里 OSS SDK adapter。它按以下 HTTP 语义工作：

- `PUT /{bucket}/{storageKey}` 写入临时对象。
- `GET /{bucket}/{storageKey}` 读取对象。
- `PUT /{bucket}/{publishedStorageKey}` 携带 `x-export-copy-source: {bucket}/{tempStorageKey}` 发布对象。
- `createDownloadUrl()` 在 URL 上附加 `expiresAt`、`signatureAlgorithm=HMAC-SHA256` 和 `signature`。

因此生产接入有两种选择：

1. 使用兼容上述 HTTP 语义的对象存储网关。
2. 新增 native OSS/S3 adapter，并保留 `putObject`、`readObject`、`publishObject`、`createDownloadUrl` 这四个接口契约。

不能只把真实 OSS/S3 endpoint 填到 `EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT` 后就声明 live OSS/S3 已验证。

## 注册生产导出配置

接入业务数据前，先通过 registry API 注册或更新任务配置。配置里的 `datasourceCode` 必须能映射到上面的只读数据源环境变量。

最小示例：

```json
{
  "taskCode": "purchase-order-export",
  "subsystemCode": "purchase",
  "displayName": "采购订单导出",
  "enabled": true,
  "concurrencyLimit": 2,
  "fileRetentionDays": 15,
  "taskHistoryRetentionDays": 90,
  "singleFileMaxRows": 20000,
  "exportMaxRows": 100000,
  "supportedFormats": ["XLSX", "ZIP"],
  "datasourceCode": "purchase-ro",
  "parameterSchema": {
    "type": "object",
    "required": ["createdAtFrom", "createdAtTo"],
    "additionalProperties": false,
    "properties": {
      "createdAtFrom": { "type": "string" },
      "createdAtTo": { "type": "string" },
      "orderStatus": { "type": "string" },
      "supplierId": { "type": "string" },
      "purchaseOrgId": { "type": "string" },
      "keyword": { "type": "string" }
    }
  },
  "queryTemplate": {
    "queryTemplateVersion": "purchase-order-v1",
    "templateText": "SELECT order_id, order_no, supplier_name, purchaser_phone, created_at FROM purchase_orders_view WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo",
    "allowedParameters": ["createdAtFrom", "createdAtTo", "orderStatus", "supplierId", "purchaseOrgId", "keyword"]
  },
  "fieldMappings": [
    {
      "fieldCode": "order_no",
      "headerName": "订单号",
      "fieldType": "STRING",
      "orderNo": 1,
      "sensitive": false,
      "exportable": true
    },
    {
      "fieldCode": "purchaser_phone",
      "headerName": "采购人手机号",
      "fieldType": "STRING",
      "orderNo": 2,
      "sensitive": true,
      "exportable": true,
      "maskingRuleCode": "phone_mask"
    }
  ],
  "maskingPolicy": {
    "rules": {
      "phone_mask": {
        "type": "PHONE",
        "preservePrefix": 3,
        "preserveSuffix": 4
      }
    }
  },
  "dataScopeTemplate": "tenant_id = :tenantId AND org_id IN (:orgScope)",
  "cursorField": "order_id",
  "orderBy": [
    { "field": "order_id", "direction": "ASC" }
  ],
  "batchSize": 500
}
```

注意：

- `templateText` 必须是只读 `SELECT`，不能包含 DML、DDL、存储过程或动态拼接调用方原始 SQL。
- `allowedParameters` 必须覆盖模板参数，不能允许未声明参数进入执行。
- `dataScopeTemplate` 必须把 `tenantId`、`orgScope` 等权限范围叠加到查询条件里。
- 敏感字段必须在 `fieldMappings` 标记 `sensitive=true`，并在 `maskingPolicy.rules` 提供可执行脱敏规则。

## 启动顺序

1. 在生产平台库执行 migration。当前仓库提供 `src/db/migrator.ts`，生产部署应提供受控 migration job 或一次性初始化任务。
2. 配置环境变量和 secret。
3. 启动 HTTP 服务：

```powershell
npm run start
```

4. 启动 scheduler worker：

```powershell
npm run worker:scheduler
```

5. 启动 cleanup job：

```powershell
npm run job:cleanup
```

6. 通过 registry API 注册或更新导出配置。
7. 用小范围查询参数创建导出任务，确认任务从 `PENDING` 到 `COMPLETED`，并能下载文件。

## Live 验证流程

建议按以下顺序做，不要一开始就用全量生产数据：

| 阶段 | 目标 | 验证 |
| --- | --- | --- |
| L1 平台库预检 | migration、连接池、平台表读写 | `npm run arch:check`，再用生产等价环境执行 DB smoke |
| L2 业务只读源预检 | `datasourceCode` 能解析，只读账号可查询 | 使用只读账号执行最小 `SELECT 1` 和业务视图小范围查询 |
| L3 对象存储 smoke | put/read/publish/download URL 可用 | 设置真实 endpoint/bucket 后运行 `npm run test:object-storage-live`，必须使用独立 smoke prefix |
| L4 API 黑盒验收 | 网关签名、registry、create/list/detail/cancel/retry | 用真实网关或等价签名客户端调用 OpenAPI 公开接口 |
| L5 Worker 全链路 | 查询、脱敏、分片、文件发布、审计串联 | 创建小范围任务，检查 `taskId`、`attemptNo`、`checkpoint`、`storageKey`、`audit` |
| L6 边界压测 | 空数据、1 行、阈值边界、超过上限、数据源不可用 | 对齐 `docs/product/acceptance-criteria.md` 的 P0/P1 场景 |

当前已有命令中，`npm run test:acceptance:full-report` 仍是 docker/mock 全量验收，不会自动证明外部生产依赖通过。接入生产依赖后，应新增专项 task，例如 `PRODUCTION-LIVE-INTEGRATION-001`，把 live 环境、命令、退出码、时间、证据边界写入 `docs/testing/verify-matrix.md` 或新的 live 报告。

生产部署变量清单、secret 分类和配置后验证步骤见 `docs/operations/production-deployment-config-runbook.md`。

## 手动验收清单

接生产数据后，至少人工抽查这些点：

- 注册配置读取到的 `datasourceCode` 与实际环境变量映射一致。
- 只读账号尝试写操作会失败，平台执行导出时只产生 SELECT。
- 创建任务时，缺少 HMAC 签名会返回 401。
- 使用不在 `EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS` 内的租户不能注册或修改配置。
- 导出结果包含预期字段顺序。
- 敏感字段已经脱敏，原始手机号、姓名等敏感值不出现在文件中。
- 下载 URL 过期后不可访问，篡改 `signature` 后不可访问。
- 任务失败时 public API 只返回安全错误码，不泄露数据库连接串、SQL、密码或对象存储内部路径。
- 取消、失败重试、worker 重启和租约接管后，`attemptNo`、checkpoint、audit 能串联。

## 失败处理

常见失败不要直接跳过：

- `DATASOURCE_UNAVAILABLE`: 检查 datasourceCode 映射、只读账号、网络白名单、SSL、数据库权限。
- `QUERY_TEMPLATE_INVALID`: 检查参数 schema、模板参数、禁用 SQL 关键字、字段映射和 cursor/orderBy。
- `MASKING_RULE_ERROR`: 检查敏感字段是否有 `maskingRuleCode`，以及规则类型是否受支持。
- `FILE_VERIFY_ERROR`: 检查对象存储 put/read/publish 权限、bucket、prefix、网关 copy 语义。
- `SIGNATURE_INVALID` / `AUTH_CONTEXT_MISSING`: 检查网关签名原文、签名密钥、issuedAt 时间偏差和请求头大小。

## Evidence 规则

生产接入完成声明必须包含：

- 使用的环境类型：staging、pre-prod 或 production。
- 不含 secret 的依赖清单：平台库、业务只读源、对象存储、网关。
- registry 配置摘要：`taskCode`、`datasourceCode`、模板版本、字段映射摘要、脱敏策略摘要。
- 成功态证据：任务创建、执行完成、文件发布、下载成功、审计可追溯。
- 失败态证据：无签名、无权限、数据源不可用、对象存储失败或等价受控失败。
- 明确未覆盖项：例如生产大流量压测、nonce 防重放、跨地域容灾、真实 OSS/S3 native adapter。

不能把 docker/mock、本地 demo 或旧报告升级为生产 live evidence。
