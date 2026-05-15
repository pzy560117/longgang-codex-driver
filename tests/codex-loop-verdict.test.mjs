import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const codexLoop = readFileSync(new URL("../codex-loop.ps1", import.meta.url), "utf8");

function parseReviewVerdict(output) {
  const regexLiteral = codexLoop.match(/\[regex\]::Matches\(\$Output, '([^']+)'/u);
  assert.ok(regexLiteral, "Get-ReviewVerdict regex literal must be present");
  const pattern = regexLiteral[1].replace(/^\(\?im\)/u, "");
  const matches = [...output.matchAll(new RegExp(pattern, "gim"))];

  if (matches.length === 0) {
    return "UNKNOWN";
  }

  const lastMatch = matches[matches.length - 1];
  return lastMatch.find((group) => group === "PASS" || group === "FAIL") ?? "UNKNOWN";
}

test("review verdict parser accepts markdown Verdict heading followed by PASS or FAIL", () => {
  assert.match(codexLoop, /#\{1,6\}/u);
  assert.match(codexLoop, /Verdict\[\\t \]\*\(\?:\\r\?\\n/u);
  assert.match(codexLoop, /\(PASS\|FAIL\)\\b/u);
  assert.equal(parseReviewVerdict("## Verdict\nPASS"), "PASS");
});

test("review verdict parser ignores ordinary PASS or FAIL bullets after explicit verdict", () => {
  assert.doesNotMatch(codexLoop, /\|\^\[\\t \]\*\[-\*\]\[\\t \]\*\(PASS\|FAIL\)\\b/u);
  assert.equal(
    parseReviewVerdict("Verdict: FAIL\n\nFindings:\n- PASS should only be accepted in the final verdict."),
    "FAIL"
  );
  assert.equal(
    parseReviewVerdict("Verdict: PASS\n\nNotes:\n- FAIL is mentioned as a historical example."),
    "PASS"
  );
});

test("review verdict parser returns UNKNOWN without an explicit verdict label or heading", () => {
  assert.equal(parseReviewVerdict("Findings:\n- PASS appears in a normal bullet only."), "UNKNOWN");
});

test("driver reruns commit ownership gate after runtime files are written and before git add", () => {
  const traceIndex = codexLoop.indexOf("$traceFile = Save-Trace");
  const finalOwnershipIndex = codexLoop.indexOf("$finalOwnershipResult = Test-CommitPathOwnership");
  const gitAddIndex = codexLoop.indexOf(
    "$gitAddResult = Invoke-NativeCommandQuiet -Script { & git -C $ProjectRoot add --all }"
  );

  assert.ok(traceIndex > 0, "trace write must exist");
  assert.ok(finalOwnershipIndex > traceIndex, "final ownership gate must run after trace write");
  assert.ok(gitAddIndex > finalOwnershipIndex, "git add must run after final ownership gate");
  assert.match(codexLoop, /final_commit_path_ownership/u);
});
