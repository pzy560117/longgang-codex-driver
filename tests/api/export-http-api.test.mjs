import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { createExportPlatformServer } from "../../src/server.ts";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createCheckpointRepository,
  createExportAuditRepository,
  createExportFileRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";

const downloadSigningSecret = `test-only-${randomUUID()}`;

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/api requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

function withTestDatabaseEnv(objectStorageConfig = {}) {
  const databaseUrl = getTestDatabaseUrl();
  const previousDatabaseUrl = process.env.EXPORT_PLATFORM_DATABASE_URL;
  const previousObjectStorageEndpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  const previousObjectStorageBucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
  const previousDownloadSigningSecret = process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET;
  process.env.EXPORT_PLATFORM_DATABASE_URL = databaseUrl;
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT =
    objectStorageConfig.endpoint ?? "https://oss.example.test";
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET =
    objectStorageConfig.bucket ?? "export-platform-test";
  process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET =
    objectStorageConfig.signingSecret ?? downloadSigningSecret;

  return () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.EXPORT_PLATFORM_DATABASE_URL;
    } else {
      process.env.EXPORT_PLATFORM_DATABASE_URL = previousDatabaseUrl;
    }

    if (previousObjectStorageEndpoint === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT = previousObjectStorageEndpoint;
    }

    if (previousObjectStorageBucket === undefined) {
      delete process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
    } else {
      process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET = previousObjectStorageBucket;
    }

    if (previousDownloadSigningSecret === undefined) {
      delete process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET;
    } else {
      process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = previousDownloadSigningSecret;
    }
  };
}

async function createTestDatabase(t) {
  const pool = mysql.createPool(getTestDatabaseUrl());
  const db = new Kysely({
    dialect: new MysqlDialect({ pool })
  });

  t.after(async () => {
    await db.destroy();
  });

  await runMigrations(db);
  return db;
}

async function createServer(t, objectStorageConfig) {
  const restoreEnv = withTestDatabaseEnv(objectStorageConfig);
  const app = createExportPlatformServer();

  t.after(async () => {
    restoreEnv();
    await app.close();
  });

  return app;
}

function createHeaders(requestId, overrides = {}) {
  return {
    "content-type": "application/json",
    "x-operator-id": overrides.operatorId ?? "u001",
    "x-tenant-id": overrides.tenantId ?? "tenant-001",
    "x-role-codes": overrides.roleCodes ?? "EXPORT_ADMIN",
    "x-org-scope": "ORG-001",
    "x-request-id": requestId
  };
}

function createRegistryPayload(taskCode) {
  return {
    taskCode,
    subsystemCode: "purchase",
    displayName: "Purchase Order Export",
    enabled: true,
    concurrencyLimit: 2,
    fileRetentionDays: 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: 20000,
    exportMaxRows: 100000,
    supportedFormats: ["XLSX"],
    datasourceCode: "purchase-ro",
    parameterSchema: {
      type: "object",
      properties: {
        createdAtFrom: { type: "string" },
        createdAtTo: { type: "string" }
      },
      required: ["createdAtFrom", "createdAtTo"]
    },
    queryTemplate: {
      queryTemplateVersion: "v1",
      templateText: "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId",
      allowedParameters: ["createdAtFrom", "createdAtTo"]
    },
    fieldMappings: [
      {
        fieldCode: "orderNo",
        headerName: "Order No",
        fieldType: "STRING",
        orderNo: 1,
        sensitive: false,
        exportable: true
      }
    ],
    maskingPolicy: {
      version: "v1",
      rules: []
    },
    dataScopeTemplate: "tenant_id = :tenantId",
    cursorField: "order_id",
    orderBy: [
      {
        field: "order_id",
        direction: "ASC"
      }
    ],
    batchSize: 500
  };
}

function createTaskPayload(taskCode, clientRequestId = "client-001") {
  return {
    taskCode,
    subsystemCode: "purchase",
    fileFormat: "XLSX",
    clientRequestId,
    queryParams: {
      createdAtFrom: "2026-05-01T00:00:00+08:00",
      createdAtTo: "2026-05-13T23:59:59+08:00"
    }
  };
}

async function auditLogsByRequestId(db, requestId) {
  return db
    .selectFrom("export_audit_logs")
    .selectAll()
    .where("request_id", "=", requestId)
    .execute();
}

async function createLocalObjectStorageServer(t, options = {}) {
  const bucket = options.bucket ?? "export-platform-test";
  const signingSecret = options.signingSecret ?? downloadSigningSecret;
  const clock = options.clock ?? { now: new Date() };
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

    requests.push({
      method: request.method ?? "GET",
      storageKey,
      search: url.search,
      internalRead: request.headers["x-export-internal-object-read"] === "true",
      signatureResult: null
    });

    if (request.method === "GET") {
      const latestRequest = requests[requests.length - 1];
      if (!latestRequest.internalRead) {
        const signatureResult = verifyDownloadUrl({
          bucket,
          storageKey,
          expiresAt: url.searchParams.get("expiresAt"),
          signature: url.searchParams.get("signature"),
          secret: signingSecret,
          now: clock.now ?? new Date()
        });
        latestRequest.signatureResult = signatureResult;
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
    requests,
    clock
  };
}

function decodeStorageKey(segments) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

function checksum(body) {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
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

function signedRoutePath(url) {
  return `${url.pathname}${url.search}`;
}

function signPlatformDownloadUrl({ taskId, storageKey, url, secret }) {
  return createHmac("sha256", secret)
    .update([
      "GET",
      taskId,
      storageKey,
      url.searchParams.get("expiresAt"),
      url.searchParams.get("operatorId"),
      url.searchParams.get("tenantId"),
      url.searchParams.get("roleCodes"),
      url.searchParams.get("orgScope"),
      url.searchParams.get("requestId")
    ].join("\n"))
    .digest("hex");
}

test("HTTP API requires EXPORT_PLATFORM_TEST_DATABASE_URL", () => {
  const previousTestDatabaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
  const previousDatabaseUrl = process.env.EXPORT_PLATFORM_DATABASE_URL;

  delete process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
  process.env.EXPORT_PLATFORM_DATABASE_URL =
    "mysql://root:password@127.0.0.1:3306/production_like_database";

  try {
    assert.throws(() => getTestDatabaseUrl(), /EXPORT_PLATFORM_TEST_DATABASE_URL/);
  } finally {
    if (previousTestDatabaseUrl === undefined) {
      delete process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
    } else {
      process.env.EXPORT_PLATFORM_TEST_DATABASE_URL = previousTestDatabaseUrl;
    }

    if (previousDatabaseUrl === undefined) {
      delete process.env.EXPORT_PLATFORM_DATABASE_URL;
    } else {
      process.env.EXPORT_PLATFORM_DATABASE_URL = previousDatabaseUrl;
    }
  }
});

test("registry/task HTTP flow persists through Fastify + MySQL production path", async (t) => {
  const db = await createTestDatabase(t);
  const objectStorageServer = await createLocalObjectStorageServer(t);
  const app = await createServer(t, objectStorageServer);
  const auditRepository = createExportAuditRepository(db);
  const checkpointRepository = createCheckpointRepository(db);
  const taskRepository = createExportTaskRepository(db);
  const eventRepository = createExportTaskEventRepository(db);
  const fileRepository = createExportFileRepository(db);
  const runId = `${Date.now()}-${process.pid}`;
  const taskCode = `purchase-order-export-${runId}`;

  const createRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-registry-${runId}`),
    payload: createRegistryPayload(taskCode)
  });

  assert.equal(createRegistryResponse.statusCode, 201);

  const disableResponse = await app.inject({
    method: "POST",
    url: `/api/export/registries/${taskCode}/disable`,
    headers: createHeaders(`req-disable-${runId}`)
  });

  assert.equal(disableResponse.statusCode, 200);

  const disabledTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-disabled-task-${runId}`),
    payload: createTaskPayload(taskCode, "client-disabled")
  });

  assert.equal(disabledTaskResponse.statusCode, 400);
  assert.equal(disabledTaskResponse.json().code, "TASK_DISABLED");
  const disabledAudits = await auditLogsByRequestId(db, `req-disabled-task-${runId}`);
  assert.equal(disabledAudits.length, 1);
  assert.equal(disabledAudits[0].result, "FAILED");
  assert.equal(disabledAudits[0].error_code, "TASK_DISABLED");

  const enableResponse = await app.inject({
    method: "POST",
    url: `/api/export/registries/${taskCode}/enable`,
    headers: createHeaders(`req-enable-${runId}`)
  });

  assert.equal(enableResponse.statusCode, 200);

  const createTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-${runId}`),
    payload: createTaskPayload(taskCode)
  });

  assert.equal(createTaskResponse.statusCode, 201);
  assert.equal(createTaskResponse.json().code, "SUCCESS");
  assert.equal(createTaskResponse.json().data.status, "PENDING");
  assert.equal(createTaskResponse.json().data.tenantId, "tenant-001");
  assert.equal(createTaskResponse.json().data.createdBy, "u001");
  assert.equal(createTaskResponse.json().data.fileFormat, "XLSX");
  const createdTask = await taskRepository.findTaskById(createTaskResponse.json().data.taskId);
  const createdTaskPayload = JSON.parse(createdTask.requestPayload);
  assert.equal(createdTaskPayload.configSnapshot.taskCode, taskCode);
  assert.equal(
    createdTaskPayload.configSnapshot.configSnapshotDigest,
    createTaskResponse.json().data.configSnapshotDigest
  );

  const replayResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-replay-task-${runId}`),
    payload: createTaskPayload(taskCode)
  });

  assert.equal(replayResponse.statusCode, 200);
  assert.equal(replayResponse.json().data.taskId, createTaskResponse.json().data.taskId);

  const conflictResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-conflict-task-${runId}`),
    payload: {
      ...createTaskPayload(taskCode),
      queryParams: {
        createdAtFrom: "2026-05-02T00:00:00+08:00",
        createdAtTo: "2026-05-13T23:59:59+08:00"
      }
    }
  });

  assert.equal(conflictResponse.statusCode, 409);
  assert.equal(conflictResponse.json().code, "IDEMPOTENCY_CONFLICT");
  const conflictAudits = await auditLogsByRequestId(db, `req-conflict-task-${runId}`);
  assert.equal(conflictAudits.length, 1);
  assert.equal(conflictAudits[0].result, "FAILED");
  assert.equal(conflictAudits[0].error_code, "IDEMPOTENCY_CONFLICT");

  const taskId = createTaskResponse.json().data.taskId;
  const pendingDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`req-detail-pending-${runId}`)
  });

  assert.equal(pendingDetailResponse.statusCode, 200);
  assert.equal(pendingDetailResponse.json().data.taskId, taskId);
  assert.equal(pendingDetailResponse.json().data.status, "PENDING");
  assert.equal(pendingDetailResponse.json().data.totalCount, 0);
  assert.equal(pendingDetailResponse.json().data.processedCount, 0);
  assert.equal(pendingDetailResponse.json().data.progressPercent, 0);
  assert.equal(pendingDetailResponse.json().data.errorCode, null);
  assert.equal(pendingDetailResponse.json().data.errorMessage, null);
  assert.deepEqual(pendingDetailResponse.json().data.recentEvents, []);
  assert.equal("events" in pendingDetailResponse.json().data, false);

  const firstDetailNow = await getDatabaseTime(db);

  await checkpointRepository.saveCheckpoint({
    taskId,
    attemptNo: 0,
    lastCursor: "cursor-24",
    processedCount: 24,
    filePartNo: 1,
    retryCount: 0,
    batchSize: 500,
    batchRowCount: 24,
    backoffMs: 0,
    now: firstDetailNow
  });
  await eventRepository.appendTaskEvent({
    eventId: `event-ready-${runId}`,
    taskId,
    attemptNo: 0,
    eventType: "QUERY_READY",
    requestId: `req-worker-${runId}`,
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "v1",
    batchCheckpoint: JSON.stringify({
      taskId,
      attemptNo: 0,
      requestId: `req-worker-${runId}`,
      datasourceCode: "purchase-ro",
      queryTemplateVersion: "v1"
    }),
    occurredAt: firstDetailNow,
    now: firstDetailNow
  });
  await eventRepository.appendTaskEvent({
    eventId: `event-batch-${runId}`,
    taskId,
    attemptNo: 0,
    eventType: "QUERY_BATCH_DONE",
    requestId: `req-worker-${runId}`,
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "v1",
    batchCheckpoint: JSON.stringify({
      lastCursor: "cursor-24",
      processedCount: 24,
      totalCount: 120,
      filePartNo: 1,
      retryCount: 0,
      batchSize: 500,
      batchRowCount: 24,
      backoffMs: 0
    }),
    occurredAt: new Date(firstDetailNow.getTime() + 1),
    now: new Date(firstDetailNow.getTime() + 1)
  });

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`req-detail-${runId}`)
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().data.taskId, taskId);
  assert.equal(detailResponse.json().data.totalCount, 120);
  assert.equal(detailResponse.json().data.processedCount, 24);
  assert.equal(detailResponse.json().data.progressPercent, 20);
  assert.equal(detailResponse.json().data.errorCode, null);
  assert.equal(detailResponse.json().data.errorMessage, null);
  assert.ok(Array.isArray(detailResponse.json().data.recentEvents));
  assert.equal("events" in detailResponse.json().data, false);
  assert.equal(detailResponse.json().data.recentEvents[0].eventType, "QUERY_BATCH_DONE");
  assert.equal(detailResponse.json().data.recentEvents[0].taskId, taskId);
  assert.equal(detailResponse.json().data.recentEvents[0].attemptNo, 0);
  assert.equal(detailResponse.json().data.recentEvents[0].requestId, `req-worker-${runId}`);
  assert.equal(detailResponse.json().data.recentEvents[0].datasourceCode, "purchase-ro");
  assert.equal(detailResponse.json().data.recentEvents[0].queryTemplateVersion, "v1");
  assert.equal(detailResponse.json().data.recentEvents[0].batchCheckpoint.processedCount, 24);
  assert.equal("errorCode" in detailResponse.json().data.recentEvents[0].batchCheckpoint, false);
  assert.equal("errorMessage" in detailResponse.json().data.recentEvents[0].batchCheckpoint, false);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks?taskCode=${encodeURIComponent(taskCode)}&createdBy=u001&fileFormat=XLSX&createdAtFrom=2026-05-01T00%3A00%3A00.000Z&createdAtTo=2099-01-01T00%3A00%3A00.000Z`,
    headers: createHeaders(`req-list-admin-${runId}`)
  });

  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.json().data.items.some((item) => item.taskId === taskId));
  assert.equal(
    listResponse.json().data.items.find((item) => item.taskId === taskId).createdBy,
    "u001"
  );
  assert.equal(
    listResponse.json().data.items.find((item) => item.taskId === taskId).fileFormat,
    "XLSX"
  );
  const listedTask = listResponse.json().data.items.find((item) => item.taskId === taskId);
  assert.equal(listedTask.totalCount, 0);
  assert.equal(listedTask.processedCount, 0);
  assert.equal(listedTask.progressPercent, 0);
  assert.deepEqual(listedTask.recentEvents, []);
  assert.equal("events" in listedTask, false);

  const secondTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-other-${runId}`, {
      operatorId: "u002",
      roleCodes: "EXPORT_USER"
    }),
    payload: createTaskPayload(taskCode, "client-other")
  });

  assert.equal(secondTaskResponse.statusCode, 201);
  const secondTaskId = secondTaskResponse.json().data.taskId;
  const failedTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-failed-${runId}`),
    payload: createTaskPayload(taskCode, "client-failed")
  });

  assert.equal(failedTaskResponse.statusCode, 201);
  const failedTaskId = failedTaskResponse.json().data.taskId;
  const failedDetailNow = await getDatabaseTime(db);

  await checkpointRepository.saveCheckpoint({
    taskId: failedTaskId,
    attemptNo: 0,
    lastCursor: "cursor-25",
    processedCount: 25,
    filePartNo: 1,
    retryCount: 2,
    batchSize: 500,
    batchRowCount: 25,
    backoffMs: 0,
    now: failedDetailNow
  });
  await eventRepository.appendTaskEvent({
    eventId: `event-failed-batch-${runId}`,
    taskId: failedTaskId,
    attemptNo: 0,
    eventType: "QUERY_BATCH_DONE",
    requestId: `req-worker-failed-${runId}`,
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "v1",
    batchCheckpoint: JSON.stringify({
      lastCursor: "cursor-25",
      processedCount: 25,
      totalCount: 50,
      filePartNo: 1,
      retryCount: 2,
      batchSize: 500,
      batchRowCount: 25,
      backoffMs: 0
    }),
    occurredAt: failedDetailNow,
    now: failedDetailNow
  });
  await taskRepository.updateTaskStatus({
    taskId: failedTaskId,
    status: "FAILED",
    now: new Date(failedDetailNow.getTime() + 1)
  });
  await auditRepository.appendAuditLog({
    auditId: `audit-failed-${runId}`,
    taskId: failedTaskId,
    attemptNo: 0,
    taskCode,
    subsystemCode: "purchase",
    operatorId: "u001",
    action: "EXECUTE_FAILED",
    result: "FAILED",
    errorCode: "QUERY_EXECUTION_ERROR",
    requestId: `req-worker-failed-${runId}`,
    occurredAt: new Date(failedDetailNow.getTime() + 2),
    now: new Date(failedDetailNow.getTime() + 2)
  });

  const failedDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${failedTaskId}`,
    headers: createHeaders(`req-detail-failed-${runId}`)
  });

  assert.equal(failedDetailResponse.statusCode, 200);
  assert.equal(failedDetailResponse.json().data.taskId, failedTaskId);
  assert.equal(failedDetailResponse.json().data.status, "FAILED");
  assert.equal(failedDetailResponse.json().data.totalCount, 50);
  assert.equal(failedDetailResponse.json().data.processedCount, 25);
  assert.equal(failedDetailResponse.json().data.progressPercent, 50);
  assert.equal(failedDetailResponse.json().data.errorCode, "QUERY_EXECUTION_ERROR");
  assert.equal(failedDetailResponse.json().data.errorMessage, "query execution error");
  assert.ok(Array.isArray(failedDetailResponse.json().data.recentEvents));
  assert.equal(failedDetailResponse.json().data.recentEvents[0].eventType, "QUERY_BATCH_DONE");
  assert.equal("events" in failedDetailResponse.json().data, false);

  const eventOnlyFailedTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-event-failed-${runId}`),
    payload: createTaskPayload(taskCode, "client-event-failed")
  });

  assert.equal(eventOnlyFailedTaskResponse.statusCode, 201);
  const eventOnlyFailedTaskId = eventOnlyFailedTaskResponse.json().data.taskId;
  const eventOnlyFailedAt = await getDatabaseTime(db);
  await checkpointRepository.saveCheckpoint({
    taskId: eventOnlyFailedTaskId,
    attemptNo: 0,
    lastCursor: "cursor-10",
    processedCount: 10,
    filePartNo: 1,
    retryCount: 3,
    batchSize: 500,
    batchRowCount: 10,
    backoffMs: 0,
    now: eventOnlyFailedAt
  });
  await eventRepository.appendTaskEvent({
    eventId: `event-only-failed-${runId}`,
    taskId: eventOnlyFailedTaskId,
    attemptNo: 0,
    eventType: "QUERY_BATCH_DONE",
    requestId: `req-worker-event-failed-${runId}`,
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "v1",
    batchCheckpoint: JSON.stringify({
      lastCursor: "cursor-10",
      processedCount: 10,
      totalCount: 40,
      errorCode: "DATASOURCE_UNAVAILABLE",
      errorMessage: "datasource credentials unavailable"
    }),
    occurredAt: eventOnlyFailedAt,
    now: eventOnlyFailedAt
  });
  await taskRepository.updateTaskStatus({
    taskId: eventOnlyFailedTaskId,
    status: "FAILED",
    now: new Date(eventOnlyFailedAt.getTime() + 1)
  });

  const eventOnlyFailedDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${eventOnlyFailedTaskId}`,
    headers: createHeaders(`req-detail-event-failed-${runId}`)
  });

  assert.equal(eventOnlyFailedDetailResponse.statusCode, 200);
  assert.equal(eventOnlyFailedDetailResponse.json().data.totalCount, 40);
  assert.equal(eventOnlyFailedDetailResponse.json().data.processedCount, 10);
  assert.equal(eventOnlyFailedDetailResponse.json().data.progressPercent, 25);
  assert.equal(eventOnlyFailedDetailResponse.json().data.errorCode, "DATASOURCE_UNAVAILABLE");
  assert.equal(
    eventOnlyFailedDetailResponse.json().data.errorMessage,
    "datasource credentials unavailable"
  );
  assert.equal(
    eventOnlyFailedDetailResponse.json().data.recentEvents[0].eventType,
    "QUERY_BATCH_DONE"
  );
  assert.equal(
    "errorCode" in eventOnlyFailedDetailResponse.json().data.recentEvents[0].batchCheckpoint,
    false
  );
  assert.equal(
    "errorMessage" in eventOnlyFailedDetailResponse.json().data.recentEvents[0].batchCheckpoint,
    false
  );
  assert.equal("events" in eventOnlyFailedDetailResponse.json().data, false);

  const internalFailureTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-internal-failed-${runId}`),
    payload: createTaskPayload(taskCode, "client-internal-failed")
  });

  assert.equal(internalFailureTaskResponse.statusCode, 201);
  const internalFailureTaskId = internalFailureTaskResponse.json().data.taskId;
  const internalFailureAt = await getDatabaseTime(db);
  await eventRepository.appendTaskEvent({
    eventId: `event-internal-cleanup-${runId}`,
    taskId: internalFailureTaskId,
    attemptNo: 0,
    eventType: "FILE_CLEANUP_RETRY",
    requestId: `req-worker-internal-failed-${runId}`,
    datasourceCode: null,
    queryTemplateVersion: null,
    batchCheckpoint: null,
    occurredAt: internalFailureAt,
    now: internalFailureAt
  });
  await eventRepository.appendTaskEvent({
    eventId: `event-internal-public-${runId}`,
    taskId: internalFailureTaskId,
    attemptNo: 0,
    eventType: "QUERY_BATCH_DONE",
    requestId: `req-worker-internal-failed-${runId}`,
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "v1",
    batchCheckpoint: JSON.stringify({
      processedCount: 1,
      totalCount: 4,
      errorCode: "UnexpectedQueryVendorError"
    }),
    occurredAt: new Date(internalFailureAt.getTime() + 1),
    now: new Date(internalFailureAt.getTime() + 1)
  });
  await taskRepository.updateTaskStatus({
    taskId: internalFailureTaskId,
    status: "FAILED",
    now: new Date(internalFailureAt.getTime() + 2)
  });
  await auditRepository.appendAuditLog({
    auditId: `audit-internal-failed-${runId}`,
    taskId: internalFailureTaskId,
    attemptNo: 0,
    taskCode,
    subsystemCode: "purchase",
    operatorId: "u001",
    action: "EXECUTE_FAILED",
    result: "FAILED",
    errorCode: "UnexpectedQueryVendorError",
    requestId: `req-worker-internal-failed-${runId}`,
    occurredAt: new Date(internalFailureAt.getTime() + 3),
    now: new Date(internalFailureAt.getTime() + 3)
  });

  const internalFailureDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${internalFailureTaskId}`,
    headers: createHeaders(`req-detail-internal-failed-${runId}`)
  });

  assert.equal(internalFailureDetailResponse.statusCode, 200);
  assert.equal(internalFailureDetailResponse.json().data.errorCode, "QUERY_EXECUTION_ERROR");
  assert.equal(
    internalFailureDetailResponse.json().data.errorMessage,
    "query execution error"
  );
  assert.deepEqual(
    internalFailureDetailResponse.json().data.recentEvents.map((event) => event.eventType),
    ["QUERY_BATCH_DONE"]
  );
  assert.doesNotMatch(
    JSON.stringify(internalFailureDetailResponse.json().data.recentEvents),
    /UnexpectedQueryVendorError/
  );
  assert.equal("events" in internalFailureDetailResponse.json().data, false);

  const ordinaryListResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks?taskCode=${encodeURIComponent(taskCode)}`,
    headers: createHeaders(`req-list-user-${runId}`, {
      operatorId: "u001",
      roleCodes: "EXPORT_USER"
    })
  });

  assert.equal(ordinaryListResponse.statusCode, 200);
  assert.ok(ordinaryListResponse.json().data.items.some((item) => item.taskId === taskId));
  assert.ok(ordinaryListResponse.json().data.items.every((item) => item.taskId !== secondTaskId));

  const crossTenantListResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks?taskCode=${encodeURIComponent(taskCode)}`,
    headers: createHeaders(`req-list-cross-tenant-${runId}`, {
      operatorId: "u001",
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });

  assert.equal(crossTenantListResponse.statusCode, 200);
  assert.ok(crossTenantListResponse.json().data.items.some((item) => item.taskId === taskId));

  const crossTenantDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`req-detail-cross-tenant-${runId}`, {
      operatorId: "u001",
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });

  assert.equal(crossTenantDetailResponse.statusCode, 403);
  assert.equal(crossTenantDetailResponse.json().code, "PERMISSION_DENIED");

  const deniedDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${secondTaskId}/download`,
    headers: createHeaders(`req-denied-download-${runId}`, {
      operatorId: "u001",
      roleCodes: "EXPORT_USER"
    })
  });

  assert.equal(deniedDownloadResponse.statusCode, 403);
  assert.equal(deniedDownloadResponse.json().code, "PERMISSION_DENIED");

  const retryPendingResponse = await app.inject({
    method: "POST",
    url: `/api/export/tasks/${taskId}/retry`,
    headers: createHeaders(`req-retry-pending-${runId}`)
  });

  assert.equal(retryPendingResponse.statusCode, 400);
  assert.equal(retryPendingResponse.json().code, "INVALID_TASK_STATE");

  const cancelResponse = await app.inject({
    method: "POST",
    url: `/api/export/tasks/${taskId}/cancel`,
    headers: createHeaders(`req-cancel-${runId}`)
  });

  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(cancelResponse.json().data.status, "CANCELED");

  const canceledTask = await taskRepository.findTaskById(taskId);
  assert.equal(canceledTask?.status, "CANCELED");

  const notReadyDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download`,
    headers: createHeaders(`req-download-not-ready-${runId}`)
  });

  assert.equal(notReadyDownloadResponse.statusCode, 400);
  assert.equal(notReadyDownloadResponse.json().code, "FILE_NOT_READY");

  const streamBody = Buffer.from("stream-download-body");
  const now = await getDatabaseTime(db);
  objectStorageServer.clock.now = now;
  const fileRetentionExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await fileRepository.saveFileMetadata({
    taskId,
    attemptNo: 0,
    fileName: "purchase-orders.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: streamBody.byteLength,
    checksum: checksum(streamBody),
    checksumAlgorithm: "SHA-256",
    tempStorageKey: "exports/tmp/purchase-orders.xlsx",
    publishedStorageKey: "exports/published/purchase-orders.xlsx",
    expiresAt: fileRetentionExpiresAt,
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const stillExecutingDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download`,
    headers: createHeaders(`req-download-still-executing-${runId}`)
  });

  assert.equal(stillExecutingDownloadResponse.statusCode, 400);
  assert.equal(stillExecutingDownloadResponse.json().code, "FILE_NOT_READY");

  await taskRepository.updateTaskStatus({
    taskId,
    status: "COMPLETED",
    now: await getDatabaseTime(db)
  });

  const downloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download`,
    headers: createHeaders(`req-download-${runId}`)
  });

  assert.equal(downloadResponse.statusCode, 200);
  const signedDownloadData = downloadResponse.json().data;
  assert.equal(signedDownloadData.fileName, "purchase-orders.xlsx");
  assert.equal(signedDownloadData.storageKey, "exports/published/purchase-orders.xlsx");
  const signedDownloadUrl = new URL(signedDownloadData.downloadUrl);
  assert.equal(signedDownloadUrl.searchParams.get("signatureAlgorithm"), "HMAC-SHA256");
  assert.equal(signedDownloadUrl.searchParams.get("expiresAt"), signedDownloadData.expiresAt);
  assert.equal(signedDownloadUrl.pathname, `/api/export/tasks/${taskId}/download`);
  assert.equal(signedDownloadUrl.searchParams.get("operatorId"), "u001");
  assert.equal(signedDownloadUrl.searchParams.get("requestId"), `req-download-${runId}`);
  assert.ok(new Date(signedDownloadData.expiresAt).getTime() < now.getTime() + 20 * 60 * 1000);
  assert.ok(new Date(signedDownloadData.expiresAt).getTime() > now.getTime());
  assert.ok(new Date(signedDownloadData.expiresAt).getTime() < fileRetentionExpiresAt.getTime());

  objectStorageServer.objects.set("exports/published/purchase-orders.xlsx", streamBody);
  const signedFetchResponse = await app.inject({
    method: "GET",
    url: signedRoutePath(signedDownloadUrl)
  });
  assert.equal(signedFetchResponse.statusCode, 200);
  assert.equal(signedFetchResponse.body, "stream-download-body");
  assert.equal(objectStorageServer.requests.at(-1).internalRead, true);

  const tamperedSignedUrl = new URL(signedDownloadData.downloadUrl);
  const originalSignature = tamperedSignedUrl.searchParams.get("signature") ?? "";
  tamperedSignedUrl.searchParams.set(
    "signature",
    `${originalSignature.startsWith("0") ? "1" : "0"}${originalSignature.slice(1)}`
  );
  const tamperedSignedResponse = await app.inject({
    method: "GET",
    url: signedRoutePath(tamperedSignedUrl)
  });
  assert.equal(tamperedSignedResponse.statusCode, 403);
  assert.equal(tamperedSignedResponse.json().code, "SIGNATURE_INVALID");

  const expiredSignedUrl = new URL(signedDownloadData.downloadUrl);
  const expiredAt = new Date(now.getTime() - 60_000).toISOString();
  expiredSignedUrl.searchParams.set("expiresAt", expiredAt);
  expiredSignedUrl.searchParams.set(
    "signature",
    signPlatformDownloadUrl({
      taskId,
      storageKey: "exports/published/purchase-orders.xlsx",
      url: expiredSignedUrl,
      secret: downloadSigningSecret
    })
  );
  const expiredSignedResponse = await app.inject({
    method: "GET",
    url: signedRoutePath(expiredSignedUrl)
  });
  assert.equal(expiredSignedResponse.statusCode, 403);
  assert.equal(expiredSignedResponse.json().code, "SIGNATURE_EXPIRED");

  const streamDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download?mode=STREAM`,
    headers: createHeaders(`req-download-stream-${runId}`)
  });

  assert.equal(streamDownloadResponse.statusCode, 200);
  assert.match(streamDownloadResponse.headers["content-type"], /^application\/octet-stream/);
  assert.equal(
    streamDownloadResponse.headers["x-export-file-name"],
    "purchase-orders.xlsx"
  );
  assert.equal(streamDownloadResponse.headers["x-export-file-size"], String(streamBody.byteLength));
  assert.equal(streamDownloadResponse.headers["x-export-checksum"], checksum(streamBody));
  assert.equal(streamDownloadResponse.headers["x-export-checksum-algorithm"], "SHA-256");
  assert.equal(streamDownloadResponse.headers["x-export-attempt-no"], "0");
  assert.equal(streamDownloadResponse.body, "stream-download-body");

  objectStorageServer.objects.set(
    "exports/published/purchase-orders.xlsx",
    Buffer.from("corrupted-stream-download-body")
  );

  const corruptedStreamDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download?mode=STREAM`,
    headers: createHeaders(`req-download-stream-corrupted-${runId}`)
  });

  assert.equal(corruptedStreamDownloadResponse.statusCode, 500);
  assert.equal(corruptedStreamDownloadResponse.json().code, "FILE_VERIFY_ERROR");

  await fileRepository.saveFileMetadata({
    taskId,
    attemptNo: 0,
    fileName: "purchase-orders.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: streamBody.byteLength,
    checksum: checksum(streamBody),
    checksumAlgorithm: "SHA-256",
    tempStorageKey: "exports/tmp/purchase-orders.xlsx",
    publishedStorageKey: "exports/published/purchase-orders.xlsx",
    expiresAt: new Date(now.getTime() - 10 * 60 * 1000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now: await getDatabaseTime(db)
  });

  const expiredDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download`,
    headers: createHeaders(`req-download-expired-${runId}`)
  });

  assert.equal(expiredDownloadResponse.statusCode, 410);
  assert.equal(expiredDownloadResponse.json().code, "FILE_EXPIRED");

  const auditLogs = await auditRepository.listAuditLogsForTask(taskId);
  assert.ok(auditLogs.some((log) => log.action === "DOWNLOAD" && log.result === "SUCCESS"));
  assert.ok(
    auditLogs.some(
      (log) => log.action === "DOWNLOAD" && log.result === "FAILED" && log.errorCode === "SIGNATURE_INVALID"
    )
  );
  assert.ok(
    auditLogs.some(
      (log) => log.action === "DOWNLOAD" && log.result === "FAILED" && log.errorCode === "SIGNATURE_EXPIRED"
    )
  );
  const deniedAudits = await auditLogsByRequestId(db, `req-denied-download-${runId}`);
  assert.equal(deniedAudits.length, 1);
  assert.equal(deniedAudits[0].result, "FAILED");
  assert.equal(deniedAudits[0].error_code, "PERMISSION_DENIED");
});
