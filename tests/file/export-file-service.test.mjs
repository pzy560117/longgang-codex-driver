import assert from "node:assert/strict";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";
import {
  createExportFileService,
  createObjectStorageFromEnv
} from "../../src/file-service/index.ts";
import { createCleanupJob } from "../../src/cleanup-job/index.ts";
import { createSchedulerWorker } from "../../src/scheduler/worker.ts";
import {
  inspectXlsxBuffer,
  inspectZipOfXlsxBuffer
} from "./xlsx-zip-helpers.mjs";

const downloadSigningSecret = `test-only-${randomUUID()}`;

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/file requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

test("file tests require an explicit test database URL", () => {
  const originalTestDatabaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
  const originalDatabaseUrl = process.env.EXPORT_PLATFORM_DATABASE_URL;

  delete process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
  process.env.EXPORT_PLATFORM_DATABASE_URL =
    "mysql://root:password@127.0.0.1:3306/production_like_database";

  try {
    assert.throws(
      () => getTestDatabaseUrl(),
      /EXPORT_PLATFORM_TEST_DATABASE_URL/
    );
  } finally {
    if (originalTestDatabaseUrl === undefined) {
      delete process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
    } else {
      process.env.EXPORT_PLATFORM_TEST_DATABASE_URL = originalTestDatabaseUrl;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env.EXPORT_PLATFORM_DATABASE_URL;
    } else {
      process.env.EXPORT_PLATFORM_DATABASE_URL = originalDatabaseUrl;
    }
  }
});

test("production object storage config is required outside injected test adapters", () => {
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
    if (originalEndpoint === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = originalEndpoint;
    }

    if (originalBucket === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = originalBucket;
    }
  }
});

async function createTestDatabase(t) {
  const pool = mysql.createPool(getTestDatabaseUrl());
  const db = new Kysely({
    dialect: new MysqlDialect({ pool })
  });

  t.after(async () => {
    await db.destroy();
  });

  await runMigrations(db);
  await db.deleteFrom("export_task_events").execute();
  await db.deleteFrom("export_task_checkpoints").execute();
  await db.deleteFrom("export_task_files").execute();
  await db.deleteFrom("export_task_leases").execute();
  await db.deleteFrom("export_audit_logs").execute();
  await db.deleteFrom("export_task_idempotency").execute();
  await db.deleteFrom("export_tasks").execute();
  await db.deleteFrom("export_registry_versions").execute();
  await db.deleteFrom("export_registries").execute();

  return db;
}

async function seedRegistryAndTask(db, overrides = {}) {
  const now = await getDatabaseTime(db);
  const runId = overrides.runId ?? `${Date.now()}-${process.pid}-${Math.random()}`;
  const taskCode = `purchase-order-export-${runId}`;
  const subsystemCode = `purchase-${runId}`;

  await createExportRegistryRepository(db).upsertRegistry({
    taskCode,
    subsystemCode,
    displayName: "Purchase Order Export",
    enabled: true,
    concurrencyLimit: 1,
    fileRetentionDays: overrides.fileRetentionDays ?? 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: overrides.singleFileMaxRows ?? 2,
    exportMaxRows: 100000,
    datasourceCode: "purchase-ro",
    supportedFormats: JSON.stringify(["XLSX", "ZIP"]),
    parameterSchema: JSON.stringify({ type: "object" }),
    queryTemplate: JSON.stringify({ queryTemplateVersion: "v1", templateText: "SELECT 1" }),
    fieldMappings: JSON.stringify([
      { fieldCode: "orderNo", headerName: "Order No", orderNo: 1, exportable: true }
    ]),
    maskingPolicy: JSON.stringify({ rules: {} }),
    dataScopeTemplate: "tenantId = :tenantId",
    cursorField: "orderNo",
    orderBy: JSON.stringify([{ field: "orderNo", direction: "ASC" }]),
    batchSize: 500,
    configSnapshotDigest: "sha256:config-v1",
    parameterSchemaDigest: "sha256:params-v1",
    fieldMappingDigest: "sha256:fields-v1",
    maskingPolicyDigest: "sha256:mask-v1",
    now
  });

  const task = await createExportTaskRepository(db).createPendingTask({
    taskId: `exp-file-${runId}`,
    taskCode,
    subsystemCode,
    tenantId: "tenant-001",
    createdBy: "u001",
    fileFormat: overrides.fileFormat ?? "XLSX",
    clientRequestId: null,
    idempotencyScope: null,
    requestDigest: `sha256:${runId}`,
    configSnapshotDigest: "sha256:config-v1",
    requestPayload: JSON.stringify({ queryParams: {} }),
    authContextPayload: JSON.stringify({
      operatorId: "u001",
      tenantId: "tenant-001",
      roleCodes: ["EXPORT_USER"],
      orgScope: "ORG-001",
      requestId: "req-file-001"
    }),
    now
  });

  const registry = await createExportRegistryRepository(db).findRegistryByTaskCode(taskCode);
  return { registry, task };
}

async function createLocalObjectStorageServer(t, options = {}) {
  const bucket = options.bucket ?? "export-platform-test";
  const signingSecret = options.signingSecret ?? downloadSigningSecret;
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
      pathname: url.pathname,
      search: url.search,
      copySource: typeof copySource === "string" ? copySource : null,
      contentType: request.headers["content-type"] ?? null
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

      const body = await readRequestBody(request);
      objects.set(storageKey, body);
      response.statusCode = 201;
      response.end("stored");
      return;
    }

    if (request.method === "GET") {
      const internalRead = request.headers["x-export-internal-object-read"] === "true";
      if (!internalRead) {
        const signatureResult = verifyDownloadUrl({
          bucket,
          storageKey,
          expiresAt: url.searchParams.get("expiresAt"),
          signature: url.searchParams.get("signature"),
          secret: signingSecret,
          now: options.now ?? new Date()
        });
        requests[requests.length - 1].signatureResult = signatureResult;
        if (!signatureResult.valid) {
          response.statusCode = 403;
          response.end(signatureResult.reason);
          return;
        }
      }

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
    config.signingSecret ?? downloadSigningSecret;

  try {
    return await callback();
  } finally {
    if (originalEndpoint === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = originalEndpoint;
    }

    if (originalBucket === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = originalBucket;
    }

    if (originalSigningSecret === undefined) {
      delete process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET;
    } else {
      process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = originalSigningSecret;
    }
  }
}

function signDownloadUrl({ bucket, storageKey, expiresAt, secret }) {
  return createHmac("sha256", secret)
    .update(["GET", bucket, storageKey, expiresAt].join("\n"))
    .digest("hex");
}

function verifyDownloadUrl({ bucket, storageKey, expiresAt, signature, secret, now }) {
  if (!expiresAt || !signature) {
    return { valid: false, reason: "SIGNATURE_REQUIRED" };
  }
  const expiresAtTime = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtTime)) {
    return { valid: false, reason: "SIGNATURE_EXPIRES_AT_INVALID" };
  }
  if (expiresAtTime <= now.getTime()) {
    return { valid: false, reason: "SIGNATURE_EXPIRED" };
  }
  const expected = signDownloadUrl({ bucket, storageKey, expiresAt, secret });
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return { valid: false, reason: "SIGNATURE_INVALID" };
  }
  return { valid: true, reason: "OK" };
}

function createProductionEquivalentObjectStorageAdapter(options = {}) {
  const objects = new Map();
  const writes = [];
  const publishes = [];
  const deletes = [];

  return {
    objects,
    writes,
    publishes,
    deletes,
    async putObject(input) {
      writes.push(input);
      if (options.putError) {
        throw options.putError;
      }
      objects.set(input.storageKey, Buffer.from(input.body));
    },
    async readObject(storageKey) {
      if (options.readError) {
        throw options.readError;
      }
      const object = objects.get(storageKey);
      if (!object) {
        throw new Error(`missing object ${storageKey}`);
      }
      return options.corruptReads ? Buffer.from("corrupted") : Buffer.from(object);
    },
    async publishObject(input) {
      publishes.push(input);
      if (options.publishError) {
        throw options.publishError;
      }
      const object = objects.get(input.tempStorageKey);
      if (!object) {
        throw new Error(`missing temp object ${input.tempStorageKey}`);
      }
      objects.set(input.publishedStorageKey, Buffer.from(object));
    },
    async deleteObject(storageKey) {
      deletes.push(storageKey);
      if (options.deleteError) {
        throw options.deleteError;
      }
      objects.delete(storageKey);
    },
    async createDownloadUrl(storageKey) {
      return `signed://download/${storageKey}`;
    }
  };
}

test("file service writes temp object, verifies checksum, and publishes ZIP metadata through a production-equivalent storage adapter", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 2,
    fileFormat: "XLSX"
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const service = createExportFileService({ db, storage });

  const result = await service.publishRows({
    task,
    registry,
    attemptNo: 0,
    requestId: "req-file-publish",
    rows: [
      { "Order No": "PO-001" },
      { "Order No": "PO-002" },
      { "Order No": "PO-003" }
    ]
  });

  assert.equal(result.contentType, "application/zip");
  assert.equal(result.fileName.endsWith(".zip"), true);
  assert.equal(result.storageKey.includes(`${task.taskId}/0/`), true);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.publishes.length, 1);
  assert.match(storage.writes[0].storageKey, /\/tmp\//);
  assert.equal(storage.publishes[0].publishedStorageKey, result.storageKey);
  const archive = await inspectZipOfXlsxBuffer(storage.objects.get(result.storageKey), { mode: "all" });
  assert.deepEqual(archive.entryNames, ["part-0001.xlsx", "part-0002.xlsx"]);
  assert.equal(archive.parts.length, 2);
  assert.equal(archive.totalRowCount, 3);
  assert.deepEqual(archive.parts[0].workbook.header, ["Order No"]);
  assert.deepEqual(archive.parts[0].workbook.rows, [["PO-001"], ["PO-002"]]);
  assert.deepEqual(archive.parts[1].workbook.rows, [["PO-003"]]);

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata.publishedStorageKey, result.storageKey);
  assert.equal(metadata.tempStorageKey, storage.writes[0].storageKey);
  assert.equal(metadata.checksumAlgorithm, "SHA-256");
  assert.ok(metadata.checksum.startsWith("sha256:"));
  assert.ok(metadata.checksumVerifiedAt instanceof Date);
  assert.ok(metadata.deliveryReadyAt instanceof Date);

  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  assert.deepEqual(
    events.map((event) => event.eventType),
    ["DELIVERY_READY", "FILE_VERIFIED", "PACKAGE_DONE", "FILE_PART_WRITTEN", "FILE_PART_WRITTEN"]
  );
});

test("env-backed object storage adapter publishes ZIP metadata through a local HTTP endpoint and returns a downloadable URL", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 2,
    fileFormat: "XLSX"
  });
  const objectStorageServer = await createLocalObjectStorageServer(t);

  await withObjectStorageEnv(objectStorageServer, async () => {
    const service = createExportFileService({ db });
    const result = await service.publishRows({
      task,
      registry,
      attemptNo: 0,
      requestId: "req-file-env-storage",
      rows: [
        { "Order No": "PO-001" },
        { "Order No": "PO-002" },
        { "Order No": "PO-003" }
      ]
    });

    const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
    assert.ok(metadata);
    assert.equal(result.contentType, "application/zip");
    assert.equal(result.fileName.endsWith(".zip"), true);
    assert.equal(result.storageKey, metadata.publishedStorageKey);
    assert.equal(metadata.checksum, result.checksum);
    assert.equal(metadata.checksumAlgorithm, "SHA-256");
    assert.ok(metadata.checksumVerifiedAt instanceof Date);
    assert.ok(metadata.deliveryReadyAt instanceof Date);
    assert.ok(objectStorageServer.objects.has(metadata.tempStorageKey));
    assert.ok(objectStorageServer.objects.has(metadata.publishedStorageKey));

    const publishedBuffer = Buffer.from(objectStorageServer.objects.get(metadata.publishedStorageKey));
    const tempBuffer = Buffer.from(objectStorageServer.objects.get(metadata.tempStorageKey));
    assert.deepEqual(publishedBuffer, tempBuffer);

    const archive = await inspectZipOfXlsxBuffer(publishedBuffer, { mode: "all" });
    assert.deepEqual(archive.entryNames, ["part-0001.xlsx", "part-0002.xlsx"]);
    assert.equal(archive.totalRowCount, 3);
    assert.deepEqual(archive.parts[0].workbook.rows, [["PO-001"], ["PO-002"]]);
    assert.deepEqual(archive.parts[1].workbook.rows, [["PO-003"]]);

    const signedUrlIssuedAt = new Date();
    const signedDownload = await service.createDownloadUrl(metadata.publishedStorageKey, {
      now: signedUrlIssuedAt
    });
    const downloadUrl = signedDownload.downloadUrl;
    assert.equal(
      signedDownload.expiresAt.toISOString(),
      new Date(signedUrlIssuedAt.getTime() + 10 * 60 * 1000).toISOString()
    );
    assert.notEqual(signedDownload.expiresAt.toISOString(), metadata.expiresAt.toISOString());
    assert.match(
      downloadUrl,
      new RegExp(
        `^${objectStorageServer.endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${objectStorageServer.bucket}/`
      )
    );
    assert.match(downloadUrl, /[?&]expiresAt=/);
    assert.match(downloadUrl, /[?&]signature=/);
    assert.match(downloadUrl, /[?&]signatureAlgorithm=HMAC-SHA256/);

    const downloadResponse = await fetch(downloadUrl);
    assert.equal(downloadResponse.ok, true);
    const downloadedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
    assert.deepEqual(downloadedBuffer, publishedBuffer);
    const downloadedArchive = await inspectZipOfXlsxBuffer(downloadedBuffer, { mode: "all" });
    assert.equal(downloadedArchive.totalRowCount, 3);

    assert.deepEqual(
      objectStorageServer.requests.map((request) => `${request.method} ${request.storageKey}`),
      [
        `PUT ${metadata.tempStorageKey}`,
        `GET ${metadata.tempStorageKey}`,
        `PUT ${metadata.publishedStorageKey}`,
        `GET ${metadata.publishedStorageKey}`
      ]
    );
    assert.equal(objectStorageServer.requests[3].signatureResult.valid, true);
    assert.equal(
      objectStorageServer.requests[2].copySource,
      `${objectStorageServer.bucket}/${metadata.tempStorageKey}`
    );

    const tamperedUrl = new URL(downloadUrl);
    const originalSignature = tamperedUrl.searchParams.get("signature") ?? "";
    tamperedUrl.searchParams.set(
      "signature",
      `${originalSignature.startsWith("0") ? "1" : "0"}${originalSignature.slice(1)}`
    );
    const tamperedResponse = await fetch(tamperedUrl);
    assert.equal(tamperedResponse.status, 403);

    const expiredUrl = new URL(downloadUrl);
    const expiredAt = new Date(signedUrlIssuedAt.getTime() - 60_000).toISOString();
    expiredUrl.searchParams.set("expiresAt", expiredAt);
    expiredUrl.searchParams.set(
      "signature",
      signDownloadUrl({
        bucket: objectStorageServer.bucket,
        storageKey: metadata.publishedStorageKey,
        expiresAt: expiredAt,
        secret: downloadSigningSecret
      })
    );
    const expiredResponse = await fetch(expiredUrl);
    assert.equal(expiredResponse.status, 403);
  });
});

test("checksum failure prevents publish and metadata from becoming downloadable", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({ corruptReads: true });
  const service = createExportFileService({ db, storage });

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-checksum-failed",
        rows: [{ "Order No": "PO-001" }]
      }),
    /FILE_VERIFY_ERROR/
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata, undefined);
  assert.equal(storage.publishes.length, 0);
});

test("object storage put failure is mapped to FILE_VERIFY_ERROR and does not publish metadata", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    putError: new Error("object storage write unavailable")
  });
  const service = createExportFileService({ db, storage });

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-put-failed",
        rows: [{ "Order No": "PO-001" }]
      }),
    (error) => {
      assert.equal(error.name, "FILE_VERIFY_ERROR");
      assert.equal(error.message, "FILE_VERIFY_ERROR: file verification failed");
      assert.doesNotMatch(error.message, /object storage|unavailable|secret|bucket|oss/i);
      return true;
    }
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata, undefined);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.publishes.length, 0);
});

test("object storage read failure is mapped to FILE_VERIFY_ERROR and does not publish metadata", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    readError: new Error("object storage read unavailable")
  });
  const service = createExportFileService({ db, storage });

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-read-failed",
        rows: [{ "Order No": "PO-001" }]
      }),
    (error) => {
      assert.equal(error.name, "FILE_VERIFY_ERROR");
      assert.equal(error.message, "FILE_VERIFY_ERROR: file verification failed");
      assert.doesNotMatch(error.message, /object storage|unavailable|secret|bucket|oss/i);
      return true;
    }
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata, undefined);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.publishes.length, 0);
});

test("object storage publish failure is mapped to FILE_VERIFY_ERROR and keeps metadata undisclosed", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    publishError: new Error("object storage publish unavailable")
  });
  const service = createExportFileService({ db, storage });

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-publish-failed",
        rows: [{ "Order No": "PO-001" }]
      }),
    (error) => {
      assert.equal(error.name, "FILE_VERIFY_ERROR");
      assert.equal(error.message, "FILE_VERIFY_ERROR: file verification failed");
      assert.doesNotMatch(error.message, /object storage|unavailable|secret|bucket|oss/i);
      return true;
    }
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata, undefined);
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.publishes.length, 1);
  assert.match(storage.writes[0].storageKey, /\/tmp\//);
});

test("xlsx renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const service = createExportFileService({ db, storage });
  const circularValue = {};
  circularValue.self = circularValue;

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-render-failed-xlsx",
        rows: [{ "Order No": circularValue }]
      }),
    (error) => error.name === "EXPORT_RENDER_ERROR"
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  const failedEvent = events.find((event) => event.eventType === "PACKAGE_FAILED");
  const checkpoint = JSON.parse(failedEvent.batchCheckpoint);

  assert.equal(metadata, undefined);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.publishes.length, 0);
  assert.equal(checkpoint.errorCode, "EXPORT_RENDER_ERROR");
  assert.equal(checkpoint.failureReason, "export render error");
  assert.doesNotMatch(checkpoint.failureReason, /circular|secret|password|select|storage|oss/i);
  assert.deepEqual(checkpoint.renderInputSummary, {
    taskId: task.taskId,
    taskCode: task.taskCode,
    attemptNo: 0,
    fileName: `${task.taskCode}-${task.taskId}-attempt-0.xlsx`,
    format: "XLSX",
    totalRowCount: 1,
    partCount: 1,
    singleFileMaxRows: 20000
  });
});

test("zip renderer failure is mapped to EXPORT_RENDER_ERROR before object storage write", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 2,
    fileFormat: "XLSX"
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const service = createExportFileService({ db, storage });
  const circularValue = {};
  circularValue.self = circularValue;

  await assert.rejects(
    () =>
      service.publishRows({
        task,
        registry,
        attemptNo: 0,
        requestId: "req-file-render-failed-zip",
        rows: [
          { "Order No": "PO-001" },
          { "Order No": circularValue },
          { "Order No": "PO-003" }
        ]
      }),
    (error) => error.name === "EXPORT_RENDER_ERROR"
  );

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  const failedEvent = events.find((event) => event.eventType === "PACKAGE_FAILED");
  const checkpoint = JSON.parse(failedEvent.batchCheckpoint);

  assert.equal(metadata, undefined);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.publishes.length, 0);
  assert.equal(checkpoint.errorCode, "EXPORT_RENDER_ERROR");
  assert.equal(checkpoint.failureReason, "export render error");
  assert.doesNotMatch(checkpoint.failureReason, /circular|secret|password|select|storage|oss/i);
  assert.deepEqual(checkpoint.renderInputSummary, {
    taskId: task.taskId,
    taskCode: task.taskCode,
    attemptNo: 0,
    fileName: `${task.taskCode}-${task.taskId}-attempt-0.zip`,
    format: "ZIP",
    totalRowCount: 3,
    partCount: 2,
    singleFileMaxRows: 2
  });
});

test("scheduler publishes file metadata before marking a completed batch as COMPLETED", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const fileService = createExportFileService({ db, storage });
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-file",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    fileService,
    batchProcessor: async () => ({
      rows: [{ "Order No": "PO-001" }],
      checkpoint: {
        lastCursor: "PO-001",
        processedCount: 1,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 1,
        backoffMs: 0
      },
      outcome: "completed"
    })
  });

  const result = await worker.pollAndProcessOnce();
  const completed = await createExportTaskRepository(db).findTaskById(task.taskId);
  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);

  assert.equal(result.completed, 1);
  assert.equal(completed.status, "COMPLETED");
  assert.equal(metadata.publishedStorageKey.includes(task.taskId), true);
  assert.equal(storage.publishes.length, 1);
  assert.equal(registry.taskCode, task.taskCode);
  const workbook = await inspectXlsxBuffer(storage.objects.get(metadata.publishedStorageKey), {
    mode: "all"
  });
  assert.deepEqual(workbook.header, ["Order No"]);
  assert.deepEqual(workbook.rows, [["PO-001"]]);
});

test("scheduler maps object storage put failure to FAILED task with FILE_VERIFY_ERROR audit", async (t) => {
  const db = await createTestDatabase(t);
  const { task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    putError: new Error("object storage write unavailable")
  });
  const fileService = createExportFileService({ db, storage });
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-file-put-failure",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    fileService,
    batchProcessor: async () => ({
      rows: [{ "Order No": "PO-001" }],
      checkpoint: {
        lastCursor: "PO-001",
        processedCount: 1,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 1,
        backoffMs: 0
      },
      outcome: "completed"
    })
  });

  const result = await worker.pollAndProcessOnce();
  const failed = await createExportTaskRepository(db).findTaskById(task.taskId);
  const audits = await db
    .selectFrom("export_audit_logs")
    .selectAll()
    .where("task_id", "=", task.taskId)
    .execute();

  assert.equal(result.failed, 1);
  assert.equal(failed.status, "FAILED");
  assert.ok(
    audits.some(
      (audit) => audit.action === "EXECUTE_FAILED" && audit.error_code === "FILE_VERIFY_ERROR"
    )
  );
});

test("scheduler maps object storage read failure to FAILED task with FILE_VERIFY_ERROR audit", async (t) => {
  const db = await createTestDatabase(t);
  const { task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    readError: new Error("object storage read unavailable")
  });
  const fileService = createExportFileService({ db, storage });
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-file-read-failure",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    fileService,
    batchProcessor: async () => ({
      rows: [{ "Order No": "PO-001" }],
      checkpoint: {
        lastCursor: "PO-001",
        processedCount: 1,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 1,
        backoffMs: 0
      },
      outcome: "completed"
    })
  });

  const result = await worker.pollAndProcessOnce();
  const failed = await createExportTaskRepository(db).findTaskById(task.taskId);
  const audits = await db
    .selectFrom("export_audit_logs")
    .selectAll()
    .where("task_id", "=", task.taskId)
    .execute();

  assert.equal(result.failed, 1);
  assert.equal(failed.status, "FAILED");
  assert.equal(storage.writes.length, 1);
  assert.equal(storage.publishes.length, 0);
  assert.ok(
    audits.some(
      (audit) => audit.action === "EXECUTE_FAILED" && audit.error_code === "FILE_VERIFY_ERROR"
    )
  );
});

test("scheduler maps renderer failure to FAILED task with EXPORT_RENDER_ERROR audit", async (t) => {
  const db = await createTestDatabase(t);
  const { task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const fileService = createExportFileService({ db, storage });
  const circularValue = {};
  circularValue.self = circularValue;
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-file-render-failure",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    fileService,
    batchProcessor: async () => ({
      rows: [{ "Order No": circularValue }],
      checkpoint: {
        lastCursor: "PO-001",
        processedCount: 1,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 1,
        backoffMs: 0
      },
      outcome: "completed"
    })
  });

  const result = await worker.pollAndProcessOnce();
  const failed = await createExportTaskRepository(db).findTaskById(task.taskId);
  const audits = await db
    .selectFrom("export_audit_logs")
    .selectAll()
    .where("task_id", "=", task.taskId)
    .execute();
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  const failedEvent = events.find((event) => event.eventType === "PACKAGE_FAILED");
  const checkpoint = JSON.parse(failedEvent.batchCheckpoint);

  assert.equal(result.failed, 1);
  assert.equal(failed.status, "FAILED");
  assert.equal(storage.writes.length, 0);
  assert.equal(checkpoint.errorCode, "EXPORT_RENDER_ERROR");
  assert.equal(checkpoint.failureReason, "export render error");
  assert.doesNotMatch(checkpoint.failureReason, /circular|secret|password|select|storage|oss/i);
  assert.equal(checkpoint.renderInputSummary.taskId, task.taskId);
  assert.equal(checkpoint.renderInputSummary.attemptNo, 0);
  assert.equal(checkpoint.renderInputSummary.totalRowCount, 1);
  assert.equal(checkpoint.renderInputSummary.partCount, 1);
  assert.ok(
    audits.some(
      (audit) => audit.action === "EXECUTE_FAILED" && audit.error_code === "EXPORT_RENDER_ERROR"
    )
  );
});

test("cleanup job invalidates expired metadata before deleting object and download is guarded", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const fileService = createExportFileService({ db, storage });
  const published = await fileService.publishRows({
    task,
    registry,
    attemptNo: 0,
    requestId: "req-cleanup-publish",
    rows: [{ "Order No": "PO-001" }]
  });
  const now = await getDatabaseTime(db);

  await createExportTaskRepository(db).updateTaskStatus({
    taskId: task.taskId,
    status: "COMPLETED",
    now
  });
  await createExportFileRepository(db).saveFileMetadata({
    taskId: task.taskId,
    attemptNo: 0,
    fileName: published.fileName,
    contentType: published.contentType,
    fileSize: published.fileSize,
    checksum: published.checksum,
    checksumAlgorithm: published.checksumAlgorithm,
    tempStorageKey: `tmp/${task.taskId}`,
    publishedStorageKey: published.storageKey,
    expiresAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const cleanupJob = createCleanupJob({
    db,
    storage,
    workerId: "cleanup-test"
  });

  await cleanupJob.pollOnce();

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata.deliveryReadyAt, null);
  assert.equal(metadata.publishedAt, null);
  assert.equal(metadata.checksumVerifiedAt, null);
  assert.equal(metadata.publishedStorageKey, null);
  assert.equal(metadata.tempStorageKey, null);
  assert.deepEqual(storage.deletes, [published.storageKey, `tmp/${task.taskId}`]);
});

test("cleanup job deletes only published object when temp storage key is null", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const fileService = createExportFileService({ db, storage });
  const published = await fileService.publishRows({
    task,
    registry,
    attemptNo: 0,
    requestId: "req-cleanup-publish-no-temp",
    rows: [{ "Order No": "PO-001" }]
  });
  const now = await getDatabaseTime(db);

  await createExportTaskRepository(db).updateTaskStatus({
    taskId: task.taskId,
    status: "COMPLETED",
    now
  });
  await createExportFileRepository(db).saveFileMetadata({
    taskId: task.taskId,
    attemptNo: 0,
    fileName: published.fileName,
    contentType: published.contentType,
    fileSize: published.fileSize,
    checksum: published.checksum,
    checksumAlgorithm: published.checksumAlgorithm,
    tempStorageKey: null,
    publishedStorageKey: published.storageKey,
    expiresAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const cleanupJob = createCleanupJob({
    db,
    storage,
    workerId: "cleanup-test"
  });

  await cleanupJob.pollOnce();

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata.publishedStorageKey, null);
  assert.equal(metadata.tempStorageKey, null);
  assert.deepEqual(storage.deletes, [published.storageKey]);
});

test("cleanup job keeps retry evidence when object delete fails and leaves download invalidated", async (t) => {
  const db = await createTestDatabase(t);
  const { registry, task } = await seedRegistryAndTask(db, {
    singleFileMaxRows: 20000
  });
  const storage = createProductionEquivalentObjectStorageAdapter({
    deleteError: new Error("object storage delete failed")
  });
  const fileService = createExportFileService({ db, storage });
  const published = await fileService.publishRows({
    task,
    registry,
    attemptNo: 0,
    requestId: "req-cleanup-retry-publish",
    rows: [{ "Order No": "PO-001" }]
  });
  const now = await getDatabaseTime(db);

  await createExportTaskRepository(db).updateTaskStatus({
    taskId: task.taskId,
    status: "COMPLETED",
    now
  });
  await createExportFileRepository(db).saveFileMetadata({
    taskId: task.taskId,
    attemptNo: 0,
    fileName: published.fileName,
    contentType: published.contentType,
    fileSize: published.fileSize,
    checksum: published.checksum,
    checksumAlgorithm: published.checksumAlgorithm,
    tempStorageKey: `tmp/${task.taskId}`,
    publishedStorageKey: published.storageKey,
    expiresAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const cleanupJob = createCleanupJob({
    db,
    storage,
    workerId: "cleanup-test"
  });

  await cleanupJob.pollOnce();

  const metadata = await createExportFileRepository(db).findFileMetadata(task.taskId, 0);
  assert.equal(metadata.deliveryReadyAt, null);
  assert.equal(metadata.publishedAt, null);
  assert.equal(metadata.checksumVerifiedAt, null);
  assert.equal(metadata.publishedStorageKey, published.storageKey);
  assert.equal(metadata.tempStorageKey, `tmp/${task.taskId}`);
  assert.deepEqual(storage.deletes, [published.storageKey]);

  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  assert.ok(events.some((event) => event.eventType === "FILE_CLEANUP_RETRY"));
  assert.ok(!events.some((event) => event.eventType === "FILE_CLEANUP_DONE"));
});
