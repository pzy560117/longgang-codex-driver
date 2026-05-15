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
  assert.match(mockFirstPlan, /local\/dev evidence/);
  assert.match(mockFirstPlan, /不得作为 `RELEASE-001` PASS 证据/);
  assert.match(verifyMatrix, /mock-first 说明见 `docs\/testing\/mock-first-release-plan\.md`，但它不是 release gate/);
});

test("mock-first plan maps every FR to local/dev evidence without upgrading release status", () => {
  for (let index = 1; index <= 14; index += 1) {
    const requirementId = `FR-${String(index).padStart(3, "0")}`;
    const rowPattern = new RegExp(
      `\\| ${requirementId} \\|[^\\n]*local/dev evidence[^\\n]*\\|[^\\n]*失败态[^\\n]*\\|[^\\n]*(?:不是|不得替代) release evidence`,
      "u"
    );
    assert.match(mockFirstPlan, rowPattern, `${requirementId} must stay local/dev only`);
  }

  assert.match(
    verifyMatrix,
    /mock-first local\/dev evidence 映射[\s\S]*FR-001 - FR-014[\s\S]*不是 RELEASE-001 PASS 证据/u
  );
});
