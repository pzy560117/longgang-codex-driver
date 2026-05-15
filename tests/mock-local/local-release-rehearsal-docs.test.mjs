import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const taskJson = JSON.parse(
  readFileSync(new URL("../../task.json", import.meta.url), "utf8").replace(/^\uFEFF/u, "")
);
const releasePlan = readFileSync(
  new URL("../../docs/testing/mock-first-release-plan.md", import.meta.url),
  "utf8"
);
const verifyMatrix = readFileSync(
  new URL("../../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);
const gitignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");
const scriptUrl = new URL("../../scripts/local-release-rehearsal.ps1", import.meta.url);

test("local release rehearsal is declared as mock/local evidence without releasing RELEASE-001", () => {
  const rehearsalTask = taskJson.tasks.find((task) => task.id === "LOCAL-RELEASE-REHEARSAL-001");
  assert.ok(rehearsalTask, "LOCAL-RELEASE-REHEARSAL-001 must exist");
  assert.equal(rehearsalTask.passes, false);
  assert.deepEqual(rehearsalTask.dependencies, ["MOCK-INTEGRATION-001"]);
  assert.match(rehearsalTask.description, /本地 release rehearsal/u);
  assert.match(rehearsalTask.test_command, /npm run release:local-rehearsal/u);
  assert.match(rehearsalTask.acceptance.join("\n"), /不是 RELEASE-001 PASS 证据/u);

  const releaseTask = taskJson.tasks.find((task) => task.id === "RELEASE-001");
  assert.ok(releaseTask, "RELEASE-001 must exist");
  assert.equal(releaseTask.passes, false);
  assert.ok(releaseTask.dependencies.includes("REAL-RELEASE-ENV-READY"));
});

test("local release rehearsal script documents local-only preflight and command coverage", () => {
  assert.equal(
    packageJson.scripts?.["release:local-rehearsal"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\local-release-rehearsal.ps1 -StartLocalObjectStorageMock"
  );
  assert.equal(existsSync(scriptUrl), true);

  const script = readFileSync(scriptUrl, "utf8");
  assert.match(script, /LOCAL-RELEASE-REHEARSAL-001/u);
  assert.match(script, /\$StartLocalObjectStorageMock = \$true/u);
  assert.match(script, /EXPORT_PLATFORM_TEST_DATABASE_URL/u);
  assert.match(script, /EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT/u);
  assert.match(script, /EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET/u);
  assert.match(script, /EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES/u);
  assert.match(script, /npm run test:api/u);
  assert.match(script, /npm run test:db/u);
  assert.match(script, /npm run test:worker/u);
  assert.match(script, /npm run test:query/u);
  assert.match(script, /npm run test:file/u);
  assert.match(script, /npm run test:sample/u);
  assert.match(script, /npm run test:object-storage-live/u);
  assert.match(script, /mock\/local rehearsal/u);
});

test("local release rehearsal can load untracked env files for local MySQL credentials", () => {
  const script = readFileSync(scriptUrl, "utf8");
  assert.match(script, /\[string\]\$EnvFile/u);
  assert.match(script, /Load-EnvFile/u);
  assert.match(script, /\.env\.local/u);
  assert.match(script, /EXPORT_PLATFORM_TEST_DATABASE_URL/u);
  assert.match(releasePlan, /\.env\.local/u);
  assert.match(verifyMatrix, /\.env\.local/u);
  assert.match(gitignore, /^\.env\*/mu);
});

test("local release rehearsal evidence is recorded separately from release evidence", () => {
  assert.match(releasePlan, /LOCAL-RELEASE-REHEARSAL-001/u);
  assert.match(releasePlan, /mock\/local rehearsal evidence/u);
  assert.match(releasePlan, /不能解除 `REAL-RELEASE-ENV-READY`/u);
  assert.match(verifyMatrix, /本地 release rehearsal/u);
  assert.match(verifyMatrix, /mock\/local rehearsal/u);
  assert.match(verifyMatrix, /不是 RELEASE-001 PASS 证据/u);
});
