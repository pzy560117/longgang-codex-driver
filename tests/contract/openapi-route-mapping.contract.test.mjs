import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function parseOpenApiOperationIds() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  return [...openapi.matchAll(/operationId:\s*([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}

function parseRouteManifestOperationIds() {
  const manifest = readFileSync("src/routes/route-manifest.ts", "utf8");
  return [...manifest.matchAll(/operationId:\s*"([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
}

function parseHandlerPaths() {
  const manifest = readFileSync("src/routes/route-manifest.ts", "utf8");
  return [...manifest.matchAll(/handlerPath:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function parseAuditActionEnum() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/action:\s*\n\s+type:\s+string\s*\n\s+enum:\s*\n([\s\S]*?)\n\s{8}result:/) ?? [];
  return new Set([...block.matchAll(/-\s+([A-Z_]+)/g)].map((match) => match[1]));
}

function parseAuditResultEnum() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, values] = openapi.match(/result:\s*\n\s+type:\s+string\s*\n\s+enum:\s+\[([^\]]+)\]/) ?? [];
  return new Set(values.split(",").map((value) => value.trim()));
}

function parseResponseCodeEnum() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/ResponseCode:\s*\n\s+type:\s+string\s*\n\s+enum:\s*\n([\s\S]*?)\n\s{4}TaskStatus:/) ?? [];
  return new Set([...block.matchAll(/-\s+([A-Z_]+)/g)].map((match) => match[1]));
}

function parseTaskEventTypeEnum() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/eventType:\s*\n\s+type:\s+string\s*\n\s+enum:\s*\n([\s\S]*?)\n\s{8}requestId:/) ?? [];
  return new Set([...block.matchAll(/-\s+([A-Z_]+)/g)].map((match) => match[1]));
}

function parseExportTaskDetailSchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/ExportTaskDetail:\s*\n([\s\S]*?)\n\s{4}ExportTaskPageEnvelope:/) ?? [];
  return block;
}

function parseBatchCheckpointSchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/BatchCheckpoint:\s*\n([\s\S]*?)\n\s{4}AuditEvent:/) ?? [];
  return block;
}

function parseYamlListFromBlock(block, key) {
  const [, listBlock] = block.match(new RegExp(`${key}:\\s*\\n([\\s\\S]*?)\\n\\s{6}properties:`)) ?? [];
  return new Set([...listBlock.matchAll(/-\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]));
}

function sourceAuditLiterals() {
  const sources = [
    "src/task-api/service.ts",
    "src/registry-config/service.ts",
    "src/scheduler/worker.ts",
    "src/cleanup-job/index.ts"
  ].map((path) => readFileSync(path, "utf8"));

  return {
    actions: new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/action:\s*"([A-Z_]+)"/g)].map((match) => match[1])
      )
    ),
    results: new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/result:\s*"([A-Z_]+)"/g)].map((match) => match[1])
      )
    ),
    errorCodes: new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/errorCode:\s*(?:"([A-Z_]+)"|[\s\S]*?\?\s*[^\n]+\n\s+:\s*"([A-Z_]+)")/g)]
          .flatMap((match) => [match[1], match[2]])
          .filter(Boolean)
      )
    )
  };
}

test("OpenAPI operationIds are represented by route manifest entries", () => {
  assert.deepEqual(
    new Set(parseRouteManifestOperationIds()),
    new Set(parseOpenApiOperationIds())
  );
});

test("OpenAPI handlers are production handlers with service and DB repository evidence", () => {
  for (const handlerPath of parseHandlerPaths()) {
    const handler = readFileSync(handlerPath, "utf8");
    assert.doesNotMatch(handler, /createScaffoldHandler|createNotImplementedHandler/);
    assert.match(handler, /requireAuthContext/);
    assert.match(handler, /sendSuccess/);
  }

  const taskService = readFileSync("src/task-api/service.ts", "utf8");
  const registryService = readFileSync("src/registry-config/service.ts", "utf8");
  const auditService = readFileSync("src/audit-log/service.ts", "utf8");

  assert.match(taskService, /createExportTaskRepository/);
  assert.match(taskService, /createExportRegistryRepository/);
  assert.match(taskService, /createExportFileRepository/);
  assert.match(taskService, /appendAudit/);
  assert.match(registryService, /createExportRegistryRepository/);
  assert.match(registryService, /appendAudit/);
  assert.match(auditService, /createExportAuditRepository/);
});

test("route manifest maps operations to HTTP API integration evidence", () => {
  const manifest = readFileSync("src/routes/route-manifest.ts", "utf8");
  assert.match(manifest, /const httpApiTest = "tests\/api\/export-http-api\.test\.mjs"/);

  const apiEvidenceCount = [...manifest.matchAll(/tests:\s*\[routeContractTest, httpApiTest\]/g)]
    .length;

  assert.equal(apiEvidenceCount, parseOpenApiOperationIds().length);
});

test("audit action, result, and errorCode literals written by production code stay within OpenAPI public enums", () => {
  const actionEnum = parseAuditActionEnum();
  const resultEnum = parseAuditResultEnum();
  const responseCodeEnum = parseResponseCodeEnum();
  const literals = sourceAuditLiterals();

  assert.deepEqual(
    [...literals.actions].filter((action) => !actionEnum.has(action)),
    []
  );
  assert.deepEqual(
    [...literals.results].filter((result) => !resultEnum.has(result)),
    []
  );
  assert.deepEqual(
    [...literals.errorCodes].filter((errorCode) => !responseCodeEnum.has(errorCode)),
    []
  );
});

test("cleanup failure audit errorCode is a public ResponseCode literal, not raw Error.name", () => {
  const cleanupJob = readFileSync("src/cleanup-job/index.ts", "utf8");
  assert.doesNotMatch(cleanupJob, /errorCode:\s*[\s\S]{0,120}\.name/);
  assert.match(cleanupJob, /errorCode:\s*"FILE_CLEANUP_DELETE_ERROR"/);
});

test("task detail schema requires public progress, error, and recentEvents fields", () => {
  const detailSchema = parseExportTaskDetailSchemaBlock();
  const required = parseYamlListFromBlock(detailSchema, "required");

  for (const field of [
    "totalCount",
    "processedCount",
    "progressPercent",
    "errorCode",
    "errorMessage",
    "recentEvents"
  ]) {
    assert.equal(required.has(field), true, `${field} must be required on ExportTaskDetail`);
    assert.match(detailSchema, new RegExp(`\\n\\s{8}${field}:\\n`), `${field} must be a property`);
  }

  assert.doesNotMatch(detailSchema, /\n\s{8}events:\n/);
});

test("runtime public response and task event allow-lists match OpenAPI enums", () => {
  const publicEnums = readFileSync("src/contracts/public-enums.ts", "utf8");
  const sourceResponseCodes = new Set(
    [...publicEnums.matchAll(/"([A-Z_]+)"/g)].map((match) => match[1])
  );

  for (const responseCode of parseResponseCodeEnum()) {
    assert.equal(sourceResponseCodes.has(responseCode), true, `${responseCode} missing in runtime allow-list`);
  }

  for (const eventType of parseTaskEventTypeEnum()) {
    assert.match(publicEnums, new RegExp(`"${eventType}"`), `${eventType} missing in runtime event allow-list`);
  }
});

test("public BatchCheckpoint schema exposes progress fields without internal error fields", () => {
  const checkpointSchema = parseBatchCheckpointSchemaBlock();

  assert.doesNotMatch(checkpointSchema, /\n\s{6}required:\n/);

  for (const field of [
    "lastCursor",
    "processedCount",
    "totalCount",
    "filePartNo",
    "retryCount",
    "batchSize",
    "batchRowCount",
    "backoffMs",
    "renderInputSummary",
    "failureReason"
  ]) {
    assert.match(checkpointSchema, new RegExp(`\\n\\s{8}${field}:\\n`), `${field} must be a public property`);
  }

  assert.doesNotMatch(checkpointSchema, /\n\s{8}errorCode:\n/);
  assert.doesNotMatch(checkpointSchema, /\n\s{8}errorMessage:\n/);
});

test("registry dataScopeTemplate example includes all auth scope placeholders", () => {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, example] =
    openapi.match(/dataScopeTemplate:\s+"([^"]+)"/) ??
    openapi.match(/dataScopeTemplate:\s*'([^']+)'/) ??
    [];

  for (const placeholder of [":tenantId", ":operatorId", ":roleCodes", ":orgScope"]) {
    assert.match(example ?? "", new RegExp(placeholder), `${placeholder} missing from dataScopeTemplate example`);
  }
});

test("download operation declares signed URL callback parameters and signature failures", () => {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");

  for (const parameter of [
    "expiresAt",
    "signatureAlgorithm",
    "signature",
    "operatorId",
    "tenantId",
    "roleCodes",
    "orgScope",
    "requestId"
  ]) {
    assert.match(openapi, new RegExp(`name: ${parameter}\\r?\\n`), `${parameter} callback parameter missing`);
  }
  assert.match(openapi, /"#\/components\/responses\/SignatureRejected"/);
  assert.match(openapi, /- SIGNATURE_INVALID/);
  assert.match(openapi, /- SIGNATURE_EXPIRED/);
});
