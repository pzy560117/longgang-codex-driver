import assert from "node:assert/strict";
import test, { describe } from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createExportAuditRepository,
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";
import { createSchedulerWorker } from "../../src/scheduler/worker.ts";
import { createCleanupJob } from "../../src/cleanup-job/index.ts";

function serialTest(name, fn) {
  return test(name, { concurrency: false }, fn);
}

describe("worker integration tests", { concurrency: false }, () => {

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/worker requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

serialTest("worker tests require an explicit test database URL", () => {
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

async function seedRegistry(db, overrides = {}) {
  const now = await getDatabaseTime(db);
  const runId = overrides.runId ?? `${Date.now()}-${process.pid}-${Math.random()}`;
  const taskCode = overrides.taskCode ?? `purchase-order-export-${runId}`;
  const subsystemCode = overrides.subsystemCode ?? `purchase-${runId}`;

  await createExportRegistryRepository(db).upsertRegistry({
    taskCode,
    subsystemCode,
    displayName: "Purchase Order Export",
    enabled: true,
    concurrencyLimit: overrides.concurrencyLimit ?? 1,
    fileRetentionDays: 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: 20000,
    exportMaxRows: 100000,
    datasourceCode: "purchase-ro",
    supportedFormats: JSON.stringify(["XLSX"]),
    parameterSchema: JSON.stringify({ type: "object" }),
    queryTemplate: "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId",
    fieldMappings: JSON.stringify([{ source: "order_no", target: "Order No" }]),
    maskingPolicy: JSON.stringify({ fields: [] }),
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

  return { taskCode, subsystemCode, runId };
}

async function seedTask(db, input) {
  const now = await getDatabaseTime(db);
  const registry =
    input.configSnapshot ??
    (await createExportRegistryRepository(db).findRegistryByTaskCode(input.taskCode));
  return createExportTaskRepository(db).createPendingTask({
    taskId: input.taskId,
    taskCode: input.taskCode,
    subsystemCode: input.subsystemCode ?? "purchase",
    tenantId: "tenant-001",
    createdBy: "u001",
    fileFormat: "XLSX",
    clientRequestId: null,
    idempotencyScope: null,
    requestDigest: `sha256:${input.taskId}`,
    configSnapshotDigest: input.configSnapshotDigest ?? "sha256:config-v1",
    requestPayload: JSON.stringify(
      input.requestPayload ?? {
        fileFormat: "XLSX",
        configSnapshot: registry ?? undefined,
        queryParams: {
          createdAtFrom: "2026-05-01T00:00:00+08:00",
          createdAtTo: "2026-05-31T23:59:59+08:00"
        }
      }
    ),
    authContextPayload: JSON.stringify({
      operatorId: "u001",
      tenantId: "tenant-001",
      roleCodes: ["EXPORT_USER"],
      orgScope: "ORG-001,ORG-002",
      requestId: "req-worker-001"
    }),
    now
  });
}

function batchResult(lastCursor, processedCount) {
  return {
    checkpoint: {
      lastCursor,
      processedCount,
      filePartNo: 1,
      retryCount: 0,
      batchSize: 500,
      batchRowCount: processedCount,
      backoffMs: 0
    },
    outcome: "continue"
  };
}

serialTest("multiple workers dispatch only up to the registry concurrency limit and write audit/checkpoint evidence", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskA = `exp-worker-${runId}-a`;
  const taskB = `exp-worker-${runId}-b`;

  await seedTask(db, { taskId: taskA, taskCode, subsystemCode });
  await seedTask(db, { taskId: taskB, taskCode, subsystemCode });

  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-100", 100)
  });
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-200", 200)
  });

  const resultA = await workerA.pollAndProcessOnce();
  const resultB = await workerB.pollAndProcessOnce();

  assert.equal(resultA.dispatched + resultB.dispatched, 1);

  const tasks = await createExportTaskRepository(db).listTasks({
    taskCode,
    limit: 10
  });
  assert.equal(tasks.filter((task) => task.status === "EXECUTING").length, 1);
  assert.equal(tasks.filter((task) => task.status === "PENDING").length, 1);

  const executing = tasks.find((task) => task.status === "EXECUTING");
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(
    executing.taskId
  );
  const checkpoint = await db
    .selectFrom("export_task_checkpoints")
    .selectAll()
    .where("task_id", "=", executing.taskId)
    .where("attempt_no", "=", executing.attemptNo)
    .executeTakeFirst();

  assert.deepEqual(
    [...audits.map((audit) => audit.action)].sort(),
    ["DISPATCH", "EXECUTE_START"]
  );
  assert.equal(audits.every((audit) => audit.requestId === "scheduler:worker-a" || audit.requestId === "scheduler:worker-b"), true);
  assert.ok([100, 200].includes(Number(checkpoint.processed_count)));
});

serialTest("same worker resumes its own active lease while other workers still cannot acquire an unexpired lease", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-worker-${Date.now()}-resume`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  const checkpoints = [];
  let batchCallCount = 0;
  let publishedRows;
  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async ({ checkpoint }) => {
      checkpoints.push(checkpoint ?? null);
      batchCallCount += 1;
      if (batchCallCount === 1) {
        return batchResult("order-100", 100);
      }
      return {
        checkpoint: {
          lastCursor: "order-200",
          processedCount: 200,
          filePartNo: 1,
          retryCount: 0,
          batchSize: 500,
          batchRowCount: 100,
          backoffMs: 0
        },
        outcome: "completed",
        rows: [{ "Order No": "PO-200" }]
      };
    },
    fileService: {
      async publishRows(input) {
        publishedRows = input.rows;
        return {
          storageKey: "exports/published/po.xlsx"
        };
      }
    }
  });
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-999", 999)
  });

  const firstPoll = await workerA.pollAndProcessOnce();
  const blockedOtherWorker = await workerB.pollAndProcessOnce();
  const secondPoll = await workerA.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const leaseEvidence = await db
    .selectFrom("export_task_leases")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .executeTakeFirst();

  assert.equal(firstPoll.dispatched, 1);
  assert.equal(firstPoll.renewed, 1);
  assert.equal(blockedOtherWorker.dispatched, 0);
  assert.equal(secondPoll.dispatched, 1);
  assert.equal(secondPoll.completed, 1);
  assert.equal(task.status, "COMPLETED");
  assert.equal(task.lockOwner, null);
  assert.equal(batchCallCount, 2);
  assert.equal(checkpoints[0], null);
  assert.equal(checkpoints[1].lastCursor, "order-100");
  assert.deepEqual(publishedRows, [{ "Order No": "PO-200" }]);
  assert.equal(leaseEvidence.lock_owner, "worker-a");
  assert.equal(leaseEvidence.previous_lock_owner, null);
  assert.equal(leaseEvidence.takeover_rule, "ACTIVE_LEASE_RESUME_SAME_OWNER");
});

serialTest("expired worker does not write EXECUTE_SUCCESS after a new owner takes over during publish", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-worker-${runId}-publish-race`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  let takeoverResult;
  let oldWorkerPublishCount = 0;
  let newWorkerPublishCount = 0;
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => ({
      checkpoint: {
        lastCursor: "order-200",
        processedCount: 200,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 200,
        backoffMs: 0
      },
      outcome: "completed",
      rows: [{ "Order No": "PO-200" }]
    }),
    fileService: {
      async publishRows() {
        newWorkerPublishCount += 1;
        return {
          storageKey: "exports/published/new-owner.xlsx"
        };
      }
    }
  });
  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 1,
    maxTasksPerPoll: 1,
    batchProcessor: async () => ({
      checkpoint: {
        lastCursor: "order-100",
        processedCount: 100,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 100,
        backoffMs: 0
      },
      outcome: "completed",
      rows: [{ "Order No": "PO-100" }]
    }),
    fileService: {
      async publishRows() {
        oldWorkerPublishCount += 1;
        await db
          .updateTable("export_tasks")
          .set({
            lock_expire_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)`
          })
          .where("task_id", "=", taskId)
          .execute();
        takeoverResult = await workerB.pollAndProcessOnce();
        return {
          storageKey: "exports/published/old-owner.xlsx"
        };
      }
    }
  });

  const oldWorkerResult = await workerA.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(oldWorkerResult.completed, 0);
  assert.equal(oldWorkerResult.failed, 0);
  assert.equal(oldWorkerPublishCount, 1);
  assert.equal(newWorkerPublishCount, 1);
  assert.equal(takeoverResult.dispatched, 1);
  assert.equal(takeoverResult.completed, 1);
  assert.equal(task.status, "COMPLETED");
  assert.equal(task.lockOwner, null);
  assert.deepEqual(
    audits.filter((audit) => audit.action === "EXECUTE_SUCCESS").map((audit) => audit.requestId),
    ["scheduler:worker-b"]
  );
  assert.equal(
    audits.some(
      (audit) =>
        audit.requestId === "scheduler:worker-a" &&
        ["EXECUTE_SUCCESS", "EXECUTE_FAILED"].includes(audit.action)
    ),
    false
  );
});

serialTest("subsystem concurrency limit is enforced across different task codes", async (t) => {
  const db = await createTestDatabase(t);
  const runId = `${Date.now()}-${process.pid}-${Math.random()}`;
  const subsystemCode = `purchase-shared-${runId}`;
  const firstTaskCode = `purchase-order-export-a-${runId}`;
  const secondTaskCode = `purchase-order-export-b-${runId}`;

  await seedRegistry(db, {
    runId,
    taskCode: firstTaskCode,
    subsystemCode,
    concurrencyLimit: 1
  });
  await seedRegistry(db, {
    runId,
    taskCode: secondTaskCode,
    subsystemCode,
    concurrencyLimit: 1
  });
  await seedTask(db, {
    taskId: `exp-worker-${runId}-cross-a`,
    taskCode: firstTaskCode,
    subsystemCode
  });
  await seedTask(db, {
    taskId: `exp-worker-${runId}-cross-b`,
    taskCode: secondTaskCode,
    subsystemCode
  });

  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-cross-a", 100)
  });
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-cross-b", 200)
  });

  const [resultA, resultB] = await Promise.all([
    workerA.pollAndProcessOnce(),
    workerB.pollAndProcessOnce()
  ]);
  const tasks = await createExportTaskRepository(db).listTasks({
    subsystemCode,
    limit: 10
  });

  assert.equal(resultA.dispatched + resultB.dispatched, 1);
  assert.equal(tasks.filter((task) => task.status === "EXECUTING").length, 1);
  assert.equal(tasks.filter((task) => task.status === "PENDING").length, 1);
});

serialTest("expired lease takeover keeps attemptNo and resumes from the latest checkpoint", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-worker-${runId}-takeover`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 1,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-100", 100)
  });

  await workerA.pollAndProcessOnce();
  await db
    .updateTable("export_tasks")
    .set({
      lock_expire_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)`
    })
    .where("task_id", "=", taskId)
    .execute();

  let resumedCheckpoint;
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async ({ checkpoint }) => {
      resumedCheckpoint = checkpoint;
      return batchResult("order-200", 200);
    }
  });

  const result = await workerB.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const leaseEvidence = await db
    .selectFrom("export_task_leases")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .executeTakeFirst();

  assert.equal(result.dispatched, 1);
  assert.equal(task.attemptNo, 0);
  assert.equal(task.lockOwner, "worker-b");
  assert.equal(leaseEvidence.previous_lock_owner, "worker-a");
  assert.equal(resumedCheckpoint.lastCursor, "order-100");
});

serialTest("task snapshot still dispatches and publishes after the current registry is disabled and updated", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-snap-${Date.now()}`;
  const registryAtCreate = await createExportRegistryRepository(db).findRegistryByTaskCode(taskCode);

  await seedTask(db, {
    taskId,
    taskCode,
    subsystemCode,
    requestPayload: {
      fileFormat: "XLSX",
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00+08:00",
        createdAtTo: "2026-05-31T23:59:59+08:00"
      },
      configSnapshot: registryAtCreate
    },
    configSnapshotDigest: registryAtCreate.configSnapshotDigest
  });

  const now = await getDatabaseTime(db);
  await createExportRegistryRepository(db).upsertRegistry({
    taskCode,
    subsystemCode,
    displayName: "Purchase Order Export Updated",
    enabled: false,
    concurrencyLimit: 5,
    fileRetentionDays: 14,
    taskHistoryRetentionDays: 60,
    singleFileMaxRows: 1000,
    exportMaxRows: 5000,
    datasourceCode: "purchase-ro-updated",
    supportedFormats: JSON.stringify(["CSV"]),
    parameterSchema: JSON.stringify({ type: "object", properties: { changed: { type: "string" } } }),
    queryTemplate: "SELECT changed FROM broken_registry",
    fieldMappings: JSON.stringify([{ source: "changed", target: "Changed" }]),
    maskingPolicy: JSON.stringify({ fields: ["changed"] }),
    dataScopeTemplate: "changed = 1",
    cursorField: "changed",
    orderBy: "changed DESC",
    batchSize: 50,
    configSnapshotDigest: "sha256:config-v2",
    parameterSchemaDigest: "sha256:params-v2",
    fieldMappingDigest: "sha256:fields-v2",
    maskingPolicyDigest: "sha256:masking-v2",
    now
  });

  let publishedRegistry;
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-snapshot",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => ({
      checkpoint: {
        lastCursor: "order-snapshot-finished",
        processedCount: 1,
        filePartNo: 1,
        retryCount: 0,
        batchSize: 500,
        batchRowCount: 1,
        backoffMs: 0
      },
      outcome: "completed",
      rows: [{ "Order No": "PO-SNAPSHOT" }]
    }),
    fileService: {
      async publishRows(input) {
        publishedRegistry = input.registry;
        return { storageKey: "exports/published/snapshot-disabled.xlsx" };
      }
    }
  });

  const result = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);

  assert.equal(result.dispatched, 1);
  assert.equal(result.completed, 1);
  assert.equal(task.status, "COMPLETED");
  assert.equal(publishedRegistry.configSnapshotDigest, registryAtCreate.configSnapshotDigest);
  assert.equal(publishedRegistry.enabled, true);
  assert.equal(publishedRegistry.datasourceCode, "purchase-ro");
  assert.equal(publishedRegistry.singleFileMaxRows, 20000);
});

serialTest("expired worker does not mark FAILED or overwrite the new owner after takeover", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-worker-${runId}-failure-race`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  let takeoverResult;
  const workerB = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-200", 200)
  });
  const workerA = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 1,
    maxTasksPerPoll: 1,
    batchProcessor: async () => {
      await db
        .updateTable("export_tasks")
        .set({
          lock_expire_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)`
        })
        .where("task_id", "=", taskId)
        .execute();
      takeoverResult = await workerB.pollAndProcessOnce();
      throw new Error("late failure after lease takeover");
    }
  });

  const oldWorkerResult = await workerA.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(oldWorkerResult.failed, 0);
  assert.equal(takeoverResult.dispatched, 1);
  assert.equal(takeoverResult.renewed, 1);
  assert.equal(task.status, "EXECUTING");
  assert.equal(task.lockOwner, "worker-b");
  assert.equal(
    audits.some(
      (audit) =>
        audit.requestId === "scheduler:worker-a" &&
        ["EXECUTE_SUCCESS", "EXECUTE_FAILED"].includes(audit.action)
    ),
    false
  );
});

serialTest("executing cancel request is closed at the next persisted batch boundary", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-cancel-${Date.now()}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async ({ task, lease }) => {
      const now = await getDatabaseTime(db);
      await createExportAuditRepository(db).appendAuditLog({
        auditId: `audit-cancel-${runId}`,
        taskId: task.taskId,
        attemptNo: lease.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode,
        operatorId: task.createdBy,
        action: "CANCEL_REQUEST",
        result: "ACCEPTED",
        errorCode: "SUCCESS",
        requestId: "req-cancel-001",
        occurredAt: now,
        now
      });
      return batchResult("order-100", 100);
    }
  });

  const result = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(result.canceled, 1);
  assert.equal(task.status, "CANCELED");
  assert.equal(task.lockOwner, null);
  assert.deepEqual(
    [...audits.map((audit) => audit.action)].sort(),
    ["CANCEL_DONE", "CANCEL_REQUEST", "DISPATCH", "EXECUTE_START"]
  );
});

serialTest("failed execution is retried only after FAILED and increments attemptNo before redispatch", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-worker-${runId}-retry`;
  await seedTask(db, { taskId, taskCode, subsystemCode });
  const repository = createExportTaskRepository(db);

  assert.equal(await repository.retryFailedTask({ taskId, now: await getDatabaseTime(db) }), undefined);

  const failingWorker = createSchedulerWorker({
    db,
    workerId: "worker-a",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => {
      throw new Error("query failed");
    }
  });

  const failedResult = await failingWorker.pollAndProcessOnce();
  const failed = await repository.findTaskById(taskId);
  assert.equal(failedResult.failed, 1);
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.attemptNo, 0);

  const retried = await repository.retryFailedTask({
    taskId,
    now: await getDatabaseTime(db)
  });

  assert.equal(retried.status, "PENDING");
  assert.equal(retried.attemptNo, 1);

  const retryWorker = createSchedulerWorker({
    db,
    workerId: "worker-b",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    batchProcessor: async () => batchResult("order-retry", 50)
  });

  const retryResult = await retryWorker.pollAndProcessOnce();
  const executing = await repository.findTaskById(taskId);

  assert.equal(retryResult.dispatched, 1);
  assert.equal(executing.status, "EXECUTING");
  assert.equal(executing.attemptNo, 1);
  assert.equal(executing.lockOwner, "worker-b");
});

serialTest("query batch transient failure persists retry checkpoint and completes on the next poll", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-retry-ok-${Date.now()}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });
  let calls = 0;

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-retry",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 2,
    queryBatchBackoffBaseMs: 25,
    batchProcessor: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("temporary datasource timeout");
        error.name = "QUERY_EXECUTION_ERROR";
        throw error;
      }
      return {
        checkpoint: {
          lastCursor: "order-retry-success",
          processedCount: 10,
          filePartNo: 1,
          retryCount: 1,
          batchSize: 500,
          batchRowCount: 10,
          backoffMs: 25
        },
        outcome: "completed",
        rows: [{ "Order No": "PO-RETRY" }]
      };
    },
    fileService: {
      async publishRows() {
        return { storageKey: "exports/published/retry.xlsx" };
      }
    }
  });

  const firstPoll = await worker.pollAndProcessOnce();
  const checkpointAfterFailure = await db
    .selectFrom("export_task_checkpoints")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .executeTakeFirst();
  await db
    .updateTable("export_task_checkpoints")
    .set({
      updated_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 SECOND)`
    })
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .execute();
  const secondPoll = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);

  assert.equal(firstPoll.failed, 0);
  assert.equal(firstPoll.renewed, 1);
  assert.equal(checkpointAfterFailure.retry_count, 1);
  assert.equal(checkpointAfterFailure.backoff_ms, 25);
  assert.equal(secondPoll.completed, 1);
  assert.equal(task.status, "COMPLETED");
});

serialTest("query batch transient failure does not retry again before checkpoint backoff elapses", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-retry-backoff-wait-${runId}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });
  let calls = 0;

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-retry-wait",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 2,
    queryBatchBackoffBaseMs: 60_000,
    batchProcessor: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("temporary datasource timeout");
        error.name = "QUERY_EXECUTION_ERROR";
        throw error;
      }
      return {
        checkpoint: {
          lastCursor: "order-retry-success",
          processedCount: 10,
          filePartNo: 1,
          retryCount: 1,
          batchSize: 500,
          batchRowCount: 10,
          backoffMs: 60_000
        },
        outcome: "completed",
        rows: [{ "Order No": "PO-RETRY" }]
      };
    },
    fileService: {
      async publishRows() {
        return { storageKey: "exports/published/retry-wait.xlsx" };
      }
    }
  });

  const firstPoll = await worker.pollAndProcessOnce();
  const secondPoll = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const checkpoint = await db
    .selectFrom("export_task_checkpoints")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .executeTakeFirst();

  assert.equal(firstPoll.renewed, 1);
  assert.equal(secondPoll.dispatched, 0);
  assert.equal(secondPoll.completed, 0);
  assert.equal(secondPoll.failed, 0);
  assert.equal(calls, 1);
  assert.equal(task.status, "EXECUTING");
  assert.equal(task.lockOwner, "worker-retry-wait");
  assert.equal(checkpoint.retry_count, 1);
  assert.equal(checkpoint.backoff_ms, 60000);
});

serialTest("query batch retry resumes only after checkpoint backoff elapses", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-retry-backoff-ready-${runId}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });
  let calls = 0;

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-retry-ready",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 2,
    queryBatchBackoffBaseMs: 1000,
    batchProcessor: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error("temporary datasource timeout");
        error.name = "QUERY_EXECUTION_ERROR";
        throw error;
      }
      return {
        checkpoint: {
          lastCursor: "order-retry-ready",
          processedCount: 10,
          filePartNo: 1,
          retryCount: 1,
          batchSize: 500,
          batchRowCount: 10,
          backoffMs: 1000
        },
        outcome: "completed",
        rows: [{ "Order No": "PO-RETRY-READY" }]
      };
    },
    fileService: {
      async publishRows() {
        return { storageKey: "exports/published/retry-ready.xlsx" };
      }
    }
  });

  const firstPoll = await worker.pollAndProcessOnce();
  await db
    .updateTable("export_task_checkpoints")
    .set({
      updated_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 SECOND)`
    })
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .execute();
  const secondPoll = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);

  assert.equal(firstPoll.renewed, 1);
  assert.equal(secondPoll.dispatched, 1);
  assert.equal(secondPoll.completed, 1);
  assert.equal(calls, 2);
  assert.equal(task.status, "COMPLETED");
});

serialTest("query batch retry exhaustion fails with QUERY_EXECUTION_ERROR and persists the exhausted retry count", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-retry-no-${Date.now()}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-retry-exhausted",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 1,
    queryBatchBackoffBaseMs: 1000,
    batchProcessor: async () => {
      const error = new Error("query still unavailable");
      error.name = "QUERY_EXECUTION_ERROR";
      throw error;
    }
  });

  const firstPoll = await worker.pollAndProcessOnce();
  await db
    .updateTable("export_task_checkpoints")
    .set({
      updated_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 2 SECOND)`
    })
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .execute();
  const secondPoll = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const checkpoint = await db
    .selectFrom("export_task_checkpoints")
    .selectAll()
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .executeTakeFirst();
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(firstPoll.failed, 0);
  assert.equal(firstPoll.renewed, 1);
  assert.equal(secondPoll.failed, 1);
  assert.equal(task.status, "FAILED");
  assert.equal(checkpoint.retry_count, 1);
  assert.equal(checkpoint.backoff_ms, 1000);
  assert.ok(
    audits.some(
      (audit) => audit.action === "EXECUTE_FAILED" && audit.errorCode === "QUERY_EXECUTION_ERROR"
    )
  );
});

serialTest("query batch retry exhaustion waits for backoff before the terminal failed retry attempt", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-retry-exh-${Date.now()}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });
  let calls = 0;

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-retry-exhausted-backoff",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 1,
    queryBatchBackoffBaseMs: 60_000,
    batchProcessor: async () => {
      calls += 1;
      const error = new Error("query still unavailable");
      error.name = "QUERY_EXECUTION_ERROR";
      throw error;
    }
  });

  const firstPoll = await worker.pollAndProcessOnce();
  const prematurePoll = await worker.pollAndProcessOnce();
  const callsAfterPrematurePoll = calls;
  await db
    .updateTable("export_task_checkpoints")
    .set({
      updated_at: sql`DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 61 SECOND)`
    })
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", 0)
    .execute();
  const finalPoll = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(firstPoll.renewed, 1);
  assert.equal(prematurePoll.dispatched, 0);
  assert.equal(prematurePoll.failed, 0);
  assert.equal(callsAfterPrematurePoll, 1);
  assert.equal(finalPoll.dispatched, 1);
  assert.equal(finalPoll.failed, 1);
  assert.equal(calls, 2);
  assert.equal(task.status, "FAILED");
  assert.ok(
    audits.some(
      (audit) => audit.action === "EXECUTE_FAILED" && audit.errorCode === "QUERY_EXECUTION_ERROR"
    )
  );
});

serialTest("datasource unavailable errors finish as DATASOURCE_UNAVAILABLE after retry exhaustion", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = `exp-ds-down-${Date.now()}`;
  await seedTask(db, { taskId, taskCode, subsystemCode });

  const worker = createSchedulerWorker({
    db,
    workerId: "worker-datasource-unavailable",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    maxQueryBatchRetries: 0,
    batchProcessor: async () => {
      const error = new Error("credential unavailable");
      error.name = "DATASOURCE_UNAVAILABLE";
      throw error;
    }
  });

  const result = await worker.pollAndProcessOnce();
  const task = await createExportTaskRepository(db).findTaskById(taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);

  assert.equal(result.failed, 1);
  assert.equal(task.status, "FAILED");
  assert.ok(
    audits.some(
      (audit) =>
        audit.action === "EXECUTE_FAILED" && audit.errorCode === "DATASOURCE_UNAVAILABLE"
    )
  );
});

serialTest("cleanup job poll once records task event and audit after successful object deletion", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = "cleanup-success-01";
  const task = await seedTask(db, { taskId, taskCode, subsystemCode });
  const now = await getDatabaseTime(db);

  await createExportTaskRepository(db).updateTaskStatus({
    taskId,
    status: "COMPLETED",
    now
  });
  await createExportFileRepository(db).saveFileMetadata({
    taskId,
    attemptNo: 0,
    fileName: "cleanup.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 1024,
    checksum: "sha256:cleanup",
    checksumAlgorithm: "SHA-256",
    tempStorageKey: "exports/tmp/cleanup.xlsx",
    publishedStorageKey: "exports/published/cleanup.xlsx",
    expiresAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const deletes = [];
  const cleanupJob = createCleanupJob({
    db,
    workerId: "cleanup-worker",
    storage: {
      async deleteObject(storageKey) {
        deletes.push(storageKey);
      }
    }
  });

  const result = await cleanupJob.pollOnce();
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(taskId);

  assert.equal(result.scanned, 1);
  assert.equal(result.deleted, 1);
  assert.equal(result.retried, 0);
  assert.deepEqual(deletes, ["exports/published/cleanup.xlsx", "exports/tmp/cleanup.xlsx"]);
  assert.ok(audits.some((audit) => audit.action === "EXPIRE_MARK" && audit.result === "SUCCESS"));
  assert.ok(events.some((event) => event.eventType === "FILE_CLEANUP_DONE"));
  assert.equal(task.taskCode, taskCode);
});

serialTest("cleanup job poll once records retry audit and does not mark cleanup done when delete fails", async (t) => {
  const db = await createTestDatabase(t);
  const { taskCode, subsystemCode, runId } = await seedRegistry(db, { concurrencyLimit: 1 });
  const taskId = "cleanup-failed-01";

  await seedTask(db, { taskId, taskCode, subsystemCode });
  const now = await getDatabaseTime(db);

  await createExportTaskRepository(db).updateTaskStatus({
    taskId,
    status: "COMPLETED",
    now
  });
  await createExportFileRepository(db).saveFileMetadata({
    taskId,
    attemptNo: 0,
    fileName: "cleanup.xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    fileSize: 1024,
    checksum: "sha256:cleanup",
    checksumAlgorithm: "SHA-256",
    tempStorageKey: "exports/tmp/cleanup.xlsx",
    publishedStorageKey: "exports/published/cleanup.xlsx",
    expiresAt: new Date(now.getTime() - 60_000),
    publishedAt: now,
    deliveryReadyAt: now,
    checksumVerifiedAt: now,
    now
  });

  const cleanupJob = createCleanupJob({
    db,
    workerId: "cleanup-worker",
    storage: {
      async deleteObject() {
        const error = new Error("delete failed");
        error.name = "UnexpectedStorageVendorError";
        throw error;
      }
    }
  });

  const result = await cleanupJob.pollOnce();
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(taskId);
  const metadata = await createExportFileRepository(db).findFileMetadata(taskId, 0);

  assert.equal(result.scanned, 1);
  assert.equal(result.deleted, 0);
  assert.equal(result.retried, 1);
  assert.ok(
    audits.some(
      (audit) =>
        audit.action === "CLEANUP_FAILED" &&
        audit.result === "FAILED" &&
        audit.errorCode === "FILE_CLEANUP_DELETE_ERROR"
    )
  );
  assert.ok(events.some((event) => event.eventType === "FILE_CLEANUP_RETRY"));
  assert.ok(!events.some((event) => event.eventType === "FILE_CLEANUP_DONE"));
  assert.equal(metadata.publishedStorageKey, "exports/published/cleanup.xlsx");
  assert.equal(metadata.tempStorageKey, "exports/tmp/cleanup.xlsx");
});

});
