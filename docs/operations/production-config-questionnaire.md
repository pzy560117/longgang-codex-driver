# 生产配置收集问卷

本文用于接手研发向 DBA、运维、网关、对象存储和业务系统负责人收集生产接入信息。真实值不要写入仓库；填写版本只能放在受控工单、部署平台或 secret manager 中。本仓库里的副本只保留字段说明和脱敏摘要。

## 基本信息

| 项 | 填写内容 |
| --- | --- |
| 接入环境 | staging / pre-prod / production |
| 计划接入日期 | `<YYYY-MM-DD>` |
| 变更窗口 | `<start-end + timezone>` |
| 接手研发 | `<name / team>` |
| 运维负责人 | `<name / team>` |
| DBA 负责人 | `<name / team>` |
| 网关负责人 | `<name / team>` |
| 业务系统负责人 | `<name / team>` |
| 回滚负责人 | `<name / team>` |

## HTTP 与网关

| 需要确认 | 配置项 | 是否必填 | 负责人 | 填写要求 |
| --- | --- | --- | --- | --- |
| 服务监听地址 | `EXPORT_PLATFORM_HOST` | 是 | 运维 | 通常为 `0.0.0.0`，不要填公网域名。 |
| 服务监听端口 | `EXPORT_PLATFORM_PORT` | 是 | 运维 | 与部署平台 service port 一致。 |
| 对外访问域名 | `EXPORT_PLATFORM_PUBLIC_BASE_URL` | production 必填 | 网关 / 运维 | 不能是 localhost、example、`.test`、`.local`。 |
| 网关签名算法 | `X-Auth-Context-Signature-Algorithm` | 是 | 网关 | 当前只接受 `HMAC-SHA256`。 |
| 网关签名密钥 | `EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET` | production 必填 secret | 网关 / 安全 | 进入 secret manager，不写入文档。 |
| 网关时间偏差 | issuedAt freshness | 是 | 网关 | 当前允许 10 分钟内新鲜度，超过窗口会拒绝。 |

## 平台库

| 需要确认 | 配置项 | 是否必填 | 负责人 | 填写要求 |
| --- | --- | --- | --- | --- |
| 连接串 | `EXPORT_PLATFORM_DATABASE_URL` | 推荐 | DBA / 运维 | 优先使用 URL；脱敏记录 host/db/ssl，不记录密码。 |
| 拆分 host | `EXPORT_PLATFORM_MYSQL_HOST` | URL 缺失时必填 | DBA | 不能是 localhost 或测试域名。 |
| 拆分端口 | `EXPORT_PLATFORM_MYSQL_PORT` | URL 缺失时必填 | DBA | 默认 `3306`。 |
| 数据库名 | `EXPORT_PLATFORM_MYSQL_DATABASE` | URL 缺失时必填 | DBA | 独立平台库。 |
| 运行期账号 | `EXPORT_PLATFORM_MYSQL_USER` | URL 缺失时必填 | DBA | 运行期需平台表读写。 |
| 运行期密码 | `EXPORT_PLATFORM_MYSQL_PASSWORD` | URL 缺失时必填 secret | DBA / 安全 | 进入 secret manager。 |
| SSL | `EXPORT_PLATFORM_MYSQL_SSL` | production 建议 true | DBA | 按数据库安全要求确认。 |
| migration 账号 | 不提交到仓库 | 是 | DBA | 建议与运行期账号分离。 |
| 备份方案 | DBA 工单 | 是 | DBA | migration 前必须可恢复。 |

## 业务只读数据源

每个 registry `datasourceCode` 都要有一条映射。`purchase-ro` 会映射为 `EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL`。

| `datasourceCode` | 业务系统 | 数据库 / 视图 | 只读账号 | 配置项 | 负责人 | 验收查询 |
| --- | --- | --- | --- | --- | --- | --- |
| `<purchase-ro>` | `<purchase>` | `<db/view>` | `<readonly user>` | `EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL` | `<owner>` | `SELECT 1` + 小范围业务查询 |

确认项：

- 账号不能具备 `INSERT`、`UPDATE`、`DELETE`、DDL 或存储过程执行权限。
- 业务视图必须包含 registry 查询模板需要的字段。
- 数据范围字段必须能支持 `tenantId`、`orgScope`、`operatorId` 或业务确认的等价权限条件。
- 小范围查询不能扫描全表；需要索引或业务侧视图保障。

## 对象存储

| 需要确认 | 配置项 | 是否必填 | 负责人 | 填写要求 |
| --- | --- | --- | --- | --- |
| endpoint | `EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT` | production 必填 | 存储平台 / 运维 | 当前 adapter 要求 HTTP put/read/copy/download URL 语义。 |
| bucket | `EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET` | production 必填 | 存储平台 / 运维 | 建议独立 bucket 或独立 prefix。 |
| smoke prefix | `EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX` | smoke 必填 | 运维 | 使用低风险独立路径，如 `release-smoke/`。 |
| smoke 写开关 | `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES` | production smoke 必填 | 运维 | 只有执行 smoke 时设为 `true`。 |
| local smoke 开关 | `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE` | docker/mock only | 运维 | 生产环境必须为 `false`。 |
| 下载签名密钥 | `EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET` | production 必填 secret | 安全 / 运维 | 与网关签名密钥分离。 |

如果对象存储是阿里 OSS、S3 或其他 native SDK，不要默认兼容当前 HTTP adapter。先确认是否有兼容网关；没有则新增 native adapter 任务。

## Registry 配置

| 需要确认 | 示例字段 | 负责人 | 说明 |
| --- | --- | --- | --- |
| 任务编码 | `taskCode` | 业务负责人 | 稳定唯一，不能随意改名。 |
| 子系统编码 | `subsystemCode` | 业务负责人 | 用于历史筛选和审计归属。 |
| 数据源编码 | `datasourceCode` | 业务 + DBA | 必须能映射到只读数据源配置。 |
| 参数 schema | `parameterSchema` | 业务 + 接手研发 | 明确必填、类型、禁止额外参数。 |
| SQL 模板 | `queryTemplate.templateText` | DBA / 业务 | 只允许只读 SELECT 和命名参数。 |
| 允许参数 | `queryTemplate.allowedParameters` | 接手研发 | 必须覆盖模板参数。 |
| 字段映射 | `fieldMappings` | 业务 | 字段顺序、标题、类型、是否可导出。 |
| 脱敏规则 | `maskingPolicy.rules` | 安全 / 业务 | 敏感字段必须有规则。 |
| 数据范围 | `dataScopeTemplate` | 业务 / 安全 | 必须叠加租户、组织或操作者范围。 |
| 阈值 | `singleFileMaxRows`、`exportMaxRows`、`batchSize` | 业务 / 运维 | 先用小范围，逐步放量。 |
| 保留期 | `fileRetentionDays`、`taskHistoryRetentionDays` | 业务 / 合规 | 对齐数据保留要求。 |

## 验收证据

接手方完成 live 接入后，至少提供：

- 成功态：创建任务、任务完成、文件发布、下载成功、审计记录可追溯。
- 失败态：缺少网关签名、无权限租户、业务数据源不可用、对象存储失败或等价受控失败。
- 不含 secret 的配置摘要：host/db/bucket/datasourceCode/taskCode 可以脱敏记录。
- 未覆盖项：nonce 防重放、压测、真实 native OSS/S3 adapter、容灾等没有做的必须写清楚。
