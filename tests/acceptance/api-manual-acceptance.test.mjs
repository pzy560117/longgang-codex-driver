import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { createExportPlatformServer } from "../../src/server.ts";
import { runMigrations } from "../../src/db/migrator.ts";

const downloadSigningSecret = `acceptance-download-${randomUUID()}`;
const authContextSigningSecret = `acceptance-auth-${randomUUID()}`;

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: acceptance tests require EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }
  return databaseUrl;
}

function withAcceptanceEnv() {
  const previous = {
    databaseUrl: process.env.EXPORT_PLATFORM_DATABASE_URL,
    objectStorageEndpoint: process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT,
    objectStorageBucket: process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET,
    downloadSigningSecret: process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET,
    authContextSigningSecret: process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET,
    registryAdminTenantIds: process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS
  };

  process.env.EXPORT_PLATFORM_DATABASE_URL = getTestDatabaseUrl();
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT =
    process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT ?? "https://oss.acceptance.test";
  process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET =
    process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET ?? "export-platform-acceptance";
  process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET = downloadSigningSecret;
  process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET = authContextSigningSecret;
  process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS = "tenant-001";

  return () => {
    restoreEnv("EXPORT_PLATFORM_DATABASE_URL", previous.databaseUrl);
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT", previous.objectStorageEndpoint);
    restoreEnv("EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET", previous.objectStorageBucket);
    restoreEnv("EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET", previous.downloadSigningSecret);
    restoreEnv("EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET", previous.authContextSigningSecret);
    restoreEnv("EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS", previous.registryAdminTenantIds);
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function createAcceptanceHarness(t) {
  const restoreEnv = withAcceptanceEnv();
  const pool = mysql.createPool(getTestDatabaseUrl());
  const db = new Kysely({
    dialect: new MysqlDialect({ pool })
  });
  const app = createExportPlatformServer();

  t.after(async () => {
    await app.close();
    await db.destroy();
    restoreEnv();
  });

  await runMigrations(db);
  return { app, db };
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

function createRegistryPayload(taskCode, subsystemCode = "purchase") {
  return {
    taskCode,
    subsystemCode,
    displayName: "Acceptance Purchase Order Export",
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

function createTaskPayload(taskCode, clientRequestId = "acceptance-client-001") {
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

test("manual acceptance API flow creates, replays, lists, cancels, and audits tasks", async (t) => {
  const { app, db } = await createAcceptanceHarness(t);
  const runId = randomUUID();
  const taskCode = `acceptance-export-${runId}`;

  const registryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`acceptance-registry-${runId}`),
    payload: createRegistryPayload(taskCode)
  });

  assert.equal(registryResponse.statusCode, 201);
  assert.equal(registryResponse.json().data.taskCode, taskCode);

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-create-${runId}`),
    payload: createTaskPayload(taskCode)
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.json().code, "SUCCESS");
  assert.equal(createResponse.json().data.status, "PENDING");
  assert.equal(createResponse.json().data.createdBy, "u001");
  assert.equal(createResponse.json().data.tenantId, "tenant-001");
  const taskId = createResponse.json().data.taskId;
  assert.match(taskId, /^exp_/);

  const createAudits = await auditLogsByRequestId(db, `acceptance-create-${runId}`);
  assert.equal(createAudits.length, 1);
  assert.equal(createAudits[0].result, "SUCCESS");
  assert.equal(createAudits[0].task_id, taskId);

  const replayResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-replay-${runId}`),
    payload: createTaskPayload(taskCode)
  });

  assert.equal(replayResponse.statusCode, 200);
  assert.equal(replayResponse.json().data.taskId, taskId);

  const conflictResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-conflict-${runId}`),
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
  const conflictAudits = await auditLogsByRequestId(db, `acceptance-conflict-${runId}`);
  assert.equal(conflictAudits.length, 1);
  assert.equal(conflictAudits[0].result, "FAILED");
  assert.equal(conflictAudits[0].error_code, "IDEMPOTENCY_CONFLICT");

  const detailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`acceptance-detail-${runId}`)
  });

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.json().data.taskId, taskId);
  assert.equal(detailResponse.json().data.status, "PENDING");
  assert.equal(detailResponse.json().data.totalCount, 0);
  assert.equal(detailResponse.json().data.processedCount, 0);
  assert.equal(detailResponse.json().data.progressPercent, 0);
  assert.equal(detailResponse.json().data.errorMessage, null);
  assert.equal("events" in detailResponse.json().data, false);

  const listResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks?taskCode=${encodeURIComponent(taskCode)}&page=1&pageSize=1`,
    headers: createHeaders(`acceptance-list-${runId}`)
  });

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listResponse.json().data.total, 1);
  assert.equal(listResponse.json().data.items.length, 1);
  assert.equal(listResponse.json().data.items[0].taskId, taskId);

  const cancelResponse = await app.inject({
    method: "POST",
    url: `/api/export/tasks/${taskId}/cancel`,
    headers: createHeaders(`acceptance-cancel-${runId}`)
  });

  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(cancelResponse.json().data.status, "CANCELED");

  const canceledDetailResponse = await app.inject({
    method: "GET",
    url: `/api/export/tasks/${taskId}`,
    headers: createHeaders(`acceptance-canceled-detail-${runId}`)
  });

  assert.equal(canceledDetailResponse.statusCode, 200);
  assert.equal(canceledDetailResponse.json().data.status, "CANCELED");
});

test("manual acceptance API rejects unsigned, unauthorized, and invalid create requests safely", async (t) => {
  const { app, db } = await createAcceptanceHarness(t);
  const runId = randomUUID();
  const taskCode = `acceptance-negative-${runId}`;

  const registryResponse = await app.inject({
    method: "POST",
    url: "/api/export/registries",
    headers: createHeaders(`acceptance-negative-registry-${runId}`),
    payload: createRegistryPayload(taskCode)
  });
  assert.equal(registryResponse.statusCode, 201);

  const unsignedHeaders = createHeaders(`acceptance-unsigned-${runId}`);
  delete unsignedHeaders["x-auth-context-signature"];
  const unsignedResponse = await app.inject({
    method: "GET",
    url: "/api/export/tasks",
    headers: unsignedHeaders
  });

  assert.equal(unsignedResponse.statusCode, 401);
  assert.equal(unsignedResponse.json().code, "AUTH_CONTEXT_MISSING");
  assert.doesNotMatch(JSON.stringify(unsignedResponse.json()), /secret|password|SELECT|oss:\/\//i);

  const unsupportedFormatResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-unsupported-format-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "acceptance-unsupported-format"),
      fileFormat: "CSV"
    }
  });

  assert.equal(unsupportedFormatResponse.statusCode, 400);
  assert.equal(unsupportedFormatResponse.json().code, "QUERY_TEMPLATE_INVALID");
  assert.doesNotMatch(
    JSON.stringify(unsupportedFormatResponse.json()),
    /secret|password|SELECT|oss:\/\//i
  );

  const missingParamsResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-missing-params-${runId}`),
    payload: {
      ...createTaskPayload(taskCode, "acceptance-missing-params"),
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00+08:00"
      }
    }
  });

  assert.equal(missingParamsResponse.statusCode, 400);
  assert.equal(missingParamsResponse.json().code, "QUERY_TEMPLATE_INVALID");

  const disabledResponse = await app.inject({
    method: "POST",
    url: `/api/export/registries/${taskCode}/disable`,
    headers: createHeaders(`acceptance-disable-${runId}`)
  });
  assert.equal(disabledResponse.statusCode, 200);

  const disabledTaskResponse = await app.inject({
    method: "POST",
    url: "/api/export/tasks",
    headers: createHeaders(`acceptance-disabled-create-${runId}`),
    payload: createTaskPayload(taskCode, "acceptance-disabled")
  });

  assert.equal(disabledTaskResponse.statusCode, 400);
  assert.equal(disabledTaskResponse.json().code, "TASK_DISABLED");
  const disabledAudits = await auditLogsByRequestId(db, `acceptance-disabled-create-${runId}`);
  assert.equal(disabledAudits.length, 1);
  assert.equal(disabledAudits[0].result, "FAILED");
  assert.equal(disabledAudits[0].error_code, "TASK_DISABLED");
});
