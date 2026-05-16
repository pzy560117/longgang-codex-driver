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

const downloadSigningSecret = `test-only-download-${randomUUID()}`;
const authContextSigningSecret = `test-only-auth-${randomUUID()}`;

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
  const previousAuthContextSigningSecret = process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET;
  const previousRegistryAdminTenantIds = process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS;
  process.env.EXPORT_PLATFORM_DATABASE_URL = databaseUrl;
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT =
    objectStorageConfig.endpoint ?? "https://oss.example.test";
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET =
    objectStorageConfig.bucket ?? "export-platform-test";
  process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET =
    objectStorageConfig.signingSecret ?? downloadSigningSecret;
  process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET =
    objectStorageConfig.authContextSigningSecret ?? authContextSigningSecret;
  process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS =
    objectStorageConfig.registryAdminTenantIds ?? "tenant-001";

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

    if (previousAuthContextSigningSecret === undefined) {
      delete process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET;
    } else {
      process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET = previousAuthContextSigningSecret;
    }

    if (previousRegistryAdminTenantIds === undefined) {
      delete process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS;
    } else {
      process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS = previousRegistryAdminTenantIds;
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
  const headers = {
    "content-type": "application/json",
    "x-operator-id": overrides.operatorId ?? "u001",
    "x-tenant-id": overrides.tenantId ?? "tenant-001",
    "x-role-codes": overrides.roleCodes ?? "EXPORT_ADMIN",
    "x-org-scope": overrides.orgScope ?? "ORG-001",
    "x-request-id": requestId,
    "x-auth-context-issued-at": overrides.issuedAt ?? new Date().toISOString(),
    "x-auth-context-signature-algorithm": "HMAC-SHA256"
  };
  headers["x-auth-context-signature"] =
    overrides.signature ?? signAuthContextHeaders(headers, overrides.secret);
  return headers;
}

function signAuthContextHeaders(headers, secret = authContextSigningSecret) {
  return createHmac("sha256", secret)
    .update([
      headers["x-operator-id"],
      headers["x-tenant-id"],
      headers["x-role-codes"],
      headers["x-org-scope"],
      headers["x-request-id"],
      headers["x-auth-context-issued-at"]
    ].join("\n"))
    .digest("hex");
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

function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function createQueryParamsWithCanonicalSize(size) {
  const prefix = Buffer.byteLength('{"payload":"', "utf8");
  const suffix = Buffer.byteLength('"}', "utf8");
  return {
    payload: "x".repeat(size - prefix - suffix)
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

  const unregisteredTaskCode = `${taskCode}-unregistered`;
  const unregisteredTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-unregistered-task-${runId}`),
    payload: createTaskPayload(unregisteredTaskCode, "client-unregistered")
  });

  assert.equal(unregisteredTaskResponse.statusCode, 404);
  assert.equal(unregisteredTaskResponse.json().code, "TASK_NOT_REGISTERED");
  const unregisteredTasks = await db
    .selectFrom("export_tasks")
    .select("task_id")
    .where("task_code", "=", unregisteredTaskCode)
    .execute();
  assert.equal(unregisteredTasks.length, 0);
  const unregisteredAudits = await auditLogsByRequestId(db, `req-unregistered-task-${runId}`);
  assert.equal(unregisteredAudits.length, 1);
  assert.equal(unregisteredAudits[0].result, "FAILED");
  assert.equal(unregisteredAudits[0].error_code, "TASK_NOT_REGISTERED");

  const createRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-registry-${runId}`),
    payload: createRegistryPayload(taskCode)
  });

  assert.equal(createRegistryResponse.statusCode, 201);

  const duplicateRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-registry-duplicate-${runId}`),
    payload: {
      ...createRegistryPayload(taskCode),
      displayName: "Duplicate Purchase Order Export"
    }
  });

  assert.equal(duplicateRegistryResponse.statusCode, 409);
  assert.equal(duplicateRegistryResponse.json().code, "REGISTRY_CONFLICT");
  const duplicateRegistryAudits = await auditLogsByRequestId(
    db,
    `req-registry-duplicate-${runId}`
  );
  assert.equal(duplicateRegistryAudits.length, 1);
  assert.equal(duplicateRegistryAudits[0].result, "FAILED");
  assert.equal(duplicateRegistryAudits[0].error_code, "REGISTRY_CONFLICT");

  const concurrentTaskCode = `${taskCode}-concurrent`;
  const [concurrentFirstResponse, concurrentSecondResponse] = await Promise.all([
    app.inject({
      method: "POST",
      url: "/api/export/registries",
      headers: createHeaders(`req-registry-concurrent-first-${runId}`),
      payload: {
        ...createRegistryPayload(concurrentTaskCode),
        displayName: "Concurrent Create Winner"
      }
    }),
    app.inject({
      method: "POST",
      url: "/api/export/registries",
      headers: createHeaders(`req-registry-concurrent-second-${runId}`),
      payload: {
        ...createRegistryPayload(concurrentTaskCode),
        displayName: "Concurrent Create Loser"
      }
    })
  ]);
  const concurrentResponses = [concurrentFirstResponse, concurrentSecondResponse];
  assert.deepEqual(
    concurrentResponses.map((response) => response.statusCode).sort(),
    [201, 409]
  );
  assert.equal(
    concurrentResponses.find((response) => response.statusCode === 409).json().code,
    "REGISTRY_CONFLICT"
  );

  const concurrentRegistryResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${concurrentTaskCode}`,
    headers: createHeaders(`req-registry-concurrent-get-${runId}`)
  });
  assert.equal(concurrentRegistryResponse.statusCode, 200);
  assert.equal(
    concurrentRegistryResponse.json().data.displayName,
    concurrentResponses.find((response) => response.statusCode === 201).json().data.displayName
  );

  const getRegistryResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: createHeaders(`req-registry-get-${runId}`)
  });

  assert.equal(getRegistryResponse.statusCode, 200);
  assert.equal(getRegistryResponse.json().data.taskCode, taskCode);
  assert.equal(getRegistryResponse.json().data.subsystemCode, "purchase");
  assert.equal(getRegistryResponse.json().data.concurrencyLimit, 2);

  const listRegistryResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries?subsystemCode=purchase&enabled=true`,
    headers: createHeaders(`req-registry-list-${runId}`)
  });

  assert.equal(listRegistryResponse.statusCode, 200);
  assert.ok(
    listRegistryResponse.json().data.items.some((item) => item.taskCode === taskCode)
  );

  const unauthorizedRegistryUpdateResponse = await app.inject({
    method: "PUT",
    url: `/api/export/registries/${taskCode}`,
    headers: createHeaders(`req-registry-update-denied-${runId}`, {
      roleCodes: "EXPORT_USER"
    }),
    payload: {
      ...createRegistryPayload(taskCode),
      concurrencyLimit: 9
    }
  });

  assert.equal(unauthorizedRegistryUpdateResponse.statusCode, 403);
  assert.equal(unauthorizedRegistryUpdateResponse.json().code, "PERMISSION_DENIED");
  const deniedRegistryUpdateAudits = await auditLogsByRequestId(
    db,
    `req-registry-update-denied-${runId}`
  );
  assert.equal(deniedRegistryUpdateAudits.length, 1);
  assert.equal(deniedRegistryUpdateAudits[0].result, "FAILED");
  assert.equal(deniedRegistryUpdateAudits[0].error_code, "PERMISSION_DENIED");

  const updateRegistryResponse = await app.inject({
    method: "PUT",
    url: `/api/export/registries/${taskCode}`,
    headers: createHeaders(`req-registry-update-${runId}`),
    payload: {
      ...createRegistryPayload(taskCode),
      displayName: "Purchase Order Export Updated",
      concurrencyLimit: 3,
      supportedFormats: ["XLSX", "ZIP"]
    }
  });

  assert.equal(updateRegistryResponse.statusCode, 200);
  assert.equal(updateRegistryResponse.json().data.taskCode, taskCode);
  assert.equal(updateRegistryResponse.json().data.displayName, "Purchase Order Export Updated");
  assert.equal(updateRegistryResponse.json().data.concurrencyLimit, 3);
  assert.deepEqual(updateRegistryResponse.json().data.supportedFormats, ["XLSX", "ZIP"]);

  const updatedRegistryResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: createHeaders(`req-registry-get-updated-${runId}`)
  });

  assert.equal(updatedRegistryResponse.statusCode, 200);
  assert.equal(updatedRegistryResponse.json().data.concurrencyLimit, 3);
  assert.deepEqual(updatedRegistryResponse.json().data.supportedFormats, ["XLSX", "ZIP"]);

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

  const otherSubsystemTaskCode = `${taskCode}-inventory`;
  const createOtherSubsystemRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-registry-other-subsystem-${runId}`),
    payload: {
      ...createRegistryPayload(otherSubsystemTaskCode),
      subsystemCode: "inventory",
      displayName: "Inventory Export"
    }
  });
  assert.equal(createOtherSubsystemRegistryResponse.statusCode, 201);
  const otherSubsystemTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-create-task-other-subsystem-${runId}`),
    payload: {
      ...createTaskPayload(otherSubsystemTaskCode, "client-other-subsystem"),
      subsystemCode: "inventory"
    }
  });
  assert.equal(otherSubsystemTaskResponse.statusCode, 201);
  const otherSubsystemTaskId = otherSubsystemTaskResponse.json().data.taskId;

  const statusSubsystemListResponse = await app.inject({
    method: "GET",
    url: "/api/export/tasks?status=PENDING&subsystemCode=purchase",
    headers: createHeaders(`req-list-status-subsystem-${runId}`)
  });

  assert.equal(statusSubsystemListResponse.statusCode, 200);
  assert.ok(
    statusSubsystemListResponse.json().data.items.some((item) => item.taskId === taskId)
  );
  assert.ok(
    statusSubsystemListResponse.json().data.items.every(
      (item) => item.status === "PENDING" && item.subsystemCode === "purchase"
    )
  );
  assert.equal(
    statusSubsystemListResponse.json().data.items.some((item) => item.taskId === failedTaskId),
    false
  );
  assert.equal(
    statusSubsystemListResponse.json().data.items.some((item) => item.taskId === otherSubsystemTaskId),
    false
  );
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

  assert.equal(crossTenantListResponse.statusCode, 403);
  assert.equal(crossTenantListResponse.json().code, "PERMISSION_DENIED");
  assert.doesNotMatch(JSON.stringify(crossTenantListResponse.json()), new RegExp(taskId));

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
  const forgedInvalidRequestId = `req-forged-invalid-signature-${runId}`;
  tamperedSignedUrl.searchParams.set("operatorId", "forged-operator");
  tamperedSignedUrl.searchParams.set("requestId", forgedInvalidRequestId);
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

  const deniedSignedUrl = new URL(signedDownloadData.downloadUrl);
  deniedSignedUrl.searchParams.set("operatorId", "u999");
  deniedSignedUrl.searchParams.set("roleCodes", "EXPORT_USER");
  deniedSignedUrl.searchParams.set("requestId", `req-signed-download-denied-${runId}`);
  deniedSignedUrl.searchParams.set(
    "signature",
    signPlatformDownloadUrl({
      taskId,
      storageKey: "exports/published/purchase-orders.xlsx",
      url: deniedSignedUrl,
      secret: downloadSigningSecret
    })
  );
  const deniedSignedResponse = await app.inject({
    method: "GET",
    url: signedRoutePath(deniedSignedUrl)
  });
  assert.equal(deniedSignedResponse.statusCode, 403);
  assert.equal(deniedSignedResponse.json().code, "PERMISSION_DENIED");

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
      (log) =>
        log.action === "DOWNLOAD" &&
        log.result === "FAILED" &&
        log.errorCode === "SIGNATURE_INVALID" &&
        log.operatorId === "signed-download"
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
  const signedDeniedAudits = await auditLogsByRequestId(db, `req-signed-download-denied-${runId}`);
  assert.equal(signedDeniedAudits.length, 1);
  assert.equal(signedDeniedAudits[0].result, "FAILED");
  assert.equal(signedDeniedAudits[0].error_code, "PERMISSION_DENIED");
  const forgedInvalidAudits = await auditLogsByRequestId(db, forgedInvalidRequestId);
  assert.equal(forgedInvalidAudits.length, 0);
});

test("trusted ingress proof is required before auth headers can grant admin or tenant context", async (t) => {
  const db = await createTestDatabase(t);
  const objectStorageServer = await createLocalObjectStorageServer(t);
  const app = await createServer(t, objectStorageServer);
  const runId = `${Date.now()}-${process.pid}-auth-boundary`;
  const taskCode = `purchase-order-auth-boundary-${runId}`;

  const unsignedAdminHeaders = createHeaders(`req-auth-boundary-unsigned-${runId}`);
  delete unsignedAdminHeaders["x-auth-context-signature"];
  const unsignedRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: unsignedAdminHeaders,
    payload: createRegistryPayload(taskCode)
  });

  assert.equal(unsignedRegistryResponse.statusCode, 401);
  assert.equal(unsignedRegistryResponse.json().code, "AUTH_CONTEXT_MISSING");
  const unsignedAudits = await auditLogsByRequestId(db, `req-auth-boundary-unsigned-${runId}`);
  assert.ok(unsignedAudits.length >= 1);
  assert.equal(unsignedAudits[0].result, "FAILED");
  assert.equal(unsignedAudits[0].error_code, "AUTH_CONTEXT_MISSING");

  const forgedAdminHeaders = createHeaders(`req-auth-boundary-forged-admin-${runId}`, {
    operatorId: "attacker",
    tenantId: "tenant-999",
    roleCodes: "EXPORT_ADMIN"
  });
  forgedAdminHeaders["x-auth-context-signature"] = signAuthContextHeaders({
    ...forgedAdminHeaders,
    "x-role-codes": "EXPORT_USER"
  });
  const forgedAdminResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: forgedAdminHeaders,
    payload: createRegistryPayload(`${taskCode}-forged`)
  });

  assert.equal(forgedAdminResponse.statusCode, 401);
  assert.equal(forgedAdminResponse.json().code, "AUTH_CONTEXT_MISSING");
  const forgedAdminAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-forged-admin-${runId}`
  );
  assert.ok(forgedAdminAudits.length >= 1);
  assert.equal(forgedAdminAudits[0].result, "FAILED");
  assert.equal(forgedAdminAudits[0].error_code, "AUTH_CONTEXT_MISSING");

  const emptyRolesHeaders = createHeaders(`req-auth-boundary-empty-roles-${runId}`, {
    roleCodes: " , "
  });
  const emptyRolesResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: emptyRolesHeaders,
    payload: createRegistryPayload(`${taskCode}-empty-roles`)
  });

  assert.equal(emptyRolesResponse.statusCode, 401);
  assert.equal(emptyRolesResponse.json().code, "AUTH_CONTEXT_MISSING");
  const emptyRolesAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-empty-roles-${runId}`
  );
  assert.ok(emptyRolesAudits.length >= 1);
  assert.equal(emptyRolesAudits[0].result, "FAILED");
  assert.equal(emptyRolesAudits[0].error_code, "AUTH_CONTEXT_MISSING");

  const validRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-auth-boundary-registry-${runId}`),
    payload: createRegistryPayload(taskCode)
  });
  assert.equal(validRegistryResponse.statusCode, 201);

  const expiredHeaders = createHeaders(`req-auth-boundary-expired-${runId}`, {
    issuedAt: new Date(Date.now() - 10 * 60 * 1000 - 1_000).toISOString()
  });
  const expiredResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: expiredHeaders
  });
  assert.equal(expiredResponse.statusCode, 401);
  assert.equal(expiredResponse.json().code, "AUTH_CONTEXT_MISSING");
  const expiredAudits = await auditLogsByRequestId(db, `req-auth-boundary-expired-${runId}`);
  assert.ok(expiredAudits.length >= 1);
  assert.equal(expiredAudits[0].result, "FAILED");
  assert.equal(expiredAudits[0].error_code, "AUTH_CONTEXT_MISSING");

  const futureHeaders = createHeaders(`req-auth-boundary-future-${runId}`, {
    issuedAt: new Date(Date.now() + 5 * 60 * 1000 + 1_000).toISOString()
  });
  const futureResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: futureHeaders
  });
  assert.equal(futureResponse.statusCode, 401);
  assert.equal(futureResponse.json().code, "AUTH_CONTEXT_MISSING");
  const futureAudits = await auditLogsByRequestId(db, `req-auth-boundary-future-${runId}`);
  assert.ok(futureAudits.length >= 1);
  assert.equal(futureAudits[0].result, "FAILED");
  assert.equal(futureAudits[0].error_code, "AUTH_CONTEXT_MISSING");

  const replayHeaders = createHeaders(`req-auth-boundary-replay-${runId}`);
  const replayFirstResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: replayHeaders
  });
  assert.equal(replayFirstResponse.statusCode, 200);
  const replaySecondResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: replayHeaders
  });
  assert.equal(replaySecondResponse.statusCode, 200);
  assert.deepEqual(replaySecondResponse.json(), replayFirstResponse.json());

  const createTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-auth-boundary-create-${runId}`, {
      roleCodes: "EXPORT_USER"
    }),
    payload: createTaskPayload(taskCode, "client-auth-boundary")
  });
  assert.equal(createTaskResponse.statusCode, 201);
  const taskId = createTaskResponse.json().data.taskId;

  const crossTenantDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`req-auth-boundary-cross-tenant-detail-${runId}`, {
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });
  assert.equal(crossTenantDetailResponse.statusCode, 403);
  assert.equal(crossTenantDetailResponse.json().code, "PERMISSION_DENIED");

  const crossTenantListResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks?taskCode=${encodeURIComponent(taskCode)}`,
    headers: createHeaders(`req-auth-boundary-cross-tenant-list-${runId}`, {
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });
  assert.equal(crossTenantListResponse.statusCode, 403);
  assert.equal(crossTenantListResponse.json().code, "PERMISSION_DENIED");
  assert.doesNotMatch(JSON.stringify(crossTenantListResponse.json()), new RegExp(taskId));

  const crossTenantDownloadResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}/download`,
    headers: createHeaders(`req-auth-boundary-cross-tenant-download-${runId}`, {
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });
  assert.equal(crossTenantDownloadResponse.statusCode, 403);
  assert.equal(crossTenantDownloadResponse.json().code, "PERMISSION_DENIED");
  assert.doesNotMatch(JSON.stringify(crossTenantDownloadResponse.json()), new RegExp(taskId));

  const crossTenantRegistryResponse = await app.inject({
    method: "GET",
    url: `/api/export/registries/${taskCode}`,
    headers: createHeaders(`req-auth-boundary-cross-tenant-registry-${runId}`, {
      operatorId: "tenant-002-admin",
      tenantId: "tenant-002",
      roleCodes: "EXPORT_ADMIN"
    })
  });
  assert.equal(crossTenantRegistryResponse.statusCode, 403);
  assert.equal(crossTenantRegistryResponse.json().code, "PERMISSION_DENIED");
  assert.doesNotMatch(JSON.stringify(crossTenantRegistryResponse.json()), new RegExp(taskCode));

  const deniedAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-cross-tenant-detail-${runId}`
  );
  assert.equal(deniedAudits.length, 1);
  assert.equal(deniedAudits[0].result, "FAILED");
  assert.equal(deniedAudits[0].error_code, "PERMISSION_DENIED");

  const crossTenantListAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-cross-tenant-list-${runId}`
  );
  assert.equal(crossTenantListAudits.length, 1);
  assert.equal(crossTenantListAudits[0].result, "FAILED");
  assert.equal(crossTenantListAudits[0].error_code, "PERMISSION_DENIED");

  const crossTenantDownloadAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-cross-tenant-download-${runId}`
  );
  assert.equal(crossTenantDownloadAudits.length, 1);
  assert.equal(crossTenantDownloadAudits[0].result, "FAILED");
  assert.equal(crossTenantDownloadAudits[0].error_code, "PERMISSION_DENIED");

  const crossTenantRegistryAudits = await auditLogsByRequestId(
    db,
    `req-auth-boundary-cross-tenant-registry-${runId}`
  );
  assert.equal(crossTenantRegistryAudits.length, 1);
  assert.equal(crossTenantRegistryAudits[0].result, "FAILED");
  assert.equal(crossTenantRegistryAudits[0].error_code, "PERMISSION_DENIED");
});

test("create task rejects queryParams above 32768 canonical JSON UTF-8 bytes before persistence", async (t) => {
  const db = await createTestDatabase(t);
  const objectStorageServer = await createLocalObjectStorageServer(t);
  const app = await createServer(t, objectStorageServer);
  const taskRepository = createExportTaskRepository(db);
  const runId = `${Date.now()}-${process.pid}-query-size`;
  const taskCode = `purchase-order-query-size-${runId}`;

  const createRegistryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`req-registry-query-size-${runId}`),
    payload: {
      ...createRegistryPayload(taskCode),
      parameterSchema: {
        type: "object",
        properties: {
          payload: { type: "string" }
        },
        required: ["payload"]
      },
      queryTemplate: {
        queryTemplateVersion: "v1",
        templateText: "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId",
        allowedParameters: ["payload"]
      }
    }
  });

  assert.equal(createRegistryResponse.statusCode, 201);

  const boundaryQueryParams = createQueryParamsWithCanonicalSize(32768);
  assert.equal(Buffer.byteLength(canonicalJson(boundaryQueryParams), "utf8"), 32768);
  const boundaryResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-query-size-boundary-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "client-query-size-boundary"),
      queryParams: boundaryQueryParams
    }
  });

  assert.equal(boundaryResponse.statusCode, 201);
  assert.equal(boundaryResponse.json().code, "SUCCESS");

  const canonicalOrderCreateResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-query-size-canonical-create-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "client-query-size-canonical"),
      queryParams: {
        z: ["last", { b: 2, a: 1 }],
        a: "first",
        payload: "tiny"
      }
    }
  });

  assert.equal(canonicalOrderCreateResponse.statusCode, 201);
  const canonicalOrderReplayResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-query-size-canonical-replay-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "client-query-size-canonical"),
      queryParams: {
        payload: "tiny",
        a: "first",
        z: ["last", { a: 1, b: 2 }]
      }
    }
  });

  assert.equal(canonicalOrderReplayResponse.statusCode, 200);
  assert.equal(
    canonicalOrderReplayResponse.json().data.taskId,
    canonicalOrderCreateResponse.json().data.taskId
  );
  assert.equal(
    canonicalOrderReplayResponse.json().data.requestDigest,
    canonicalOrderCreateResponse.json().data.requestDigest
  );

  const oversizedQueryParams = createQueryParamsWithCanonicalSize(32769);
  assert.equal(Buffer.byteLength(canonicalJson(oversizedQueryParams), "utf8"), 32769);
  const oversizedResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`req-query-size-oversized-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "client-query-size-oversized"),
      queryParams: oversizedQueryParams
    }
  });

  assert.equal(oversizedResponse.statusCode, 400);
  assert.equal(oversizedResponse.json().code, "QUERY_PARAMS_TOO_LARGE");
  assert.equal(oversizedResponse.json().data.queryParamsMaxBytes, 32768);
  assert.equal(oversizedResponse.json().data.queryParamsBytes, 32769);

  const oversizedTasks = await db
    .selectFrom("export_tasks")
    .select("task_id")
    .where("task_code", "=", taskCode)
    .where("client_request_id", "=", "client-query-size-oversized")
    .execute();
  assert.equal(oversizedTasks.length, 0);

  const oversizedIdempotencyScope =
    `tenant-001:u001:${taskCode}:client-query-size-oversized`;
  assert.equal(await taskRepository.findByIdempotencyScope(oversizedIdempotencyScope), undefined);

  const oversizedAudits = await auditLogsByRequestId(db, `req-query-size-oversized-${runId}`);
  assert.equal(oversizedAudits.length, 0);
});
