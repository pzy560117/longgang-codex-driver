# DEV-PLAN：Docker 自动配置与测试数据验证

**Feature ID**: `FEAT-DOCKER-TEST-DATA-AUTOMATION-001`
**建议 Task ID**: `DOCKER-TEST-DATA-AUTOMATION-001`
**创建日期**: 2026-05-16
**用途**: 在当前统一导出平台已通过 docker/mock release gate 的基础上，补齐可重复的一键本机测试环境准备、测试数据 seed 和手动/自动验证入口。

## 1. 需求复述

- 自动检查并启动本机 Docker Desktop，等待 Docker daemon 可用。
- 自动创建或复用本机 Docker MySQL 容器，提供稳定的 `EXPORT_PLATFORM_TEST_DATABASE_URL`。
- 自动执行 migration，并写入可用于 API、worker、query、file、sample 和 demo 的标准测试数据。
- 自动启动本地 object storage mock，并保持证据边界为 `docker/mock` 或 `local demo`。
- 提供一个面向人工测试的入口命令，让用户无需手工拼环境变量即可完成环境准备和主链路验证。
- 不声明外部生产 MySQL 或 live OSS/S3 已验证；外部 live 验证必须另开任务。

## 2. 当前事实基线

- 当前 `task.json` 中 18 个任务均为 `passes:true`。
- `RELEASE-001` 的正式完成口径是本机 Docker MySQL + 本地 object storage mock 的 docker/mock release gate。
- `scripts/release-verify.ps1` 已能在 Docker daemon 可用时自举 Docker MySQL 并启动本地 object storage mock。
- `npm run demo:local` 和 `npm run demo:local:smoke` 已存在，但当前目标是把 Docker 准备、测试数据 seed 和验证入口进一步产品化。

## 3. Architecture Constraints Packet

### Delivery Shape

- `delivery_shape=independent_microservice`
- `runtime=http_service+worker+scheduled_job`
- 本任务只增强本机验证和测试数据准备，不改变生产 API、worker、job 或 DB schema 业务边界。

### Data Boundary

- 测试环境使用 Docker MySQL 或显式传入的本机 MySQL URL。
- seed 脚本必须拒绝明显非本机/非测试数据库 URL，避免污染外部数据库。
- migration 必须使用现有 `src/db/migrator.ts` 或现有项目认可入口，不复制 schema 逻辑。

### Test Double Policy

- 本地 object storage mock 只能作为 docker/mock 或 local demo evidence。
- 不允许用内存 repository、fixture repository 或 mock DB 替代 MySQL 验证。
- 缺少 Docker daemon、端口冲突且无法复用、MySQL 启动失败时必须输出 `BLOCKED - 需要人工介入`。

### Forbidden Implementations

- 禁止新增第二套 migration 或绕过现有 repository/service 直接写业务完成状态。
- 禁止把 seed 数据写入外部生产 MySQL。
- 禁止把本地 object storage mock 写成 live OSS/S3 evidence。
- 禁止只跑 `git diff --check` 声明完成。

## 4. 实施阶段

| 阶段 | 目标 | 主要产物 | 验证 |
| --- | --- | --- | --- |
| P1 | Docker 环境 preflight 与自举 | `scripts/docker-test-env.ps1` | Docker 不可达时输出结构化 BLOCKED；Docker 可达时返回 MySQL URL |
| P2 | MySQL migration 与测试数据 seed | `scripts/docker-test-seed.mjs` 或扩展现有 `scripts/local-demo-setup.mjs` | seed 可重复执行；拒绝非本机数据库 URL |
| P3 | 一键验证入口 | `package.json` script，例如 `test:docker-local` | 自动准备环境后运行 `npm run test:api/db/worker/query/file/sample` 或 `release-verify.ps1` |
| P4 | 文档与证据边界 | `docs/testing/docker-test-data-runbook.md`、`docs/testing/verify-matrix.md` | 文档明确 docker/mock/local-only，不替代 live evidence |
| P5 | 漂移守护 | `tests/mock-local/docker-test-data-plan.test.mjs` | 守护 package script、runbook、task 映射和 evidence 边界 |

## 5. 建议 owned paths

- `package.json`
- `scripts/docker-test-env.ps1`
- `scripts/docker-test-seed.mjs`
- `scripts/local-demo-setup.mjs`
- `scripts/release-verify.ps1`
- `docs/testing/docker-test-data-runbook.md`
- `docs/testing/verify-matrix.md`
- `tests/mock-local/docker-test-data-plan.test.mjs`
- `task.json`

## 6. 建议 task.json 条目

确认后追加一个新任务，不改写已有 `passes:true` 任务：

```json
{
  "id": "DOCKER-TEST-DATA-AUTOMATION-001",
  "description": "自动配置本机 Docker MySQL、测试数据 seed 和一键 docker/mock 验证入口",
  "task_kind": "feature_impl",
  "phase": "test-environment-automation",
  "gate_profile": "spec_required",
  "priority": 91,
  "dependencies": ["RELEASE-001"],
  "passes": false,
  "architecture_constraints": [
    "delivery_shape=independent_microservice",
    "runtime=http_service+worker+scheduled_job",
    "测试环境必须使用本机 Docker MySQL 或显式本机测试 MySQL URL",
    "测试数据 seed 必须拒绝非本机/非测试数据库 URL",
    "本任务产出 docker/mock 或 local demo evidence，不产出外部 live evidence"
  ],
  "forbidden_implementations": [
    "禁止把本地 Docker MySQL 写成外部生产 MySQL 证据",
    "禁止把本地 object storage mock 写成 live OSS/S3 证据",
    "禁止用内存 repository 或 fixture repository 替代 MySQL 验证",
    "禁止绕过现有 migration/repository/service 直接伪造完成状态"
  ],
  "test_command": "npm run test:mock-local; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; npm run test:docker-local; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; git diff --check -- task.json package.json scripts docs/testing tests/mock-local"
}
```

## 7. 验收标准

- 一条命令可完成 Docker daemon preflight、Docker MySQL 创建或复用、migration、seed 和主验证入口。
- seed 后至少能覆盖：
  - registry 样板：`purchase-order-export`
  - export task 创建和查询
  - worker 可处理的 purchase-order 样板数据
  - file/sample 所需的 0/1/20000/20001/100000/100001 边界数据生成入口
- Docker daemon 未启动时输出明确 `BLOCKED - 需要人工介入`，并给出启动 Docker Desktop 后重试命令。
- `docs/testing/verify-matrix.md` 记录该任务只提供 docker/local 测试环境证据。
- `tests/mock-local` 守护测试能在 package script、runbook 或 evidence 边界漂移时失败。

## 8. 推荐验证命令

```powershell
npm run test:mock-local
npm run test:docker-local
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1
git diff --check -- task.json package.json scripts docs/testing tests/mock-local plans/features/docker-test-data-automation.plan.md
```

## 9. 风险与阻塞

- Docker Desktop 可能未启动或 WSL/Linux engine 不可用：必须 BLOCKED，不自动宣称通过。
- 端口 `33306` 可能被占用：脚本需支持检测现有容器、复用或明确提示冲突。
- 10 万行样板验证耗时较长：`test:docker-local` 需要明确是否包含完整 sample 压测，或拆分 smoke/full 两档。
- seed 数据如果直接写库，必须通过现有 migration 和公开 service/repository 边界，避免制造与生产路径不一致的数据。

## 10. 确认后执行顺序

1. 追加 `DOCKER-TEST-DATA-AUTOMATION-001` 到 `task.json`，保持 `passes:false`。
2. 先写 `tests/mock-local/docker-test-data-plan.test.mjs`，红灯确认缺少脚本、runbook 和 evidence 映射。
3. 实现 Docker preflight 和 MySQL 自举脚本。
4. 实现幂等 seed 数据入口。
5. 增加 `package.json` script 和 runbook。
6. 运行完整验证，只有通过后才标记任务完成。

**等待确认**: 确认后再进入实现并修改 `task.json` / scripts / tests。
