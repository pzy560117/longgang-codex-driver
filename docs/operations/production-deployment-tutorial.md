# 安装与生产部署主入口

本文是统一导出平台安装、接入和生产上线的唯一主入口。它同时回答“怎么把服务跑起来”和“怎么接真实生产依赖”，再把细节链接到配置、数据接入、migration 和 live evidence 附录。

当前仓库状态：已提供 HTTP 服务、scheduler worker、cleanup job 三个运行入口、统一配置入口、`db:migrate` 迁移命令和 systemd 三进程模板；尚未提供生产 `Dockerfile`、构建产物脚本或部署平台流水线。因此本文默认采用“部署平台拉取源码 + Node.js 22 + `npm ci` + 受控 migration + 三个独立进程”的可运行路径。若目标环境强制要求镜像、PM2、Kubernetes 或禁止 devDependencies 上生产，必须先完成对应硬化任务，再继续 production 放量。

## 0. 先理解要安装什么

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

如果只想先看效果，先走“本地试跑”。如果要上服务器，走“服务器安装”。如果要接生产，继续走后续真实依赖步骤。

## 0.1 本地试跑

适用场景：还没有生产数据库、对象存储和网关，只想确认项目能跑。

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

如果只跑 smoke：

```powershell
npm run demo:local:smoke
```

本地试跑会自动准备 Docker MySQL、本地 object storage mock、本地 HTTP 服务和演示测试数据。它只能证明开发链路能跑，不能当作生产接入证据。

## 0.2 最短生产安装路径

如果接手方只需要按源码部署方式把服务装到一台 Linux 主机，最短路径是：

1. 准备 Node.js 22+、npm、Git、MySQL 网络访问、对象存储 HTTP gateway、认证网关签名 secret。
2. 按第 1 步锁定部署 commit。
3. 按第 4 步克隆代码并执行 `npm ci`。
4. 按第 5 步配置环境变量和 secret。
5. 按第 6 步执行静态验证。
6. 按第 7 步执行 `npm run db:migrate -- list` 和 `npm run db:migrate`。
7. 按第 8 步启动 HTTP、scheduler、cleanup 三个独立进程。
8. 按第 9 至第 15 步完成健康检查、对象存储 smoke、小范围导出、失败态和 live evidence。

这条路径仍然不是“只复制命令就能生产上线”。第 3 步的配置收集、第 7 步的 DBA 备份、第 14 步的失败态证据都必须有负责人和记录。

## 0.3 术语和边界

| 项 | 本教程中的含义 |
| --- | --- |
| 目标环境 | staging、pre-prod 或 production。生产前必须至少先跑通 staging 或 pre-prod。 |
| 平台库 | 导出平台自己的 MySQL 库，保存任务、registry、lease、文件元信息和审计。 |
| 业务只读源 | 业务系统提供的只读数据源，按 `datasourceCode` 映射。 |
| 对象存储 | 当前代码使用 HTTP object storage gateway 语义，不等同于原生 OSS/S3 SDK。 |
| live evidence | 接入真实依赖后的成功态和失败态证据，不包括 Docker/mock、本地 demo 或 rehearsal。 |

## 0.4 安装成功和接入成功的区别

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

## 1. 锁定部署版本

输入：准备上线的 Git commit。

动作：

```powershell
git status --short
git rev-parse HEAD
git tag --points-at HEAD
```

通过标准：

- 工作区干净。
- 记录了 commit sha。
- 如果有发布 tag，tag 指向同一 commit。

失败处理：

- 工作区不干净时停止部署，先确认未提交改动是否属于本次上线。
- 不允许用“当前本地最新代码”替代明确 commit。

## 2. 确认生产部署门禁

输入：目标环境、部署方式、运维要求。

动作：逐项确认下表。

| 门禁 | 当前仓库状态 | 生产处理 |
| --- | --- | --- |
| Node.js 版本 | `package.json` 要求 `>=22` | 部署主机或运行镜像必须提供 Node.js 22+。 |
| 依赖安装 | 有 `package-lock.json` | 使用 `npm ci`，不要用 `npm install` 改锁文件。 |
| 构建产物 | 未提供 `build` 脚本 | 当前可运行路径依赖 `tsx`，需要安装 devDependencies；若禁止 devDependencies 上生产，先新增 build 任务。 |
| 镜像部署 | 未提供 `Dockerfile` | 若平台只接受镜像，先新增并验证 Dockerfile，不要临时手写镜像声明已上线。 |
| migration job | 已提供 `npm run db:migrate -- list` 和 `npm run db:migrate` | 按 `production-migration-runbook.md` 在受控变更窗口执行，不能绑定到 HTTP 服务启动。 |
| 进程守护 | 已提供 systemd 三进程模板 | 模板在 `deploy/systemd/`；若使用 PM2 / K8s / 平台进程组，必须等价配置三个独立进程和重启策略。 |
| 外部依赖 | 未声明 live 接通 | 必须形成 live evidence 后才能声明接入完成。 |

通过标准：

- 每个门禁都有明确结论：已满足、已接受临时路径、或已创建阻塞任务。
- 若任一 P0 门禁缺失且没有受控替代方案，停止 production 放量。

失败处理：

```text
BLOCKED - 需要人工介入: production 部署门禁 <gate> 未满足，不能继续声明生产上线。
```

## 3. 收集配置并脱敏确认

输入：`docs/operations/production-config-questionnaire.md`。

动作：

1. 复制问卷到受控工单或部署平台配置审批单。
2. 分别向 DBA、运维、网关、对象存储、业务系统负责人收集字段。
3. 真实 secret 只进入 secret manager 或部署平台 secret，不写入仓库。
4. 在仓库文档或验收记录里只保留脱敏摘要。

通过标准：

- `EXPORT_PLATFORM_PUBLIC_BASE_URL`、平台库、对象存储、两个签名 secret、worker id 均有来源。
- 每个 registry 需要的 `datasourceCode` 都能映射到只读数据源。
- 对象存储已确认兼容当前 HTTP gateway 语义，或已有 native adapter 任务。

负责人收集边界：

| 要什么 | 找谁 | 拿到什么 |
| --- | --- | --- |
| 平台库 | DBA | 平台 MySQL 地址、库名、运行期账号、migration 账号、备份方案 |
| 业务只读源 | 业务系统负责人 / DBA | 只读连接串、业务视图、字段说明、验收查询 |
| 对象存储 | 运维 / 存储平台 | HTTP gateway endpoint、bucket、smoke prefix、权限说明 |
| 认证网关 | 网关 / 安全 | `X-Auth-Context-*` 签名规则和共享签名密钥 |
| 管理租户 | 产品 / 业务负责人 | 哪些 tenant 可以注册和修改导出配置 |
| registry 配置 | 业务负责人 / 接手研发 | `taskCode`、参数 schema、查询模板、字段映射、脱敏规则 |

失败处理：

- 缺 secret、缺负责人或缺网络白名单时停止部署。
- 不允许把 `.env.example` 占位符当真实配置。

## 4. 准备运行目录

输入：目标部署主机或部署平台工作目录。

动作：

```powershell
node --version
npm --version
git --version
git clone <repo-url> export-platform-service
Set-Location export-platform-service
git checkout <deploy-commit-sha>
npm ci
```

Linux 部署主机可使用等价命令：

```bash
node --version
npm --version
git --version
git clone <repo-url> export-platform-service
cd export-platform-service
git checkout <deploy-commit-sha>
npm ci
```

通过标准：

- `node --version` 为 22 或更高。
- `npm ci` 成功退出。
- 部署目录的 `git rev-parse HEAD` 等于第 1 步记录的 commit。

失败处理：

- Node 版本不足时更换 runtime，不要降级 package 要求。
- `npm ci` 失败时停止部署，不要改用 `npm install` 覆盖锁文件。

## 5. 注入环境变量和 secret

输入：第 3 步确认的配置。

动作：在部署平台配置以下变量。示例值只能作为形态参考。

```text
EXPORT_PLATFORM_ENVIRONMENT=production
EXPORT_PLATFORM_HOST=0.0.0.0
EXPORT_PLATFORM_PORT=3000
EXPORT_PLATFORM_PUBLIC_BASE_URL=https://<export-platform-public-host>
EXPORT_PLATFORM_DATABASE_URL=mysql://<platform_user>:<platform_password>@<platform_host>:3306/<platform_db>?ssl=true
EXPORT_PLATFORM_DATASOURCE_<CODE>_URL=mysql://<readonly_user>:<readonly_password>@<business_host>:3306/<business_db>?ssl=true
EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT=https://<object-storage-gateway>
EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET=<bucket>
EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX=release-smoke
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=false
EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=false
EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET=<secret>
EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET=<secret>
EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS=<tenant-001,tenant-002>
EXPORT_PLATFORM_WORKER_ID=export-worker-prod-001
EXPORT_PLATFORM_CLEANUP_WORKER_ID=export-cleanup-prod-001
EXPORT_PLATFORM_SCHEDULER_POLL_MS=5000
EXPORT_PLATFORM_CLEANUP_POLL_MS=60000
```

`EXPORT_PLATFORM_DATASOURCE_<CODE>_URL` 的 `<CODE>` 来自 `datasourceCode`：把 `datasourceCode` 转成大写，并把 `-` 转成 `_`。例如 `datasourceCode=purchase-ro` 对应 `EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL`。

通过标准：

- Secret 由部署平台或 secret manager 注入。
- 生产值不包含 localhost、`127.0.0.1`、`.local`、`.test`、`.invalid` 或 example 域名。
- 普通 HTTP / worker / cleanup 运行期使用 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=false`。
- `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=false`。

失败处理：

- `loadConfig()` 报缺配置或 unsafe endpoint 时，修配置，不改代码绕过 fail-fast。
- 需要执行对象存储 live smoke 时，只在 smoke 窗口临时把 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`，执行后改回 `false`。

## 6. 执行上线前静态验证

输入：已安装依赖的部署目录。

动作：

```powershell
npm run typecheck
npm run arch:check
node --import tsx --test tests/config-env.test.mjs
npm run test:contract
git diff --check
```

通过标准：

- 所有命令退出码为 0。
- `git diff --check` 没有空白错误。

失败处理：

- 任何命令失败都停止部署。
- 这些命令只证明静态和契约边界，不证明真实生产依赖已接通。

## 7. 执行平台库 migration

输入：部署 commit、`migrations/`、平台库连接、DBA 变更窗口。

动作：按 `docs/operations/production-migration-runbook.md` 执行：

```powershell
npm run db:migrate -- list
npm run db:migrate
```

`list` 用于输出待执行 migration 列表；不带参数默认执行到 latest。生产必须在 DBA 备份或快照完成后、变更窗口内执行。

注意：

- `db:migrate` 只读取平台库配置，不能要求对象存储、业务只读源或网关 secret 先可用。
- `db:migrate` 不能放进 HTTP、scheduler 或 cleanup 的启动命令里。
- `npm run db:migrate -- list` 第二次应显示 `pending=0`，或者受控工单里必须解释为什么还有 pending。

通过标准：

- 有备份 ID 或快照 ID。
- migration 元数据和平台表可追溯。
- 运行期账号能读写平台表，但不能做 DDL。

失败处理：

- migration 失败时停止启动或放量。
- 不允许跳过失败 migration 后继续声称生产接入完成。

## 8. 配置三个独立进程

输入：部署平台进程配置。

动作：创建三个独立进程，不能把 worker 和 cleanup 合并到 HTTP 进程里。

| 进程 | 命令 | 健康/存活判断 |
| --- | --- | --- |
| HTTP 服务 | `npm run start` | `GET /health` 返回 `status=ok`。 |
| Scheduler worker | `npm run worker:scheduler` | 日志出现 `export-platform.scheduler.started`，持续 poll。 |
| Cleanup job | `npm run job:cleanup` | 日志出现 `export-platform.cleanup.started`，持续 poll。 |

如果使用 systemd，可从仓库模板安装：

```bash
sudo install -d -o root -g root /etc/export-platform
sudo install -d -o export-platform -g export-platform /opt/export-platform-service
sudo cp deploy/systemd/export-platform-*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable export-platform-http export-platform-scheduler export-platform-cleanup
sudo systemctl start export-platform-http export-platform-scheduler export-platform-cleanup
sudo systemctl status export-platform-http export-platform-scheduler export-platform-cleanup
```

模板默认读取 `/etc/export-platform/export-platform.env`，工作目录为 `/opt/export-platform-service`，运行用户为 `export-platform`。如果目标主机路径、用户或 `npm` 绝对路径不同，先改模板再安装。真实 secret 只能进入环境变量文件、secret manager 或部署平台配置，不能提交到仓库。

通过标准：

- 三个进程使用同一部署 commit。
- 三个进程读取同一套平台库、对象存储和签名配置。
- 部署平台设置自动重启、日志采集、CPU/内存告警和实例身份。

失败处理：

- HTTP 健康检查失败时不要启动业务流量。
- worker 或 cleanup 无法启动时不要创建正式导出任务。

## 9. 打开 HTTP 健康检查

输入：HTTP 进程已启动。

动作：

```powershell
curl.exe -fsS "https://<export-platform-public-host>/health"
```

如果在内网服务地址探测：

```powershell
curl.exe -fsS "http://<service-host>:<port>/health"
```

通过标准：

- 返回 JSON 包含 `status: "ok"`。
- 返回内容的 `entries.http`、`entries.worker`、`entries.cleanupJob` 为 `true`，表示代码入口存在。

失败处理：

- 公开域名失败但内网成功时，优先排查网关、路由、证书和端口映射。
- 内网也失败时，回到第 5 步配置和第 8 步进程日志。

## 10. 执行对象存储 smoke

输入：对象存储 endpoint、bucket、独立 smoke prefix。

动作：

1. 临时设置 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`。
2. 确认 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=false`。
3. 执行：

```powershell
npm run test:object-storage-live
```

4. 执行后恢复 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=false`。

通过标准：

- smoke 可以 put、read、publish copy，并生成可访问的 download URL。
- smoke 对象只写入独立低风险 prefix。

失败处理：

- 如果对象存储是原生 OSS/S3 且没有兼容 HTTP gateway，停止 live 声明，先实现 native adapter。
- 不允许用本地 object storage mock 替代 production smoke。

## 11. 注册最小业务导出配置

输入：业务确认的 registry 配置、只读数据源、网关签名客户端。

动作：

1. 选择低风险 `taskCode`，建议使用正式业务 code 加环境后缀。
2. 使用 registry API 注册或更新配置。
3. 配置必须包含参数 schema、只读查询模板、字段映射、脱敏规则、数据范围模板、阈值和保留期。

通过标准：

- `datasourceCode` 能映射到第 5 步中的只读数据源变量。
- `queryTemplate.templateText` 只包含只读 `SELECT` 和命名参数。
- 敏感字段有 `sensitive=true` 和对应脱敏规则。

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

失败处理：

- registry 保存失败时优先检查管理租户、网关签名、schema 必填字段和 datasource 映射。
- 不允许用空字段映射、空脱敏策略或绕过数据范围模板来换取通过。

## 12. 创建小范围导出任务

输入：已注册 registry、小范围查询参数、真实网关签名。

动作：

1. 调用 `POST /api/export/tasks`，只请求小时间窗、小组织范围或少量测试数据。
2. 记录返回的脱敏 `taskId`、`requestId`、`configSnapshotDigest`。
3. 查询 `GET /api/export/tasks/{taskId}` 直到任务进入终态。

通过标准：

- 创建接口返回 `PENDING`。
- worker 将任务推进到 `COMPLETED`。
- 详情接口能看到进度、attemptNo、checkpoint 或文件元信息。

失败处理：

- `TASK_NOT_REGISTERED`：回到第 11 步。
- `DATASOURCE_UNAVAILABLE`：检查只读源网络、账号、SSL 和白名单。
- `QUERY_TEMPLATE_INVALID`：检查参数 schema、模板参数和数据范围模板。

## 13. 验证下载、审计和脱敏

输入：已完成的导出任务。

动作：

1. 调用 `GET /api/export/tasks/{taskId}/download`。
2. 访问返回的签名下载 URL。
3. 校验文件 checksum、字段顺序和敏感字段脱敏。
4. 查询审计记录，确认 create、execute、download 可追溯。

通过标准：

- 文件可以下载，checksum 匹配。
- 敏感字段不出现原始手机号、姓名等明文。
- 审计记录包含操作者、租户、动作、结果、requestId 和时间。

失败处理：

- `FILE_VERIFY_ERROR`：排查对象存储 put/read/publish 权限和 copy 语义。
- `SIGNATURE_INVALID` 或 `SIGNATURE_EXPIRED`：排查下载签名 secret、过期时间和 URL 篡改。

## 14. 验证失败态

输入：受控失败场景和可回滚的测试数据。

动作：至少执行以下失败态。

| 失败态 | 操作 | 预期 |
| --- | --- | --- |
| 缺网关签名 | 移除 `X-Auth-Context-Signature` | 401 / `AUTH_CONTEXT_MISSING` |
| 无权限租户 | 用非授权租户注册配置 | `PERMISSION_DENIED` |
| 未注册任务 | 使用不存在的 `taskCode` 创建任务 | `TASK_NOT_REGISTERED` |
| 参数不合法 | 缺必填参数或传额外参数 | `QUERY_TEMPLATE_INVALID` |
| 数据源不可用 | 使用受控错误源或临时切断只读源 | `DATASOURCE_UNAVAILABLE` |
| 对象存储失败 | 使用受控失败 bucket/prefix 或故障注入 | `FILE_VERIFY_ERROR` |
| 签名 URL 篡改 | 修改 `signature` | `SIGNATURE_INVALID` |

通过标准：

- 每个失败态返回公开安全错误码。
- 响应、日志和证据不包含 SQL、连接串、密码、secret、对象存储内部路径或堆栈。

失败处理：

- 未覆盖失败态时，结论只能写为 BLOCKED 或 PARTIAL，不得写 PASS。

## 15. 填写 live evidence

输入：第 7 至第 14 步结果。

动作：

1. 复制 `docs/operations/production-live-evidence-template.md` 到受控报告或新文档。
2. 填写部署 commit、依赖脱敏摘要、migration 证据、registry 摘要、成功态、失败态和未覆盖项。
3. 如果 evidence 落仓库，命名建议为 `docs/operations/production-live-evidence-report.md`，不要包含 secret 或生产样本数据。

通过标准：

- 证据同时覆盖真实依赖成功态和关键失败态。
- 未覆盖项有后续任务编号或明确责任人。

失败处理：

- 证据缺失时，不允许把 Docker/mock 或本地 rehearsal 报告升级为 live evidence。

## 16. 灰度放量

输入：live evidence 初版 PASS 或受控 PARTIAL。

动作：

1. 只开放一个低风险 `taskCode`。
2. 限制 `concurrencyLimit`、`batchSize`、`singleFileMaxRows`、`exportMaxRows`。
3. 观察任务耗时、失败率、数据库慢查询、对象存储错误、worker poll 日志和审计量。
4. 每次放量只改一个维度。

通过标准：

- 小范围任务稳定完成。
- 失败可恢复，错误码可解释，审计可追溯。

失败处理：

- 出现数据源压力、对象存储失败或 worker 租约异常时，先降并发或停用 registry，不直接扩大范围。

## 17. 正式结论

PASS 结论必须同时满足：

- 第 1 步部署 commit 明确。
- 第 2 步门禁无未处理 P0 阻塞。
- 第 7 步 migration 成功且可追溯。
- 第 8 至第 13 步三个进程、健康检查、对象存储、registry、小范围导出、下载、审计和脱敏通过。
- 第 14 步关键失败态通过。
- 第 15 步 live evidence 已记录，且不含 secret。

若任一项不满足，使用：

```text
BLOCKED - 需要人工介入: production 部署缺少 <依赖/权限/证据/门禁>，当前只能声明生产接入准备完成，不能声明 live evidence 或正式上线完成。
```

## 常见分歧裁决

| 分歧 | 裁决 |
| --- | --- |
| 能否只启动 HTTP 服务就上线 | 不能。导出执行依赖 scheduler worker，过期清理依赖 cleanup job。 |
| 能否把 `npm run test:acceptance:full-report` 当生产验收 | 不能。它是 docker/mock 验收，不证明真实依赖。 |
| 能否用 `.env.example` 改成 `.env.production` 提交 | 不能。真实 secret 进入部署平台，不进仓库。 |
| 能否直接填真实 OSS/S3 endpoint | 不能默认。当前 adapter 需要 HTTP gateway 语义；没有网关时先做 native adapter。 |
| 能否让服务启动时自动 migration | 当前不允许作为默认生产方案。migration 必须与应用启动分离，受控执行。 |
| 能否跳过失败态验证 | 不能。缺失败态只能写 PARTIAL 或 BLOCKED。 |

## 附录入口

| 需要细节 | 继续读 |
| --- | --- |
| 收集生产配置 | `docs/operations/production-config-questionnaire.md` |
| 理解每个变量 | `docs/operations/production-deployment-config-runbook.md` |
| 接业务库、对象存储、网关 | `docs/operations/production-data-integration-runbook.md` |
| 做平台库 migration | `docs/operations/production-migration-runbook.md` |
| 记录真实验证证据 | `docs/operations/production-live-evidence-template.md` |
