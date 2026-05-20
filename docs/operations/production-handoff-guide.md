# 生产接入交接指南

本文面向接手研发、运维、DBA、网关和业务系统负责人。当前仓库已经提供统一导出平台的生产配置入口、Docker/mock release evidence 和生产接入说明；接手方要做的是把真实 staging、pre-prod 或 production 依赖接入后形成 live evidence。

当前状态不能写成“生产已接通”。在没有真实依赖、真实请求、成功态证据和失败态证据前，只能写成“具备生产接入准备”。

## 交接包内容

| 文件 | 用途 |
| --- | --- |
| `.env.example` | 环境变量占位示例，不包含真实 secret。 |
| `docs/operations/production-deployment-tutorial.md` | 从锁定 commit、安装依赖、注入配置、执行 migration、启动三类进程到 live evidence 的原子化上线步骤。 |
| `docs/operations/production-deployment-config-runbook.md` | 每个配置项的用途、必填环境、secret 分类和 fail-fast 边界。 |
| `docs/operations/production-data-integration-runbook.md` | 平台库、业务只读源、对象存储、网关、worker 的接入边界。 |
| `docs/operations/production-config-questionnaire.md` | 交给 DBA、运维、网关、业务系统负责人填写的信息收集表。 |
| `docs/operations/production-migration-runbook.md` | 平台库 migration 的受控执行流程。 |
| `docs/operations/production-live-evidence-template.md` | staging / pre-prod / production live 验证记录模板。 |
| `docs/testing/verify-matrix.md` | 当前证据边界。Docker/mock 证据不能升级成 live evidence。 |

## 接手前先确认

1. 接入环境类型：`staging`、`pre-prod` 或 `production`。
2. 运行形态：HTTP 服务、scheduler worker、cleanup job 必须独立启动，并连接同一平台库。
3. 平台库 migration 权限和运行期账号权限分离。
4. 每个业务数据源只能给只读账号，并按 `datasourceCode` 映射到环境变量。
5. 对象存储如果不是兼容当前 HTTP adapter 的网关，先补 native OSS/S3 adapter，不能只填真实 endpoint 后声明通过。
6. 认证网关必须能生成 `X-Auth-Context-*` HMAC-SHA256 可信证明头。
7. 所有 secret 进入部署平台或 secret manager，不写入仓库、trace、测试报告或聊天记录。

## 生产链接怎么配置

接手方不应该直接问“生产链接是什么”，而是按边界向负责人收集：

| 边界 | 需要的链接 / 标识 | 配置入口 | 谁提供 |
| --- | --- | --- | --- |
| 公开服务域名 | 导出平台对外 base URL | `EXPORT_PLATFORM_PUBLIC_BASE_URL` | 网关 / 运维 |
| 平台库 | MySQL URL 或 host/port/db/user/password/ssl | `EXPORT_PLATFORM_DATABASE_URL` 或拆分 MySQL 变量 | DBA / 运维 |
| 业务只读源 | 每个 `datasourceCode` 对应只读连接串 | `EXPORT_PLATFORM_DATASOURCE_<CODE>_URL` 或 `EXPORT_PLATFORM_DATASOURCES_JSON` | 业务系统负责人 / DBA |
| 对象存储 | endpoint、bucket、smoke prefix | `EXPORT_PLATFORM_OBJECT_STORAGE_*` | 运维 / 存储平台负责人 |
| 下载签名 | 下载 URL HMAC secret | `EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET` | 安全 / 运维 |
| 网关签名 | auth context HMAC secret | `EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET` | 网关 / 安全 |
| 管理租户 | 可管理 registry 的租户 ID 列表 | `EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS` | 产品 / 业务负责人 |

真实值只填入部署平台。文档、PR、issue、trace 里只能写脱敏摘要，例如 `platform-db.internal:3306/<db>`、`bucket=<prod-export-bucket>`。

## 直接迁移怎么做

不要让研发手动复制 SQL 到生产库直接执行。当前仓库有 `src/db/migrator.ts` 的 Kysely migration runner，但 `package.json` 尚未提供 `db:migrate` 生产脚本。因此生产迁移需要二选一：

1. 推荐：由接手方新增受控 migration job 或一次性初始化命令，接入部署平台审批、备份、dry run 和回滚流程后执行。
2. 临时：由 DBA 在变更窗口按 `migrations/` 中的 SQL/TS migration 逐项审核和执行，并把执行记录写入 live evidence。

无论哪种方式，都必须先读 `docs/operations/production-migration-runbook.md`，并在 `docs/operations/production-live-evidence-template.md` 填写 migration 版本、执行人、时间、退出码或 DBA 工单号。

## 推荐接入顺序

如果接手方需要按上线工单逐步执行，优先使用 `docs/operations/production-deployment-tutorial.md`。下面列表只保留高层接入顺序。

1. 填完 `docs/operations/production-config-questionnaire.md`，确认没有空白的 P0/P1 项。
2. 在 staging 或 pre-prod 配置环境变量和 secret，先不要接全量生产数据。
3. 执行平台库 migration，并确认平台表存在、migration 记录可追溯。
4. 启动 HTTP 服务，检查 `GET /health` 或等价健康检查。
5. 启动 scheduler worker 和 cleanup job，确认它们连接同一平台库。
6. 注册一个小范围、低风险的导出配置，`taskCode` 建议使用业务正式 code 加环境后缀。
7. 用真实网关签名或等价签名客户端创建小范围导出任务。
8. 验证任务完成、文件可下载、审计可追溯、敏感字段脱敏。
9. 执行失败态：缺签名、无权限、数据源不可用、对象存储失败或等价受控失败。
10. 把证据填入 live evidence 模板，再同步到 `docs/testing/verify-matrix.md` 或新建专项报告。

## 交接时禁止声明

- 禁止把 Docker MySQL、本地 object storage mock、local rehearsal 或 demo 写成生产 live evidence。
- 禁止把 `.env.example` 的占位符当作真实配置。
- 禁止提交真实 token、cookie、私钥、密码、数据库连接串、生产样本数据。
- 禁止在未验证失败态时声明“生产接入完成”。
- 禁止绕过 migration 审批、备份和回滚计划。

## 阻塞处理

如果接手方拿不到真实依赖、真实权限或真实验证窗口，应在交接记录中写：

```text
BLOCKED - 需要人工介入: 缺少 <依赖/权限/负责人/变更窗口>，当前只能声明生产接入准备完成，不能声明 live evidence。
```

阻塞项解除后，再创建 `PRODUCTION-LIVE-INTEGRATION-001` 或等价任务记录真实接入验证。
