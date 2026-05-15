import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
);
const mockFirstPlan = readFileSync(
  new URL("../../docs/testing/mock-first-release-plan.md", import.meta.url),
  "utf8"
);
const verifyMatrix = readFileSync(
  new URL("../../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);

test("mock-first has a dedicated local/dev test command that cannot be used as release evidence", () => {
  assert.equal(
    packageJson.scripts?.["test:mock-local"],
    "node --import tsx --test --test-concurrency=1 tests/mock-local/*.test.mjs"
  );
  assert.match(mockFirstPlan, /^# MOCK-FIRST RELEASE 计划/m);
  assert.match(mockFirstPlan, /## mock-first 的边界/);
  assert.match(mockFirstPlan, /local\/dev evidence/);
  assert.match(mockFirstPlan, /不得作为 `RELEASE-001` PASS 证据/);
  assert.match(verifyMatrix, /mock-first 说明见 `docs\/testing\/mock-first-release-plan\.md`，但它不是 docker\/mock release gate/);
});

test("mock-first plan maps every FR to local/dev evidence without upgrading release status", () => {
  const expectedRequirements = Array.from({ length: 14 }, (_, index) => `FR-${String(index + 1).padStart(3, "0")}`);

  assert.equal(countMockFirstRows(mockFirstPlan), expectedRequirements.length);

  for (let index = 1; index <= 14; index += 1) {
    const requirementId = `FR-${String(index).padStart(3, "0")}`;
    const row = getMockFirstRow(mockFirstPlan, requirementId);
    assert.ok(row, `${requirementId} row must exist in mock-first plan`);
    assert.match(row, /local\/dev evidence/u, `${requirementId} must be local/dev evidence only`);
    assert.match(row, /失败态/u, `${requirementId} must include a failure-mode boundary`);
    assert.match(
      row,
      /(?:不是|不得替代) `?release evidence`?/iu,
      `${requirementId} must not be upgraded to release evidence`
    );
  }

  assert.match(getMockFirstRow(mockFirstPlan, "FR-003"), /本地 HTTP object storage adapter/u);
  assert.match(getMockFirstRow(mockFirstPlan, "FR-003"), /live OSS\/S3/u);
  assert.match(getMockFirstRow(mockFirstPlan, "FR-005"), /scheduler \/ worker/u);
  assert.match(getMockFirstRow(mockFirstPlan, "FR-005"), /本机 Docker MySQL/u);

  assert.match(
    verifyMatrix,
    /mock-first local\/dev evidence 映射[\s\S]*FR-001 - FR-014[\s\S]*不是 RELEASE-001 PASS 证据/u
  );
  assert.match(
    verifyMatrix,
    /不能替代 API \/ DB \/ worker \/ query \/ file \/ sample 或 docker\/mock release gate/u
  );
  assert.match(verifyMatrix, /release 结论来自 docker\/mock release gate/u);
});

function getMockFirstRow(markdown, requirementId) {
  const row = markdown
    .split(/\r?\n/u)
    .find((line) => line.startsWith(`| ${requirementId} |`));

  return row ?? "";
}

function countMockFirstRows(markdown) {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => /^\| FR-\d{3} \|/u.test(line))
    .length;
}
