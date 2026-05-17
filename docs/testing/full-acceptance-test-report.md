# 全量需求验收测试报告

**结论**: PASS
**开始时间**: 2026-05-17T03:27:06.4646833Z
**结束时间**: 2026-05-17T03:30:33.0364088Z
**数据库**: local/Docker MySQL (redacted)
**对象存储**: local object storage mock (http://127.0.0.1:60518)

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
| NPM high audit | FR-001 - FR-014 | PASS | 0 | 2.24 | `npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000` |
| Architecture gate | FR-001 - FR-014 | PASS | 0 | 1.65 | `npm run arch:check` |
| TypeScript typecheck | FR-001 - FR-014 | PASS | 0 | 2.65 | `npm run typecheck` |
| Contract tests | FR-001 - FR-014 | PASS | 0 | 1.11 | `npm run test:contract` |
| Base tests | FR-001 - FR-014 | PASS | 0 | 1.91 | `npm test` |
| OpenAPI lint | FR-001 - FR-014 | PASS | 0 | 15.18 | `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml` |
| Mock/local evidence guards | FR-001 - FR-014 | PASS | 0 | 3.43 | `npm run test:mock-local` |
| API integration | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 4.48 | `npm run test:api` |
| DB integration | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | PASS | 0 | 1.76 | `npm run test:db` |
| Worker integration | FR-005 / FR-010 / FR-012 / FR-013 | PASS | 0 | 7.14 | `npm run test:worker` |
| Query executor | FR-006 / FR-008 / FR-009 / FR-014 | PASS | 0 | 5.72 | `npm run test:query` |
| File service | FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | PASS | 0 | 4.57 | `npm run test:file` |
| Purchase-order sample | FR-014 | PASS | 0 | 146.94 | `npm run test:sample` |
| Acceptance matrix and API smoke | FR-001 - FR-014 | PASS | 0 | 2.43 | `npm run test:acceptance` |
| API smoke report | FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 2.27 | `npm run test:acceptance:report` |
| Object storage docker/mock smoke | FR-003 / FR-006 / FR-011 / FR-014 | PASS | 0 | 1.49 | `npm run test:object-storage-live` |
| Scoped diff check | FR-001 - FR-014 | PASS | 0 | 0.65 | `git diff --check -- contracts task.json package.json tests/acceptance tests/arch-check.test.mjs tests/sample scripts docs/testing` |

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

✔ OpenAPI operationIds are represented by route manifest entries (1.9317ms)
✔ OpenAPI handlers are production handlers with service and DB repository evidence (1.3475ms)
✔ route manifest maps operations to HTTP API integration evidence (0.4007ms)
✔ audit action, result, and errorCode literals written by production code stay within OpenAPI public enums (2.0613ms)
✔ cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name (0.2215ms)
✔ task detail schema requires public progress, error, and recentEvents fields (0.576ms)
✔ runtime public response and task event allow-lists match OpenAPI enums (0.6614ms)
✔ public BatchCheckpoint schema exposes progress fields without internal error fields (0.3579ms)
✔ public error messages are documented and implemented as code-derived safe summaries (0.445ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.354ms)
✔ download operation declares signed URL callback parameters and signature failures (0.4012ms)
✔ protected operations declare trusted auth context signature proof (0.4195ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (0.5185ms)
✔ create task contract guard is implemented before PENDING enqueue (0.6169ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (1.7828ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (0.4627ms)
ℹ tests 16
ℹ suites 0
ℹ pass 16
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 76.3055
```

### Base tests

```text

> export-platform-service@0.1.0 test
> node --import tsx --test tests/*.test.mjs tests/contract/*.test.mjs

✔ arch:check is declared as the scaffold gate (0.7092ms)
✔ verify matrix marks API and DB repository boundaries as available while STACK-ADR-001 is recorded as the current design baseline (0.3619ms)
✔ createDatabase 在缺少真实数据库环境时仍可构造 Kysely 对象 (1.6773ms)
✔ MySQL pool options 使用拆分环境变量并允许 database URL 优先 (0.6775ms)
✔ DB schema、TS migration、SQL migration 的表名集合一致 (0.3643ms)
✔ DB schema、TS migration、SQL migration 的列集合一致 (2.2933ms)
✔ arch:check 拒绝 SQL migration 的表尾逗号 (0.5341ms)
✔ arch:check 的生产
... output truncated ...
pository evidence (1.2969ms)
✔ route manifest maps operations to HTTP API integration evidence (0.4433ms)
✔ audit action, result, and errorCode literals written by production code stay within OpenAPI public enums (1.7037ms)
✔ cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name (0.2984ms)
✔ task detail schema requires public progress, error, and recentEvents fields (0.6077ms)
✔ runtime public response and task event allow-lists match OpenAPI enums (0.7554ms)
✔ public BatchCheckpoint schema exposes progress fields without internal error fields (0.4627ms)
✔ public error messages are documented and implemented as code-derived safe summaries (0.5003ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.3639ms)
✔ download operation declares signed URL callback parameters and signature failures (0.4032ms)
✔ protected operations declare trusted auth context signature proof (0.4575ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (0.4695ms)
✔ create task contract guard is implemented before PENDING enqueue (0.6193ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (1.3813ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (0.5768ms)
✔ 脚手架声明的服务入口脚本存在 (0.58ms)
✔ npm test 仅覆盖当前脚手架可验证的测试文件 (0.2177ms)
✔ 验证矩阵明确包含当前脚手架验证命令 (0.1089ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40251}
✔ HTTP 服务可独立启动并暴露 health (106.0025ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40252}
✔ 公开 API 在缺少认证上下文时返回受控 401 响应 (11.1368ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 866.4307
```

### OpenAPI lint

```text
No configurations were provided -- using built in [34mrecommended[39m configuration by default.
System.Management.Automation.RemoteException
[90mvalidating contracts\openapi.yaml...
[39m[90mcontracts\openapi.yaml: validated in 97ms
System.Management.Automation.RemoteException
[39m[32mWoohoo! Your API description is valid. 🎉
[39m
```

### Mock/local evidence guards

```text

> export-platform-service@0.1.0 test:mock-local
> node --import tsx --test --test-concurrency=1 tests/mock-local/*.test.mjs

✔ docker test data task is queued after release with executable guardrails (0.8443ms)
✔ docker local test command wires environment setup, seed and validation (0.5112ms)
✔ verify matrix records docker test data evidence without promoting live validation (0.1479ms)
✔ local demo entrypoint provisions local dependencies and starts the HTTP service (1.2326ms)
✔ local demo setup runs migrations and seeds purchase-order demo data (0.2404ms)
✔ local demo setup rejects local tu
... output truncated ...
cal release rehearsal result records API DB worker query file and sample coverage without promoting release (0.1291ms)
✔ mock-first has a dedicated local/dev test command that cannot be used as release evidence (0.556ms)
✔ mock-first plan maps every FR to local/dev evidence without upgrading release status (1.1252ms)
✔ mock integration acceptance archives executed local/dev evidence without release promotion (0.5131ms)
✔ release task uses the local docker mock release gate (0.1508ms)
▶ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only
  ✔ registry and create task flow stay in local/dev evidence, not release evidence (1.0231ms)
  ✔ progress, detail and data scope stay visible only to the right actor (0.3051ms)
  ✔ worker lease, checkpoint, retry and cancel boundaries stay local (1.0593ms)
  ✔ query chunking, file publish/download and cleanup invalidation stay in local/dev evidence (0.4766ms)
  ✔ purchase order sample boundaries and blocked release env remain local/dev evidence (0.2139ms)
✔ mock-local integration flow keeps FR-001 to FR-014 in local/dev evidence only (4.0297ms)
✔ local/dev object storage smoke exercises env-backed adapter without live OSS evidence (43.4874ms)
✔ local/dev object storage smoke keeps live object storage preflight blocked without env (0.455ms)
✔ requirements review Markdown and JSON artifacts stay consistent (5.2815ms)
✔ test practice matrix task owns the drift guard (0.8535ms)
✔ each critical test script has a task owner and documented evidence boundary (0.6971ms)
✔ release gate keeps docker mock evidence separate from external live validation (0.104ms)
✔ release gate pins the current OpenAPI lint command (0.0615ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2390.2849
```

### API integration

```text

> export-platform-service@0.1.0 test:api
> node --import tsx --test --test-concurrency=1 tests/api/*.test.mjs

✔ HTTP API requires EXPORT_PLATFORM_TEST_DATABASE_URL (0.6948ms)
✔ public HTTP errors use safe messages instead of underlying Error.message (0.343ms)
✔ registry/task HTTP flow persists through Fastify + MySQL production path (2123.6975ms)
✔ trusted ingress proof is required before auth headers can grant admin or tenant context (240.3411ms)
✔ create task rejects queryParams above 32768 canonical JSON UTF-8 bytes before persistence (123.9786ms)
✔ create task rejects registry-unsupported fileFormat and invalid queryParams before enqueue (126.5758ms)
✔ create task idempotent replay returns existing task after registry guard changes (118.5862ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3412.7216
```

### DB integration

```text

> export-platform-service@0.1.0 test:db
> node --import tsx --test --test-concurrency=1 tests/db/*.test.mjs

✔ DB tests require an explicit test database URL (0.6717ms)
✔ migration exposes durable evidence tables for FR-001/005/007/010/013 (53.7557ms)
✔ repositories persist registry, task idempotency, lease, checkpoint, file and audit evidence (132.9489ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 676.2001
```

### Worker integration

```text

> export-platform-service@0.1.0 test:worker
> node --import tsx --test --test-concurrency=1 tests/worker/*.test.mjs

▶ worker integration tests
  ✔ worker tests require an explicit test database URL (0.7799ms)
  ✔ multiple workers dispatch only up to the registry concurrency limit and write audit/checkpoint evidence (296.8565ms)
  ✔ default scheduler query processor enforces registry dataScopeTemplate before publishing rows (407.7209ms)
  ✔ default scheduler query processor passes the datasource adapter boundary into query executor (233.7327ms)
  ✔ same worker resumes its own active lease whi
... output truncated ...
ttemptNo and resumes from the latest checkpoint (260.9815ms)
  ✔ task snapshot still dispatches and publishes after the current registry is disabled and updated (221.1796ms)
  ✔ expired worker does not mark FAILED or overwrite the new owner after takeover (222.8021ms)
  ✔ executing cancel request is closed at the next persisted batch boundary (197.1326ms)
  ✔ failed execution is retried only after FAILED and increments attemptNo before redispatch (254.2886ms)
  ✔ stale executing cancel cannot overwrite a retried attempt (203.4688ms)
  ✔ query batch transient failure persists retry checkpoint and completes on the next poll (279.1525ms)
  ✔ query batch transient failure does not retry again before checkpoint backoff elapses (174.1137ms)
  ✔ query batch retry resumes only after checkpoint backoff elapses (259.4957ms)
  ✔ query batch default retry limit allows three checkpoint retries before final failure (390.2777ms)
  ✔ query batch retry exhaustion fails with QUERY_EXECUTION_ERROR and persists the exhausted retry count (241.5165ms)
  ✔ query batch retry exhaustion waits for backoff before the terminal failed retry attempt (237.0041ms)
  ✔ datasource unavailable errors finish as DATASOURCE_UNAVAILABLE after retry exhaustion (171.8676ms)
  ✔ default worker maps datasource provider failures to DATASOURCE_UNAVAILABLE audits (164.4349ms)
  ✔ unknown worker error names are normalized to public QUERY_EXECUTION_ERROR audits (160.4651ms)
  ✔ cleanup job poll once records task event and audit after successful object deletion (157.9577ms)
  ✔ cleanup job poll once records retry audit and does not mark cleanup done when delete fails (158.8323ms)
✔ worker integration tests (5473.0187ms)
ℹ tests 24
ℹ suites 1
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6078.1838
```

### Query executor

```text

> export-platform-service@0.1.0 test:query
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/query requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/query/*.test.mjs

✔ query tests require an explicit test database URL (1.1071ms)
✔ seed registry uses the same contract validation as production persistence and rejects empty bypass values (227.569ms)
✔ query executor binds template, enforces data scope, masks sensitive fields and emits QUERY
... output truncated ...
SOURCE_UNAVAILABLE without leaking adapter details (205.1168ms)
✔ query executor maps invalid datasource URL failures to DATASOURCE_UNAVAILABLE (158.0137ms)
✔ query executor maps SQL adapter failures without leaking SQL text or secrets (163.7137ms)
✔ query executor applies registry dataScopeTemplate with operatorId and roleCodes to block same org unauthorized rows (214.5746ms)
✔ query executor rejects dataScopeTemplate parameters outside the auth scope contract (186.1185ms)
✔ query executor rejects dataScopeTemplate missing required auth scope placeholders (193.045ms)
✔ query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount (238.0725ms)
✔ query executor replays the task config snapshot after the current registry changes (225.1346ms)
✔ query executor accepts legacy string checkpoint cursors while producing structured cursor tokens (246.9924ms)
✔ query executor rejects rows with missing or null cursor values (250.8132ms)
✔ query executor rejects duplicate cursor values (205.1353ms)
✔ query executor rejects non-increasing cursor values without duplicates (189.2185ms)
✔ query executor rejects checkpoints missing required cursor fields (182.9678ms)
✔ query executor rejects unsafe template forms and undeclared placeholders (212.3046ms)
✔ seed registry rejects missing masking rules for sensitive exportable fields before persistence (142.4355ms)
✔ query executor rejects field mappings that do not match selected columns (163.4276ms)
✔ query executor enforces exportMaxRows before crossing registry limit (177.0378ms)
✔ query executor classifies datasource adapter and credential failures as DATASOURCE_UNAVAILABLE (0.3179ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4657.3507
```

### File service

```text

> export-platform-service@0.1.0 test:file
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/file requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/file/*.test.mjs

✔ file tests require an explicit test database URL (0.8487ms)
✔ production object storage config is required outside injected test adapters (0.1835ms)
✔ file service writes temp object, verifies checksum, and publishes ZIP metadata through a production-equivalent storage adapter (383.2316ms)
✔ env-backed object storage adapter publishes ZIP metadata through a local HTTP endpoint and returns a downloadable URL (216.741ms)
✔ checksum failure prevents publish and metadata from becoming downloadable (146.1097ms)
✔ object storage put failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (108.7571ms)
✔ object storage read failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (114.9551ms)
✔ object storage publish failure is mapped to FILE_VERIFY_ERROR and keeps metadata undisclosed (121.6034ms)
✔ xlsx renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (104.5547ms)
✔ zip renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (94.1891ms)
✔ scheduler publishes file metadata before marking a completed batch as COMPLETED (242.9428ms)
✔ scheduler maps object storage put failure to FAILED task with FILE_VERIFY_ERROR audit (221.2939ms)
✔ scheduler maps object storage read failure to FAILED task with FILE_VERIFY_ERROR audit (237.2747ms)
✔ scheduler maps renderer failure to FAILED task with EXPORT_RENDER_ERROR audit (237.0243ms)
✔ cleanup job invalidates expired metadata before deleting object and download is guarded (240.4693ms)
✔ cleanup job deletes only published object when temp storage key is null (234.6666ms)
✔ cleanup job keeps retry evidence when object delete fails and leaves download invalidated (215.6109ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3458.631
```

### Purchase-order sample

```text

> export-platform-service@0.1.0 test:sample
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/sample requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/sample/*.test.mjs

▶ sample purchase-order integration tests
  ✔ sample suite blocks env-backed live object storage when config is missing and keeps adapter evidence scoped as production-equivalent (0.7472ms)
  ✔ sample purchase-order registry contract is registered through the public registry service (257.9424ms)
  ✔ sample boundary 0 rows completes through the public create and worker chain (420.5297ms)
  ✔ sample boundary 1 row keeps final file masked and records create/query/file/audit/download evidence (462.4825ms)
  ✔ sample boundary 20000 rows completes with a single-file package (8079.6254ms)
  ✔ sample boundary 20001 rows packages ZIP evidence without losing rows (8385.6278ms)
  ✔ sample boundary 100000 rows stays on the default batch path and publishes every row (78653.4406ms)
  ✔ sample boundary 100001 rows must be rejected under the default export limit (48976.2666ms)
  ✔ sample registry rejects missing masking rules before creating a task (12.5581ms)
✔ sample purchase-order integration tests (145250.435ms)
ℹ tests 9
ℹ suites 1
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 145814.3969
```

### Acceptance matrix and API smoke

```text

> export-platform-service@0.1.0 test:acceptance
> node --import tsx --test --test-concurrency=1 tests/acceptance/*.test.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (345.1936ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (138.158ms)
✔ full acceptance report task covers every product requirement (0.8806ms)
✔ full acceptance report command includes all critical verification layers (0.4145ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1315.3817
```

### API smoke report

```text

> export-platform-service@0.1.0 test:acceptance:report
> node --import tsx scripts/run-acceptance-report.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (293.2516ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (142.029ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1074.1795
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
warning: in the working copy of 'contracts/openapi.yaml', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/testing/api-acceptance-test-report.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'docs/testing/verify-matrix.md', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'package.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'task.json', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/arch-check.test.mjs', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'tests/sample/purchase-order-sample.test.mjs', LF will be replaced by CRLF the next time Git touches it
```


