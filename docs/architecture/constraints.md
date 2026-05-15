# Architecture Constraints Packet：统一导出平台

本文件是统一导出平台进入计划和编码前的架构约束包。后续 `task.json` 中所有 `feature_impl` 任务必须复制本文件中的约束到 `architecture_constraints`，并把最容易跑偏的替代实现写入 `forbidden_implementations`。

## 1. System Shape

- 交付形态：`independent_microservice`。
- 运行方式：`http_service` + `worker` + `scheduled_job`。
- 部署单位：独立服务进程；后续实现必须提供生产启动入口和部署入口。
- 生产入口最低要求：HTTP server entry、scheduler worker entry、cleanup job entry、配置加载入口。
- 当前状态：仓库保留产品、契约、架构和测试文档；不保留任何已完成的业务实现、测试证据或旧运行 trace。

## 2. API Boundary

- 外部入口：HTTP，契约来源为 `contracts/openapi.yaml`。
- 子系统接入：仅通过 HTTP/Feign 调用统一导出平台，不加载业务 JAR，不直接写平台表。
- Public operation 完成条件：每个公开 operation 必须能追踪到 route/handler、service、repository 或外部 adapter、测试和证据路径。
- 禁止状态：只有 service class、领域函数或单元测试时，不得声明 API 需求完成。

## 3. Data Boundary

- 持久化：生产路径使用 MySQL 或等价关系型数据库；任务、注册配置、锁租约、批次检查点、文件元信息、审计日志都必须有 schema/migration。
- Repository 策略：生产 repository 必须走真实持久化边界；`InMemory*`、mock repository、fixture repository 只能用于单元测试。
- 数据访问：平台只允许访问注册配置声明的只读数据源或数据中台，禁止执行调用方传入的原始 SQL。
- 数据一致性：幂等键、配置快照、任务状态机、DB 锁租约和审计写入必须有可验证约束。

## 4. Async And Worker Boundary

- 调度方式：MySQL 轮询 + DB 抢锁。
- 锁模型：`lockOwner + lockExpireAt + leaseRenewedAt`，时间判断以数据库时间为准。
- 默认租约：5 分钟，worker 只能在批次边界续租。
- 接管规则：租约过期后的实例接管延续当前 `attemptNo`，从最近持久化批次检查点继续。
- 重试规则：只有 FAILED 重试递增 `attemptNo`；PENDING/EXECUTING 重试必须拒绝。

## 5. Test Double Policy

- `InMemory*` 允许范围：unit tests only。
- Mock 允许范围：外部生产依赖不可用时可作为临时单测替身；当前验收允许本机/Docker MySQL 与本地 object storage mock，但不能使用内存 repository 冒充生产路径。
- 生产完成证据：必须包含 API/handler 测试、DB repository 或 migration 验证、worker/lease 验证、`git diff --check`。
- 若本机/Docker MySQL、本地 object storage mock 或任务声明的第三方依赖不可用，任务必须记录 `BLOCKED - 需要人工介入`，不得用内存实现冒充通过。外部生产 MySQL / live OSS 不属于当前 release gate 的完成条件。

## 6. Forbidden Implementations

- 禁止把 `InMemory*`、mock、fixture repository 或领域原型作为生产实现完成。
- 禁止只有 `src/*/service.ts` 而没有 HTTP route/handler、server entry 和 API 集成测试。
- 禁止只有调度 class 而没有 worker entry、DB 锁 schema、repository 原子抢锁和租约测试。
- 禁止只有 OpenAPI 契约或文档而声明 `feature_impl` 完成。
- 禁止只运行 `git diff --check` 就声明 `feature_impl` 完成。
- 禁止把采购订单样板写成平台特例接口；样板必须复用标准 registry、query、file、audit 链路。

## 7. Architecture Fitness Checks

后续脚手架任务必须创建 `arch:check` 或等价命令。最低检查项：

- 生产 HTTP server entry 存在。
- scheduler worker entry 和 cleanup job entry 存在。
- `contracts/openapi.yaml` 的公开 operation 有 route/handler 和测试映射。
- 生产入口没有引用 `InMemory*`、mock repository 或测试 fixture。
- MySQL schema/migration 覆盖 task、registry、lease/checkpoint、file metadata、audit log。
- `feature_impl` 任务的 `test_command` 包含架构检查、affected tests 和 `git diff --check`。

## 8. Definition Of Done

- 当前任务的 `architecture_constraints` 已复制本文件相关条目。
- 当前任务的 `forbidden_implementations` 覆盖最容易跑偏的替代实现。
- Stage 1 Review 先审查架构形态，再审查业务规格。
- 完成声明能说明 production path、test double 和 BLOCKED 依赖边界。
