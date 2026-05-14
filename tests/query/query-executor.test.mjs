import assert from "node:assert/strict";
import test from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";
import { createQueryExecutorBatchProcessor } from "../../src/query-executor/index.ts";

function parseCursorToken(lastCursor) {
  return JSON.parse(lastCursor);
}

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/query requires a real MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

test("query tests require an explicit test database URL", () => {
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
  await db.schema
    .createTable("purchase_orders")
    .ifNotExists()
    .addColumn("order_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("tenant_id", "varchar(128)", (column) => column.notNull())
    .addColumn("org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("order_no", "varchar(128)", (column) => column.notNull())
    .addColumn("order_status", "varchar(64)", (column) => column.notNull())
    .addColumn("supplier_id", "varchar(128)", (column) => column.notNull())
    .addColumn("purchase_org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("contact_phone", "varchar(64)", (column) => column.notNull())
    .addColumn("keyword_text", "varchar(255)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) => column.notNull())
    .execute();

  await db.deleteFrom("export_task_events").execute();
  await db.deleteFrom("export_task_checkpoints").execute();
  await db.deleteFrom("export_task_files").execute();
  await db.deleteFrom("export_task_leases").execute();
  await db.deleteFrom("export_audit_logs").execute();
  await db.deleteFrom("export_task_idempotency").execute();
  await db.deleteFrom("export_tasks").execute();
  await db.deleteFrom("export_registry_versions").execute();
  await db.deleteFrom("export_registries").execute();
  await db.deleteFrom("purchase_orders").execute();

  return db;
}

async function seedRegistry(db, overrides = {}) {
  const now = await getDatabaseTime(db);
  const runId = overrides.runId ?? `${Date.now()}-${process.pid}-${Math.random()}`;
  const taskCode = overrides.taskCode ?? `purchase-order-export-${runId}`;
  const subsystemCode = overrides.subsystemCode ?? "purchase";
  const registryRepository = createExportRegistryRepository(db);

  await registryRepository.upsertRegistry({
    taskCode,
    subsystemCode,
    displayName: "Purchase Order Export",
    enabled: true,
    concurrencyLimit: 1,
    fileRetentionDays: 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: 20000,
    exportMaxRows: overrides.exportMaxRows ?? 100000,
    datasourceCode: "purchase-ro",
    supportedFormats: JSON.stringify(["XLSX", "ZIP"]),
    parameterSchema: JSON.stringify({
      type: "object",
      properties: {
        createdAtFrom: { type: "string" },
        createdAtTo: { type: "string" },
        orderStatus: { type: "string" },
        supplierId: { type: "string" },
        purchaseOrgId: { type: "string" },
        keyword: { type: "string" }
      },
      required: ["createdAtFrom", "createdAtTo"]
    }),
    queryTemplate: JSON.stringify(
      overrides.queryTemplate ?? {
        queryTemplateVersion: "v1",
        templateText:
          "SELECT order_id AS orderId, tenant_id AS tenantId, org_id AS orgId, order_no AS orderNo, order_status AS orderStatus, supplier_id AS supplierId, purchase_org_id AS purchaseOrgId, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo AND (:orderStatus IS NULL OR order_status = :orderStatus) AND (:supplierId IS NULL OR supplier_id = :supplierId) AND (:purchaseOrgId IS NULL OR purchase_org_id = :purchaseOrgId) AND (:keyword IS NULL OR keyword_text LIKE :keyword)",
        allowedParameters: [
          "createdAtFrom",
          "createdAtTo",
          "orderStatus",
          "supplierId",
          "purchaseOrgId",
          "keyword"
        ]
      }
    ),
    fieldMappings: JSON.stringify(
      overrides.fieldMappings ?? [
        {
          fieldCode: "orderId",
          headerName: "Order ID",
          fieldType: "STRING",
          orderNo: 1,
          sensitive: false,
          exportable: true
        },
        {
          fieldCode: "orderNo",
          headerName: "Order No",
          fieldType: "STRING",
          orderNo: 2,
          sensitive: false,
          exportable: true
        },
        {
          fieldCode: "contactPhone",
          headerName: "Contact Phone",
          fieldType: "STRING",
          orderNo: 3,
          sensitive: true,
          exportable: true,
          maskingRuleCode: "phone_mask"
        }
      ]
    ),
    maskingPolicy: JSON.stringify(
      overrides.maskingPolicy ?? {
        rules: {
          phone_mask: {
            type: "PHONE",
            preservePrefix: 3,
            preserveSuffix: 4
          }
        }
      }
    ),
    dataScopeTemplate:
      overrides.dataScopeTemplate ??
      "tenantId = :tenantId and orgId in (:orgScope)",
    cursorField: "orderId",
    orderBy: JSON.stringify([{ field: "orderId", direction: "ASC" }]),
    batchSize: overrides.batchSize ?? 2,
    configSnapshotDigest: overrides.configSnapshotDigest ?? "sha256:config-v1",
    parameterSchemaDigest: "sha256:params-v1",
    fieldMappingDigest: "sha256:fields-v1",
    maskingPolicyDigest: "sha256:mask-v1",
    now
  });

  return { taskCode, subsystemCode };
}

async function seedTask(db, input) {
  const now = await getDatabaseTime(db);
  return createExportTaskRepository(db).createPendingTask({
    taskId: input.taskId,
    taskCode: input.taskCode,
    subsystemCode: input.subsystemCode,
    tenantId: input.tenantId ?? "tenant-001",
    createdBy: input.createdBy ?? "u001",
    fileFormat: "XLSX",
    clientRequestId: input.clientRequestId ?? null,
    idempotencyScope: input.idempotencyScope ?? null,
    requestDigest: input.requestDigest ?? `sha256:${input.taskId}`,
    configSnapshotDigest: input.configSnapshotDigest ?? "sha256:config-v1",
    requestPayload: JSON.stringify(
      input.requestPayload ?? {
        queryParams: {
          createdAtFrom: "2026-05-01T00:00:00+08:00",
          createdAtTo: "2026-05-31T23:59:59+08:00",
          orderStatus: "APPROVED",
          supplierId: "SUP-001",
          purchaseOrgId: "PO-001",
          keyword: "PO-2026"
        }
      }
    ),
    authContextPayload: JSON.stringify(
      input.authContextPayload ?? {
        operatorId: input.createdBy ?? "u001",
        tenantId: input.tenantId ?? "tenant-001",
        roleCodes: ["EXPORT_USER"],
        orgScope: "ORG-001,ORG-002",
        requestId: "req-query-001"
      }
    ),
    now
  });
}

async function seedPurchaseOrders(db, now) {
  await db
    .insertInto("purchase_orders")
    .values([
      {
        order_id: "order-001",
        tenant_id: "tenant-001",
        org_id: "ORG-001",
        order_no: "PO-2026-001",
        order_status: "APPROVED",
        supplier_id: "SUP-001",
        purchase_org_id: "PO-001",
        contact_phone: "13812345678",
        keyword_text: "PO-2026 apples",
        created_at: now
      },
      {
        order_id: "order-002",
        tenant_id: "tenant-001",
        org_id: "ORG-002",
        order_no: "PO-2026-002",
        order_status: "APPROVED",
        supplier_id: "SUP-001",
        purchase_org_id: "PO-001",
        contact_phone: "13987654321",
        keyword_text: "PO-2026 bananas",
        created_at: now
      },
      {
        order_id: "order-003",
        tenant_id: "tenant-002",
        org_id: "ORG-009",
        order_no: "PO-2026-003",
        order_status: "APPROVED",
        supplier_id: "SUP-001",
        purchase_org_id: "PO-001",
        contact_phone: "13700001111",
        keyword_text: "PO-2026 other tenant",
        created_at: now
      }
    ])
    .execute();
}

test("query executor binds template, enforces data scope, masks sensitive fields and emits QUERY_READY/QUERY_BATCH_DONE", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db);
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-001",
    taskCode,
    subsystemCode
  });

  const processor = createQueryExecutorBatchProcessor();
  const result = await processor({
    db,
    task: {
      ...task,
      status: "EXECUTING",
      lockOwner: "worker-query",
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now
    },
    lease: {
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      lockOwner: "worker-query",
      previousLockOwner: null,
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now,
      databaseTime: now,
      takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
    },
    checkpoint: undefined,
    requestId: "req-query-001"
  });

  assert.equal(result.outcome, "completed");
  assert.equal(result.checkpoint?.processedCount, 2);
  assert.equal(parseCursorToken(result.checkpoint?.lastCursor).values.orderId, "order-002");
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((row) => row["Order ID"]),
    ["order-001", "order-002"]
  );
  assert.deepEqual(
    result.rows.map((row) => row["Contact Phone"]),
    ["138****5678", "139****4321"]
  );

  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  assert.deepEqual(
    events.map((event) => event.eventType),
    ["QUERY_BATCH_DONE", "QUERY_READY"]
  );
  assert.equal(events[1].datasourceCode, "purchase-ro");
  assert.equal(events[0].queryTemplateVersion, "v1");
});

test("query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { batchSize: 1 });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-002",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor();
  const context = {
    db,
    task: {
      ...task,
      status: "EXECUTING",
      lockOwner: "worker-query",
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now
    },
    lease: {
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      lockOwner: "worker-query",
      previousLockOwner: null,
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now,
      databaseTime: now,
      takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
    },
    requestId: "req-query-002"
  };

  const first = await processor({
    ...context,
    checkpoint: undefined
  });
  const second = await processor({
    ...context,
    checkpoint: {
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      lastCursor: first.checkpoint.lastCursor,
      processedCount: first.checkpoint.processedCount,
      filePartNo: 1,
      retryCount: 0,
      batchSize: 1,
      batchRowCount: 1,
      backoffMs: 0
    }
  });

  assert.equal(first.outcome, "continue");
  assert.equal(first.checkpoint.processedCount, 1);
  assert.equal(parseCursorToken(first.checkpoint.lastCursor).values.orderId, "order-001");
  assert.equal(second.outcome, "completed");
  assert.equal(second.checkpoint.processedCount, 2);
  assert.equal(parseCursorToken(second.checkpoint.lastCursor).values.orderId, "order-002");
  assert.deepEqual(
    second.rows.map((row) => row["Order ID"]),
    ["order-001", "order-002"]
  );
});

test("query executor accepts legacy string checkpoint cursors while producing structured cursor tokens", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { batchSize: 1 });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-legacy-cursor",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor();

  const result = await processor({
    db,
    task: {
      ...task,
      status: "EXECUTING",
      lockOwner: "worker-query",
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now
    },
    lease: {
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      lockOwner: "worker-query",
      previousLockOwner: null,
      lockExpireAt: new Date(now.getTime() + 300000),
      leaseRenewedAt: now,
      databaseTime: now,
      takeoverRule: "EXPIRED_LEASE_TAKEOVER_KEEP_ATTEMPT"
    },
    checkpoint: {
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      lastCursor: "order-001",
      processedCount: 1,
      filePartNo: 1,
      retryCount: 0,
      batchSize: 1,
      batchRowCount: 1,
      backoffMs: 0
    },
    requestId: "req-query-legacy-cursor"
  });

  assert.equal(result.outcome, "completed");
  assert.equal(parseCursorToken(result.checkpoint.lastCursor).values.orderId, "order-002");
  assert.deepEqual(
    result.rows.map((row) => row["Order ID"]),
    ["order-001", "order-002"]
  );
});

test("query executor rejects unsafe template forms and undeclared placeholders", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const unsafeTemplates = [
    {
      queryTemplateVersion: "v1",
      templateText: "DELETE FROM purchase_orders WHERE tenant_id = :tenantId",
      allowedParameters: []
    },
    {
      queryTemplateVersion: "v1",
      templateText: "SELECT * FROM purchase_orders; SELECT * FROM export_tasks",
      allowedParameters: []
    },
    {
      queryTemplateVersion: "v1",
      templateText: "SELECT * FROM purchase_orders WHERE tenant_id = :tenantId AND hack = :unknownParam",
      allowedParameters: []
    }
  ];

  for (const [index, queryTemplate] of unsafeTemplates.entries()) {
    const { taskCode, subsystemCode } = await seedRegistry(db, {
      runId: `unsafe-${index}`,
      queryTemplate
    });
    const task = await seedTask(db, {
      taskId: `exp-unsafe-${index}`,
      taskCode,
      subsystemCode
    });
    const processor = createQueryExecutorBatchProcessor();

    await assert.rejects(
      () =>
        processor({
          db,
          task: {
            ...task,
            status: "EXECUTING",
            lockOwner: "worker-query",
            lockExpireAt: new Date(now.getTime() + 300000),
            leaseRenewedAt: now
          },
          lease: {
            taskId: task.taskId,
            attemptNo: task.attemptNo,
            lockOwner: "worker-query",
            previousLockOwner: null,
            lockExpireAt: new Date(now.getTime() + 300000),
            leaseRenewedAt: now,
            databaseTime: now,
            takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
          },
          checkpoint: undefined,
          requestId: `req-unsafe-${index}`
        }),
      /QUERY_TEMPLATE_INVALID/
    );
  }
});

test("query executor rejects missing masking rules for sensitive exportable fields", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "mask-missing",
    maskingPolicy: { rules: {} }
  });
  const task = await seedTask(db, {
    taskId: "exp-mask-missing",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor();

  await assert.rejects(
    () =>
      processor({
        db,
        task: {
          ...task,
          status: "EXECUTING",
          lockOwner: "worker-query",
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now
        },
        lease: {
          taskId: task.taskId,
          attemptNo: task.attemptNo,
          lockOwner: "worker-query",
          previousLockOwner: null,
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now,
          databaseTime: now,
          takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
        },
        checkpoint: undefined,
        requestId: "req-mask-missing"
      }),
    /MASKING_RULE_ERROR/
  );
});

test("query executor rejects field mappings that do not match selected columns", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "field-invalid",
    fieldMappings: [
      {
        fieldCode: "missing_field",
        headerName: "Missing",
        fieldType: "STRING",
        orderNo: 1,
        sensitive: false,
        exportable: true
      }
    ]
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-field-invalid",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor();

  await assert.rejects(
    () =>
      processor({
        db,
        task: {
          ...task,
          status: "EXECUTING",
          lockOwner: "worker-query",
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now
        },
        lease: {
          taskId: task.taskId,
          attemptNo: task.attemptNo,
          lockOwner: "worker-query",
          previousLockOwner: null,
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now,
          databaseTime: now,
          takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
        },
        checkpoint: undefined,
        requestId: "req-field-invalid"
      }),
    /FIELD_MAPPING_INVALID/
  );
});

test("query executor enforces exportMaxRows before crossing registry limit", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "limit",
    exportMaxRows: 1,
    batchSize: 2
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-limit",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor();

  await assert.rejects(
    () =>
      processor({
        db,
        task: {
          ...task,
          status: "EXECUTING",
          lockOwner: "worker-query",
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now
        },
        lease: {
          taskId: task.taskId,
          attemptNo: task.attemptNo,
          lockOwner: "worker-query",
          previousLockOwner: null,
          lockExpireAt: new Date(now.getTime() + 300000),
          leaseRenewedAt: now,
          databaseTime: now,
          takeoverRule: "PENDING_OR_EXPIRED_KEEP_ATTEMPT"
        },
        checkpoint: undefined,
        requestId: "req-limit"
      }),
    /EXPORT_LIMIT_EXCEEDED/
  );
});
