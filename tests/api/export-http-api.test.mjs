import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { createExportPlatformServer } from "../../src/server.ts";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createExportAuditRepository,
  createExportFileRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";

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
  process.env.EXPORT_PLATFORM_DATABASE_URL = databaseUrl;
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT =
    objectStorageConfig.endpoint ?? "https://oss.example.test";
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET =
    objectStorageConfig.bucket ?? "export-platform-test";

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
  const objects = new Map();
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
    objects
  };
}

function decodeStorageKey(segments) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

function checksum(body) {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
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
  const taskRepository = createExportTaskRepository(db);
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

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`req-detail-${runId}`)
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().data.taskId, taskId);

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
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
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
  assert.equal(downloadResponse.json().data.fileName, "purchase-orders.xlsx");
  assert.equal(downloadResponse.json().data.storageKey, "exports/published/purchase-orders.xlsx");
  assert.match(
    downloadResponse.json().data.downloadUrl,
    new RegExp(`^${objectStorageServer.endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`)
  );

  objectStorageServer.objects.set("exports/published/purchase-orders.xlsx", streamBody);

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
  const deniedAudits = await auditLogsByRequestId(db, `req-denied-download-${runId}`);
  assert.equal(deniedAudits.length, 1);
  assert.equal(deniedAudits[0].result, "FAILED");
  assert.equal(deniedAudits[0].error_code, "PERMISSION_DENIED");
});
