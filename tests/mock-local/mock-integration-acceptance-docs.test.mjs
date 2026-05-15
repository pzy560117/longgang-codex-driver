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
  assert.match(acceptanceDoc, /不得替代真实 MySQL、live object storage、API、DB、worker、query、file 或 sample 集成证据/u);

  assert.match(releasePlan, /MOCK-INTEGRATION-001 本地验收结果/u);
  assert.match(releasePlan, /accepted \/ local-dev-only/u);
  assert.match(releasePlan, /`RELEASE-001` 仍保持 BLOCKED/u);
  assert.match(releasePlan, /`REAL-RELEASE-ENV-READY` 仍是外部哨兵依赖/u);

  assert.match(verifyMatrix, /本地集成验收归档 \| FR-001 - FR-014 \| accepted \/ local-dev-only/u);
  assert.match(verifyMatrix, /`MOCK-INTEGRATION-001` 已执行/u);
});

test("release task remains blocked behind the real environment sentinel", () => {
  const releaseTask = taskJson.tasks.find((task) => task.id === "RELEASE-001");
  assert.ok(releaseTask, "RELEASE-001 must exist");
  assert.equal(releaseTask.passes, false);
  assert.ok(releaseTask.dependencies.includes("REAL-RELEASE-ENV-READY"));
  assert.match(
    releaseTask.external_dependency_notes.join("\n"),
    /真实 MySQL EXPORT_PLATFORM_TEST_DATABASE_URL/u
  );
  assert.match(
    releaseTask.external_dependency_notes.join("\n"),
    /live object storage/u
  );
});
