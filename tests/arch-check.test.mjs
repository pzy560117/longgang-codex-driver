import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadConfig } from "../src/config/env.ts";
import { createDatabase } from "../src/db/index.ts";
import { createMysqlPoolOptions } from "../src/db/kysely.ts";
import * as archCheck from "../scripts/arch-check.ts";
import {
  checkFilesForForbiddenProductionReferences,
  checkNoForbiddenProductionReferences,
  getExpectedDatabaseTableNames,
  getProductionScanRoots
} from "../scripts/arch-check.ts";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const verifyMatrix = readFileSync(
  new URL("../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);
const schemaSource = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8");
const tsMigrationSource = readFileSync(
  new URL("../migrations/001_initial_export_platform.ts", import.meta.url),
  "utf8"
);
const sqlMigrationSource = readFileSync(
  new URL("../migrations/001_initial_export_platform_schema.sql", import.meta.url),
  "utf8"
);

function collectMatches(source, regex) {
  return [...source.matchAll(regex)].map((match) => match[1]).sort();
}

function getDatabaseInterfaceBody(source) {
  const match = source.match(/export interface ExportPlatformDatabase \{\n([\s\S]*?)\n\}/);
  assert.ok(match, "ExportPlatformDatabase interface must exist");
  return match[1];
}

function collectSchemaColumns(source) {
  const tables = new Map();
  const interfacePattern = /export interface ([A-Za-z0-9]+Table) \{\n([\s\S]*?)\n\}/g;
  const databaseBody = getDatabaseInterfaceBody(source);
  const typeByTable = new Map(
    [...databaseBody.matchAll(/^\s{2}([a-z0-9_]+):\s+([A-Za-z0-9]+Table);/gm)].map(
      (match) => [match[2], match[1]]
    )
  );

  for (const match of source.matchAll(interfacePattern)) {
    const tableName = typeByTable.get(match[1]);
    if (!tableName) {
      continue;
    }
    tables.set(
      tableName,
      collectMatches(match[2], /^\s{2}([a-z0-9_]+):\s+/gm)
    );
  }

  return Object.fromEntries([...tables.entries()].sort());
}

function collectTsMigrationColumns(source) {
  const tables = new Map();
  const tablePattern = /\.createTable\("([a-z0-9_]+)"\)([\s\S]*?)(?=\.execute\(\);)/g;

  for (const match of source.matchAll(tablePattern)) {
    tables.set(
      match[1],
      collectMatches(match[2], /\.addColumn\("([a-z0-9_]+)"/g)
    );
  }

  return Object.fromEntries([...tables.entries()].sort());
}

function collectSqlMigrationColumns(source) {
  const tables = new Map();
  const tablePattern = /^CREATE TABLE ([a-z0-9_]+) \(\n([\s\S]*?)\n\);/gm;

  for (const match of source.matchAll(tablePattern)) {
    const columns = match[2]
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => /^[a-z0-9_]+\s+/i.test(line))
      .filter((line) => !/^(PRIMARY|UNIQUE|KEY|CONSTRAINT)\b/i.test(line))
      .map((line) => line.split(/\s+/)[0])
      .sort();
    tables.set(match[1], columns);
  }

  return Object.fromEntries([...tables.entries()].sort());
}

test("arch:check is declared as the scaffold gate", () => {
  assert.equal(packageJson.scripts?.["arch:check"], "tsx scripts/arch-check.ts");
});

test("verify matrix marks downstream DB/API/worker work as blocked or planned", () => {
  assert.match(verifyMatrix, /\|\s*FR-001\s*\|\s*contract \/ API \/ DB\s*\|\s*blocked-by-next-task\s*\|/);
  assert.match(verifyMatrix, /\|\s*FR-005\s*\|\s*DB \/ worker\s*\|\s*blocked-by-next-task\s*\|/);
  assert.match(verifyMatrix, /\|\s*FR-010\s*\|\s*audit \/ API \/ worker\s*\|\s*blocked-by-next-task\s*\|/);
  assert.match(verifyMatrix, /\|\s*STACK-ADR-001\s*\|\s*design \/ planned \/ arch-check\s*\|\s*planned\s*\|/);
});

test("createDatabase 在缺少真实数据库环境时仍可构造 Kysely 对象", async () => {
  const originalEnv = {
    ...process.env
  };

  delete process.env.EXPORT_PLATFORM_DATABASE_URL;

  const database = createDatabase();

  assert.equal(typeof database.destroy, "function");
  await database.destroy();

  process.env = originalEnv;
});

test("MySQL pool options 使用拆分环境变量并允许 database URL 优先", () => {
  const splitConfig = loadConfig({
    EXPORT_PLATFORM_MYSQL_HOST: "mysql.internal",
    EXPORT_PLATFORM_MYSQL_PORT: "3307",
    EXPORT_PLATFORM_MYSQL_DATABASE: "exports",
    EXPORT_PLATFORM_MYSQL_USER: "export_user",
    EXPORT_PLATFORM_MYSQL_PASSWORD: "secret",
    EXPORT_PLATFORM_MYSQL_SSL: "true"
  });

  assert.deepEqual(createMysqlPoolOptions(splitConfig), {
    host: "mysql.internal",
    port: 3307,
    database: "exports",
    user: "export_user",
    password: "secret",
    ssl: {}
  });

  const urlConfig = loadConfig({
    EXPORT_PLATFORM_DATABASE_URL: "mysql://url_user:url_pass@db.example:3308/url_db?ssl=false",
    EXPORT_PLATFORM_MYSQL_HOST: "ignored"
  });

  assert.deepEqual(createMysqlPoolOptions(urlConfig), {
    host: "db.example",
    port: 3308,
    database: "url_db",
    user: "url_user",
    password: "url_pass",
    ssl: undefined
  });
});

test("DB schema、TS migration、SQL migration 的表名集合一致", () => {
  const expectedTables = getExpectedDatabaseTableNames().sort();
  const schemaTables = collectMatches(
    getDatabaseInterfaceBody(schemaSource),
    /^\s{2}([a-z0-9_]+):\s+[A-Za-z0-9_]+;/gm
  );
  const tsMigrationTables = collectMatches(
    tsMigrationSource,
    /\.createTable\("([a-z0-9_]+)"\)/g
  );
  const sqlMigrationTables = collectMatches(
    sqlMigrationSource,
    /^CREATE TABLE ([a-z0-9_]+) \(/gm
  );

  assert.deepEqual(schemaTables, expectedTables);
  assert.deepEqual(tsMigrationTables, expectedTables);
  assert.deepEqual(sqlMigrationTables, expectedTables);
});

test("DB schema、TS migration、SQL migration 的列集合一致", () => {
  assert.deepEqual(collectTsMigrationColumns(tsMigrationSource), collectSchemaColumns(schemaSource));
  assert.deepEqual(collectSqlMigrationColumns(sqlMigrationSource), collectSchemaColumns(schemaSource));
});

test("arch:check 拒绝 SQL migration 的表尾逗号", () => {
  assert.equal(typeof archCheck.checkSqlMigrationSyntaxGuards, "function");
  assert.throws(
    () =>
      archCheck.checkSqlMigrationSyntaxGuards(
        "CREATE TABLE export_registries (\n  task_code VARCHAR(128),\n);"
      ),
    /SQL migration contains a dangling comma before table close/
  );
  assert.doesNotThrow(() => archCheck.checkSqlMigrationSyntaxGuards(sqlMigrationSource));
});

test("arch:check 的生产替身扫描覆盖 API 和 DB 生产路径", () => {
  assert.deepEqual(
    new Set(getProductionScanRoots()),
    new Set([
      "src/server.ts",
      "src/routes/",
      "src/task-api/",
      "src/registry-config/",
      "src/scheduler/",
      "src/workers/",
      "src/query-executor/",
      "src/file-service/",
      "src/cleanup-job/",
      "src/jobs/",
      "src/audit-log/",
      "src/repositories/",
      "src/db/"
    ])
  );
});

test("生产路径出现测试替身术语时 arch check 会失败", () => {
  assert.throws(
    () =>
      checkFilesForForbiddenProductionReferences(["src/routes/forbidden.ts"], () => {
        return "export class InMemoryRepository {}";
      }),
    /src\/routes\/forbidden.ts references forbidden test double terminology/
  );
});
