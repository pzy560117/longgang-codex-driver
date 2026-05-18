# 全量需求验收测试报告

**结论**: PASS
**开始时间**: 2026-05-18T03:20:49.4638231Z
**结束时间**: 2026-05-18T03:24:40.8870956Z
**数据库**: local/Docker MySQL (redacted)
**对象存储**: local object storage mock (http://127.0.0.1:53396)

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
| NPM high audit | FR-001 - FR-014 | PASS | 0 | 3.18 | `npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000` |
| Architecture gate | FR-001 - FR-014 | PASS | 0 | 2.02 | `npm run arch:check` |
| TypeScript typecheck | FR-001 - FR-014 | PASS | 0 | 2.75 | `npm run typecheck` |
| Contract tests | FR-001 - FR-014 | PASS | 0 | 1.27 | `npm run test:contract` |
| Base tests | FR-001 - FR-014 | PASS | 0 | 3.03 | `npm test` |
| OpenAPI lint | FR-001 - FR-014 | PASS | 0 | 5.1 | `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml` |
| Mock/local evidence guards | FR-001 - FR-014 | PASS | 0 | 3.74 | `npm run test:mock-local` |
| API integration | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 4.87 | `npm run test:api` |
| DB integration | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | PASS | 0 | 1.89 | `npm run test:db` |
| Worker integration | FR-005 / FR-010 / FR-012 / FR-013 | PASS | 0 | 7.75 | `npm run test:worker` |
| Query executor | FR-006 / FR-008 / FR-009 / FR-014 | PASS | 0 | 6.65 | `npm run test:query` |
| File service | FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | PASS | 0 | 4.82 | `npm run test:file` |
| Purchase-order sample | FR-014 | PASS | 0 | 175.08 | `npm run test:sample` |
| Acceptance matrix and API smoke | FR-001 - FR-014 | PASS | 0 | 3.06 | `npm run test:acceptance` |
| API smoke report | FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 2.93 | `npm run test:acceptance:report` |
| Object storage docker/mock smoke | FR-003 / FR-006 / FR-011 / FR-014 | PASS | 0 | 1.99 | `npm run test:object-storage-live` |
| Scoped diff check | FR-001 - FR-014 | PASS | 0 | 0.86 | `git diff --check -- contracts task.json package.json tests/acceptance tests/arch-check.test.mjs tests/sample scripts docs/testing` |

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

✔ OpenAPI operationIds are represented by route manifest entries (3.6031ms)
✔ OpenAPI handlers are production handlers with service and DB repository evidence (2.7874ms)
✔ route manifest maps operations to HTTP API integration evidence (0.7453ms)
✔ audit action, result, and errorCode literals written by production code stay within OpenAPI public enums (3.6063ms)
✔ cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name (0.5141ms)
✔ task detail schema requires public progress, error, and recentEvents fields (1.1104ms)
✔ runtime public response and task event allow-lists match OpenAPI enums (1.0804ms)
✔ public BatchCheckpoint schema exposes progress fields without internal error fields (0.5888ms)
✔ public error messages are documented and implemented as code-derived safe summaries (0.8983ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.6133ms)
✔ download operation declares signed URL callback parameters and signature failures (0.6386ms)
✔ protected operations declare trusted auth context signature proof (0.8045ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (1.0627ms)
✔ create task contract guard is implemented before PENDING enqueue (1.0741ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (2.2329ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (0.8148ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (1.0122ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (1.7638ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (1.6275ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 122.8191
```

### Base tests

```text

> export-platform-service@0.1.0 test
> node --import tsx --test tests/*.test.mjs tests/contract/*.test.mjs

✔ arch:check is declared as the scaffold gate (0.6716ms)
✔ verify matrix marks API and DB repository boundaries as available while STACK-ADR-001 is recorded as the current design baseline (0.3559ms)
✔ createDatabase 在缺少真实数据库环境时仍可构造 Kysely 对象 (2.1038ms)
✔ MySQL pool options 使用拆分环境变量并允许 database URL 优先 (0.8105ms)
✔ DB schema、TS migration、SQL migration 的表名集合一致 (0.558ms)
✔ DB schema、TS migration、SQL migration 的列集合一致 (2.9497ms)
✔ arch:check 拒绝 SQL migration 的表尾逗号 (0.5469ms)
✔ arch:check 的生产替
... output truncated ...
-derived safe summaries (0.612ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.6202ms)
✔ download operation declares signed URL callback parameters and signature failures (0.6065ms)
✔ protected operations declare trusted auth context signature proof (0.7773ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (0.8316ms)
✔ create task contract guard is implemented before PENDING enqueue (1.0164ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (2.0149ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (0.6676ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (0.837ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (1.4935ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (1.33ms)
✔ object storage live smoke blocks when endpoint or bucket is missing (620.9798ms)
✔ object storage live smoke blocks local endpoints unless explicitly allowed by the docker mock gate (448.1637ms)
✔ object storage live smoke requires an explicit write guard before touching a non-placeholder endpoint (500.3959ms)
✔ 脚手架声明的服务入口脚本存在 (0.6405ms)
✔ npm test 仅覆盖当前脚手架可验证的测试文件 (0.1992ms)
✔ 验证矩阵明确包含当前脚手架验证命令 (0.1466ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40251}
✔ HTTP 服务可独立启动并暴露 health (116.6966ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40252}
✔ 公开 API 在缺少认证上下文时返回受控 401 响应 (13.4251ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1868.6463
```

### OpenAPI lint

```text
No configurations were provided -- using built in [34mrecommended[39m configuration by default.
System.Management.Automation.RemoteException
[90mvalidating contracts\openapi.yaml...
[39m[90mcontracts\openapi.yaml: validated in 99ms
System.Management.Automation.RemoteException
[39m[32mWoohoo! Your API description is valid. 🎉
[39m
```

### Mock/local evidence guards

```text

> export-platform-service@0.1.0 test:mock-local
> node --import tsx --test --test-concurrency=1 tests/mock-local/*.test.mjs

✔ docker test data task is queued after release with executable guardrails (0.8882ms)
✔ docker local test command wires environment setup, seed and validation (2.9367ms)
✔ verify matrix records docker test data evidence without promoting live validation (0.2078ms)
✔ local demo entrypoint provisions local dependencies and starts the HTTP service (0.873ms)
✔ local demo setup runs migrations and seeds purchase-order demo data (0.243ms)
✔ local demo setup rejects local tunn
... output truncated ...
al release rehearsal result records API DB worker query file and sample coverage without promoting release (0.1483ms)
✔ mock-first has a dedicated local/dev test command that cannot be used as release evidence (0.6035ms)
✔ mock-first plan maps every FR to local/dev evidence without upgrading release status (1.0501ms)
✔ mock integration acceptance archives executed local/dev evidence without release promotion (0.607ms)
✔ release task uses the local docker mock release gate (0.185ms)
▶ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only
  ✔ registry and create task flow stay in local/dev evidence, not release evidence (1.0686ms)
  ✔ progress, detail and data scope stay visible only to the right actor (0.2913ms)
  ✔ worker lease, checkpoint, retry and cancel boundaries stay local (1.1339ms)
  ✔ query chunking, file publish/download and cleanup invalidation stay in local/dev evidence (0.4776ms)
  ✔ purchase order sample boundaries and blocked release env remain local/dev evidence (0.2394ms)
✔ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only (4.1782ms)
✔ local/dev object storage smoke exercises env-backed adapter without live OSS evidence (42.7303ms)
✔ local/dev object storage smoke keeps live object storage preflight blocked without env (0.4434ms)
✔ requirements review Markdown and JSON artifacts stay consistent (5.0789ms)
✔ test practice matrix task owns the drift guard (0.5607ms)
✔ each critical test script has a task owner and documented evidence boundary (0.7628ms)
✔ release gate keeps docker mock evidence separate from external live validation (0.1294ms)
✔ release gate pins the current OpenAPI lint command (0.1002ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2522.0073
```

### API integration

```text

> export-platform-service@0.1.0 test:api
> node --import tsx --test --test-concurrency=1 tests/api/*.test.mjs

✔ HTTP API requires EXPORT_PLATFORM_TEST_DATABASE_URL (0.6983ms)
✔ public HTTP errors use safe messages instead of underlying Error.message (0.3336ms)
✔ registry/task HTTP flow persists through Fastify + MySQL production path (2198.9057ms)
✔ trusted ingress proof is required before auth headers can grant admin or tenant context (269.9229ms)
✔ create task rejects queryParams above 32768 canonical JSON UTF-8 bytes before persistence (141.1969ms)
✔ create task rejects registry-unsupported fileFormat and invalid queryParams before enqueue (134.2676ms)
✔ create task idempotent replay returns existing task after registry guard changes (124.1106ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3689.9227
```

### DB integration

```text

> export-platform-service@0.1.0 test:db
> node --import tsx --test --test-concurrency=1 tests/db/*.test.mjs

✔ DB tests require an explicit test database URL (0.6933ms)
✔ migration exposes durable evidence tables for FR-001/005/007/010/013 (74.4569ms)
✔ repositories persist registry, task idempotency, lease, checkpoint, file and audit evidence (165.2715ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 727.2027
```

### Worker integration

```text

> export-platform-service@0.1.0 test:worker
> node --import tsx --test --test-concurrency=1 tests/worker/*.test.mjs

▶ worker integration tests
  ✔ worker tests require an explicit test database URL (0.8136ms)
  ✔ multiple workers dispatch only up to the registry concurrency limit and write audit/checkpoint evidence (322.163ms)
  ✔ default scheduler query processor enforces registry dataScopeTemplate before publishing rows (363.9193ms)
  ✔ default scheduler query processor passes the datasource adapter boundary into query executor (264.7967ms)
  ✔ same worker resumes its own active lease whil
... output truncated ...
s attemptNo and resumes from the latest checkpoint (270.1936ms)
  ✔ task snapshot still dispatches and publishes after the current registry is disabled and updated (247.932ms)
  ✔ expired worker does not mark FAILED or overwrite the new owner after takeover (238.5101ms)
  ✔ executing cancel request is closed at the next persisted batch boundary (200.0449ms)
  ✔ failed execution is retried only after FAILED and increments attemptNo before redispatch (378.68ms)
  ✔ stale executing cancel cannot overwrite a retried attempt (218.8378ms)
  ✔ query batch transient failure persists retry checkpoint and completes on the next poll (279.4868ms)
  ✔ query batch transient failure does not retry again before checkpoint backoff elapses (190.2114ms)
  ✔ query batch retry resumes only after checkpoint backoff elapses (290.0636ms)
  ✔ query batch default retry limit allows three checkpoint retries before final failure (397.9675ms)
  ✔ query batch retry exhaustion fails with QUERY_EXECUTION_ERROR and persists the exhausted retry count (246.1207ms)
  ✔ query batch retry exhaustion waits for backoff before the terminal failed retry attempt (263.1752ms)
  ✔ datasource unavailable errors finish as DATASOURCE_UNAVAILABLE after retry exhaustion (181.4331ms)
  ✔ default worker maps datasource provider failures to DATASOURCE_UNAVAILABLE audits (185.6888ms)
  ✔ unknown worker error names are normalized to public QUERY_EXECUTION_ERROR audits (166.5472ms)
  ✔ cleanup job poll once records task event and audit after successful object deletion (187.6596ms)
  ✔ cleanup job poll once records retry audit and does not mark cleanup done when delete fails (198.5563ms)
✔ worker integration tests (5965.2479ms)
ℹ tests 24
ℹ suites 1
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6608.1653
```

### Query executor

```text

> export-platform-service@0.1.0 test:query
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/query requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/query/*.test.mjs

✔ query tests require an explicit test database URL (0.9791ms)
✔ seed registry uses the same contract validation as production persistence and rejects empty bypass values (290.2287ms)
✔ query executor binds template, enforces data scope, masks sensitive fields and emits QUER
... output truncated ...
OURCE_UNAVAILABLE without leaking adapter details (202.2444ms)
✔ query executor maps invalid datasource URL failures to DATASOURCE_UNAVAILABLE (195.1019ms)
✔ query executor maps SQL adapter failures without leaking SQL text or secrets (180.4389ms)
✔ query executor applies registry dataScopeTemplate with operatorId and roleCodes to block same org unauthorized rows (279.1965ms)
✔ query executor rejects dataScopeTemplate parameters outside the auth scope contract (227.7369ms)
✔ query executor rejects dataScopeTemplate missing required auth scope placeholders (213.5288ms)
✔ query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount (321.4904ms)
✔ query executor replays the task config snapshot after the current registry changes (280.7467ms)
✔ query executor accepts legacy string checkpoint cursors while producing structured cursor tokens (265.0276ms)
✔ query executor rejects rows with missing or null cursor values (215.0857ms)
✔ query executor rejects duplicate cursor values (209.8006ms)
✔ query executor rejects non-increasing cursor values without duplicates (212.3649ms)
✔ query executor rejects checkpoints missing required cursor fields (211.7386ms)
✔ query executor rejects unsafe template forms and undeclared placeholders (247.4497ms)
✔ seed registry rejects missing masking rules for sensitive exportable fields before persistence (168.5417ms)
✔ query executor rejects field mappings that do not match selected columns (186.9125ms)
✔ query executor enforces exportMaxRows before crossing registry limit (219.1822ms)
✔ query executor classifies datasource adapter and credential failures as DATASOURCE_UNAVAILABLE (0.2883ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5358.9435
```

### File service

```text

> export-platform-service@0.1.0 test:file
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/file requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/file/*.test.mjs

✔ file tests require an explicit test database URL (0.9397ms)
✔ production object storage config is required outside injected test adapters (0.2169ms)
✔ file service writes temp object, verifies checksum, and publishes ZIP metadata through a production-equivalent storage adapter (242.5374ms)
✔ env-backed object storage adapter publishes ZIP metadata through a local HTTP endpoint and returns a downloadable URL (234.0205ms)
✔ checksum failure prevents publish and metadata from becoming downloadable (169.4517ms)
✔ object storage put failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (99.51ms)
✔ object storage read failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (112.5484ms)
✔ object storage publish failure is mapped to FILE_VERIFY_ERROR and keeps metadata undisclosed (120.4391ms)
✔ xlsx renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (120.4252ms)
✔ zip renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (106.9702ms)
✔ scheduler publishes file metadata before marking a completed batch as COMPLETED (237.9735ms)
✔ scheduler maps object storage put failure to FAILED task with FILE_VERIFY_ERROR audit (258.1456ms)
✔ scheduler maps object storage read failure to FAILED task with FILE_VERIFY_ERROR audit (226.3427ms)
✔ scheduler maps renderer failure to FAILED task with EXPORT_RENDER_ERROR audit (237.6405ms)
✔ cleanup job invalidates expired metadata before deleting object and download is guarded (267.5703ms)
✔ cleanup job deletes only published object when temp storage key is null (235.9196ms)
✔ cleanup job keeps retry evidence when object delete fails and leaves download invalidated (230.6131ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3505.6543
```

### Purchase-order sample

```text

> export-platform-service@0.1.0 test:sample
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/sample requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/sample/*.test.mjs

▶ sample purchase-order integration tests
  ✔ sample suite blocks env-backed live object storage when config is missing and keeps adapter evidence scoped as production-equivalent (0.7383ms)
  ✔ sample purchase-order registry contract is registered through the public registry service (274.8914ms)
  ✔ sample boundary 0 rows completes through the public create and worker chain (469.432ms)
  ✔ sample boundary 1 row keeps final file masked and records create/query/file/audit/download evidence (534.0534ms)
  ✔ sample boundary 20000 rows completes with a single-file package (8884.2774ms)
  ✔ sample boundary 20001 rows packages ZIP evidence without losing rows (8830.6766ms)
  ✔ sample boundary 100000 rows stays on the default batch path and publishes every row (88530.6972ms)
  ✔ sample boundary 100001 rows must be rejected under the default export limit (65714.181ms)
  ✔ sample registry rejects missing masking rules before creating a task (14.5032ms)
✔ sample purchase-order integration tests (173254.7822ms)
ℹ tests 9
ℹ suites 1
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 173880.252
```

### Acceptance matrix and API smoke

```text

> export-platform-service@0.1.0 test:acceptance
> node --import tsx --test --test-concurrency=1 tests/acceptance/*.test.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (392.1602ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (156.0686ms)
✔ full acceptance report task covers every product requirement (0.8335ms)
✔ full acceptance report command includes all critical verification layers (0.4013ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1581.9391
```

### API smoke report

```text

> export-platform-service@0.1.0 test:acceptance:report
> node --import tsx scripts/run-acceptance-report.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (353.466ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (151.9395ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1315.5671
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
warning: in the working copy of 'docs/testing/full-acceptance-test-report.md', LF will be replaced by CRLF the next time Git touches it
```


