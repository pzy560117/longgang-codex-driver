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
