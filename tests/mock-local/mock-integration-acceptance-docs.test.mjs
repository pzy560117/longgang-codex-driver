import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const acceptanceDoc = readFileSync(
  new URL("../../docs/testing/mock-first-acceptance.md", import.meta.url),
  "utf8"
);
const releasePlan = readFileSync(
  new URL("../../docs/testing/mock-first-release-plan.md", import.meta.url),
  "utf8"
);
const verifyMatrix = readFileSync(
  new URL("../../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);
const taskJson = JSON.parse(
  readFileSync(new URL("../../task.json", import.meta.url), "utf8").replace(/^\uFEFF/u, "")
);

test("mock integration acceptance archives executed local/dev evidence without release promotion", () => {
  assert.match(acceptanceDoc, /## MOCK-INTEGRATION-001 执行证据/u);
  assert.match(acceptanceDoc, /本轮结论: accepted \/ local-dev-only/u);
  assert.match(acceptanceDoc, /\| `npm run arch:check` \| PASS \|/u);
  assert.match(acceptanceDoc, /\| `npm run test:mock-local` \| PASS \|/u);
  assert.match(acceptanceDoc, /\| `npm test` \| PASS \|/u);
  assert.match(acceptanceDoc, /\| scoped `git diff --check` \| PASS \|/u);
  assert.match(acceptanceDoc, /不是 release evidence/u);
  assert.match(acceptanceDoc, /不得替代 docker\/mock release gate/u);

  assert.match(releasePlan, /MOCK-INTEGRATION-001 本地验收结果/u);
  assert.match(releasePlan, /accepted \/ local-dev-only/u);
  assert.match(releasePlan, /`RELEASE-001` 已通过 docker\/mock release gate/u);
  assert.match(releasePlan, /本机 Docker MySQL 与本地 object storage mock/u);

  assert.match(verifyMatrix, /本地集成验收归档 \| FR-001 - FR-014 \| accepted \/ local-dev-only/u);
  assert.match(verifyMatrix, /`MOCK-INTEGRATION-001` 已执行/u);
});

test("release task uses the local docker mock release gate", () => {
  const releaseTask = taskJson.tasks.find((task) => task.id === "RELEASE-001");
  assert.ok(releaseTask, "RELEASE-001 must exist");
  assert.equal(releaseTask.passes, true);
  assert.ok(!releaseTask.dependencies.includes("REAL-RELEASE-ENV-READY"));
  assert.match(
    releaseTask.local_release_environment_notes.join("\n"),
    /本机 Docker MySQL/u
  );
  assert.match(
    releaseTask.local_release_environment_notes.join("\n"),
    /本地 object storage mock/u
  );
});
