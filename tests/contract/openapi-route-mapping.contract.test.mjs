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

test("audit action and result literals written by production code stay within OpenAPI public enums", () => {
  const actionEnum = parseAuditActionEnum();
  const resultEnum = parseAuditResultEnum();
  const literals = sourceAuditLiterals();

  assert.deepEqual(
    [...literals.actions].filter((action) => !actionEnum.has(action)),
    []
  );
  assert.deepEqual(
    [...literals.results].filter((result) => !resultEnum.has(result)),
    []
  );
});
