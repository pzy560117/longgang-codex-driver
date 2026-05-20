import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OPENAPI_OPERATION_ROUTES } from "../src/routes/route-manifest.ts";

type OpenApiOperation = {
  operationId: string;
  method: string;
  path: string;
};

const root = process.cwd();
const requiredFiles = [
  "src/server.ts",
  "src/config/env.ts",
  "src/workers/scheduler-worker.ts",
  "src/jobs/cleanup-job.ts",
  "src/routes/register-routes.ts",
  "src/routes/route-manifest.ts",
  "src/db/migrator.ts",
  "scripts/db-migrate.ts",
  "deploy/systemd/export-platform-http.service",
  "deploy/systemd/export-platform-scheduler.service",
  "deploy/systemd/export-platform-cleanup.service",
  "src/repositories/index.ts",
  "migrations/001_initial_export_platform_schema.sql"
];

const requiredScripts = [
  "start",
  "worker:scheduler",
  "job:cleanup",
  "db:migrate",
  "arch:check",
  "typecheck",
  "test",
  "test:contract",
  "test:api",
  "test:db",
  "test:worker",
  "test:query",
  "test:file",
  "test:sample"
];

const requiredMigrationMarkers = [
  "export_tasks",
  "export_task_idempotency",
  "export_registries",
  "export_registry_versions",
  "export_task_leases",
  "export_task_checkpoints",
  "export_task_files",
  "export_task_events",
  "export_audit_logs"
];

const forbiddenProductionPattern = /\b(InMemory\w*|mock\w*|fixture\w*)\b/i;
const productionScanRoots = [
  "src/server.ts",
  "src/routes/",
  "src/task-api/",
  "src/registry-config/",
  "src/scheduler/",
  "src/workers/",
  "src/query-executor/",
  "src/datasource-adapters/",
  "src/file-service/",
  "src/cleanup-job/",
  "src/jobs/",
  "src/audit-log/",
  "src/repositories/",
  "src/db/"
];

function fail(message: string): never {
  throw new Error(`Architecture check failed: ${message}`);
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function requireFile(relativePath: string): void {
  if (!existsSync(path.join(root, relativePath))) {
    fail(`missing required file ${relativePath}`);
  }
}

function collectTypeScriptFiles(relativePath: string): string[] {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const stat = statSync(absolutePath);
  if (stat.isFile()) {
    return relativePath.endsWith(".ts") ? [relativePath] : [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(absolutePath)) {
    files.push(...collectTypeScriptFiles(path.join(relativePath, entry)));
  }
  return files;
}

function parseOpenApiOperations(openapiText: string): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];
  let currentPath = "";
  let currentMethod = "";

  for (const line of openapiText.split(/\r?\n/)) {
    const pathMatch = line.match(/^  (\/[^:]+):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1];
      currentMethod = "";
      continue;
    }

    const methodMatch = line.match(/^    (get|post|put|delete|patch):\s*$/);
    if (methodMatch) {
      currentMethod = methodMatch[1].toUpperCase();
      continue;
    }

    const operationMatch = line.match(/^\s+operationId:\s*([A-Za-z0-9_]+)\s*$/);
    if (operationMatch && currentPath && currentMethod) {
      operations.push({
        operationId: operationMatch[1],
        method: currentMethod,
        path: `/api${currentPath}`
      });
    }
  }

  return operations;
}

function checkPackageScripts(): void {
  const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
  for (const script of requiredScripts) {
    if (!packageJson.scripts?.[script]) {
      fail(`package.json missing script ${script}`);
    }
  }
}

function checkRequiredFiles(): void {
  for (const relativePath of requiredFiles) {
    requireFile(relativePath);
  }
}

function checkNoForbiddenProductionReferences(): void {
  const productionFiles = productionScanRoots.flatMap((scanRoot) =>
    collectTypeScriptFiles(scanRoot)
  );

  checkFilesForForbiddenProductionReferences(productionFiles, read);
}

function checkFilesForForbiddenProductionReferences(
  relativePaths: string[],
  readFile: (relativePath: string) => string
): void {
  for (const relativePath of relativePaths) {
    const content = readFile(relativePath);
    if (forbiddenProductionPattern.test(content)) {
      fail(`${relativePath} references forbidden test double terminology`);
    }
  }
}

function checkOpenApiRouteMapping(): void {
  const operations = parseOpenApiOperations(read("contracts/openapi.yaml"));
  if (operations.length === 0) {
    fail("contracts/openapi.yaml exposes no operationId entries");
  }

  const routesByOperation = new Map(
    OPENAPI_OPERATION_ROUTES.map((route) => [route.operationId, route])
  );

  for (const operation of operations) {
    const route = routesByOperation.get(operation.operationId);
    if (!route) {
      fail(`missing route mapping for operationId ${operation.operationId}`);
    }
    if (route.method !== operation.method || route.path !== operation.path) {
      fail(
        `${operation.operationId} route mismatch: expected ${operation.method} ${operation.path}, got ${route.method} ${route.path}`
      );
    }
    requireFile(route.handlerPath);
    if (route.tests.length === 0) {
      fail(`${operation.operationId} has no test mapping`);
    }
    for (const testPath of route.tests) {
      requireFile(testPath);
    }
  }
}

function checkMigrationCoverage(): void {
  const migration = collectMigrationSql().toLowerCase();
  for (const marker of requiredMigrationMarkers) {
    if (!migration.includes(marker)) {
      fail(`migration missing marker ${marker}`);
    }
  }
}

function checkSqlMigrationSyntaxGuards(migrationSql: string): void {
  if (/,\s*\);/m.test(migrationSql)) {
    fail("SQL migration contains a dangling comma before table close");
  }
}

function checkSqlMigrationSyntax(): void {
  checkSqlMigrationSyntaxGuards(collectMigrationSql());
}

function collectMigrationSql(): string {
  const migrationDir = path.join(root, "migrations");
  return readdirSync(migrationDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => read(path.join("migrations", fileName)))
    .join("\n");
}

function getExpectedDatabaseTableNames(): string[] {
  return [...requiredMigrationMarkers];
}

function getProductionScanRoots(): string[] {
  return [...productionScanRoots];
}

function main(): void {
  checkRequiredFiles();
  checkPackageScripts();
  checkOpenApiRouteMapping();
  checkNoForbiddenProductionReferences();
  checkMigrationCoverage();
  checkSqlMigrationSyntax();

  console.log("Architecture check passed.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export {
  checkMigrationCoverage,
  checkFilesForForbiddenProductionReferences,
  checkNoForbiddenProductionReferences,
  checkOpenApiRouteMapping,
  checkPackageScripts,
  checkRequiredFiles,
  checkSqlMigrationSyntaxGuards,
  collectMigrationSql,
  getExpectedDatabaseTableNames,
  getProductionScanRoots,
  parseOpenApiOperations
};
