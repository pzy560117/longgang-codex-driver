# Docker 完整集成链路测试方案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前“本地自动测试入口”升级为真正的完整 Docker 集成链路环境，能够在 Docker 中运行 `HTTP + scheduler + cleanup + MySQL + MinIO + 业务只读数据源/签名链路`，并提供黑盒验收入口。

**Architecture:** 保留当前 `test:docker-local` 作为“自动化验证入口”，新增一套长期运行的 Docker 集成栈和独立的黑盒集成测试入口。集成栈必须以真实进程边界运行 3 个服务进程，并通过真实协议连接 MySQL、MinIO 和只读数据源，而不是依赖内存替身或测试专用 mock server。

**Tech Stack:** Node.js 22、TypeScript、Fastify、Kysely、MySQL 8.4、MinIO、Docker Compose、PowerShell 启动脚本、Node test runner

---

## 文件结构

**Create:**
- `docker-compose.integration.yml`
- `docker/integration/http.Dockerfile`
- `docker/integration/worker.Dockerfile`
- `docker/integration/cleanup.Dockerfile`
- `scripts/integration-stack.ps1`
- `scripts/integration-seed.mjs`
- `scripts/integration-smoke.mjs`
- `scripts/integration-auth-client.mjs`
- `tests/integration/export-platform.integration.test.mjs`
- `docs/testing/integration-stack-runbook.md`

**Modify:**
- `package.json`
- `src/config/env.ts`
- `docs/testing/verify-matrix.md`
- `docs/operations/production-deployment-tutorial.md`
- `task.json`

**Responsibilities:**
- `docker-compose.integration.yml`
  定义完整运行时拓扑，不是单测辅助容器。
- `docker/integration/*.Dockerfile`
  给 `http`、`scheduler`、`cleanup` 提供独立镜像入口。
- `scripts/integration-stack.ps1`
  负责启动、停止、清理和环境检查。
- `scripts/integration-seed.mjs`
  初始化平台库、业务只读库、registry 和受控数据。
- `scripts/integration-smoke.mjs`
  黑盒验证主流程和失败态。
- `scripts/integration-auth-client.mjs`
  生成可信签名请求，避免手工拼 header。
- `tests/integration/export-platform.integration.test.mjs`
  在完整 Docker 栈上执行自动黑盒链路。
- `docs/testing/integration-stack-runbook.md`
  记录人工执行路径和证据边界。

### Task 1: 定义完整 Docker 集成栈拓扑

**Files:**
- Create: `docker-compose.integration.yml`
- Modify: `docs/testing/verify-matrix.md`
- Test: 无代码测试，先做结构定义检查

- [ ] **Step 1: 写出集成栈 compose 草案**

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: export-platform-integration-mysql
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: "yes"
      MYSQL_DATABASE: export_platform_integration
    ports:
      - "127.0.0.1:43306:3306"

  business-mysql:
    image: mysql:8.4
    container_name: export-platform-business-mysql
    environment:
      MYSQL_ALLOW_EMPTY_PASSWORD: "yes"
      MYSQL_DATABASE: purchase_readonly
    ports:
      - "127.0.0.1:43307:3306"

  minio:
    image: minio/minio:latest
    container_name: export-platform-integration-minio
    environment:
      MINIO_ROOT_USER: export-platform
      MINIO_ROOT_PASSWORD: export-platform-secret
    command: server /data --console-address ":9001"
    ports:
      - "127.0.0.1:49000:9000"
      - "127.0.0.1:49001:9001"

  http:
    build:
      context: .
      dockerfile: docker/integration/http.Dockerfile
    depends_on:
      - mysql
      - minio
      - business-mysql
    ports:
      - "127.0.0.1:43000:3000"

  scheduler:
    build:
      context: .
      dockerfile: docker/integration/worker.Dockerfile
    depends_on:
      - mysql
      - minio
      - business-mysql

  cleanup:
    build:
      context: .
      dockerfile: docker/integration/cleanup.Dockerfile
    depends_on:
      - mysql
      - minio
```

- [ ] **Step 2: 明确每个容器的职责和协议边界**

Run: 无  
Expected: 文档中写明以下边界
- `mysql`: 平台库
- `business-mysql`: 业务只读库
- `minio`: 文件存储
- `http`: API 入口
- `scheduler`: 异步执行
- `cleanup`: 清理作业

- [ ] **Step 3: 更新 verify-matrix，增加 integration stack 入口**

```md
| Docker integration stack | `npm run stack:integration` / `npm run test:integration-live` | `DOCKER-INTEGRATION-STACK-001` | FR-001 - FR-014 | Docker MySQL + Docker MinIO + Docker business MySQL + 3 进程真实运行 | 证明完整部署形态可运行；不是外部云 live evidence，但高于 docker/mock 单命令验证 |
```

- [ ] **Step 4: 运行格式验证**

Run: `git diff --check -- docker-compose.integration.yml docs/testing/verify-matrix.md`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add docker-compose.integration.yml docs/testing/verify-matrix.md
git commit -m "test: define docker integration stack topology"
```

### Task 2: 为三个运行进程提供独立镜像入口

**Files:**
- Create: `docker/integration/http.Dockerfile`
- Create: `docker/integration/worker.Dockerfile`
- Create: `docker/integration/cleanup.Dockerfile`
- Modify: `package.json`
- Test: `npm run typecheck`

- [ ] **Step 1: 写 HTTP Dockerfile**

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]
```

- [ ] **Step 2: 写 scheduler Dockerfile**

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "tsx", "src/workers/scheduler-worker.ts"]
```

- [ ] **Step 3: 写 cleanup Dockerfile**

```dockerfile
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "tsx", "src/jobs/cleanup-job.ts"]
```

- [ ] **Step 4: 在 `package.json` 增加集成入口**

```json
{
  "scripts": {
    "stack:integration": "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\integration-stack.ps1 -Up",
    "stack:integration:down": "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\integration-stack.ps1 -Down",
    "test:integration-live": "node --import tsx --test --test-concurrency=1 tests/integration/*.test.mjs"
  }
}
```

- [ ] **Step 5: 跑类型检查确认无破坏**

Run: `npm run typecheck`  
Expected: `tsc --noEmit` exit 0

- [ ] **Step 6: Commit**

```bash
git add docker/integration package.json
git commit -m "build: add docker image entries for integration stack"
```

### Task 3: 提供集成栈启动/停止脚本

**Files:**
- Create: `scripts/integration-stack.ps1`
- Test: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration-stack.ps1 -CheckOnly`

- [ ] **Step 1: 写参数结构**

```powershell
param(
  [switch]$Up,
  [switch]$Down,
  [switch]$CheckOnly,
  [string]$ComposeFile = "docker-compose.integration.yml"
)
```

- [ ] **Step 2: 写 compose 封装**

```powershell
function Invoke-Compose {
  param([string[]]$Arguments)

  & docker compose -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose failed: $($Arguments -join ' ')"
  }
}
```

- [ ] **Step 3: 写健康检查逻辑**

```powershell
function Wait-HttpHealth {
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod "http://127.0.0.1:43000/health" | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "BLOCKED - 需要人工介入: integration stack HTTP health check timeout."
}
```

- [ ] **Step 4: 写执行入口**

```powershell
if ($CheckOnly) {
  Invoke-Compose @("config")
  exit 0
}

if ($Down) {
  Invoke-Compose @("down", "-v")
  exit 0
}

if ($Up) {
  Invoke-Compose @("up", "-d", "--build")
  Wait-HttpHealth
  Write-Output "integration stack ready."
  exit 0
}

throw "Specify -Up, -Down, or -CheckOnly."
```

- [ ] **Step 5: 跑脚本语法和 compose 配置检查**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration-stack.ps1 -CheckOnly`  
Expected: compose config resolve 成功

- [ ] **Step 6: Commit**

```bash
git add scripts/integration-stack.ps1
git commit -m "test: add integration stack lifecycle script"
```

### Task 4: 初始化平台库和业务只读库

**Files:**
- Create: `scripts/integration-seed.mjs`
- Modify: `src/config/env.ts`
- Test: `node --import tsx scripts/integration-seed.mjs`

- [ ] **Step 1: 连接两个 MySQL**

```js
const platformUrl = process.env.EXPORT_PLATFORM_DATABASE_URL;
const readonlyUrl = process.env.EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL;
```

- [ ] **Step 2: 复用 migration**

```js
await runMigrations(platformDb);
```

- [ ] **Step 3: 初始化业务只读表和视图**

```js
await readonlyDb.schema
  .createTable("purchase_orders_sample")
  .ifNotExists()
  .addColumn("order_id", "varchar(64)", (col) => col.primaryKey())
  .addColumn("tenant_id", "varchar(128)", (col) => col.notNull())
  .addColumn("org_id", "varchar(128)", (col) => col.notNull())
  .addColumn("order_no", "varchar(128)", (col) => col.notNull())
  .addColumn("contact_phone", "varchar(64)", (col) => col.notNull())
  .addColumn("created_at", "datetime(3)", (col) => col.notNull())
  .execute();
```

- [ ] **Step 4: seed 真实协议数据**

```js
for (let i = 0; i < 10000; i += 1) {
  rows.push({
    order_id: `integration-order-${String(i + 1).padStart(6, "0")}`,
    tenant_id: "tenant-001",
    org_id: i % 2 === 0 ? "ORG-001" : "ORG-002",
    order_no: `INT-PO-${String(i + 1).padStart(6, "0")}`,
    contact_phone: `138${String(10000000 + i).slice(-8)}`,
    created_at: new Date(`2026-05-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`)
  });
}
```

- [ ] **Step 5: 注册 `purchase-order-export` registry 到平台库**

```js
await upsertExportRegistry(
  {
    operatorId: "integration-admin",
    tenantId: "tenant-001",
    roleCodes: ["EXPORT_ADMIN"],
    orgScope: "ORG-001,ORG-002",
    requestId: "req-integration-registry"
  },
  registryPayload
);
```

- [ ] **Step 6: 跑一次 seed**

Run: `node --import tsx scripts/integration-seed.mjs`  
Expected: 输出 `integration seed ready`

- [ ] **Step 7: Commit**

```bash
git add scripts/integration-seed.mjs src/config/env.ts
git commit -m "test: add integration database seed flow"
```

### Task 5: 提供签名客户端，模拟真实网关请求

**Files:**
- Create: `scripts/integration-auth-client.mjs`
- Test: `node --import tsx scripts/integration-auth-client.mjs`

- [ ] **Step 1: 定义签名输入**

```js
const auth = {
  operatorId: "u001",
  tenantId: "tenant-001",
  roleCodes: ["EXPORT_USER"],
  orgScope: "ORG-001,ORG-002",
  requestId: `req-${Date.now()}`
};
```

- [ ] **Step 2: 生成 header**

```js
const issuedAt = new Date().toISOString();
const payload = [auth.operatorId, auth.tenantId, auth.roleCodes.join(","), auth.orgScope, auth.requestId, issuedAt].join("\n");
const signature = createHmac("sha256", process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET)
  .update(payload)
  .digest("hex");
```

- [ ] **Step 3: 输出可直接用于 fetch 的 header 对象**

```js
console.log(JSON.stringify({
  "x-operator-id": auth.operatorId,
  "x-tenant-id": auth.tenantId,
  "x-role-codes": auth.roleCodes.join(","),
  "x-org-scope": auth.orgScope,
  "x-request-id": auth.requestId,
  "x-auth-context-issued-at": issuedAt,
  "x-auth-context-signature-algorithm": "HMAC-SHA256",
  "x-auth-context-signature": signature
}, null, 2));
```

- [ ] **Step 4: 运行脚本验证输出**

Run: `node --import tsx scripts/integration-auth-client.mjs`  
Expected: 输出完整 header JSON

- [ ] **Step 5: Commit**

```bash
git add scripts/integration-auth-client.mjs
git commit -m "test: add integration auth signing client"
```

### Task 6: 实现黑盒 smoke 脚本

**Files:**
- Create: `scripts/integration-smoke.mjs`
- Test: `node --import tsx scripts/integration-smoke.mjs`

- [ ] **Step 1: 健康检查**

```js
const health = await fetch("http://127.0.0.1:43000/health");
if (!health.ok) throw new Error("health check failed");
```

- [ ] **Step 2: 创建任务**

```js
const createResp = await fetch("http://127.0.0.1:43000/api/export/tasks", {
  method: "POST",
  headers,
  body: JSON.stringify({
    taskCode: "purchase-order-export",
    subsystemCode: "purchase",
    fileFormat: "XLSX",
    clientRequestId: `integration-${Date.now()}`,
    queryParams: {
      createdAtFrom: "2026-05-01T00:00:00.000Z",
      createdAtTo: "2026-05-31T23:59:59.000Z"
    }
  })
});
```

- [ ] **Step 3: 轮询详情直到完成**

```js
for (let i = 0; i < 60; i += 1) {
  const detail = await fetch(`http://127.0.0.1:43000/api/export/tasks/${taskId}`, { headers });
  const payload = await detail.json();
  if (payload.data.status === "COMPLETED") break;
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
```

- [ ] **Step 4: 下载文件并校验非空**

```js
const download = await fetch(`http://127.0.0.1:43000/api/export/tasks/${taskId}/download`, { headers });
const downloadPayload = await download.json();
if (!downloadPayload.data.downloadUrl) throw new Error("missing download url");
```

- [ ] **Step 5: 追加失败态 smoke**

```js
const unauthResp = await fetch("http://127.0.0.1:43000/api/export/tasks", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ taskCode: "purchase-order-export", subsystemCode: "purchase", fileFormat: "XLSX", queryParams: {} })
});
if (unauthResp.status !== 401) throw new Error("expected 401 for missing signature");
```

- [ ] **Step 6: 运行脚本**

Run: `node --import tsx scripts/integration-smoke.mjs`  
Expected: 输出 `integration smoke passed`

- [ ] **Step 7: Commit**

```bash
git add scripts/integration-smoke.mjs
git commit -m "test: add integration smoke scenario"
```

### Task 7: 写自动黑盒集成测试

**Files:**
- Create: `tests/integration/export-platform.integration.test.mjs`
- Modify: `package.json`
- Test: `npm run test:integration-live`

- [ ] **Step 1: 写测试骨架**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("integration stack completes export task end-to-end", async () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/integration-smoke.mjs"],
    { encoding: "utf8", cwd: new URL("../../", import.meta.url) }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /integration smoke passed/u);
});
```

- [ ] **Step 2: 增加一个失败态测试**

```js
test("integration stack rejects unsigned requests", async () => {
  const response = await fetch("http://127.0.0.1:43000/api/export/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      taskCode: "purchase-order-export",
      subsystemCode: "purchase",
      fileFormat: "XLSX",
      queryParams: {}
    })
  });

  assert.equal(response.status, 401);
});
```

- [ ] **Step 3: 配置 package script**

```json
{
  "scripts": {
    "test:integration-live": "node --import tsx --test --test-concurrency=1 tests/integration/*.test.mjs"
  }
}
```

- [ ] **Step 4: 在 integration stack 已启动时执行测试**

Run: `npm run test:integration-live`  
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add tests/integration/export-platform.integration.test.mjs package.json
git commit -m "test: add black-box integration test entry"
```

### Task 8: 写人工执行 runbook 和证据边界

**Files:**
- Create: `docs/testing/integration-stack-runbook.md`
- Modify: `docs/testing/verify-matrix.md`
- Modify: `docs/operations/production-deployment-tutorial.md`

- [ ] **Step 1: 写 runbook 标题和定位**

```md
# Docker 完整集成栈运行手册

本手册对应完整 Docker 集成环境，不是外部生产 live evidence，但高于本地 mock/demo。
```

- [ ] **Step 2: 写启动命令**

```md
## 启动

```powershell
npm run stack:integration
node --import tsx scripts/integration-seed.mjs
npm run test:integration-live
```
```

- [ ] **Step 3: 写人工检查项**

```md
- `/health` 返回 `status=ok`
- `POST /api/export/tasks` 返回 `PENDING`
- 任务最终进入 `COMPLETED`
- 下载 URL 可访问
- 文件内容非空且脱敏生效
- 缺签名请求返回 `401`
```

- [ ] **Step 4: 更新 verify-matrix 的层级说明**

```md
- `demo:local`: 人工演示
- `test:docker-local`: 自动化闭环验证
- `stack:integration` + `test:integration-live`: 真实 Docker 运行态验证
- `PRODUCTION-LIVE-INTEGRATION-001`: 外部或目标交付环境验证
```

- [ ] **Step 5: 更新生产部署教程的环境层次说明**

```md
如果目标系统的“真实依赖”本身由 Docker 自托管提供，则应先通过完整 Docker 集成栈验证，再进入 live evidence 归档。
```

- [ ] **Step 6: 运行文档检查**

Run: `git diff --check -- docs/testing/integration-stack-runbook.md docs/testing/verify-matrix.md docs/operations/production-deployment-tutorial.md`  
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add docs/testing/integration-stack-runbook.md docs/testing/verify-matrix.md docs/operations/production-deployment-tutorial.md
git commit -m "docs: document docker integration validation flow"
```

### Task 9: 把任务入口落到 task.json

**Files:**
- Modify: `task.json`
- Test: `powershell -NoProfile -Command "Get-Content -Raw task.json | ConvertFrom-Json | Out-Null"`

- [ ] **Step 1: 新增任务定义**

```json
{
  "id": "DOCKER-INTEGRATION-STACK-001",
  "description": "通过完整 Docker 集成栈验证 HTTP、scheduler、cleanup、MySQL、MinIO 和业务只读数据源链路",
  "task_kind": "integration",
  "phase": "integration",
  "passes": false
}
```

- [ ] **Step 2: 写 architecture_constraints**

```json
[
  "必须以独立 Docker 容器运行 HTTP、scheduler、cleanup，不得退回单进程 mock",
  "必须使用真实 MySQL、真实 MinIO、真实只读 datasource 协议，不得用内存替身冒充",
  "必须覆盖成功态和失败态"
]
```

- [ ] **Step 3: 写 test_command**

```json
"test_command": "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\integration-stack.ps1 -Up; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; node --import tsx scripts/integration-seed.mjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run test:integration-live; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git diff --check -- task.json docs/testing docs/operations scripts tests/integration docker-compose.integration.yml docker/integration"
```

- [ ] **Step 4: 验证 task.json 结构**

Run: `powershell -NoProfile -Command "Get-Content -Raw task.json | ConvertFrom-Json | Out-Null"`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add task.json
git commit -m "chore: add docker integration task entry"
```

## 自检

**Spec coverage**
- 第三层“不是外部云，而是在 Docker 中创建全部真实内容”已覆盖：
  - 完整容器拓扑
  - 真实进程边界
  - 真实 MySQL / MinIO / 只读数据源
  - 黑盒 smoke
  - 自动化 integration test
  - 文档和 task 入口

**Placeholder scan**
- 没有 `TODO/TBD`
- 每个任务都给了具体文件、命令和代码骨架

**Type consistency**
- 统一使用：
  - `stack:integration`
  - `test:integration-live`
  - `integration-seed.mjs`
  - `integration-smoke.mjs`
