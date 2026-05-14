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
