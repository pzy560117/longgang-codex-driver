# 全量需求验收测试报告

**结论**: PASS
**开始时间**: 2026-05-18T07:57:43.7255828Z
**结束时间**: 2026-05-18T08:02:43.8640663Z
**数据库**: local/Docker MySQL (redacted)
**对象存储**: local object storage mock (http://127.0.0.1:51950)

## 覆盖范围

| Requirement | 验证层 | 主要命令 |
| --- | --- | --- |
| FR-001 / FR-002 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | HTTP API / auth / audit / history / state machine | `npm run test:api`, `npm run test:acceptance` |
| FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | DB schema / repositories / durable evidence | `npm run test:db` |
| FR-005 / FR-010 / FR-012 / FR-013 | scheduler / locks / retry / cleanup polling | `npm run test:worker` |
| FR-006 / FR-008 / FR-009 / FR-014 | query executor / datasource adapter / data scope / masking | `npm run test:query` |
| FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | file service / signed download / cleanup / render failures | `npm run test:file`, `npm run test:object-storage-live` |
| FR-014 | purchase-order sample / 0-100001 row boundaries / masked output | `npm run test:sample` |
| FR-001 - FR-014 | contract, architecture, docs, local/dev evidence boundary | `npm run arch:check`, `npm run test:contract`, `npm test`, `npm run test:mock-local` |

## 命令结果

| 验证项 | Requirement | 状态 | 退出码 | 耗时秒 | 命令 |
| --- | --- | --- | ---: | ---: | --- |
| NPM high audit | FR-001 - FR-014 | PASS | 0 | 4.52 | `npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000` |
| Architecture gate | FR-001 - FR-014 | PASS | 0 | 3.31 | `npm run arch:check` |
| TypeScript typecheck | FR-001 - FR-014 | PASS | 0 | 5.35 | `npm run typecheck` |
| Contract tests | FR-001 - FR-014 | PASS | 0 | 2.4 | `npm run test:contract` |
| Base tests | FR-001 - FR-014 | PASS | 0 | 7.16 | `npm test` |
| OpenAPI lint | FR-001 - FR-014 | PASS | 0 | 9.39 | `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml` |
| Mock/local evidence guards | FR-001 - FR-014 | PASS | 0 | 6.95 | `npm run test:mock-local` |
| API integration | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 7.92 | `npm run test:api` |
| DB integration | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | PASS | 0 | 3.56 | `npm run test:db` |
| Worker integration | FR-005 / FR-010 / FR-012 / FR-013 | PASS | 0 | 11.8 | `npm run test:worker` |
| Query executor | FR-006 / FR-008 / FR-009 / FR-014 | PASS | 0 | 9.38 | `npm run test:query` |
| File service | FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | PASS | 0 | 7.61 | `npm run test:file` |
| Purchase-order sample | FR-014 | PASS | 0 | 212.58 | `npm run test:sample` |
| Acceptance matrix and API smoke | FR-001 - FR-014 | PASS | 0 | 2.56 | `npm run test:acceptance` |
| API smoke report | FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 2.57 | `npm run test:acceptance:report` |
| Object storage docker/mock smoke | FR-003 / FR-006 / FR-011 / FR-014 | PASS | 0 | 1.71 | `npm run test:object-storage-live` |
| Scoped diff check | FR-001 - FR-014 | PASS | 0 | 0.72 | `git diff --check -- contracts task.json package.json tests/acceptance tests/arch-check.test.mjs tests/sample scripts docs/testing` |

## 证据边界

- 本报告覆盖当前仓库 FR-001 至 FR-014 的本机受控验收链路。
- 证据来自 Docker/local MySQL、本地 object storage mock、Node test、OpenAPI/架构/文档守护和现有集成测试。
- 本报告不声明外部生产 MySQL、外部业务数据源、live OSS/S3 或外部网关已验证。
- `npm run test:object-storage-live` 在本脚本中由本地 object storage mock 和显式 allow flags 驱动，只能算 docker/mock smoke。

## 输出摘要

### NPM high audit

```text
found 0 vulnerabilities
```

### Architecture gate

```text

> export-platform-service@0.1.0 arch:check
> tsx scripts/arch-check.ts

Architecture check passed.
```

### TypeScript typecheck

```text

> export-platform-service@0.1.0 typecheck
> tsc --noEmit
```

### Contract tests

```text

> export-platform-service@0.1.0 test:contract
> node --test tests/contract/*.test.mjs

✔ OpenAPI operationIds are represented by route manifest entries (4.5095ms)
✔ OpenAPI handlers are production handlers with service and DB repository evidence (2.5785ms)
✔ route manifest maps operations to HTTP API integration evidence (0.8161ms)
✔ audit action, result, and errorCode literals written by production code stay within OpenAPI public enums (5.6156ms)
✔ cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name (0.4902ms)
✔ task detail schema requires public progress, error, and recentEvents fields (1.4992ms)
✔ runtime public response and task event allow-lists match OpenAPI enums (1.2097ms)
✔ public BatchCheckpoint schema exposes progress fields without internal error fields (0.71ms)
✔ public error messages are documented and implemented as code-derived safe summaries (0.8813ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.6178ms)
✔ download operation declares signed URL callback parameters and signature failures (0.8019ms)
✔ protected operations declare trusted auth context signature proof (0.8292ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (1.0722ms)
✔ create task contract guard is implemented before PENDING enqueue (1.0408ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (3.3372ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (1.317ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (1.0513ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (2.5069ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (1.5692ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 154.7514
```

### Base tests

```text

> export-platform-service@0.1.0 test
> node --import tsx --test tests/*.test.mjs tests/contract/*.test.mjs

✔ arch:check is declared as the scaffold gate (2.123ms)
✔ verify matrix marks API and DB repository boundaries as available while STACK-ADR-001 is recorded as the current design baseline (1.4295ms)
✔ createDatabase 在缺少真实数据库环境时仍可构造 Kysely 对象 (6.7366ms)
✔ MySQL pool options 使用拆分环境变量并允许 database URL 优先 (3.9095ms)
✔ DB schema、TS migration、SQL migration 的表名集合一致 (3.1985ms)
✔ DB schema、TS migration、SQL migration 的列集合一致 (4.6905ms)
✔ arch:check 拒绝 SQL migration 的表尾逗号 (1.6283ms)
✔ arch:check 的生产替
... output truncated ...
ed safe summaries (1.2099ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.8929ms)
✔ download operation declares signed URL callback parameters and signature failures (1.0305ms)
✔ protected operations declare trusted auth context signature proof (1.1516ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (1.4994ms)
✔ create task contract guard is implemented before PENDING enqueue (2.0312ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (4.5348ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (2.7787ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (4.3974ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (2.9718ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (2.9559ms)
✔ object storage live smoke blocks when endpoint or bucket is missing (1519.3204ms)
✔ object storage live smoke blocks local endpoints unless explicitly allowed by the docker mock gate (1234.2477ms)
✔ object storage live smoke requires an explicit write guard before touching a non-placeholder endpoint (1345.2666ms)
✔ 脚手架声明的服务入口脚本存在 (1.1855ms)
✔ npm test 仅覆盖当前脚手架可验证的测试文件 (0.5577ms)
✔ 验证矩阵明确包含当前脚手架验证命令 (0.3396ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40251}
✔ HTTP 服务可独立启动并暴露 health (264.9099ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40252}
✔ 公开 API 在缺少认证上下文时返回受控 401 响应 (28.8754ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4961.716
```

### OpenAPI lint

```text
No configurations were provided -- using built in [34mrecommended[39m configuration by default.
System.Management.Automation.RemoteException
[90mvalidating contracts\openapi.yaml...
[39m[90mcontracts\openapi.yaml: validated in 140ms
System.Management.Automation.RemoteException
[39m[32mWoohoo! Your API description is valid. 🎉
[39m
```

### Mock/local evidence guards

```text

> export-platform-service@0.1.0 test:mock-local
> node --import tsx --test --test-concurrency=1 tests/mock-local/*.test.mjs

✔ docker test data task is queued after release with executable guardrails (1.656ms)
✔ docker local test command wires environment setup, seed and validation (0.9317ms)
✔ verify matrix records docker test data evidence without promoting live validation (0.3206ms)
✔ local demo entrypoint provisions local dependencies and starts the HTTP service (1.5061ms)
✔ local demo setup runs migrations and seeds purchase-order demo data (0.4255ms)
✔ local demo setup rejects local tun
... output truncated ...
l release rehearsal result records API DB worker query file and sample coverage without promoting release (0.2678ms)
✔ mock-first has a dedicated local/dev test command that cannot be used as release evidence (0.9868ms)
✔ mock-first plan maps every FR to local/dev evidence without upgrading release status (2.2715ms)
✔ mock integration acceptance archives executed local/dev evidence without release promotion (1.0135ms)
✔ release task uses the local docker mock release gate (0.3062ms)
▶ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only
  ✔ registry and create task flow stay in local/dev evidence, not release evidence (2.1585ms)
  ✔ progress, detail and data scope stay visible only to the right actor (0.6201ms)
  ✔ worker lease, checkpoint, retry and cancel boundaries stay local (2.0353ms)
  ✔ query chunking, file publish/download and cleanup invalidation stay in local/dev evidence (0.9421ms)
  ✔ purchase order sample boundaries and blocked release env remain local/dev evidence (0.4306ms)
✔ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only (8.1595ms)
✔ local/dev object storage smoke exercises env-backed adapter without live OSS evidence (103.7631ms)
✔ local/dev object storage smoke keeps live object storage preflight blocked without env (1.0077ms)
✔ requirements review Markdown and JSON artifacts stay consistent (9.7358ms)
✔ test practice matrix task owns the drift guard (1.314ms)
✔ each critical test script has a task owner and documented evidence boundary (1.2483ms)
✔ release gate keeps docker mock evidence separate from external live validation (0.226ms)
✔ release gate pins the current OpenAPI lint command (0.1197ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4635.4572
```

### API integration

```text

> export-platform-service@0.1.0 test:api
> node --import tsx --test --test-concurrency=1 tests/api/*.test.mjs

✔ HTTP API requires EXPORT_PLATFORM_TEST_DATABASE_URL (2.165ms)
✔ public HTTP errors use safe messages instead of underlying Error.message (0.606ms)
✔ registry/task HTTP flow persists through Fastify + MySQL production path (3313.0754ms)
✔ trusted ingress proof is required before auth headers can grant admin or tenant context (422.3783ms)
✔ create task rejects queryParams above 32768 canonical JSON UTF-8 bytes before persistence (242.4722ms)
✔ create task rejects registry-unsupported fileFormat and invalid queryParams before enqueue (208.8475ms)
✔ create task idempotent replay returns existing task after registry guard changes (224.9011ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5760.666
```

### DB integration

```text

> export-platform-service@0.1.0 test:db
> node --import tsx --test --test-concurrency=1 tests/db/*.test.mjs

✔ DB tests require an explicit test database URL (1.5432ms)
✔ migration exposes durable evidence tables for FR-001/005/007/010/013 (99.3395ms)
✔ repositories persist registry, task idempotency, lease, checkpoint, file and audit evidence (350.1947ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1405.6019
```

### Worker integration

```text

> export-platform-service@0.1.0 test:worker
> node --import tsx --test --test-concurrency=1 tests/worker/*.test.mjs

▶ worker integration tests
  ✔ worker tests require an explicit test database URL (1.939ms)
  ✔ multiple workers dispatch only up to the registry concurrency limit and write audit/checkpoint evidence (499.8006ms)
  ✔ default scheduler query processor enforces registry dataScopeTemplate before publishing rows (554.6404ms)
  ✔ default scheduler query processor passes the datasource adapter boundary into query executor (369.7371ms)
  ✔ same worker resumes its own active lease whil
... output truncated ...
attemptNo and resumes from the latest checkpoint (402.3047ms)
  ✔ task snapshot still dispatches and publishes after the current registry is disabled and updated (473.8576ms)
  ✔ expired worker does not mark FAILED or overwrite the new owner after takeover (327.8019ms)
  ✔ executing cancel request is closed at the next persisted batch boundary (266.5001ms)
  ✔ failed execution is retried only after FAILED and increments attemptNo before redispatch (378.0116ms)
  ✔ stale executing cancel cannot overwrite a retried attempt (380.6009ms)
  ✔ query batch transient failure persists retry checkpoint and completes on the next poll (425.0618ms)
  ✔ query batch transient failure does not retry again before checkpoint backoff elapses (254.241ms)
  ✔ query batch retry resumes only after checkpoint backoff elapses (377.8265ms)
  ✔ query batch default retry limit allows three checkpoint retries before final failure (642.0534ms)
  ✔ query batch retry exhaustion fails with QUERY_EXECUTION_ERROR and persists the exhausted retry count (445.9888ms)
  ✔ query batch retry exhaustion waits for backoff before the terminal failed retry attempt (364.2686ms)
  ✔ datasource unavailable errors finish as DATASOURCE_UNAVAILABLE after retry exhaustion (249.6065ms)
  ✔ default worker maps datasource provider failures to DATASOURCE_UNAVAILABLE audits (255.3949ms)
  ✔ unknown worker error names are normalized to public QUERY_EXECUTION_ERROR audits (229.1008ms)
  ✔ cleanup job poll once records task event and audit after successful object deletion (271.0412ms)
  ✔ cleanup job poll once records retry audit and does not mark cleanup done when delete fails (270.828ms)
✔ worker integration tests (8652.3743ms)
ℹ tests 24
ℹ suites 1
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 9683.0837
```

### Query executor

```text

> export-platform-service@0.1.0 test:query
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/query requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/query/*.test.mjs

✔ query tests require an explicit test database URL (2.5195ms)
✔ seed registry uses the same contract validation as production persistence and rejects empty bypass values (437.4116ms)
✔ query executor binds template, enforces data scope, masks sensitive fields and emits QUER
... output truncated ...
ASOURCE_UNAVAILABLE without leaking adapter details (261.2177ms)
✔ query executor maps invalid datasource URL failures to DATASOURCE_UNAVAILABLE (239.0566ms)
✔ query executor maps SQL adapter failures without leaking SQL text or secrets (254.8828ms)
✔ query executor applies registry dataScopeTemplate with operatorId and roleCodes to block same org unauthorized rows (306.8838ms)
✔ query executor rejects dataScopeTemplate parameters outside the auth scope contract (280.4748ms)
✔ query executor rejects dataScopeTemplate missing required auth scope placeholders (317.9762ms)
✔ query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount (355.601ms)
✔ query executor replays the task config snapshot after the current registry changes (317.5266ms)
✔ query executor accepts legacy string checkpoint cursors while producing structured cursor tokens (334.0383ms)
✔ query executor rejects rows with missing or null cursor values (277.9423ms)
✔ query executor rejects duplicate cursor values (293.2639ms)
✔ query executor rejects non-increasing cursor values without duplicates (286.392ms)
✔ query executor rejects checkpoints missing required cursor fields (276.7981ms)
✔ query executor rejects unsafe template forms and undeclared placeholders (340.5268ms)
✔ seed registry rejects missing masking rules for sensitive exportable fields before persistence (205.1784ms)
✔ query executor rejects field mappings that do not match selected columns (234.4985ms)
✔ query executor enforces exportMaxRows before crossing registry limit (296.3542ms)
✔ query executor classifies datasource adapter and credential failures as DATASOURCE_UNAVAILABLE (0.6633ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 7233.4578
```

### File service

```text

> export-platform-service@0.1.0 test:file
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/file requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/file/*.test.mjs

✔ file tests require an explicit test database URL (1.4857ms)
✔ production object storage config is required outside injected test adapters (0.3322ms)
✔ file service writes temp object, verifies checksum, and publishes ZIP metadata through a production-equivalent storage adapter (344.4293ms)
✔ env-backed object storage adapter publishes ZIP metadata through a local HTTP endpoint and returns a downloadable URL (541.0667ms)
✔ checksum failure prevents publish and metadata from becoming downloadable (220.0639ms)
✔ object storage put failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (164.8536ms)
✔ object storage read failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (171.9266ms)
✔ object storage publish failure is mapped to FILE_VERIFY_ERROR and keeps metadata undisclosed (198.9567ms)
✔ xlsx renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (149.7135ms)
✔ zip renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (145.8316ms)
✔ scheduler publishes file metadata before marking a completed batch as COMPLETED (363.2448ms)
✔ scheduler maps object storage put failure to FAILED task with FILE_VERIFY_ERROR audit (376.8293ms)
✔ scheduler maps object storage read failure to FAILED task with FILE_VERIFY_ERROR audit (330.2378ms)
✔ scheduler maps renderer failure to FAILED task with EXPORT_RENDER_ERROR audit (371.3145ms)
✔ cleanup job invalidates expired metadata before deleting object and download is guarded (324.086ms)
✔ cleanup job deletes only published object when temp storage key is null (315.0732ms)
✔ cleanup job keeps retry evidence when object delete fails and leaves download invalidated (312.3867ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5432.3838
```

### Purchase-order sample

```text

> export-platform-service@0.1.0 test:sample
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/sample requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/sample/*.test.mjs

▶ sample purchase-order integration tests
  ✔ sample suite blocks env-backed live object storage when config is missing and keeps adapter evidence scoped as production-equivalent (2.0022ms)
  ✔ sample purchase-order registry contract is registered through the public registry service (375.05ms)
  ✔ sample boundary 0 rows completes through the public create and worker chain (769.1271ms)
  ✔ sample boundary 1 row keeps final file masked and records create/query/file/audit/download evidence (701.1943ms)
  ✔ sample boundary 20000 rows completes with a single-file package (15332.9344ms)
  ✔ sample boundary 20001 rows packages ZIP evidence without losing rows (15260.2381ms)
  ✔ sample boundary 100000 rows stays on the default batch path and publishes every row (124507.1372ms)
  ✔ sample boundary 100001 rows must be rejected under the default export limit (52372.02ms)
  ✔ sample registry rejects missing masking rules before creating a task (15.0595ms)
✔ sample purchase-order integration tests (209337.0777ms)
ℹ tests 9
ℹ suites 1
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 210430.8676
```

### Acceptance matrix and API smoke

```text

> export-platform-service@0.1.0 test:acceptance
> node --import tsx --test --test-concurrency=1 tests/acceptance/*.test.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (316.9604ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (147.7952ms)
✔ full acceptance report task covers every product requirement (0.511ms)
✔ full acceptance report command includes all critical verification layers (0.6081ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1296.2747
```

### API smoke report

```text

> export-platform-service@0.1.0 test:acceptance:report
> node --import tsx scripts/run-acceptance-report.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (354.0767ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (148.1762ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1149.45
acceptance report written: docs\testing\api-acceptance-test-report.md
```

### Object storage docker/mock smoke

```text

> export-platform-service@0.1.0 test:object-storage-live
> node --import tsx scripts/object-storage-live-smoke.mjs

Live object storage smoke passed.
```

### Scoped diff check

```text
warning: in the working copy of 'docs/testing/api-acceptance-test-report.md', LF will be replaced by CRLF the next time Git touches it
```


