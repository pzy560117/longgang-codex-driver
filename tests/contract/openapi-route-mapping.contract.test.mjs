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

test("OpenAPI operationIds are represented by route manifest entries", () => {
  assert.deepEqual(
    new Set(parseRouteManifestOperationIds()),
    new Set(parseOpenApiOperationIds())
  );
});
