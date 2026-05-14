import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createExportAuditRepository,
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  createLeaseRepository,
  createCheckpointRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/db requires a real MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

test("DB tests require an explicit test database URL", () => {
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

test("migration exposes durable evidence tables for FR-001/005/007/010/013", async (t) => {
  const db = await createTestDatabase(t);
  const rows = await db
    .selectFrom("information_schema.tables")
    .select("TABLE_NAME as tableName")
    .where("TABLE_SCHEMA", "=", sql`DATABASE()`)
    .where("TABLE_NAME", "in", [
      "export_tasks",
      "export_task_idempotency",
      "export_registries",
      "export_registry_versions",
      "export_task_leases",
      "export_task_checkpoints",
      "export_task_files",
      "export_task_events",
      "export_audit_logs"
    ])
    .execute();

  assert.deepEqual(
    rows.map((row) => row.tableName).sort(),
    [
      "export_audit_logs",
      "export_registries",
      "export_registry_versions",
      "export_task_checkpoints",
      "export_task_events",
      "export_task_files",
      "export_task_idempotency",
      "export_task_leases",
      "export_tasks"
    ]
  );
});

test("repositories persist registry, task idempotency, lease, checkpoint, file and audit evidence", async (t) => {
  const db = await createTestDatabase(t);
  const registryRepository = createExportRegistryRepository(db);
  const taskRepository = createExportTaskRepository(db);
  const leaseRepository = createLeaseRepository(db);
  const eventRepository = createExportTaskEventRepository(db);
  const checkpointRepository = createCheckpointRepository(db);
  const fileRepository = createExportFileRepository(db);
  const auditRepository = createExportAuditRepository(db);
  const now = await getDatabaseTime(db);
  const runId = `${Date.now()}-${process.pid}`;
  const taskCode = `purchase-order-export-${runId}`;
  const taskId = `exp_${runId}`;
  const idempotencyScope = `tenant-001:u001:${taskCode}:client-001`;

  await registryRepository.upsertRegistry({
    taskCode,
    subsystemCode: "purchase",
    displayName: "Purchase Order Export",
    enabled: true,
    concurrencyLimit: 2,
    fileRetentionDays: 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: 20000,
    exportMaxRows: 100000,
    datasourceCode: "purchase-ro",
    supportedFormats: JSON.stringify(["XLSX", "CSV"]),
    parameterSchema: JSON.stringify({ type: "object", required: ["dateRange"] }),
    queryTemplate: "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId",
    fieldMappings: JSON.stringify([{ source: "order_no", target: "Order No" }]),
    maskingPolicy: JSON.stringify({ fields: ["buyer_phone"] }),
    dataScopeTemplate: "tenant_id = :tenantId",
    cursorField: "order_id",
    orderBy: "order_id ASC",
    batchSize: 500,
    configSnapshotDigest: "sha256:config-v1",
    parameterSchemaDigest: "sha256:params-v1",
    fieldMappingDigest: "sha256:fields-v1",
    maskingPolicyDigest: "sha256:masking-v1",
    now
  });

  const created = await taskRepository.createPendingTask({
    taskId,
    taskCode,
    subsystemCode: "purchase",
    tenantId: "tenant-001",
    createdBy: "u001",
    fileFormat: "XLSX",
    clientRequestId: "client-001",
    idempotencyScope,
    requestDigest: "sha256:request-v1",
    configSnapshotDigest: "sha256:config-v1",
    requestPayload: JSON.stringify({
      fileFormat: "XLSX",
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00+08:00",
        createdAtTo: "2026-05-31T23:59:59+08:00"
      }
    }),
    authContextPayload: JSON.stringify({
      operatorId: "u001",
      tenantId: "tenant-001",
      roleCodes: ["EXPORT_USER"],
      orgScope: "ORG-001",
      requestId: "req-001"
    }),
    now
  });

  const idempotent = await taskRepository.findByIdempotencyScope(
    idempotencyScope
  );

  assert.equal(created.status, "PENDING");
  assert.equal(idempotent?.taskId, taskId);
  assert.equal(idempotent?.requestDigest, "sha256:request-v1");

  const lease = await leaseRepository.acquirePendingTaskLease({
    taskId,
    lockOwner: "worker-a",
    leaseDurationSeconds: 300
  });

  assert.equal(lease?.attemptNo, 0);
  assert.equal(lease?.lockOwner, "worker-a");
  assert.equal(lease?.takeoverRule, "PENDING_OR_EXPIRED_KEEP_ATTEMPT");

  const renewedLease = await leaseRepository.renewTaskLease({
    taskId,
    attemptNo: 0,
    lockOwner: "worker-a",
    leaseDurationSeconds: 300
  });

  assert.equal(renewedLease?.lockOwner, "worker-a");
  assert.equal(renewedLease?.attemptNo, 0);
  assert.ok(renewedLease?.databaseTime instanceof Date);

  await checkpointRepository.saveCheckpoint({
    taskId,
    attemptNo: 0,
    lastCursor: "order-100",
    processedCount: 100,
    filePartNo: 1,
    retryCount: 0,
    batchSize: 500,
    batchRowCount: 100,
    backoffMs: 0,
    now
  });

  await eventRepository.appendTaskEvent({
    eventId: `event-${runId}`,
    taskId,
    attemptNo: 0,
    eventType: "QUERY_BATCH_DONE",
    requestId: "req-001",
    datasourceCode: "purchase-ro",
    queryTemplateVersion: "sha256:config-v1",
    batchCheckpoint: JSON.stringify({ lastCursor: "order-100", processedCount: 100 }),
    occurredAt: now,
    now
  });

  await fileRepository.saveFileMetadata({
    taskId,
    attemptNo: 0,
    fileName: "purchase-orders.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 1024,
    checksum: "sha256:file-v1",
    checksumAlgorithm: "SHA-256",
    tempStorageKey: "exports/tmp/file.xlsx",
    publishedStorageKey: "exports/published/file.xlsx",
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  await auditRepository.appendAuditLog({
    auditId: `audit-${runId}`,
    taskId,
    attemptNo: 0,
    taskCode,
    subsystemCode: "purchase",
    operatorId: "u001",
    action: "CREATE",
    result: "SUCCESS",
    errorCode: "OK",
    requestId: "req-001",
    occurredAt: now,
    now
  });

  const task = await taskRepository.findTaskById(taskId);
  const registry = await registryRepository.findRegistryByTaskCode(taskCode);
  const checkpoint = await checkpointRepository.findLatestCheckpoint(taskId, 0);
  const events = await eventRepository.listRecentTaskEvents(taskId);
  const file = await fileRepository.findFileMetadata(taskId, 0);
  const audits = await auditRepository.listAuditLogsForTask(taskId);

  assert.equal(task?.status, "EXECUTING");
  assert.equal(task?.lockOwner, "worker-a");
  assert.equal(
    JSON.parse(task?.requestPayload ?? "{}").queryParams.createdAtFrom,
    "2026-05-01T00:00:00+08:00"
  );
  assert.equal(JSON.parse(task?.authContextPayload ?? "{}").tenantId, "tenant-001");
  assert.equal(registry?.enabled, true);
  assert.equal(registry?.configSnapshotDigest, "sha256:config-v1");
  assert.deepEqual(JSON.parse(registry?.supportedFormats ?? "[]"), ["XLSX", "CSV"]);
  assert.equal(registry?.queryTemplate, "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId");
  assert.equal(registry?.dataScopeTemplate, "tenant_id = :tenantId");
  assert.equal(registry?.cursorField, "order_id");
  assert.equal(registry?.orderBy, "order_id ASC");
  assert.equal(registry?.batchSize, 500);
  assert.equal(checkpoint?.processedCount, 100);
  assert.deepEqual(events.map((event) => event.eventType), ["QUERY_BATCH_DONE"]);
  assert.equal(events[0]?.batchCheckpoint, JSON.stringify({ lastCursor: "order-100", processedCount: 100 }));
  assert.equal(file?.publishedStorageKey, "exports/published/file.xlsx");
  assert.deepEqual(
    audits.map((audit) => audit.action),
    ["CREATE"]
  );
});
