import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const fullAcceptanceScript = readFileSync(
  new URL("../../scripts/full-acceptance-report.ps1", import.meta.url),
  "utf8"
);

const requiredFrIds = Array.from({ length: 14 }, (_, index) =>
  `FR-${String(index + 1).padStart(3, "0")}`
);

const fullAcceptanceCommands = [
  "npm audit --audit-level=high",
  "npm run arch:check",
  "npm run typecheck",
  "npm run test:contract",
  "npm test",
  "npx --yes @redocly/cli@2.30.6 lint contracts/openapi.yaml",
  "npm run stack:integration:down",
  "npm run stack:integration",
  "scripts/integration-seed.mjs",
  "npm run test:api",
  "npm run test:db",
  "npm run test:worker",
  "npm run test:query",
  "npm run test:file",
  "npm run test:sample",
  "npm run test:acceptance",
  "npm run test:acceptance:report",
  "npm run test:integration-live",
  "npm run test:integration-performance",
  "git diff --check"
];

test("full acceptance report task covers every product requirement", () => {
  const task = findTask("FULL-REQUIREMENTS-ACCEPTANCE-REPORT-001");

  assert.equal(task.passes, true);
  assert.equal(task.task_kind, "test");
  assert.ok(task.owned_paths.includes("docs/testing/full-acceptance-test-report.md"));
  assert.ok(task.owned_paths.includes("scripts/full-acceptance-report.ps1"));

  for (const frId of requiredFrIds) {
    assert.ok(task.requirement_ids.includes(frId), `${frId} must be in task requirement_ids`);
  }
});

test("full acceptance report command includes all critical verification layers", () => {
  const task = findTask("FULL-REQUIREMENTS-ACCEPTANCE-REPORT-001");
  const taskText = JSON.stringify(task);

  assert.ok(packageJson.scripts?.["test:acceptance:full-report"]);
  assert.match(packageJson.scripts["test:acceptance:full-report"], /full-acceptance-report\.ps1/u);
  assert.match(verifyMatrix, /FULL-REQUIREMENTS-ACCEPTANCE-REPORT-001/u);

  for (const command of fullAcceptanceCommands) {
    assert.match(
      fullAcceptanceScript,
      new RegExp(escapeRegExp(command), "u"),
      `${command} must be included`
    );
  }

  assert.match(taskText, /Docker 集成栈/u);
  assert.match(taskText, /Docker MinIO|完整 Docker 集成环境/u);
  assert.doesNotMatch(taskText, /live OSS\/S3 已验证/u);
});

function findTask(taskId) {
  const task = taskJson.tasks.find((candidate) => candidate.id === taskId);
  assert.ok(task, `${taskId} must exist`);
  return task;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
