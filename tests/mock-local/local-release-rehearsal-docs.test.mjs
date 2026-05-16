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
const releaseVerify = readFileSync(
  new URL("../../scripts/release-verify.ps1", import.meta.url),
  "utf8"
);
const objectStorageLiveSmoke = readFileSync(
  new URL("../../scripts/object-storage-live-smoke.mjs", import.meta.url),
  "utf8"
);

test("local release rehearsal is declared as mock/local evidence without releasing RELEASE-001", () => {
  const rehearsalTask = taskJson.tasks.find((task) => task.id === "LOCAL-RELEASE-REHEARSAL-001");
  assert.ok(rehearsalTask, "LOCAL-RELEASE-REHEARSAL-001 must exist");
  assert.equal(rehearsalTask.passes, true);
  assert.deepEqual(rehearsalTask.dependencies, ["MOCK-INTEGRATION-001"]);
  assert.match(rehearsalTask.description, /本地 release rehearsal/u);
  assert.match(rehearsalTask.test_command, /npm run release:local-rehearsal/u);
  assert.match(rehearsalTask.acceptance.join("\n"), /不是 RELEASE-001 PASS 证据/u);

  const releaseTask = taskJson.tasks.find((task) => task.id === "RELEASE-001");
  assert.ok(releaseTask, "RELEASE-001 must exist");
  assert.equal(releaseTask.passes, true);
  assert.ok(!releaseTask.dependencies.includes("REAL-RELEASE-ENV-READY"));
  assert.match(releaseTask.local_release_environment_notes.join("\n"), /Docker MySQL/u);
  assert.match(releaseTask.local_release_environment_notes.join("\n"), /object storage mock/u);
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
  assert.match(objectStorageLiveSmoke, /EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES/u);
  assert.match(script, /npm run test:api/u);
  assert.match(script, /npm run test:db/u);
  assert.match(script, /npm run test:worker/u);
  assert.match(script, /npm run test:query/u);
  assert.match(script, /npm run test:file/u);
  assert.match(script, /npm run test:sample/u);
  assert.match(script, /git diff --check -- task\.json package\.json scripts tests\/mock-local docs\/testing progress\.txt/u);
  assert.match(script, /npm run test:object-storage-live/u);
  assert.match(script, /mock\/local rehearsal/u);
});

test("local release rehearsal does not auto-enable live object storage smoke writes", () => {
  const script = readFileSync(scriptUrl, "utf8");
  assert.doesNotMatch(
    script,
    /\$env:EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES\s*=\s*"true"/u
  );
  assert.match(script, /Test-LocalEndpoint -Endpoint \$ObjectStorageEndpoint/u);
  assert.match(script, /Invoke-RehearsalCommand -Command \$LiveObjectStorageCommand/u);
  assert.match(objectStorageLiveSmoke, /allowSmokeWrites !== "true"/u);
});

test("release verify self-provisions docker MySQL and local object storage smoke", () => {
  assert.match(releaseVerify, /Ensure-DockerMysql/u);
  assert.match(releaseVerify, /Ensure-DockerDaemon/u);
  assert.match(releaseVerify, /docker info/u);
  assert.match(releaseVerify, /Docker daemon is not reachable/u);
  assert.match(releaseVerify, /docker inspect \$ContainerName/u);
  assert.match(releaseVerify, /mysql:8\.4/u);
  assert.match(releaseVerify, /Start-LocalObjectStorage/u);
  assert.match(releaseVerify, /EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES", "true"/u);
  assert.match(releaseVerify, /EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE", "true"/u);
  assert.match(releaseVerify, /npm run test:object-storage-live/u);
  assert.match(objectStorageLiveSmoke, /allowLocalSmoke !== "true" && isPlaceholderEndpoint/u);
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
  assert.match(releasePlan, /RELEASE-001` 的 docker\/mock release gate/u);
  assert.match(verifyMatrix, /本地 release rehearsal/u);
  assert.match(verifyMatrix, /mock\/local rehearsal/u);
  assert.match(verifyMatrix, /不是 RELEASE-001 PASS 证据/u);
});

test("local release rehearsal result records API DB worker query file and sample coverage without promoting release", () => {
  assert.match(releasePlan, /本轮状态: passed \/ mock\/local rehearsal evidence/u);
  assert.match(releasePlan, /`npm run release:local-rehearsal` \| PASS/u);
  assert.match(releasePlan, /API \/ DB \/ worker \/ query \/ file \/ sample \| PASS/u);
  assert.match(releasePlan, /live object storage smoke \| SKIPPED \/ local rehearsal only/u);
  assert.match(releasePlan, /不替代 `RELEASE-001` 的 docker\/mock release gate/u);

  assert.match(verifyMatrix, /LOCAL-RELEASE-REHEARSAL-001 mock\/local rehearsal result（2026-05-15）/u);
  assert.match(verifyMatrix, /API \/ DB \/ worker \/ query \/ file \/ sample 集成命令 \| FR-001 - FR-014 \| PASS \/ mock-local-only/u);
  assert.match(verifyMatrix, /Docker\/mock object storage smoke \| FR-003 \/ FR-006 \/ FR-011 \/ FR-014 \| PASS \/ docker-mock-release/u);
  assert.match(verifyMatrix, /`RELEASE-001` 已通过 docker\/mock release gate/u);
});
