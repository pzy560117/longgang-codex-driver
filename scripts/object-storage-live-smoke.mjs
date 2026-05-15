import { randomUUID } from "node:crypto";
import { createObjectStorageFromEnv } from "../src/file-service/index.ts";

const endpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
const bucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
const allowSmokeWrites = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES;
const allowLocalSmoke = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE;
const smokePrefix = (process.env.EXPORT_PLATFORM_OBJECT_STORAGE_SMOKE_PREFIX ?? "release-smoke")
  .replace(/^\/+|\/+$/g, "");

if (!endpoint || !bucket || (allowLocalSmoke !== "true" && isPlaceholderEndpoint(endpoint))) {
  console.error(
    "BLOCKED - 需要人工介入: RELEASE-001 requires an object storage endpoint and bucket. Local endpoints are allowed only when EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_LOCAL_SMOKE=true is set by the docker/mock release gate."
  );
  process.exit(1);
}

if (allowSmokeWrites !== "true") {
  console.error(
    "BLOCKED - 需要人工介入: set EXPORT_PLATFORM_OBJECT_STORAGE_ALLOW_SMOKE_WRITES=true to permit release smoke writes to the configured live object storage bucket."
  );
  process.exit(1);
}

const storage = createObjectStorageFromEnv();
const runId = randomUUID();
const tempStorageKey = `${smokePrefix}/${runId}/tmp.txt`;
const publishedStorageKey = `${smokePrefix}/${runId}/published.txt`;
const body = Buffer.from(`release-object-storage-smoke:${runId}`);
const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

try {
  await storage.putObject({
    storageKey: tempStorageKey,
    body,
    contentType: "text/plain"
  });

  const stored = await storage.readObject(tempStorageKey);
  if (!stored.equals(body)) {
    throw new Error("object storage read body does not match written body");
  }

  await storage.publishObject({
    tempStorageKey,
    publishedStorageKey
  });

  const published = await storage.readObject(publishedStorageKey);
  if (!published.equals(body)) {
    throw new Error("object storage published body does not match written body");
  }

  const downloadUrl = await storage.createDownloadUrl(publishedStorageKey, expiresAt);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`object storage download URL returned ${response.status}`);
  }

  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(body)) {
    throw new Error("object storage download body does not match published body");
  }

  console.log("Live object storage smoke passed.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAILED: live object storage smoke failed: ${message}`);
  process.exit(1);
}

function isPlaceholderEndpoint(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return true;
  }

  const host = url.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".example.test") ||
    host.endsWith(".example.invalid") ||
    host.endsWith(".invalid")
  );
}
