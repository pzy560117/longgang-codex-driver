# 生产平台库迁移 runbook

本文说明平台库 schema migration 如何交给接手方在 staging、pre-prod 或 production 中受控执行。当前仓库提供 `npm run db:migrate -- list` 和 `npm run db:migrate`，但它必须作为独立 migration job 或变更窗口一次性命令执行，不能绑定到 HTTP 服务、scheduler worker 或 cleanup job 启动流程。

## 当前迁移资产

| 资产 | 说明 |
| --- | --- |
| `migrations/` | 平台库 SQL / TypeScript migration 文件。 |
| `src/db/migrator.ts` | 基于 Kysely `Migrator` 的 migration runner 函数。 |
| `src/db/kysely.ts` | 平台库连接入口。 |
| `scripts/db-migrate.ts` | 受控 migration CLI，支持 `list` 和执行到 latest。 |
| `package.json` | `db:migrate` 命令入口。 |
| `docs/operations/production-deployment-config-runbook.md` | 平台库连接配置说明。 |

## 推荐方案

接手方应把 `npm run db:migrate` 接入部署平台的受控 migration job 或一次性初始化命令，满足：

- 从部署平台读取 `EXPORT_PLATFORM_DATABASE_URL` 或拆分 MySQL 配置。
- 先执行 `npm run db:migrate -- list` 输出待执行 migration 列表。
- 执行前确认数据库备份或快照完成。
- 执行日志不输出密码、token、完整连接串或生产数据。
- 失败时非零退出，并保留 migration 名称、错误摘要、执行时间和负责人。
- 与应用启动分离，不在每次 HTTP 服务启动时自动迁移生产库。

如果部署平台暂时没有 migration job 能力，仍可在 DBA 变更窗口手动执行同一命令；不能由研发临时复制 SQL 改表后声明完成。

## 执行前检查

| 检查项 | 要求 | 负责人 |
| --- | --- | --- |
| 变更窗口 | 已审批并通知相关团队 | 运维 |
| 备份 / 快照 | 可恢复，记录备份 ID | DBA |
| migration 列表 | 与仓库 `migrations/` 对齐 | 接手研发 / DBA |
| 连接账号 | migration 账号和运行期账号分离 | DBA |
| 权限 | migration 账号具备 DDL，运行期账号只具备平台表运行权限 | DBA |
| 回滚策略 | 明确回滚方式或前滚修复方式 | DBA / 接手研发 |
| 应用状态 | 迁移期间是否停服务、灰度或只读已确认 | 运维 |

## 执行流程

1. 确认当前部署 commit、migration 文件列表和目标环境。
2. DBA 完成备份，记录备份 ID、时间和恢复联系人。
3. 在 staging 或 pre-prod 先执行：

```powershell
npm run db:migrate -- list
npm run db:migrate
```

4. 验证平台表、索引和 migration 元数据符合预期。
5. 在生产变更窗口执行同一组命令。
6. 启动或重启 HTTP 服务、scheduler worker、cleanup job。
7. 用小范围 registry 配置创建导出任务，确认平台表读写正常。
8. 把执行结果写入 `docs/operations/production-live-evidence-template.md` 或受控工单。

## 验证点

| 验证 | 通过标准 |
| --- | --- |
| migration 元数据 | 所有预期 migration 状态为成功。 |
| 平台表存在 | task、registry、lease/checkpoint、file metadata、audit log 等表可访问。 |
| 运行期账号 | HTTP / worker / cleanup 可读写平台表，但不能做 DDL。 |
| 幂等性 | 重复执行 migration job 不应重复建表或破坏数据。 |
| 失败可见性 | migration 失败时非零退出，日志可定位 migration 名称。 |

## 回滚与失败处理

如果 migration 失败：

1. 停止继续启动或放量。
2. 记录失败 migration、错误摘要、时间、执行人和目标环境。
3. 由 DBA 判断恢复备份、修正后前滚，或保持当前状态等待人工介入。
4. 对外结论写为：

```text
BLOCKED - 需要人工介入: 平台库 migration 在 <env> 失败，失败 migration=<name>，已停止 live 接入声明。
```

不要跳过失败 migration 后继续声明生产接入完成。

## 后续建议任务

- 增加最小集成测试，证明 production 模式不会在服务启动时隐式迁移。
- 将 migration job 的命令和证据写回验证矩阵。
