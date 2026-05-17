import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverSource = readFileSync("src/server.ts", "utf8");
const registerRoutesSource = readFileSync("src/routes/register-routes.ts", "utf8");
const routeManifestSource = readFileSync("src/routes/route-manifest.ts", "utf8");
const legacyRouteRegistrySource = readFileSync("src/routes/registry.ts", "utf8");

test("Fastify production route registration uses route-manifest instead of legacy route definitions", () => {
  assert.match(serverSource, /from "\.\/routes\/register-routes\.ts"/);
  assert.doesNotMatch(serverSource, /from "\.\/routes\/registry\.ts"/);
  assert.doesNotMatch(serverSource, /import\s+\{\s*routes\s*\}/);

  assert.match(registerRoutesSource, /OPENAPI_OPERATION_ROUTES/);
  assert.match(registerRoutesSource, /from "\.\/route-manifest\.ts"/);
  assert.doesNotMatch(registerRoutesSource, /from "\.\/registry\.ts"/);
});

test("legacy route definition registry remains isolated from production registration while it still points at scaffold handlers", () => {
  assert.match(legacyRouteRegistrySource, /createExportTaskRoute/);

  const legacyRouteFiles = [
    "src/routes/export/tasks/create-export-task.route.ts",
    "src/routes/export/tasks/list-export-tasks.route.ts",
    "src/routes/export/tasks/get-export-task.route.ts",
    "src/routes/export/tasks/download-export-task.route.ts",
    "src/routes/export/tasks/cancel-export-task.route.ts",
    "src/routes/export/tasks/retry-export-task.route.ts",
    "src/routes/export/registries/create-export-registry.route.ts",
    "src/routes/export/registries/list-export-registries.route.ts",
    "src/routes/export/registries/get-export-registry.route.ts",
    "src/routes/export/registries/update-export-registry.route.ts",
    "src/routes/export/registries/enable-export-registry.route.ts",
    "src/routes/export/registries/disable-export-registry.route.ts"
  ];

  for (const routeFile of legacyRouteFiles) {
    const source = readFileSync(routeFile, "utf8");
    assert.match(source, /createNotImplementedHandler/);
    assert.doesNotMatch(routeManifestSource, new RegExp(escapeRegExp(routeFile), "u"));
  }
});

test("route-manifest points directly at production handlers and never at .route.ts wrappers", () => {
  const handlerPaths = [...routeManifestSource.matchAll(/handlerPath:\s*"([^"]+)"/g)].map(
    (match) => match[1]
  );

  assert.equal(handlerPaths.length, 12);
  for (const handlerPath of handlerPaths) {
    assert.match(handlerPath, /\.handler\.ts$/);
    assert.doesNotMatch(handlerPath, /\.route\.ts$/);
    assert.doesNotMatch(readFileSync(handlerPath, "utf8"), /createNotImplementedHandler/);
  }
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
