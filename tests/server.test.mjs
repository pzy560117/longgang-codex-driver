import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadConfig } from "../src/config/env.ts";
import { startServer } from "../src/server.ts";
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const verifyMatrix = readFileSync(
  new URL("../docs/testing/verify-matrix.md", import.meta.url),
  "utf8"
);

async function waitForHealth(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw lastError ?? new Error("health endpoint did not become ready");
}

test("脚手架声明的服务入口脚本存在", () => {
  const scripts = packageJson.scripts ?? {};

  assert.equal(scripts.start, "tsx src/server.ts");
  assert.equal(scripts["worker:scheduler"], "tsx src/workers/scheduler-worker.ts");
  assert.equal(scripts["job:cleanup"], "tsx src/jobs/cleanup-job.ts");
});

test("npm test 仅覆盖当前脚手架可验证的测试文件", () => {
  assert.equal(
    packageJson.scripts?.test,
    "node --import tsx --test tests/*.test.mjs tests/contract/*.test.mjs"
  );
  assert.match(
    packageJson.scripts?.test ?? "",
    /^node --import tsx --test tests\/\*\.test\.mjs tests\/contract\/\*\.test\.mjs$/
  );
});

test("验证矩阵明确包含当前脚手架验证命令", () => {
  assert.match(verifyMatrix, /npm run arch:check/);
  assert.match(verifyMatrix, /npm test/);
  assert.match(verifyMatrix, /git diff --check/);
});

test("HTTP 服务可独立启动并暴露 health", async (t) => {
  const port = 40251;
  const server = await startServer({
    ...loadConfig(),
    port,
    host: "127.0.0.1"
  });

  t.after(async () => {
    await server.close();
  });

  const health = await waitForHealth(port);

  assert.equal(health.status, "ok");
  assert.equal(health.service, "export-platform");
  assert.equal(health.deliveryShape, "independent_microservice");
  assert.equal(health.entries.http, true);
  assert.equal(health.entries.worker, true);
  assert.equal(health.entries.cleanupJob, true);
});

test("公开脚手架 API 返回受控 501 响应", async (t) => {
  const port = 40252;
  const server = await startServer({
    ...loadConfig(),
    port,
    host: "127.0.0.1"
  });

  t.after(async () => {
    await server.close();
  });

  const taskResponse = await fetch(`http://127.0.0.1:${port}/api/export/tasks`, {
    method: "POST"
  });
  const taskBody = await taskResponse.json();

  assert.equal(taskResponse.status, 501);
  assert.equal(taskBody.code, "INTERNAL_ERROR");
  assert.equal(taskBody.data.operationId, "createExportTask");

  const registryResponse = await fetch(`http://127.0.0.1:${port}/api/export/registries`, {
    method: "POST"
  });
  const registryBody = await registryResponse.json();

  assert.equal(registryResponse.status, 501);
  assert.equal(registryBody.code, "INTERNAL_ERROR");
  assert.equal(registryBody.data.operationId, "createExportRegistry");
});
