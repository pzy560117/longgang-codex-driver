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

function parseCreateExportTaskOperationBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/operationId: createExportTask\n([\s\S]*?)\n\s{4}get:/) ?? [];
  return block;
}

function parseCreateExportTaskServiceBlock() {
  const taskServiceSource = readFileSync("src/task-api/service.ts", "utf8");
  const [, block] =
    taskServiceSource.match(
      /(export async function createExportTask[\s\S]*?)\nexport async function listExportTasks/
    ) ?? [];
  return block;
}

function parseExportRegistryUpsertSchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] =
    openapi.match(/ExportRegistryUpsertRequest:\s*\n([\s\S]*?)\n\s{4}ExportRegistryEnvelope:/) ??
    [];
  return block;
}

function parseQueryTemplateContractSchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/QueryTemplateContract:\s*\n([\s\S]*?)\n\s{4}FieldMapping:/) ?? [];
  return block;
}

function parseFieldMappingSchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/FieldMapping:\s*\n([\s\S]*?)\n\s{4}OrderBy:/) ?? [];
  return block;
}

function parseOrderBySchemaBlock() {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const [, block] = openapi.match(/OrderBy:\s*\n([\s\S]*?)\n\s{4}BatchCheckpoint:/) ?? [];
  return block;
}

function parseYamlListFromBlock(block, key) {
  const lines = block.split(/\r?\n/);
  const inlineLine = lines.find((line) =>
    new RegExp(`^\\s*${key}:\\s*\\[([^\\]]+)\\]\\s*$`).test(line)
  );
  if (inlineLine) {
    const [, values] =
      inlineLine.match(new RegExp(`^\\s*${key}:\\s*\\[([^\\]]+)\\]\\s*$`)) ?? [];
    return new Set(
      values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }

  const startIndex = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*$`).test(line));
  if (startIndex === -1) {
    return new Set();
  }

  const values = [];
  let itemIndent = null;
  for (const line of lines.slice(startIndex + 1)) {
    const itemMatch = line.match(/^(\s*)-\s+([A-Za-z0-9_]+)/);
    if (itemMatch) {
      itemIndent ??= itemMatch[1].length;
      values.push(itemMatch[2]);
      continue;
    }

    if (itemIndent !== null && line.trim() !== "") {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (indent <= itemIndent) {
        break;
      }
    }
  }

  return new Set(values);
}

function parseTypescriptStringArray(source, exportName) {
  const [, block] =
    source.match(new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const;`)) ?? [];
  return new Set([...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
}

function parseTypescriptStringMap(source, exportName) {
  const [, block] =
    source.match(new RegExp(`export const ${exportName} = \\{([\\s\\S]*?)\\} as const;`)) ?? [];
  return Object.fromEntries(
    [...block.matchAll(/([A-Za-z0-9_]+):\s*"([A-Z_]+)"/g)].map((match) => [match[1], match[2]])
  );
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

test("protected operations declare trusted auth context signature proof", () => {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const operationIds = parseOpenApiOperationIds();
  const signatureRefCount = [...openapi.matchAll(/#\/components\/parameters\/XAuthContextSignature"/g)]
    .length;
  const issuedAtRefCount = [...openapi.matchAll(/#\/components\/parameters\/XAuthContextIssuedAt"/g)]
    .length;
  const algorithmRefCount = [...openapi.matchAll(/#\/components\/parameters\/XAuthContextSignatureAlgorithm"/g)]
    .length;

  assert.match(openapi, /XAuthContextSignature:/);
  assert.match(openapi, /name: X-Auth-Context-Signature/);
  assert.match(openapi, /XAuthContextIssuedAt:/);
  assert.match(openapi, /name: X-Auth-Context-Issued-At/);
  assert.match(openapi, /XAuthContextSignatureAlgorithm:/);
  assert.match(openapi, /name: X-Auth-Context-Signature-Algorithm/);
  assert.match(openapi, /HMAC-SHA256 proof that the ingress authenticated the auth context headers/);
  assert.match(openapi, /freshness boundary only: issuedAt must be no more than 5 minutes in the future and no older than 10 minutes relative to server time/);
  assert.match(openapi, /No nonce or replay-deduplication store is part of this contract; identical signed headers may be replayed within the accepted freshness window/);
  assert.match(openapi, /Required auth context is missing, malformed, outside the trusted freshness boundary, or lacks trusted ingress proof\./);
  assert.equal(signatureRefCount, operationIds.length);
  assert.equal(issuedAtRefCount, operationIds.length);
  assert.equal(algorithmRefCount, operationIds.length);
});

test("create task contract declares 32768-byte canonical queryParams limit and error response", () => {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const operationBlock = parseCreateExportTaskOperationBlock();

  assert.match(openapi, /description: Must match registry parameter schema and must not exceed 32768 bytes after canonical JSON serialization\./);
  assert.match(operationBlock, /- QUERY_PARAMS_TOO_LARGE/);
  assert.match(operationBlock, /QUERY_PARAMS_TOO_LARGE:\s+400/);
  assert.match(openapi, /queryParamsTooLarge:/);
  assert.match(openapi, /message: queryParams exceeds 32768 bytes/);
});

test("create task contract guard is implemented before PENDING enqueue", () => {
  const openapi = readFileSync("contracts/openapi.yaml", "utf8");
  const operationBlock = parseCreateExportTaskOperationBlock();
  const createTaskServiceBlock = parseCreateExportTaskServiceBlock();

  assert.match(openapi, /description: Must match registry parameter schema and must not exceed 32768 bytes after canonical JSON serialization\./);
  assert.match(operationBlock, /- QUERY_TEMPLATE_INVALID/);
  assert.match(operationBlock, /QUERY_TEMPLATE_INVALID:\s+400/);
  assert.match(createTaskServiceBlock, /findByIdempotencyScope/);
  assert.match(createTaskServiceBlock, /assertCreateTaskRegistryGuards/);
  assert.match(createTaskServiceBlock, /createPendingTask/);
  assert.ok(
    createTaskServiceBlock.indexOf("findByIdempotencyScope") <
      createTaskServiceBlock.indexOf("assertCreateTaskRegistryGuards"),
    "idempotency replay must be checked before registry guard"
  );
  assert.ok(
    createTaskServiceBlock.indexOf("assertCreateTaskRegistryGuards") <
      createTaskServiceBlock.indexOf("createPendingTask"),
    "registry guard must still run before createPendingTask"
  );
});

test("registry required fields and nested registry contract required fields stay aligned with production validation", () => {
  const registryContractSource = readFileSync("src/registry-config/contract.ts", "utf8");

  assert.deepEqual(
    parseTypescriptStringArray(registryContractSource, "REGISTRY_REQUIRED_FIELDS"),
    parseYamlListFromBlock(parseExportRegistryUpsertSchemaBlock(), "required")
  );
  assert.deepEqual(
    parseTypescriptStringArray(registryContractSource, "QUERY_TEMPLATE_REQUIRED_FIELDS"),
    parseYamlListFromBlock(parseQueryTemplateContractSchemaBlock(), "required")
  );
  assert.deepEqual(
    parseTypescriptStringArray(registryContractSource, "FIELD_MAPPING_REQUIRED_FIELDS"),
    parseYamlListFromBlock(parseFieldMappingSchemaBlock(), "required")
  );
  assert.deepEqual(
    parseTypescriptStringArray(registryContractSource, "ORDER_BY_REQUIRED_FIELDS"),
    parseYamlListFromBlock(parseOrderBySchemaBlock(), "required")
  );
});

test("registry validation keeps public error-code mapping and forbids empty fallback defaults for required contract fields", () => {
  const registryContractSource = readFileSync("src/registry-config/contract.ts", "utf8");
  const registryServiceSource = readFileSync("src/registry-config/service.ts", "utf8");
  const errorCodes = parseTypescriptStringMap(
    registryContractSource,
    "REGISTRY_REQUIRED_FIELD_ERROR_CODES"
  );

  assert.equal(errorCodes.supportedFormats, "QUERY_TEMPLATE_INVALID");
  assert.equal(errorCodes.parameterSchema, "QUERY_TEMPLATE_INVALID");
  assert.equal(errorCodes.queryTemplate, "QUERY_TEMPLATE_INVALID");
  assert.equal(errorCodes.fieldMappings, "FIELD_MAPPING_INVALID");
  assert.equal(errorCodes.maskingPolicy, "MASKING_RULE_ERROR");
  assert.equal(errorCodes.dataScopeTemplate, "QUERY_TEMPLATE_INVALID");
  assert.equal(errorCodes.cursorField, "QUERY_TEMPLATE_INVALID");
  assert.equal(errorCodes.orderBy, "QUERY_TEMPLATE_INVALID");
  assert.match(registryContractSource, /SUPPORTED_MASKING_RULE_TYPES = \["PHONE", "PERSON_NAME"\]/);
  assert.match(registryContractSource, /validateMaskingContract\(fieldMappings, maskingPolicy\)/);
  assert.match(registryServiceSource, /buildValidatedRegistryUpsertInput/);
  assert.doesNotMatch(registryServiceSource, /supportedFormats:\s*stableText\(body\.supportedFormats\s*\?\?\s*\[\]\)/);
  assert.doesNotMatch(registryServiceSource, /fieldMappings:\s*stableText\(body\.fieldMappings\s*\?\?\s*\[\]\)/);
  assert.doesNotMatch(registryServiceSource, /dataScopeTemplate:\s*body\.dataScopeTemplate\s*\?\?\s*""/);
  assert.doesNotMatch(registryServiceSource, /cursorField:\s*body\.cursorField\s*\?\?\s*""/);
  assert.doesNotMatch(registryServiceSource, /orderBy:\s*stableText\(body\.orderBy\s*\?\?\s*\[\]\)/);
});
