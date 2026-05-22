import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("integration stack completes export task end-to-end", async () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/integration-smoke.mjs"],
    {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
      env: process.env
    }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /integration smoke passed/u);
});

test("integration stack rejects unsigned requests", async () => {
  const response = await fetch("http://127.0.0.1:43000/api/export/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      taskCode: "purchase-order-export",
      subsystemCode: "purchase",
      fileFormat: "XLSX",
      queryParams: {}
    })
  });

  assert.equal(response.status, 401);
});
