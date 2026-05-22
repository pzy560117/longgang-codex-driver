import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const demoScriptUrl = new URL("../../scripts/local-demo.ps1", import.meta.url);
const setupScriptUrl = new URL("../../scripts/local-demo-setup.mjs", import.meta.url);
const runbookUrl = new URL("../../docs/testing/local-demo-runbook.md", import.meta.url);

test("local demo entrypoint provisions local dependencies and starts the HTTP service", () => {
  assert.equal(
    packageJson.scripts?.["demo:local"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\local-demo.ps1"
  );
  assert.equal(
    packageJson.scripts?.["demo:local:smoke"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\local-demo.ps1 -SmokeOnly"
  );
  assert.equal(existsSync(demoScriptUrl), true, "scripts/local-demo.ps1 must exist");
  assert.equal(existsSync(setupScriptUrl), true, "scripts/local-demo-setup.mjs must exist");

  const script = readFileSync(demoScriptUrl, "utf8");
  assert.match(script, /Ensure-DockerMysql/u);
  assert.match(script, /mysql:8\.4/u);
  assert.match(script, /MinioContainerName/u);
  assert.match(script, /docker-test-env\.ps1/u);
  assert.match(script, /EXPORT_PLATFORM_TEST_DATABASE_URL/u);
  assert.match(script, /ObjectStorageBucket/u);
  assert.match(script, /docker-test-env\.ps1/u);
  assert.match(script, /src\\server\.ts/u);
  assert.match(script, /Invoke-WebRequest/u);
  assert.match(script, /\/health/u);
  assert.match(script, /POST \/api\/export\/tasks/u);
  assert.match(script, /Assert-DockerMysqlConfiguration/u);
  assert.match(script, /NetworkSettings\.Ports/u);
  assert.match(script, /MYSQL_DATABASE/u);
});

test("local demo setup delegates to shared docker/minio seed flow", () => {
  const setupScript = readFileSync(setupScriptUrl, "utf8");
  assert.match(setupScript, /runMigrations/u);
  assert.match(setupScript, /purchase_orders_sample/u);
  assert.match(setupScript, /seededRows/u);
});

test("local demo setup rejects local tunnels to non-demo databases before connecting", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", fileURLToPath(new URL("../../scripts/local-demo-setup.mjs", import.meta.url))],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        EXPORT_PLATFORM_DATABASE_URL: "mysql://root@127.0.0.1:1/production_like_database",
        EXPORT_PLATFORM_TEST_DATABASE_URL: ""
      }
    }
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /refuses non-demo MySQL databases/u);
});

test("local demo does not silently seed an inherited external database URL", () => {
  const script = readFileSync(demoScriptUrl, "utf8");

  assert.doesNotMatch(
    script,
    /GetEnvironmentVariable\("EXPORT_PLATFORM_TEST_DATABASE_URL"\)[\s\S]{0,240}return/u
  );
  assert.match(script, /127\.0\.0\.1:\$Port\/\$Database/u);
  assert.match(script, /SetEnvironmentVariable\("EXPORT_PLATFORM_TEST_DATABASE_URL"/u);
});

test("local demo runbook is explicit about local-only dependencies and API examples", () => {
  assert.equal(existsSync(runbookUrl), true, "docs/testing/local-demo-runbook.md must exist");
  const runbook = readFileSync(runbookUrl, "utf8");

  assert.match(runbook, /npm run demo:local/u);
  assert.match(runbook, /npm run demo:local:smoke/u);
  assert.match(runbook, /npm run stack:local/u);
  assert.match(runbook, /Docker MySQL/u);
  assert.match(runbook, /Docker MinIO/u);
  assert.match(runbook, /不需要外部 MySQL/u);
  assert.match(runbook, /不需要外部 OSS\/S3/u);
  assert.match(runbook, /自动 migration/u);
  assert.match(runbook, /seed 测试数据/u);
  assert.match(runbook, /curl/u);
  assert.match(runbook, /Invoke-RestMethod/u);
  assert.match(runbook, /GET \/health/u);
  assert.match(runbook, /POST \/api\/export\/tasks/u);
  assert.doesNotMatch(runbook, /已验证外部 live OSS\/S3/u);
});
