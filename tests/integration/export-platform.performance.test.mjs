import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("integration performance script completes and returns result rows", async () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/integration-performance.mjs"],
    {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        EXPORT_PLATFORM_PERF_ROW_COUNTS: "1000"
      }
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const payload = JSON.parse(result.stdout);
  assert.equal(Array.isArray(payload.results), true);
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].rowCount, 1000);
  assert.ok(payload.results[0].durationMs > 0);
});
