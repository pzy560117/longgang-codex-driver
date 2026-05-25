# 全量需求验收测试报告

**结论**: PASS
**开始时间**: 2026-05-25T07:10:32.3646260Z
**结束时间**: 2026-05-25T07:13:43.8105281Z
**数据库**: Docker integration MySQL (redacted)
**对象存储**: Docker MinIO (http://127.0.0.1:49000)

## 覆盖范围

| Requirement | 验证层 | 主要命令 |
| --- | --- | --- |
| FR-001 / FR-002 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | HTTP API / auth / audit / history / state machine | `npm run test:api`, `npm run test:acceptance` |
| FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | DB schema / repositories / durable evidence | `npm run test:db` |
| FR-005 / FR-010 / FR-012 / FR-013 | scheduler / locks / retry / cleanup polling | `npm run test:worker` |
| FR-006 / FR-008 / FR-009 / FR-014 | query executor / datasource adapter / data scope / masking | `npm run test:query` |
| FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | file service / signed download / cleanup / render failures | `npm run test:file`, `npm run test:integration-live`, `npm run test:integration-performance` |
| FR-014 | purchase-order sample / 0-100001 row boundaries / masked output | `npm run test:sample` |
| FR-001 - FR-014 | contract, architecture, docs, integration-stack evidence boundary | `npm run arch:check`, `npm run test:contract`, `npm test`, `npm run stack:integration`, `node --import tsx scripts/integration-seed.mjs` |

## 命令结果

| 验证项 | Requirement | 状态 | 退出码 | 耗时秒 | 命令 |
| --- | --- | --- | ---: | ---: | --- |
| NPM high audit | FR-001 - FR-014 | PASS | 0 | 2.16 | `npm audit --audit-level=high --registry=https://registry.npmjs.org --fetch-retries=3 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000` |
| Architecture gate | FR-001 - FR-014 | PASS | 0 | 1.3 | `npm run arch:check` |
| TypeScript typecheck | FR-001 - FR-014 | PASS | 0 | 4.13 | `npm run typecheck` |
| Contract tests | FR-001 - FR-014 | PASS | 0 | 0.52 | `npm run test:contract` |
| Base tests | FR-001 - FR-014 | PASS | 0 | 5.44 | `npm test` |
| OpenAPI lint | FR-001 - FR-014 | PASS | 0 | 6.64 | `npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml` |
| Docker integration stack down | FR-001 - FR-014 | PASS | 0 | 6.23 | `npm run stack:integration:down` |
| Docker integration stack up | FR-001 - FR-014 | PASS | 0 | 39.33 | `npm run stack:integration` |
| Docker integration seed | FR-001 / FR-005 / FR-007 / FR-014 | FAIL | 1 | 1.04 | `node --import tsx scripts/integration-seed.mjs` |
| Docker integration seed | FR-001 / FR-005 / FR-007 / FR-014 | PASS | 0 | 4.32 | `node --import tsx scripts/integration-seed.mjs` |
| API integration | FR-001 / FR-002 / FR-003 / FR-004 / FR-007 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 6.25 | `npm run test:api` |
| DB integration | FR-001 / FR-005 / FR-007 / FR-010 / FR-013 | PASS | 0 | 1.51 | `npm run test:db` |
| Worker integration | FR-005 / FR-010 / FR-012 / FR-013 | PASS | 0 | 8.64 | `npm run test:worker` |
| Query executor | FR-006 / FR-008 / FR-009 / FR-014 | PASS | 0 | 6.46 | `npm run test:query` |
| File service | FR-003 / FR-006 / FR-009 / FR-011 / FR-014 | PASS | 0 | 4.63 | `npm run test:file` |
| Purchase-order sample | FR-014 | PASS | 0 | 43.96 | `npm run test:sample` |
| Acceptance matrix and API smoke | FR-001 - FR-014 | PASS | 0 | 2.38 | `npm run test:acceptance` |
| API smoke report | FR-001 / FR-002 / FR-004 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 | PASS | 0 | 1.94 | `npm run test:acceptance:report` |
| Integration end-to-end chain | FR-001 / FR-002 / FR-003 / FR-005 / FR-006 / FR-008 / FR-009 / FR-010 / FR-012 / FR-013 / FR-014 | PASS | 0 | 16.42 | `npm run test:integration-live` |
| Integration performance baseline | FR-006 / FR-014 | PASS | 0 | 11.36 | `npm run test:integration-performance` |
| Scoped diff check | FR-001 - FR-014 | PASS | 0 | 0.04 | `git diff --check -- contracts task.json package.json tests/acceptance tests/arch-check.test.mjs tests/sample scripts docs/testing` |

## 证据边界

- 本报告覆盖当前仓库 FR-001 至 FR-014 的本机受控验收链路。
- 证据来自完整 Docker integration stack：平台 MySQL、业务只读 MySQL、MinIO、HTTP、scheduler、cleanup，以及在该环境上运行的 Node tests。
- 本报告不声明外部生产 MySQL、外部业务数据源、外部 OSS/S3 或外部网关已验证；它只声明完整 Docker 集成环境已验证。
- `npm run test:integration-live` 和 `npm run test:integration-performance` 都在完整 Docker 集成栈上执行。

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

✔ OpenAPI operationIds are represented by route manifest entries (3.4084ms)
✔ OpenAPI handlers are production handlers with service and DB repository evidence (2.2333ms)
✔ route manifest maps operations to HTTP API integration evidence (0.6878ms)
✔ audit action, result, and errorCode literals written by production code stay within OpenAPI public enums (3.6288ms)
✔ cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name (0.3862ms)
✔ task detail schema requires public progress, error, and recentEvents fields (0.8598ms)
✔ runtime public response and task event allow-lists match OpenAPI enums (0.8719ms)
✔ public BatchCheckpoint schema exposes progress fields without internal error fields (0.6117ms)
✔ public error messages are documented and implemented as code-derived safe summaries (0.8382ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (0.711ms)
✔ download operation declares signed URL callback parameters and signature failures (0.6488ms)
✔ protected operations declare trusted auth context signature proof (0.8081ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (0.9814ms)
✔ create task contract guard is implemented before PENDING enqueue (1.3431ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (3.2819ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (1.2674ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (0.8966ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (2.0759ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (1.7302ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 138.7921
```

### Base tests

```text

> export-platform-service@0.1.0 test
> node --import tsx --test tests/*.test.mjs tests/contract/*.test.mjs

✔ arch:check is declared as the scaffold gate (0.852ms)
✔ production migration command is available as an explicit deployment gate (0.466ms)
✔ systemd deployment templates keep HTTP, scheduler, and cleanup as separate processes (0.9399ms)
✔ verify matrix marks API and DB repository boundaries as available while STACK-ADR-001 is recorded as the current design baseline (0.5715ms)
✔ createDatabase 在缺少真实数据库环境时仍可构造 Kysely 对象 (3.9971ms)
✔ MySQL pool options 使用拆分环境变量并允许 database URL 优先 (1.2605
... output truncated ...
ved safe summaries (1.2359ms)
✔ registry dataScopeTemplate example includes all auth scope placeholders (1.5953ms)
✔ download operation declares signed URL callback parameters and signature failures (1.0579ms)
✔ protected operations declare trusted auth context signature proof (0.9316ms)
✔ create task contract declares 32768-byte canonical queryParams limit and error response (2.4365ms)
✔ create task contract guard is implemented before PENDING enqueue (1.096ms)
✔ registry required fields and nested registry contract required fields stay aligned with production validation (3.4479ms)
✔ registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields (0.9289ms)
✔ Fastify production route registration uses route-manifest instead of legacy route definitions (3.545ms)
✔ legacy route definition registry remains isolated from production registration while it still points at scaffold handlers (11.8445ms)
✔ route-manifest points directly at production handlers and never at .route.ts wrappers (22.6243ms)
✔ object storage live smoke blocks when endpoint or bucket is missing (2073.9748ms)
✔ object storage live smoke blocks local endpoints unless explicitly allowed by the docker mock gate (894.6797ms)
✔ object storage live smoke requires an explicit write guard before touching a non-placeholder endpoint (928.0782ms)
✔ 脚手架声明的服务入口脚本存在 (0.7643ms)
✔ npm test 仅覆盖当前脚手架可验证的测试文件 (0.2651ms)
✔ 验证矩阵明确包含当前脚手架验证命令 (0.1397ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40251}
✔ HTTP 服务可独立启动并暴露 health (191.7359ms)
{"event":"export-platform.http.started","host":"127.0.0.1","port":40252}
✔ 公开 API 在缺少认证上下文时返回受控 401 响应 (19.7524ms)
ℹ tests 55
ℹ suites 0
ℹ pass 55
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4719.1282
```

### OpenAPI lint

```text

```

### Docker integration stack down

```text

> export-platform-service@0.1.0 stack:integration:down
> powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration-stack.ps1 -Down
```

### Docker integration stack up

```text

> export-platform-service@0.1.0 stack:integration
> powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\integration-stack.ps1 -Up

#1 [internal] load local bake definitions
#1 reading from stdin 1.64kB 0.0s done
#1 DONE 0.0s

#2 [scheduler internal] load build definition from worker.Dockerfile
#2 transferring dockerfile: 202B done
#2 DONE 0.1s

#3 [http internal] load build definition from http.Dockerfile
#3 transferring dockerfile: 194B done
#3 DONE 0.1s

#4 [http internal] load metadata for docker.io/library/node:22-bookworm-slim
#4 ...

#5 [cleanup internal] load build definition
... output truncated ...
#13 exporting manifest list sha256:619a07497a42b238ba3a0fbf861ec269e0bde0ec3ad3da8b05f113aba4703ee2 0.1s done
#13 naming to docker.io/library/longgang-codex-driver-scheduler:latest 0.0s done
#13 unpacking to docker.io/library/longgang-codex-driver-scheduler:latest
#13 unpacking to docker.io/library/longgang-codex-driver-scheduler:latest 6.5s done
#13 DONE 18.2s

#15 [cleanup] exporting to image
#15 exporting config sha256:fda2647c539581b0f50aed723061ace2e1dfae79dcf9b257827b18ea82b3aa4c 0.1s done
#15 exporting attestation manifest sha256:76509d98785140aaa49104170abd44f34f769a4f53d48c898774c8f9c8c41771 0.2s done
#15 exporting manifest list sha256:780f216cc5dbc94cf9ded012285a5332c01bdc032afd096c1c8a407e176d822e 0.1s done
#15 naming to docker.io/library/longgang-codex-driver-cleanup:latest 0.0s done
#15 unpacking to docker.io/library/longgang-codex-driver-cleanup:latest 6.5s done
#15 DONE 18.2s

#14 [http] exporting to image
#14 exporting layers 11.0s done
#14 exporting manifest sha256:b00bb5dddede282d014b8ebf6352d1927981915ce98d2a5fb1d92a4e71753ba7 0.2s done
#14 exporting config sha256:5d0f3f3e9e3ddeecdb8e5926a25ea1e5b1bbc93b3ae0f358ee0a0ba10765af0f 0.1s done
#14 exporting attestation manifest sha256:a4fc24aa55c0f868ad1a1eaa9e167d760c858c9d6dfb6cc01cb1c549c9bfc205 0.2s done
#14 exporting manifest list sha256:9f2a8407544b218b965193c0a7235fbeb36dfd36e2c206c091d8f131ca73b667 0.1s done
#14 naming to docker.io/library/longgang-codex-driver-http:latest 0.0s done
#14 unpacking to docker.io/library/longgang-codex-driver-http:latest 6.5s done
#14 DONE 18.3s

#16 [cleanup] resolving provenance for metadata file
#16 DONE 0.2s

#17 [scheduler] resolving provenance for metadata file
#17 DONE 0.2s

#18 [http] resolving provenance for metadata file
#18 DONE 0.0s
integration stack ready.
```

### Docker integration seed

```text

```

### Docker integration seed

```text
{"event":"export-platform.integration.seeded","seededRows":10000,"datasource":"purchase-ro","table":"purchase_orders_sample","view":"purchase_orders_view"}
```

### API integration

```text

> export-platform-service@0.1.0 test:api
> node --import tsx --test --test-concurrency=1 tests/api/*.test.mjs

✔ HTTP API requires EXPORT_PLATFORM_TEST_DATABASE_URL (1.3014ms)
✔ public HTTP errors use safe messages instead of underlying Error.message (0.5929ms)
✔ registry/task HTTP flow persists through Fastify + MySQL production path (3002.2648ms)
✔ trusted ingress proof is required before auth headers can grant admin or tenant context (407.6256ms)
✔ create task rejects queryParams above 32768 canonical JSON UTF-8 bytes before persistence (275.2671ms)
✔ create task rejects registry-unsupported fileFormat and invalid queryParams before enqueue (223.2742ms)
✔ create task idempotent replay returns existing task after registry guard changes (167.908ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 5847.9609
```

### DB integration

```text

> export-platform-service@0.1.0 test:db
> node --import tsx --test --test-concurrency=1 tests/db/*.test.mjs

✔ DB tests require an explicit test database URL (1.386ms)
✔ migration exposes durable evidence tables for FR-001/005/007/010/013 (78.4519ms)
✔ repositories persist registry, task idempotency, lease, checkpoint, file and audit evidence (214.9686ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1089.4768
```

### Worker integration

```text

> export-platform-service@0.1.0 test:worker
> node --import tsx --test --test-concurrency=1 tests/worker/*.test.mjs

▶ worker integration tests
  ✔ worker tests require an explicit test database URL (1.2627ms)
  ✔ multiple workers dispatch only up to the registry concurrency limit and write audit/checkpoint evidence (379.9451ms)
  ✔ default scheduler query processor enforces registry dataScopeTemplate before publishing rows (398.1279ms)
  ✔ default scheduler query processor passes the datasource adapter boundary into query executor (295.169ms)
  ✔ same worker resumes its own active lease whil
... output truncated ...
attemptNo and resumes from the latest checkpoint (413.3488ms)
  ✔ task snapshot still dispatches and publishes after the current registry is disabled and updated (294.3186ms)
  ✔ expired worker does not mark FAILED or overwrite the new owner after takeover (303.567ms)
  ✔ executing cancel request is closed at the next persisted batch boundary (244.8648ms)
  ✔ failed execution is retried only after FAILED and increments attemptNo before redispatch (318.1971ms)
  ✔ stale executing cancel cannot overwrite a retried attempt (290.0689ms)
  ✔ query batch transient failure persists retry checkpoint and completes on the next poll (369.3726ms)
  ✔ query batch transient failure does not retry again before checkpoint backoff elapses (231.1106ms)
  ✔ query batch retry resumes only after checkpoint backoff elapses (333.8415ms)
  ✔ query batch default retry limit allows three checkpoint retries before final failure (529.2271ms)
  ✔ query batch retry exhaustion fails with QUERY_EXECUTION_ERROR and persists the exhausted retry count (354.3148ms)
  ✔ query batch retry exhaustion waits for backoff before the terminal failed retry attempt (350.0573ms)
  ✔ datasource unavailable errors finish as DATASOURCE_UNAVAILABLE after retry exhaustion (255.3734ms)
  ✔ default worker maps datasource provider failures to DATASOURCE_UNAVAILABLE audits (206.5468ms)
  ✔ unknown worker error names are normalized to public QUERY_EXECUTION_ERROR audits (218.2409ms)
  ✔ cleanup job poll once records task event and audit after successful object deletion (221.4879ms)
  ✔ cleanup job poll once records retry audit and does not mark cleanup done when delete fails (212.4053ms)
✔ worker integration tests (7402.9544ms)
ℹ tests 24
ℹ suites 1
ℹ pass 24
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8286.0177
```

### Query executor

```text

> export-platform-service@0.1.0 test:query
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/query requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/query/*.test.mjs

✔ query tests require an explicit test database URL (1.0751ms)
✔ seed registry uses the same contract validation as production persistence and rejects empty bypass values (295.3531ms)
✔ query executor binds template, enforces data scope, masks sensitive fields and emits QUER
... output truncated ...
SOURCE_UNAVAILABLE without leaking adapter details (276.4411ms)
✔ query executor maps invalid datasource URL failures to DATASOURCE_UNAVAILABLE (208.7031ms)
✔ query executor maps SQL adapter failures without leaking SQL text or secrets (206.7239ms)
✔ query executor applies registry dataScopeTemplate with operatorId and roleCodes to block same org unauthorized rows (260.7549ms)
✔ query executor rejects dataScopeTemplate parameters outside the auth scope contract (237.1079ms)
✔ query executor rejects dataScopeTemplate missing required auth scope placeholders (240.4029ms)
✔ query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount (305.2034ms)
✔ query executor replays the task config snapshot after the current registry changes (282.8556ms)
✔ query executor accepts legacy string checkpoint cursors while producing structured cursor tokens (334.7374ms)
✔ query executor rejects rows with missing or null cursor values (331.4862ms)
✔ query executor rejects duplicate cursor values (239.0918ms)
✔ query executor rejects non-increasing cursor values without duplicates (253.4971ms)
✔ query executor rejects checkpoints missing required cursor fields (221.9462ms)
✔ query executor rejects unsafe template forms and undeclared placeholders (325.231ms)
✔ seed registry rejects missing masking rules for sensitive exportable fields before persistence (161.7518ms)
✔ query executor rejects field mappings that do not match selected columns (200.5728ms)
✔ query executor enforces exportMaxRows before crossing registry limit (219.0095ms)
✔ query executor classifies datasource adapter and credential failures as DATASOURCE_UNAVAILABLE (0.4856ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6068.9935
```

### File service

```text

> export-platform-service@0.1.0 test:file
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/file requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/file/*.test.mjs

✔ file tests require an explicit test database URL (1.5172ms)
✔ production object storage config is required outside injected test adapters (1.3156ms)
✔ file service writes temp object, verifies checksum, and publishes ZIP metadata through a production-equivalent storage adapter (261.3338ms)
✔ env-backed object storage adapter publishes ZIP metadata through a local HTTP endpoint and returns a downloadable URL (270.9516ms)
✔ checksum failure prevents publish and metadata from becoming downloadable (160.9537ms)
✔ object storage put failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (135.4511ms)
✔ object storage read failure is mapped to FILE_VERIFY_ERROR and does not publish metadata (129.6673ms)
✔ object storage publish failure is mapped to FILE_VERIFY_ERROR and keeps metadata undisclosed (148.2928ms)
✔ xlsx renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (131.1533ms)
✔ zip renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write (115.5717ms)
✔ scheduler publishes file metadata before marking a completed batch as COMPLETED (282.0786ms)
✔ scheduler maps object storage put failure to FAILED task with FILE_VERIFY_ERROR audit (301.3224ms)
✔ scheduler maps object storage read failure to FAILED task with FILE_VERIFY_ERROR audit (280.2411ms)
✔ scheduler maps renderer failure to FAILED task with EXPORT_RENDER_ERROR audit (259.5851ms)
✔ cleanup job invalidates expired metadata before deleting object and download is guarded (293.0546ms)
✔ cleanup job deletes only published object when temp storage key is null (253.3564ms)
✔ cleanup job keeps retry evidence when object delete fails and leaves download invalidated (250.889ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4168.3405
```

### Purchase-order sample

```text

> export-platform-service@0.1.0 test:sample
> node -e "if (!process.env.EXPORT_PLATFORM_TEST_DATABASE_URL) { console.error('BLOCKED - 需要人工介入: tests/sample requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL.'); process.exit(1); }" && node --import tsx --test --test-concurrency=1 tests/sample/*.test.mjs

▶ sample purchase-order integration tests
  ✔ sample suite blocks env-backed live object storage when config is missing and keeps adapter evidence scoped as production-equivalent (2.4829ms)
  ✔ sample purchase-order registry contract is registered through the public registry service (271.2019ms)
  ✔ sample boundary 0 rows completes through the public create and worker chain (503.5388ms)
  ✔ sample boundary 1 row keeps final file masked and records create/query/file/audit/download evidence (623.1651ms)
  ✔ sample boundary 20000 rows completes with a single-file package (3492.2551ms)
  ✔ sample boundary 20001 rows packages ZIP evidence without losing rows (3411.8073ms)
  ✔ sample boundary 100000 rows stays on the default batch path and publishes every row (22051.6447ms)
  ✔ sample boundary 100001 rows must be rejected under the default export limit (12370.1109ms)
  ✔ sample registry rejects missing masking rules before creating a task (18.2312ms)
✔ sample purchase-order integration tests (42746.0221ms)
ℹ tests 9
ℹ suites 1
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 43583.7889
```

### Acceptance matrix and API smoke

```text

> export-platform-service@0.1.0 test:acceptance
> node --import tsx --test --test-concurrency=1 tests/acceptance/*.test.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (389.0164ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (176.1315ms)
✔ full acceptance report task covers every product requirement (0.6391ms)
✔ full acceptance report command includes all critical verification layers (1.146ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1976.5854
```

### API smoke report

```text

> export-platform-service@0.1.0 test:acceptance:report
> node --import tsx scripts/run-acceptance-report.mjs

✔ manual acceptance API flow creates, replays, lists, cancels, and audits tasks (347.0697ms)
✔ manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely (174.6804ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1446.3077
acceptance report written: docs\testing\api-acceptance-test-report.md
```

### Integration end-to-end chain

```text

> export-platform-service@0.1.0 test:integration-live
> node --import tsx --test --test-concurrency=1 tests/integration/*.test.mjs

✔ integration stack completes export task end-to-end (12989.3144ms)
✔ integration stack rejects unsigned requests (37.6788ms)
✔ integration performance script completes and returns result rows (2620.6428ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16086.5874
```

### Integration performance baseline

```text

> export-platform-service@0.1.0 test:integration-performance
> node --import tsx scripts/integration-performance.mjs

{
  "results": [
    {
      "rowCount": 10000,
      "taskId": "exp_42a5b4d8-f2c3-45ea-9117-f0023e2b0160",
      "status": "COMPLETED",
      "durationMs": 10315,
      "durationSec": 10.31,
      "completeDurationMs": 10228,
      "completeDurationSec": 10.23,
      "downloadMetadataDurationMs": 31,
      "downloadBodyDurationMs": 53,
      "fileName": "purchase-order-export-exp_42a5b4d8-f2c3-45ea-9117-f0023e2b0160-attempt-0.xlsx",
      "fileSize": 619237,
      "partCount": 1,
      "throughputRowsPerSec": 977.71,
      "endToEndThroughputRowsPerSec": 969.46,
      "publishedStorageKey": "exports/purchase/purchase-order-export/20260525/exp_42a5b4d8-f2c3-45ea-9117-f0023e2b0160/0/purchase-order-export-exp_42a5b4d8-f2c3-45ea-9117-f0023e2b0160-attempt-0.xlsx"
    }
  ]
}
```

### Scoped diff check

```text

```


