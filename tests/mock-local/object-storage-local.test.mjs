import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createObjectStorageFromEnv } from "../../src/file-service/index.ts";

test("local/dev object storage smoke exercises env-backed adapter without live OSS evidence", async (t) => {
  const objectStorageServer = await createLocalObjectStorageServer(t);

  await withObjectStorageEnv(objectStorageServer, async () => {
    const storage = createObjectStorageFromEnv();
    const body = Buffer.from("mock-first local object storage evidence");
    const tempStorageKey = "local-dev/tmp/purchase-orders.xlsx";
    const publishedStorageKey = "local-dev/published/purchase-orders.xlsx";

    await storage.putObject({
      storageKey: tempStorageKey,
      body,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    assert.deepEqual(await storage.readObject(tempStorageKey), body);

    await storage.publishObject({ tempStorageKey, publishedStorageKey });
    assert.deepEqual(await storage.readObject(publishedStorageKey), body);

    const downloadUrl = await storage.createDownloadUrl(
      publishedStorageKey,
      new Date("2026-05-15T00:00:00.000Z")
    );
    const downloadResponse = await fetch(downloadUrl);

    assert.equal(downloadResponse.status, 200);
    assert.deepEqual(Buffer.from(await downloadResponse.arrayBuffer()), body);
    assert.equal(objectStorageServer.requests.length, 5);
    assert.deepEqual(
      objectStorageServer.requests.map((request) => `${request.method} ${request.storageKey}`),
      [
        `PUT ${tempStorageKey}`,
        `GET ${tempStorageKey}`,
        `PUT ${publishedStorageKey}`,
        `GET ${publishedStorageKey}`,
        `GET ${publishedStorageKey}`
      ]
    );
    assert.equal(
      objectStorageServer.requests[2].copySource,
      `${objectStorageServer.bucket}/${tempStorageKey}`
    );
  });
});

test("local/dev object storage smoke keeps live object storage preflight blocked without env", () => {
  const originalEndpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  const originalBucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;

  delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;

  try {
    assert.throws(
      () => createObjectStorageFromEnv(),
      /BLOCKED - 需要人工介入: object storage/
    );
  } finally {
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT", originalEndpoint);
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET", originalBucket);
  }
});

async function createLocalObjectStorageServer(t, options = {}) {
  const bucket = options.bucket ?? "export-platform-local-dev";
  const objects = new Map();
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const requestBucket = pathSegments.shift();
    const storageKey = decodeStorageKey(pathSegments);

    if (requestBucket !== bucket || !storageKey) {
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    const copySource = request.headers["x-export-copy-source"];
    requests.push({
      method: request.method ?? "GET",
      storageKey,
      copySource: typeof copySource === "string" ? copySource : null
    });

    if (request.method === "PUT") {
      if (typeof copySource === "string") {
        const [sourceBucket, ...sourceKeySegments] = copySource.split("/");
        const sourceStorageKey = sourceKeySegments.join("/");
        if (sourceBucket !== bucket || !objects.has(sourceStorageKey)) {
          response.statusCode = 404;
          response.end("missing source object");
          return;
        }
        objects.set(storageKey, Buffer.from(objects.get(sourceStorageKey)));
        response.statusCode = 201;
        response.end("copied");
        return;
      }

      objects.set(storageKey, await readRequestBody(request));
      response.statusCode = 201;
      response.end("stored");
      return;
    }

    if (request.method === "GET") {
      const body = objects.get(storageKey);
      if (!body) {
        response.statusCode = 404;
        response.end("missing object");
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", "application/octet-stream");
      response.end(body);
      return;
    }

    response.statusCode = 405;
    response.end("method not allowed");
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  );

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve local object storage server address");
  }

  return {
    bucket,
    endpoint: `http://127.0.0.1:${address.port}`,
    objects,
    requests
  };
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function decodeStorageKey(segments) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

async function withObjectStorageEnv(config, callback) {
  const originalEndpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  const originalBucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
  const originalSigningSecret = process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET;

  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = config.endpoint;
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = config.bucket;
  process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET =
    "mock-local-download-signing-secret";

  try {
    return await callback();
  } finally {
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT", originalEndpoint);
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET", originalBucket);
    restoreEnv("EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET", originalSigningSecret);
  }
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
