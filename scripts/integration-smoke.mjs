import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const baseUrl = process.env.EXPORT_PLATFORM_INTEGRATION_BASE_URL ?? "http://127.0.0.1:43000";
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(projectRoot, "tests", "integration", "artifacts");

const headers = JSON.parse(
  execFileSync(process.execPath, ["--import", "tsx", "scripts/integration-auth-client.mjs"], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
    env: process.env
  })
);

const health = await fetch(`${baseUrl}/health`);
if (!health.ok) {
  throw new Error(`health check failed with ${health.status}`);
}

const createResp = await fetch(`${baseUrl}/api/export/tasks`, {
  method: "POST",
  headers: {
    ...headers,
    "content-type": "application/json"
  },
  body: JSON.stringify({
    taskCode: "purchase-order-export",
    subsystemCode: "purchase",
    fileFormat: "XLSX",
    clientRequestId: `integration-${Date.now()}`,
    queryParams: {
      createdAtFrom: "2026-05-01T00:00:00.000Z",
      createdAtTo: "2026-05-31T23:59:59.000Z"
    }
  })
});

if (!createResp.ok) {
  throw new Error(`create task failed with ${createResp.status}`);
}

const createPayload = await createResp.json();
const taskId = createPayload?.data?.taskId;
if (!taskId) {
  throw new Error("missing taskId");
}

let terminalPayload = null;
for (let index = 0; index < 90; index += 1) {
  const detail = await fetch(`${baseUrl}/api/export/tasks/${taskId}`, {
    headers
  });
  if (!detail.ok) {
    throw new Error(`detail request failed with ${detail.status}`);
  }
  const payload = await detail.json();
  terminalPayload = payload;
  const status = payload?.data?.status;
  if (status === "COMPLETED") {
    break;
  }
  if (status === "FAILED" || status === "CANCELED") {
    throw new Error(`task ended unexpectedly with status ${status}`);
  }
  await wait(2000);
}

if (terminalPayload?.data?.status !== "COMPLETED") {
  throw new Error("task did not complete within timeout");
}

const downloadResp = await fetch(`${baseUrl}/api/export/tasks/${taskId}/download`, {
  headers
});
if (!downloadResp.ok) {
  throw new Error(`download metadata failed with ${downloadResp.status}`);
}
const downloadPayload = await downloadResp.json();
const downloadUrl = downloadPayload?.data?.downloadUrl;
if (!downloadUrl) {
  throw new Error("missing download url");
}

const fileResp = await fetch(downloadUrl);
if (!fileResp.ok) {
  throw new Error(`download url failed with ${fileResp.status}`);
}
const fileBuffer = Buffer.from(await fileResp.arrayBuffer());
if (fileBuffer.byteLength === 0) {
  throw new Error("downloaded file is empty");
}
await mkdir(artifactDir, { recursive: true });
await writeFile(resolve(artifactDir, downloadPayload.data.fileName), fileBuffer);

const unauthResp = await fetch(`${baseUrl}/api/export/tasks`, {
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

if (unauthResp.status !== 401) {
  throw new Error(`expected 401 for missing signature, received ${unauthResp.status}`);
}

console.log(`integration smoke passed: ${downloadPayload.data.fileName}`);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
