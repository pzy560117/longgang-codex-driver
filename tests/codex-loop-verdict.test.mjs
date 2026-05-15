import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const codexLoop = readFileSync(new URL("../codex-loop.ps1", import.meta.url), "utf8");

test("review verdict parser accepts markdown Verdict heading followed by PASS or FAIL", () => {
  assert.match(codexLoop, /#\{1,6\}/u);
  assert.match(codexLoop, /Verdict\[\\t \]\*\(\?:\\r\?\\n/u);
  assert.match(codexLoop, /\(PASS\|FAIL\)\\b/u);
});
