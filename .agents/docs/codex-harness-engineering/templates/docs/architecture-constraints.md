# Architecture Constraints Packet

本文件在需求分析结束、进入计划或编码前完成。它把“系统应该是什么形态”转成可执行约束，供 `task.json`、Stage 1 Review 和验证命令使用。

## 1. System Shape

- 交付形态：`independent_microservice` / `monolith` / `frontend_app` / `cli` / `library` / `domain-prototype`
- 运行方式：`http_service` / `worker` / `scheduled_job` / `embedded_library` / `static_site`
- 部署单位：`container` / `single_process` / `serverless` / `package` / `not_applicable`
- 生产入口：列出 `src/server.*`、`main.*`、worker entry、Dockerfile 或其他启动入口。

## 2. API Boundary

- 外部入口：`HTTP` / `gRPC` / `MQ` / `CLI` / `none`
- 契约来源：`OpenAPI` / `protobuf` / `GraphQL schema` / `existing API` / `docs`
- Public operation 是否必须有 handler/controller 测试：`yes` / `no`
- 契约到代码追踪规则：每个公开 operation 必须能追踪到 handler、service、测试和证据路径。

## 3. Data Boundary

- 持久化：`MySQL` / `PostgreSQL` / `Redis` / `object_storage` / `filesystem` / `none`
- Schema/migration 是否是完成条件：`yes` / `no`
- Repository 策略：生产路径使用真实持久化；`InMemory*`、mock repository 和 fixture repository 只能用于测试或明确的 `domain-prototype`。
- 数据一致性要求：事务、行锁、CAS、唯一约束、幂等键、审计保留等。

## 4. Async And Worker Boundary

- 是否需要 worker：`yes` / `no`
- 调度方式：`DB polling` / `MQ consumer` / `cron` / `event bus` / `none`
- 并发与锁：`DB row lock` / `optimistic CAS` / `distributed lock` / `single process` / `none`
- 时间来源：`database time` / `server time` / `event time` / `not_applicable`

## 5. Test Double Policy

- `InMemory*` 允许范围：`unit tests only` / `local demo` / `domain-prototype` / `production`
- Mock 是否允许作为验收证据：默认否；只有外部依赖不可用且已记录 `BLOCKED` 或任务明确声明时可作为临时证据。
- 集成测试最低要求：列出 API、DB、worker、文件、第三方服务或浏览器验证的最低组合。

## 6. Forbidden Implementations

按项目填充，不要只写抽象原则。示例：

- 不允许用内存锁替代生产 DB 租约。
- 不允许只有 service class 而没有公开 API handler。
- 不允许 OpenAPI 有 operation 但代码没有对应路由、handler 或 handler 测试。
- 不允许把 `domain-prototype` 标记为生产功能完成。
- 不允许只运行 `git diff --check` 就声明 `feature_impl` 完成。

## 7. Architecture Fitness Checks

每个项目至少定义一个可运行入口，例如：

```powershell
npm run arch:check
```

若暂时没有脚本，必须在 `verify-matrix.md` 写明等价检查项。建议检查：

- 生产入口存在且可启动。
- 契约 operation 与 handler/controller 测试一一对应。
- 生产入口未引用 `InMemory*` 或测试替身。
- 需要持久化的任务存在 schema/migration 和真实 repository。
- 需要 worker 的任务存在 worker entry、调度配置和集成测试。

## 8. Definition Of Done

- 任务的 `architecture_constraints` 已从本文件复制到 `task.json`。
- `forbidden_implementations` 已覆盖最容易跑偏的替代实现。
- `test_command` 包含架构检查、affected tests、契约/集成测试和 `git diff --check`。
- Stage 1 Review 对架构形态给出 PASS。
- 完成声明能说明生产路径和测试替身的边界。
