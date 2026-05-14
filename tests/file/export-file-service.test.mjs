import assert from "node:assert/strict";
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

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/file requires a real MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
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
      objects.set(input.storageKey, Buffer.from(input.body));
    },
    async readObject(storageKey) {
      const object = objects.get(storageKey);
      if (!object) {
        throw new Error(`missing object ${storageKey}`);
      }
      return options.corruptReads ? Buffer.from("corrupted") : Buffer.from(object);
    },
    async publishObject(input) {
      publishes.push(input);
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
