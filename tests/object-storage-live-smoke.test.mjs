import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

function runSmoke(overrides = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith("EXPORT_PLATFORM_OBJECT_STORAGE") &&
        key !== "EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET"
    )
  );

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/object-storage-live-smoke.mjs"],
      {
        cwd: new URL("../", import.meta.url),
        env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("object storage live smoke blocks when endpoint or bucket is missing", async () => {
  const result = await runSmoke();

  assert.equal(result.code, 1);
  assert.match(result.stderr, /BLOCKED - 需要人工介入: RELEASE-001 requires an object storage endpoint and bucket/);
});

test("object storage live smoke blocks local endpoints unless explicitly allowed by the docker mock gate", async () => {
  const result = await runSmoke({
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "http://127.0.0.1:65534",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-test",
    EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES: "true",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "test-only-secret"
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /Local endpoints are allowed only when EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=true/);
});

test("object storage live smoke requires an explicit write guard before touching a non-placeholder endpoint", async () => {
  const result = await runSmoke({
    EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT: "https://object-storage.internal",
    EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET: "export-platform-test",
    EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET: "test-only-secret"
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /set EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true/);
});
