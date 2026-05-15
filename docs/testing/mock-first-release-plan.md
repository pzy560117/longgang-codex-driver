# MOCK-FIRST RELEASE 计划

**功能**: FEAT-EXPORT-PLATFORM-001 统一导出平台
**任务**: RELEASE-001
**状态**: BLOCKED
**最新 trace**: `traces/RELEASE-001-20260515-070412.json`
**session**: `traces/RELEASE-001-e5b34ad7c4354a38bb4cc9b93449b344/`

## 当前结论

- `RELEASE-001` 当前最新状态是 `BLOCKED`。
- 已通过的基础 gate 包括 `npm audit`、`npm run arch:check`、`npm run typecheck`、`npm run test:contract`、`npm test`、`Redocly OpenAPI lint`。
- 当前阻塞点是缺少 `EXPORT_PLATFORM_TEST_DATABASE_URL`。
- live object storage 仍需要真实 endpoint、bucket、credential，以及 `EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true`。

## mock-first 的边界

- mock-first 只用于本地开发、联调和失败态演练。
- mock-first 可以使用本地 HTTP object storage adapter、fixture seed、受控 fake 外部数据源。
- mock-first 不得作为 `RELEASE-001` PASS 证据。
- mock-first 不得替代 live OSS/S3 证据。
- mock-first 不得替代真实 MySQL 证据。
- mock-first 不得作为 `FR-001` 到 `FR-014` 的 release evidence。

## 退出条件

- 补齐真实 MySQL 和 live object storage 环境。
- 重新执行 `npm run test:api`。
- 再执行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\release-verify.ps1`，或由 driver 重新跑 release 流程。
- 只有真实环境下的 release evidence 才能推动 `RELEASE-001` 退出 `BLOCKED`。

## 证据约束

- mock-first 证据只能标记为 `local/dev evidence`。
- mock-first 证据只能用于说明本地链路、联调用例和失败态，不可覆盖 release gate。
- 若真实依赖缺失，仍必须保留 `BLOCKED - 需要人工介入`。
