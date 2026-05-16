import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const taskJson = JSON.parse(
  readFileSync(new URL("../../task.json", import.meta.url), "utf8").replace(/^\uFEFF/u, "")
);
const verifyMatrix = readFileSync(
  new URL("../../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);

const task = taskJson.tasks.find((candidate) => candidate.id === "DOCKER-TEST-DATA-AUTOMATION-001");
const envScriptUrl = new URL("../../scripts/docker-test-env.ps1", import.meta.url);
const seedScriptUrl = new URL("../../scripts/docker-test-seed.mjs", import.meta.url);
const runbookUrl = new URL("../../docs/testing/docker-test-data-runbook.md", import.meta.url);

test("docker test data task is queued after release with executable guardrails", () => {
  assert.ok(task, "DOCKER-TEST-DATA-AUTOMATION-001 must exist");
  assert.equal(task.passes, true);
  assert.deepEqual(task.dependencies, ["RELEASE-001"]);
  assert.match(task.test_command, /npm run test:docker-local/u);
  assert.match(task.architecture_constraints.join("\n"), /Docker MySQL/u);
  assert.match(task.architecture_constraints.join("\n"), /不产出外部 live evidence/u);
  assert.match(task.forbidden_implementations.join("\n"), /禁止把本地 object storage mock 写成 live OSS\/S3 证据/u);
});

test("docker local test command wires environment setup, seed and validation", () => {
  assert.equal(
    packageJson.scripts?.["test:docker-local"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\docker-test-env.ps1 -RunValidation"
  );
  assert.equal(existsSync(envScriptUrl), true);
  assert.equal(existsSync(seedScriptUrl), true);
  assert.equal(existsSync(runbookUrl), true);

  const envScript = readFileSync(envScriptUrl, "utf8");
  const seedScript = readFileSync(seedScriptUrl, "utf8");
  const runbook = readFileSync(runbookUrl, "utf8");

  assert.match(envScript, /Start-DockerDesktopIfNeeded/u);
  assert.match(envScript, /Ensure-DockerMysql/u);
  assert.match(envScript, /Start-LocalObjectStorage/u);
  assert.match(envScript, /docker-test-seed\.mjs/u);
  assert.match(envScript, /npm run test:api/u);
  assert.match(envScript, /npm run test:db/u);
  assert.match(envScript, /npm run test:worker/u);
  assert.match(envScript, /npm run test:query/u);
  assert.match(envScript, /npm run test:file/u);
  assert.match(envScript, /npm run test:sample/u);
  assert.match(envScript, /BLOCKED - 需要人工介入/u);

  assert.match(seedScript, /runMigrations/u);
  assert.match(seedScript, /purchase_orders_sample/u);
  assert.match(seedScript, /seededRows/u);
  assert.match(seedScript, /refuses non-local MySQL URLs/u);
  assert.match(seedScript, /purchase-order-export/u);

  assert.match(runbook, /npm run test:docker-local/u);
  assert.match(runbook, /docker\/mock/u);
  assert.match(runbook, /不是 live OSS\/S3/u);
  assert.match(runbook, /Docker Desktop/u);
});

test("verify matrix records docker test data evidence without promoting live validation", () => {
  const row = verifyMatrix
    .split(/\r?\n/u)
    .find((line) => line.startsWith("| Docker test data automation |")) ?? "";

  assert.match(row, /DOCKER-TEST-DATA-AUTOMATION-001/u);
  assert.match(row, /npm run test:docker-local/u);
  assert.match(row, /本机 Docker MySQL \+ 本地 object storage mock/u);
  assert.match(row, /不是 live evidence/u);
});
