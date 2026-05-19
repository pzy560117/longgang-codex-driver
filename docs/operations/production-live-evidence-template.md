# 生产 live evidence 模板

本文是 staging、pre-prod 或 production 真实依赖接入后的证据模板。填写时不要记录 secret、密码、token、cookie、私钥、完整数据库连接串或生产样本数据。

## 基本信息

| 项 | 内容 |
| --- | --- |
| 专项任务 ID | `PRODUCTION-LIVE-INTEGRATION-001` 或等价任务 |
| 环境 | staging / pre-prod / production |
| 部署 commit | `<git sha>` |
| 执行时间 | `<YYYY-MM-DD HH:mm +timezone>` |
| 执行人 | `<name / team>` |
| 评审人 | `<name / team>` |
| 结论 | PASS / FAIL / BLOCKED |

## 依赖摘要

| 边界 | 脱敏摘要 | 负责人 | 状态 |
| --- | --- | --- | --- |
| 平台库 | `host=<masked>, db=<masked>, ssl=<true/false>` | DBA | connected / blocked |
| 业务只读源 | `datasourceCode=<code>, host=<masked>, view=<masked>` | 业务 / DBA | connected / blocked |
| 对象存储 | `endpoint=<masked>, bucket=<masked>, prefix=<masked>` | 运维 | connected / blocked |
| 网关认证 | `algorithm=HMAC-SHA256, public host=<masked>` | 网关 | connected / blocked |
| HTTP 服务 | `baseUrl=<masked>` | 运维 | healthy / blocked |
| Worker / cleanup | `workerId=<masked>, cleanupWorkerId=<masked>` | 运维 | running / blocked |

## Migration 证据

| 项 | 内容 |
| --- | --- |
| migration 执行方式 | migration job / DBA 工单 / 其他 |
| migration 版本 | `<migration names>` |
| 备份 ID | `<backup id>` |
| 执行结果 | PASS / FAIL / BLOCKED |
| 失败摘要 | `<safe error summary>` |

## Registry 配置摘要

| 项 | 内容 |
| --- | --- |
| `taskCode` | `<task code>` |
| `subsystemCode` | `<subsystem>` |
| `datasourceCode` | `<datasource code>` |
| 查询模板版本 | `<queryTemplateVersion>` |
| 参数 schema 摘要 | `<required params and types>` |
| 字段映射摘要 | `<field count and sensitive field count>` |
| 脱敏策略摘要 | `<rule codes>` |
| 数据范围模板摘要 | `<tenant/org/operator boundary>` |
| 阈值 | `batchSize=<n>, singleFileMaxRows=<n>, exportMaxRows=<n>` |

## 成功态证据

| 验证项 | 命令 / 操作 | 预期 | 实际 | 状态 |
| --- | --- | --- | --- | --- |
| 健康检查 | `GET /health` 或等价探活 | 服务健康 | `<safe summary>` | PASS / FAIL |
| registry 注册 / 更新 | 调用 registry API | 配置可读取 | `<config version>` | PASS / FAIL |
| 创建导出任务 | 调用 create task API | 返回 `PENDING` / taskId | `<task id masked>` | PASS / FAIL |
| worker 执行 | 观察任务状态 | `COMPLETED` | `<duration / rows>` | PASS / FAIL |
| 文件发布 | 下载 API / storage metadata | 可生成下载 URL | `<file metadata masked>` | PASS / FAIL |
| 下载验签 | 访问签名 URL | 可下载且 checksum 正确 | `<checksum prefix>` | PASS / FAIL |
| 审计追踪 | 查询审计 | create/export/download 可追溯 | `<audit ids masked>` | PASS / FAIL |
| 脱敏检查 | 抽查导出文件 | 敏感字段已脱敏 | `<field summary>` | PASS / FAIL |

## 失败态证据

| 验证项 | 操作 | 预期错误 | 实际 | 状态 |
| --- | --- | --- | --- | --- |
| 缺少网关签名 | 移除 `X-Auth-Context-Signature` | `AUTH_CONTEXT_MISSING` / 401 | `<safe summary>` | PASS / FAIL |
| 无权限租户 | 使用非授权租户注册配置 | `PERMISSION_DENIED` | `<safe summary>` | PASS / FAIL |
| 未注册任务 | 使用不存在 `taskCode` 创建任务 | `TASK_NOT_REGISTERED` | `<safe summary>` | PASS / FAIL |
| 参数不合法 | 缺少必填参数或传额外参数 | `QUERY_TEMPLATE_INVALID` | `<safe summary>` | PASS / FAIL |
| 数据源不可用 | 临时切断只读源或使用受控错误源 | `DATASOURCE_UNAVAILABLE` | `<safe summary>` | PASS / FAIL |
| 对象存储失败 | 使用受控失败 bucket/prefix 或故障注入 | `FILE_VERIFY_ERROR` | `<safe summary>` | PASS / FAIL |
| 签名 URL 篡改 | 修改 `signature` | `SIGNATURE_INVALID` | `<safe summary>` | PASS / FAIL |

## 未覆盖项

| 未覆盖项 | 原因 | 后续任务 |
| --- | --- | --- |
| nonce 防重放 | 当前只做 freshness，不做持久 nonce store | `<task id>` |
| 压测 / 大数据量 | `<reason>` | `<task id>` |
| native OSS/S3 adapter | `<reason>` | `<task id>` |
| 容灾 / 多地域 | `<reason>` | `<task id>` |

## 结论模板

PASS：

```text
本次 <env> live 接入在 commit <sha> 上通过。证据覆盖平台库 migration、业务只读源、小范围导出、对象存储发布下载、网关认证、审计追踪、脱敏和关键失败态；未覆盖项已列入后续任务。
```

BLOCKED：

```text
BLOCKED - 需要人工介入: <env> live 接入缺少 <依赖/权限/窗口/负责人>。当前只能声明生产接入准备完成，不能声明 live evidence。
```
