import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config/env.ts";

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
    ssl: true
  });
  assert.equal(config.schedulerPollIntervalMs, 2500);
  assert.equal(config.scheduler.pollIntervalMs, 2500);
  assert.equal(config.cleanupPollIntervalMs, 90000);
  assert.equal(config.cleanup.pollIntervalMs, 90000);
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
