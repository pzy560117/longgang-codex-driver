import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createEnvReadonlyDatasourceAdapterProvider } from "../src/datasource-adapters/index.ts";
import { loadConfig, loadDatabaseConfig } from "../src/config/env.ts";

test("loadConfig prefers EXPORT_PLATFORM_DATABASE_URL over split MySQL settings and decodes credentials", () => {
  const config = loadConfig({
    EXPORT_PLATFORM_DATABASE_URL:
      "mysql://url%20user:p%40ss%2Fword@db.example.internal:3307/export_platform_prod?ssl=true",
    EXPORT_PLATFORM_MYSQL_HOST: "ignored-host",
    EXPORT_PLATFORM_MYSQL_PORT: "3308",
    EXPORT_PLATFORM_MYSQL_DATABASE: "ignored_db",
    EXPORT_PLATFORM_MYSQL_USER: "ignored_user",
    EXPORT_PLATFORM_MYSQL_PASSWORD: "ignored_password",
    EXPORT_PLATFORM_MYSQL_SSL: "false"
  });

  assert.equal(config.databaseUrl?.startsWith("mysql://url%20user:"), true);
  assert.equal(config.mysql.host, "db.example.internal");
  assert.equal(config.mysql.port, 3307);
  assert.equal(config.mysql.database, "export_platform_prod");
  assert.equal(config.mysql.user, "url user");
  assert.equal(config.mysql.password, "p@ss/word");
  assert.equal(config.mysql.ssl, true);
});

test("loadConfig reads split MySQL, HTTP, scheduler, and cleanup settings", () => {
  const config = loadConfig({
    EXPORT_PLATFORM_HOST: "127.0.0.1",
    EXPORT_PLATFORM_PORT: "4100",
    EXPORT_PLATFORM_MYSQL_HOST: "mysql.internal",
    EXPORT_PLATFORM_MYSQL_PORT: "3307",
    EXPORT_PLATFORM_MYSQL_DATABASE: "exports",
    EXPORT_PLATFORM_MYSQL_USER: "export_user",
    EXPORT_PLATFORM_MYSQL_PASSWORD: "export_password",
    EXPORT_PLATFORM_MYSQL_SSL: "yes",
    EXPORT_PLATFORM_SCHEDULER_POLL_MS: "2500",
    EXPORT_PLATFORM_CLEANUP_POLL_MS: "90000"
  });

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.port, 4100);
  assert.equal(config.http.port, 4100);
  assert.deepEqual(config.mysql, {
    host: "mysql.internal",
    port: 3307,
    database: "exports",
    user: "export_user",
    password: "export_password",
    ssl: true,
    source: "split"
  });
  assert.equal(config.schedulerPollIntervalMs, 2500);
  assert.equal(config.scheduler.pollIntervalMs, 2500);
  assert.equal(config.cleanupPollIntervalMs, 90000);
  assert.equal(config.cleanup.pollIntervalMs, 90000);
});

test("loadConfig reads production dependency, security, datasource, and worker settings", () => {
  const config = loadConfig({
    EXPORT_PLATFORM_ENVIRONMENT: "production",
    EXPORT_PLATFORM_DATABASE_URL: "mysql://platform_user:platform_password@mysql.internal:3306/export_platform?ssl=true",
    EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL:
      "mysql://readonly_user:readonly_password@purchase.internal:3306/purchase?ssl=true",
    EXPORT_PLATFORM_DATASOURCES_JSON:
      '{"inventory-ro":{"url":"mysql://readonly_user:readonly_password@inventory.internal:3306/inventory?ssl=true"}}',
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "https://object-storage.internal",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-prod",
    EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "true",
    EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX: "/release-smoke/prod/",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "download-signing-secret",
    EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET: "auth-context-signing-secret",
    EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS: "tenant-001, tenant-002",
    EXPORT_PLATFORM_PUBLIC_BASE_URL: "https://exports.platform.internal",
    EXPORT_PLATFORM_WORKER_ID: "scheduler-prod-001",
    EXPORT_PLATFORM_CLEANUP_WORKER_ID: "cleanup-prod-001"
  });

  assert.equal(config.environment, "production");
  assert.deepEqual(config.datasource.urlsByCode, {
    "purchase-ro": "mysql://readonly_user:readonly_password@purchase.internal:3306/purchase?ssl=true",
    "inventory-ro": "mysql://readonly_user:readonly_password@inventory.internal:3306/inventory?ssl=true"
  });
  assert.deepEqual(config.objectStorage, {
    endpoint: "https://object-storage.internal",
    bucket: "export-platform-prod",
    allowLocalSmoke: false,
    allowSmokeWrites: true,
    smokePrefix: "release-smoke/prod"
  });
  assert.deepEqual(config.security, {
    downloadUrlSigningSecret: "download-signing-secret",
    authContextSigningSecret: "auth-context-signing-secret",
    registryAdminTenantIds: ["tenant-001", "tenant-002"],
    publicBaseUrl: "https://exports.platform.internal"
  });
  assert.deepEqual(config.worker, {
    schedulerWorkerId: "scheduler-prod-001",
    cleanupWorkerId: "cleanup-prod-001"
  });
});

test("loadConfig fails fast for unsafe production dependency configuration", () => {
  const productionBase = {
    EXPORT_PLATFORM_ENVIRONMENT: "production",
    EXPORT_PLATFORM_DATABASE_URL: "mysql://platform_user:platform_password@mysql.internal:3306/export_platform?ssl=true",
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "https://object-storage.internal",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-prod",
    EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "true",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "download-signing-secret",
    EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET: "auth-context-signing-secret",
    EXPORT_PLATFORM_PUBLIC_BASE_URL: "https://exports.platform.internal"
  };

  for (const [name, overrides, message] of [
    [
      "missing auth secret",
      { EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET: "" },
      /Missing required production secret: EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET/
    ],
    [
      "localhost object storage",
      { EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:9000" },
      /Unsafe production endpoint/
    ],
    [
      "example public base URL",
      { EXPORT_PLATFORM_PUBLIC_BASE_URL: "https://exports.example.test" },
      /Unsafe production endpoint/
    ],
    [
      "missing smoke write guard",
      { EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "" },
      /EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true/
    ]
  ]) {
    assert.throws(() => loadConfig({ ...productionBase, ...overrides }), message, name);
  }
});

test("loadConfig allows complete split MySQL settings in production", () => {
  const config = loadConfig({
    EXPORT_PLATFORM_ENVIRONMENT: "production",
    EXPORT_PLATFORM_MYSQL_HOST: "mysql.internal",
    EXPORT_PLATFORM_MYSQL_PORT: "3306",
    EXPORT_PLATFORM_MYSQL_DATABASE: "export_platform",
    EXPORT_PLATFORM_MYSQL_USER: "platform_user",
    EXPORT_PLATFORM_MYSQL_PASSWORD: "platform_password",
    EXPORT_PLATFORM_MYSQL_SSL: "true",
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "https://object-storage.internal",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-prod",
    EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "true",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "download-signing-secret",
    EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET: "auth-context-signing-secret",
    EXPORT_PLATFORM_PUBLIC_BASE_URL: "https://exports.platform.internal"
  });

  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.mysql.host, "mysql.internal");
  assert.equal(config.mysql.password, "platform_password");
  assert.equal(config.mysql.source, "split");
});

test("loadDatabaseConfig allows production migration job with only platform database settings", () => {
  const config = loadDatabaseConfig({
    EXPORT_PLATFORM_ENVIRONMENT: "production",
    EXPORT_PLATFORM_DATABASE_URL: "mysql://platform_user:platform_password@mysql.internal:3306/export_platform?ssl=true"
  });

  assert.equal(config.environment, "production");
  assert.equal(config.mysql.host, "mysql.internal");
  assert.equal(config.mysql.database, "export_platform");
  assert.equal(config.mysql.source, "database-url");
});

test("loadConfig rejects incomplete split MySQL settings in production", () => {
  const productionSplitBase = {
    EXPORT_PLATFORM_ENVIRONMENT: "production",
    EXPORT_PLATFORM_MYSQL_HOST: "mysql.internal",
    EXPORT_PLATFORM_MYSQL_PORT: "3306",
    EXPORT_PLATFORM_MYSQL_DATABASE: "export_platform",
    EXPORT_PLATFORM_MYSQL_USER: "platform_user",
    EXPORT_PLATFORM_MYSQL_PASSWORD: "platform_password",
    EXPORT_PLATFORM_MYSQL_SSL: "true",
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "https://object-storage.internal",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-prod",
    EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "true",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "download-signing-secret",
    EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET: "auth-context-signing-secret",
    EXPORT_PLATFORM_PUBLIC_BASE_URL: "https://exports.platform.internal"
  };

  for (const name of [
    "EXPORT_PLATFORM_MYSQL_HOST",
    "EXPORT_PLATFORM_MYSQL_PORT",
    "EXPORT_PLATFORM_MYSQL_DATABASE",
    "EXPORT_PLATFORM_MYSQL_USER",
    "EXPORT_PLATFORM_MYSQL_PASSWORD",
    "EXPORT_PLATFORM_MYSQL_SSL"
  ]) {
    assert.throws(
      () => loadConfig({ ...productionSplitBase, [name]: "" }),
      new RegExp(`Missing required production configuration: ${name}`)
    );
  }
});

test("production modules use the unified config provider instead of direct process.env reads", () => {
  for (const path of [
    "src/datasource-adapters/index.ts",
    "src/file-service/index.ts",
    "src/audit-log/auth-context.ts",
    "src/task-api/service.ts",
    "src/workers/scheduler-worker.ts",
    "src/jobs/cleanup-job.ts",
    "src/cleanup-job/index.ts"
  ]) {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /process\.env/u, `${path} reads process.env directly`);
  }
});

test("datasource adapter provider accepts legacy env input and explicit datasource config", async () => {
  const legacyEnvProvider = createEnvReadonlyDatasourceAdapterProvider({
    env: {
      EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL:
        "mysql://readonly_user:readonly_password@purchase.internal:3306/purchase?ssl=true"
    }
  });
  const explicitConfigProvider = createEnvReadonlyDatasourceAdapterProvider({
    datasource: {
      urlsByCode: {
        "purchase-ro": "mysql://readonly_user:readonly_password@purchase.internal:3306/purchase?ssl=true"
      }
    }
  });

  assert.notEqual(await legacyEnvProvider.resolveReadonlyAdapter("purchase-ro"), undefined);
  assert.notEqual(await explicitConfigProvider.resolveReadonlyAdapter("purchase-ro"), undefined);
  assert.equal(await explicitConfigProvider.resolveReadonlyAdapter("unknown"), undefined);
});

test("loadConfig rejects invalid positive integer settings", () => {
  for (const [name, value] of [
    ["EXPORT_PLATFORM_PORT", "0"],
    ["EXPORT_PLATFORM_MYSQL_PORT", "-1"],
    ["EXPORT_PLATFORM_SCHEDULER_POLL_MS", "abc"],
    ["EXPORT_PLATFORM_CLEANUP_POLL_MS", "0"]
  ]) {
    assert.throws(
      () =>
        loadConfig({
          [name]: value
        }),
      /Invalid positive integer configuration value/
    );
  }
});

test("loadConfig rejects invalid boolean settings", () => {
  assert.throws(
    () =>
      loadConfig({
        EXPORT_PLATFORM_MYSQL_SSL: "sometimes"
      }),
    /Invalid boolean configuration value/
  );
  assert.throws(
    () =>
      loadConfig({
        EXPORT_PLATFORM_DATABASE_URL: "mysql://user:pass@mysql.internal/export_platform?ssl=maybe"
      }),
    /Invalid boolean configuration value/
  );
});
