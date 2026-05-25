# Docker 集成栈运行手册

本文描述统一导出平台 Docker 集成栈的测试层级定位、运行入口和证据边界。它只回答“这套栈属于哪一层、从哪里启动、能证明什么、不能证明什么”，不补充新的业务事实。

## 1. 目的

- 明确 Docker 集成栈在测试体系中的位置。
- 说明各个运行入口对应的验证边界。
- 统一区分 `docker/mock` 证据、local rehearsal 证据和 live evidence。

## 2. 测试层级定位

Docker 集成栈用于承接本机或容器化环境下的集成验证，通常覆盖以下层级：

| 层级 | 关注点 | 典型入口 | 证据边界 |
| --- | --- | --- | --- |
| contract | OpenAPI、路由、参数和错误码一致性 | `npm run test:contract` | 只证明契约和映射，不证明外部真实依赖 |
| api | HTTP 接口与认证、审计、状态机联动 | `npm run test:api` | 只证明 API 行为，不自动升级为 live evidence |
| db | schema、migration、repository 持久化 | `npm run test:db` | 只证明本机或 Docker MySQL 可用 |
| worker | 调度、租约、重试、cleanup | `npm run test:worker` | 只证明 worker 入口和 DB 边界 |
| query | 查询执行、数据范围、脱敏和错误映射 | `npm run test:query` | 只证明受控数据源或测试替身边界 |
| file | 文件服务、对象存储协议链路、下载签名 | `npm run test:file` | 只证明 production-equivalent adapter 或 mock 边界 |
| sample | 端到端样板契约 | `npm run test:sample` | 只证明样板链路可执行，不替代 live evidence |
| docker/mock | 本机容器化综合验证 | `npm run test:docker-local` | 只证明本机 Docker MySQL / MinIO 受控链路 |

## 3. 运行入口

### 3.1 单项入口

按层级分别执行时，优先使用矩阵或任务中声明的最小相关命令：

```powershell
npm run test:contract
npm run test:api
npm run test:db
npm run test:worker
npm run test:query
npm run test:file
npm run test:sample
```

### 3.2 Docker 集成入口

当需要一次性跑通本机容器化集成链路时，使用：

```powershell
npm run test:docker-local
```

该入口通常由本机 Docker MySQL、Docker MinIO、受控种子数据和一组联动测试组成。实际执行内容以仓库脚本和测试命令为准。

### 3.3 完整 Docker 集成栈入口

当需要以真实进程边界运行 `HTTP + scheduler + cleanup + 平台 MySQL + 业务只读 MySQL + MinIO` 时，使用：

```powershell
npm run stack:integration
node --import tsx scripts/integration-seed.mjs
npm run test:integration-live
```

该入口要求：

- `docker-compose.integration.yml` 可解析并成功启动；
- 平台库与业务只读库都能连通；
- MinIO bucket 可初始化并可读写；
- 黑盒链路可以完成 `create -> execute -> download`；
- 未签名请求返回 `401`。

### 3.4 手动测试完整链路

当需要人工完整验证“发起导出 -> worker 执行 -> MinIO 落盘 -> 下载表格”时，按下面顺序执行。

#### Step 1. 启动完整环境

```powershell
npm run stack:integration
node --import tsx scripts/integration-seed.mjs
```

期望：

- `http://127.0.0.1:43000/health` 返回 `status=ok`
- `http://127.0.0.1:49001` 的 MinIO 控制台可打开

#### Step 2. 生成认证头

```powershell
node --import tsx scripts/integration-auth-client.mjs
```

脚本会输出一组请求头，手动测试时需要带上：

- `x-operator-id`
- `x-tenant-id`
- `x-role-codes`
- `x-org-scope`
- `x-request-id`
- `x-auth-context-issued-at`
- `x-auth-context-signature-algorithm`
- `x-auth-context-signature`

#### Step 3. 发起导出任务

```powershell
$headers = @{
  "x-operator-id" = "u001"
  "x-tenant-id" = "tenant-001"
  "x-role-codes" = "EXPORT_USER"
  "x-org-scope" = "ORG-001,ORG-002"
  "x-request-id" = "req-manual-001"
  "x-auth-context-issued-at" = "<integration-auth-client 输出值>"
  "x-auth-context-signature-algorithm" = "HMAC-SHA256"
  "x-auth-context-signature" = "<integration-auth-client 输出值>"
  "content-type" = "application/json"
}

$body = @{
  taskCode = "purchase-order-export"
  subsystemCode = "purchase"
  fileFormat = "XLSX"
  clientRequestId = "manual-001"
  queryParams = @{
    createdAtFrom = "2026-05-01T00:00:00.000Z"
    createdAtTo   = "2026-05-31T23:59:59.000Z"
  }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:43000/api/export/tasks" -Headers $headers -Body $body
```

期望：

- 返回 `PENDING`
- 记录 `taskId`

#### Step 4. 轮询任务状态

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:43000/api/export/tasks/<taskId>" -Headers $headers
```

期望：

- 状态从 `PENDING -> EXECUTING -> COMPLETED`

若长时间未完成，查看：

```powershell
docker logs export-platform-integration-scheduler --tail 200
```

#### Step 5. 获取下载地址并下载表格

```powershell
$meta = Invoke-RestMethod -Uri "http://127.0.0.1:43000/api/export/tasks/<taskId>/download" -Headers $headers
$meta.data.downloadUrl
Invoke-WebRequest -Uri $meta.data.downloadUrl -OutFile "manual-export.xlsx"
```

期望：

- 能拿到 `downloadUrl`
- 文件下载成功
- 文件非空

自动化链路默认把下载样本保存到：

- [tests/integration/artifacts](/E:/2026/alpha-project/longgang-codex-driver/tests/integration/artifacts)

也就是说：

- `npm run test:integration-live`
- `npm run test:integration-performance`

都会把真实下载到的导出文件自动落到这个目录。

#### Step 6. 在 MinIO 中核对对象

- MinIO 控制台：`http://127.0.0.1:49001`
- 用户名：`export-platform`
- 密码：`export-platform-secret`
- bucket：`export-platform-integration`

期望：

- 能看到 `exports/purchase/purchase-order-export/...` 下的对象

#### Step 7. 在平台库核对文件元数据

```powershell
docker exec export-platform-integration-mysql mysql -uroot -D export_platform_integration -e "SELECT task_id, file_name, published_storage_key, published_at FROM export_task_files ORDER BY created_at DESC LIMIT 10;"
```

期望：

- 能看到刚才任务的 `published_storage_key`

#### Step 8. 失败态最少手工测一条

不带任何 `x-auth-context-*` 头重新发起导出：

期望：

- 返回 `401`

## 4. 证据边界

- `docker/mock` 证据只能证明本机容器化环境下的集成链路。
- `local rehearsal` 证据只能证明本地演练路径可运行。
- `live evidence` 只能来自真实生产依赖接通后的受控验证。
- 任何 Docker 集成结果都不能自动升级为生产接入成功。
- 任何单项测试通过都不能替代完整的生产接入证据。

## 5. 使用规则

- 先按任务或矩阵确认需要哪一层验证，再选入口。
- 如果目标是生产接入，只能把 Docker 集成栈作为前置验证，不可当作最终结论。
- 如果某个依赖不可用，应记录 `BLOCKED - 需要人工介入`，不要用更低层的替身冒充通过。

## 6. Fresh Evidence（2026-05-22）

本轮已在本机执行并通过以下命令：

```powershell
npm run stack:integration
node --import tsx scripts/integration-seed.mjs
npm run test:integration-live
```

结果摘要：

- `stack:integration`：PASS，完整 Docker 栈成功启动
- `integration-seed.mjs`：PASS，平台库、业务只读库、registry 与 `10,000` 条样例数据初始化成功
- `test:integration-live`：PASS
  - `integration stack completes export task end-to-end`
  - `integration stack rejects unsigned requests`

本次完整重跑（fresh rerun）结果：

- 重新执行了：

```powershell
npm run stack:integration:down
npm run stack:integration
node --import tsx scripts/integration-seed.mjs
npm run test:integration-live
```

- fresh 结果：
  - `integration stack completes export task end-to-end`: `23.10s`
  - `integration stack rejects unsigned requests`: `PASS`

说明：

- 这组结果对应“发起导出 -> worker 执行 -> MinIO 落盘 -> 下载表格”的完整功能链路；
- 本次 fresh rerun 证明完整 Docker 集成环境在清场后可重复通过，而不是仅依赖之前的残留状态。

实际导出产物证据：

- `task_id`: `exp_2058531a-9e37-4483-b72c-cbfb6a385d58`
- `file_name`: `purchase-order-export-exp_2058531a-9e37-4483-b72c-cbfb6a385d58-attempt-0.xlsx`
- `published_storage_key`: `exports/purchase/purchase-order-export/20260522/exp_2058531a-9e37-4483-b72c-cbfb6a385d58/0/purchase-order-export-exp_2058531a-9e37-4483-b72c-cbfb6a385d58-attempt-0.xlsx`
- MinIO bucket: `export-platform-integration`
- MinIO 控制台: `http://127.0.0.1:49001`
- 本地样本文件: [purchase-order-export-exp_2058531a-9e37-4483-b72c-cbfb6a385d58-attempt-0.xlsx](/E:/2026/alpha-project/longgang-codex-driver/docs/testing/artifacts/purchase-order-export-exp_2058531a-9e37-4483-b72c-cbfb6a385d58-attempt-0.xlsx)

证据边界：

- 该结果证明本机完整 Docker 集成栈可运行，且高于 `test:docker-local` 的单命令聚合验证。
- 该结果仍然不是外部生产 live evidence，不声明外部生产 MySQL、外部 OSS/S3 或外部网关已验证。

## 7. 相关文档

- [验证矩阵](./verify-matrix.md)
- [生产部署教程](../operations/production-deployment-tutorial.md)
- [Docker 测试数据运行手册](./docker-test-data-runbook.md)
- [测试数据矩阵](./TEST_DATA_MATRIX.md)
