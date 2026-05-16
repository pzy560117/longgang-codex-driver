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
import {
  createQueryExecutorBatchProcessor,
  mapDatasourceAdapterError
} from "../../src/query-executor/index.ts";
import { createMysqlReadonlyDatasourceAdapter } from "../../src/datasource-adapters/index.ts";
import { buildValidatedRegistryUpsertInput } from "../../src/registry-config/contract.ts";

function serialTest(name, fn) {
  return test(name, { concurrency: false }, fn);
}

const invalidRegistrySeedCases = [
  {
    field: "supportedFormats",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      supportedFormats: []
    }
  },
  {
    field: "parameterSchema",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      parameterSchema: null
    }
  },
  {
    field: "queryTemplate",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      queryTemplate: null
    }
  },
  {
    field: "fieldMappings",
    code: "FIELD_MAPPING_INVALID",
    overrides: {
      fieldMappings: []
    }
  },
  {
    field: "maskingPolicy",
    code: "MASKING_RULE_ERROR",
    overrides: {
      maskingPolicy: null
    }
  },
  {
    field: "maskingPolicyRuleCoverage",
    code: "MASKING_RULE_ERROR",
    overrides: {
      maskingPolicy: { rules: {} }
    }
  },
  {
    field: "maskingPolicyUnsupportedRule",
    code: "MASKING_RULE_ERROR",
    overrides: {
      maskingPolicy: { rules: { phone_mask: { type: "UNSUPPORTED" } } }
    }
  },
  {
    field: "dataScopeTemplate",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      dataScopeTemplate: ""
    }
  },
  {
    field: "cursorField",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      cursorField: ""
    }
  },
  {
    field: "orderBy",
    code: "QUERY_TEMPLATE_INVALID",
    overrides: {
      orderBy: []
    }
  }
];

function parseCursorToken(lastCursor) {
  return JSON.parse(lastCursor);
}

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/query requires a local or Docker MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

serialTest("query tests require an explicit test database URL", () => {
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
  await db.schema.dropTable("purchase_orders").ifExists().execute();
  await db.schema
    .createTable("purchase_orders")
    .addColumn("order_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("tenant_id", "varchar(128)", (column) => column.notNull())
    .addColumn("org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("order_no", "varchar(128)", (column) => column.notNull())
    .addColumn("order_status", "varchar(64)", (column) => column.notNull())
    .addColumn("supplier_id", "varchar(128)", (column) => column.notNull())
    .addColumn("purchase_org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("owner_operator_id", "varchar(128)", (column) => column.notNull())
    .addColumn("allowed_role_code", "varchar(128)", (column) => column.notNull())
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

function createTestReadonlyDatasourceAdapterProvider() {
  return {
    async resolveReadonlyAdapter(datasourceCode) {
      if (datasourceCode !== "purchase-ro") {
        return undefined;
      }
      return createMysqlReadonlyDatasourceAdapter(getTestDatabaseUrl());
    }
  };
}

function createTestQueryExecutorBatchProcessor() {
  return createQueryExecutorBatchProcessor({
    datasourceAdapters: createTestReadonlyDatasourceAdapterProvider()
  });
}

async function seedRegistry(db, overrides = {}) {
  const now = await getDatabaseTime(db);
  const runId = overrides.runId ?? `${Date.now()}-${process.pid}-${Math.random()}`;
  const taskCode = overrides.taskCode ?? `purchase-order-export-${runId}`;
  const subsystemCode = overrides.subsystemCode ?? "purchase";
  const registryRepository = createExportRegistryRepository(db);
  const registryInput = buildValidatedRegistryUpsertInput({
    body: {
      taskCode,
      subsystemCode,
      displayName: "Purchase Order Export",
      enabled: true,
      concurrencyLimit: 1,
      fileRetentionDays: 7,
      taskHistoryRetentionDays: 30,
      singleFileMaxRows: 20000,
      exportMaxRows: overrides.exportMaxRows ?? 100000,
      supportedFormats: Object.hasOwn(overrides, "supportedFormats")
        ? overrides.supportedFormats
        : ["XLSX", "ZIP"],
      datasourceCode: "purchase-ro",
      parameterSchema: Object.hasOwn(overrides, "parameterSchema")
        ? overrides.parameterSchema
        : {
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
          },
      queryTemplate: Object.hasOwn(overrides, "queryTemplate")
        ? overrides.queryTemplate
        : {
            queryTemplateVersion: "v1",
            templateText:
              "SELECT order_id AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, order_status AS orderStatus, supplier_id AS supplierId, purchase_org_id AS purchaseOrgId, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo AND (:orderStatus IS NULL OR order_status = :orderStatus) AND (:supplierId IS NULL OR supplier_id = :supplierId) AND (:purchaseOrgId IS NULL OR purchase_org_id = :purchaseOrgId) AND (:keyword IS NULL OR keyword_text LIKE :keyword)",
            allowedParameters: [
              "createdAtFrom",
              "createdAtTo",
              "orderStatus",
              "supplierId",
              "purchaseOrgId",
              "keyword"
            ]
          },
      fieldMappings: Object.hasOwn(overrides, "fieldMappings")
        ? overrides.fieldMappings
        : [
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
          ],
      maskingPolicy: Object.hasOwn(overrides, "maskingPolicy")
        ? overrides.maskingPolicy
        : {
            rules: {
              phone_mask: {
                type: "PHONE",
                preservePrefix: 3,
                preserveSuffix: 4
              }
            }
          },
      dataScopeTemplate: Object.hasOwn(overrides, "dataScopeTemplate")
        ? overrides.dataScopeTemplate
        : "tenantId = :tenantId AND operatorId = :operatorId AND roleCode IN (:roleCodes) AND orgId IN (:orgScope)",
      cursorField: Object.hasOwn(overrides, "cursorField") ? overrides.cursorField : "orderId",
      orderBy: Object.hasOwn(overrides, "orderBy")
        ? overrides.orderBy
        : [{ field: "orderId", direction: "ASC" }],
      batchSize: overrides.batchSize ?? 2
    },
    now
  });

  await registryRepository.upsertRegistry({
    ...registryInput,
    configSnapshotDigest: overrides.configSnapshotDigest ?? "sha256:config-v1",
    parameterSchemaDigest: overrides.parameterSchemaDigest ?? "sha256:params-v1",
    fieldMappingDigest: overrides.fieldMappingDigest ?? "sha256:fields-v1",
    maskingPolicyDigest: overrides.maskingPolicyDigest ?? "sha256:mask-v1"
  });

  return { taskCode, subsystemCode };
}

serialTest("seed registry uses the same contract validation as production persistence and rejects empty bypass values", async (t) => {
  const db = await createTestDatabase(t);

  for (const [index, invalidCase] of invalidRegistrySeedCases.entries()) {
    const taskCode = `invalid-seed-${invalidCase.field}-${Date.now()}-${index}`;
    await assert.rejects(
      () =>
        seedRegistry(db, {
          runId: `invalid-seed-${index}`,
          taskCode,
          ...invalidCase.overrides
        }),
      (error) => {
        assert.equal(error?.code, invalidCase.code);
        return true;
      }
    );
    assert.equal(await createExportRegistryRepository(db).findRegistryByTaskCode(taskCode), undefined);
  }
});

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
        owner_operator_id: "u001",
        allowed_role_code: "EXPORT_USER",
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
        owner_operator_id: "u001",
        allowed_role_code: "EXPORT_USER",
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
        owner_operator_id: "u999",
        allowed_role_code: "EXPORT_ADMIN",
        contact_phone: "13700001111",
        keyword_text: "PO-2026 other tenant",
        created_at: now
      }
    ])
    .execute();
}

serialTest("query executor binds template, enforces data scope, masks sensitive fields and emits QUERY_READY/QUERY_BATCH_DONE", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db);
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-001",
    taskCode,
    subsystemCode
  });

  const processor = createTestQueryExecutorBatchProcessor();
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
  assert.equal(JSON.parse(events[0].batchCheckpoint).totalCount, 2);
  assert.equal(events[1].datasourceCode, "purchase-ro");
  assert.equal(events[0].queryTemplateVersion, "v1");
});

serialTest("query executor runs business SELECT through the readonly datasource adapter for registry datasourceCode", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { runId: "adapter-boundary" });
  const task = await seedTask(db, {
    taskId: "exp-query-adapter-boundary",
    taskCode,
    subsystemCode
  });
  const adapterCalls = [];
  const processor = createQueryExecutorBatchProcessor({
    datasourceAdapters: {
      async resolveReadonlyAdapter(datasourceCode) {
        assert.equal(datasourceCode, "purchase-ro");
        return {
          async executeSelect(sqlText, values) {
            adapterCalls.push({ sqlText, values });
            return [
              {
                orderId: "adapter-order-001",
                tenantId: "tenant-001",
                orgId: "ORG-001",
                operatorId: "u001",
                roleCode: "EXPORT_USER",
                orderNo: "PO-ADAPTER-001",
                contactPhone: "13812345678"
              }
            ];
          }
        };
      }
    }
  });

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
    requestId: "req-query-adapter-boundary"
  });

  assert.equal(result.outcome, "completed");
  assert.equal(adapterCalls.length, 1);
  assert.equal(result.rows[0]["Order ID"], "adapter-order-001");
  assert.equal(result.rows[0]["Contact Phone"], "138****5678");
});

serialTest("query executor maps unknown datasourceCode to DATASOURCE_UNAVAILABLE without leaking adapter details", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { runId: "adapter-missing" });
  const task = await seedTask(db, {
    taskId: "exp-query-adapter-missing",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor({
    datasourceAdapters: {
      async resolveReadonlyAdapter() {
        return undefined;
      }
    }
  });

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
        requestId: "req-query-adapter-missing"
      }),
    (error) => {
      assert.equal(error.name, "DATASOURCE_UNAVAILABLE");
      assert.match(error.message, /^DATASOURCE_UNAVAILABLE: datasource unavailable$/);
      return true;
    }
  );
});

serialTest("query executor maps provider failures to DATASOURCE_UNAVAILABLE without leaking adapter details", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { runId: "adapter-provider-throws" });
  const task = await seedTask(db, {
    taskId: "exp-query-adapter-provider-throws",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor({
    datasourceAdapters: {
      async resolveReadonlyAdapter() {
        throw new RangeError("missing datasource credential password=secret");
      }
    }
  });

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
        requestId: "req-query-adapter-provider-throws"
      }),
    (error) => {
      assert.equal(error.name, "DATASOURCE_UNAVAILABLE");
      assert.equal(error.message, "DATASOURCE_UNAVAILABLE: datasource unavailable");
      assert.doesNotMatch(error.message, /password|secret|credential/i);
      return true;
    }
  );
});

serialTest("query executor maps invalid datasource URL failures to DATASOURCE_UNAVAILABLE", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { runId: "adapter-invalid-url" });
  const task = await seedTask(db, {
    taskId: "exp-query-adapter-invalid-url",
    taskCode,
    subsystemCode
  });
  const processor = createQueryExecutorBatchProcessor({
    datasourceAdapters: {
      async resolveReadonlyAdapter() {
        return createMysqlReadonlyDatasourceAdapter("not-a-valid-mysql-url");
      }
    }
  });

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
        requestId: "req-query-adapter-invalid-url"
      }),
    (error) => {
      assert.equal(error.name, "DATASOURCE_UNAVAILABLE");
      assert.equal(error.message, "DATASOURCE_UNAVAILABLE: datasource unavailable");
      assert.doesNotMatch(error.message, /not-a-valid-mysql-url|Invalid URL/i);
      return true;
    }
  );
});

serialTest("query executor applies registry dataScopeTemplate with operatorId and roleCodes to block same org unauthorized rows", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "data-scope-template",
    queryTemplate: {
      queryTemplateVersion: "v-scope",
      templateText:
        "SELECT order_id AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo AND (:keyword IS NULL OR keyword_text LIKE :keyword)",
      allowedParameters: ["createdAtFrom", "createdAtTo", "keyword"]
    },
    dataScopeTemplate:
      "tenantId = :tenantId AND operatorId = :operatorId AND roleCode IN (:roleCodes) AND orgId IN (:orgScope)"
  });
  await seedPurchaseOrders(db, now);
  await db
    .insertInto("purchase_orders")
    .values([
      {
        order_id: "order-004",
        tenant_id: "tenant-001",
        org_id: "ORG-001",
        order_no: "PO-2026-004",
        order_status: "APPROVED",
        supplier_id: "SUP-001",
        purchase_org_id: "PO-001",
        owner_operator_id: "u002",
        allowed_role_code: "EXPORT_USER",
        contact_phone: "13600002222",
        keyword_text: "PO-2026 same org wrong operator",
        created_at: now
      },
      {
        order_id: "order-005",
        tenant_id: "tenant-001",
        org_id: "ORG-001",
        order_no: "PO-2026-005",
        order_status: "APPROVED",
        supplier_id: "SUP-001",
        purchase_org_id: "PO-001",
        owner_operator_id: "u001",
        allowed_role_code: "EXPORT_ADMIN",
        contact_phone: "13500003333",
        keyword_text: "PO-2026 same org wrong role",
        created_at: now
      }
    ])
    .execute();
  const task = await seedTask(db, {
    taskId: "exp-query-data-scope-template",
    taskCode,
    subsystemCode,
    requestPayload: {
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00+08:00",
        createdAtTo: "2026-05-31T23:59:59+08:00",
        keyword: "PO-2026"
      }
    }
  });

  const processor = createTestQueryExecutorBatchProcessor();
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
    requestId: "req-query-data-scope-template"
  });

  assert.equal(result.outcome, "completed");
  assert.deepEqual(
    result.rows.map((row) => row["Order ID"]),
    ["order-001", "order-002"]
  );

  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  const ready = events.find((event) => event.eventType === "QUERY_READY");
  assert.deepEqual(JSON.parse(ready.batchCheckpoint).dataScopeExpression, {
    operatorId: "u001",
    roleCodes: ["EXPORT_USER"],
    orgScope: ["ORG-001", "ORG-002"],
    template: "tenantId = :tenantId AND operatorId = :operatorId AND roleCode IN (:roleCodes) AND orgId IN (:orgScope)"
  });
});

serialTest("query executor rejects dataScopeTemplate parameters outside the auth scope contract", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "data-scope-unsafe-param",
    dataScopeTemplate: "tenantId = :tenantId AND orgId = :createdAtFrom"
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-data-scope-unsafe-param",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
        requestId: "req-query-data-scope-unsafe-param"
      }),
    /QUERY_TEMPLATE_INVALID/
  );
});

serialTest("query executor rejects dataScopeTemplate missing required auth scope placeholders", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "data-scope-missing-auth-placeholders",
    dataScopeTemplate: "tenantId = :tenantId AND orgId IN (:orgScope)"
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-data-scope-missing-auth-placeholders",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
        requestId: "req-query-data-scope-missing-auth-placeholders"
      }),
    /QUERY_TEMPLATE_INVALID/
  );
});

serialTest("query executor rebuilds the completed export payload from prior checkpoints and preserves cumulative processedCount", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { batchSize: 1 });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-002",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();
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

serialTest("query executor replays the task config snapshot after the current registry changes", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { runId: "snapshot-v1" });
  await seedPurchaseOrders(db, now);
  const snapshot = await createExportRegistryRepository(db).findRegistryByTaskCode(taskCode);
  const task = await seedTask(db, {
    taskId: "exp-query-snapshot-replay",
    taskCode,
    subsystemCode,
    requestPayload: {
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00+08:00",
        createdAtTo: "2026-05-31T23:59:59+08:00",
        orderStatus: "APPROVED",
        supplierId: "SUP-001",
        purchaseOrgId: "PO-001",
        keyword: "PO-2026"
      },
      configSnapshot: snapshot
    }
  });

  await seedRegistry(db, {
    taskCode,
    subsystemCode,
    runId: "snapshot-v2",
    configSnapshotDigest: "sha256:config-v2",
    fieldMappings: [
      {
        fieldCode: "missingFieldFromNewRegistry",
        headerName: "Broken",
        fieldType: "STRING",
        orderNo: 1,
        sensitive: false,
        exportable: true
      }
    ]
  });

  const processor = createTestQueryExecutorBatchProcessor();
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
    requestId: "req-query-snapshot-replay"
  });

  assert.equal(result.outcome, "completed");
  assert.deepEqual(
    result.rows.map((row) => row["Order ID"]),
    ["order-001", "order-002"]
  );
  assert.equal(result.registry.configSnapshotDigest, "sha256:config-v1");
});

serialTest("query executor accepts legacy string checkpoint cursors while producing structured cursor tokens", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { batchSize: 1 });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-legacy-cursor",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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

serialTest("query executor rejects rows with missing or null cursor values", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "cursor-missing",
    queryTemplate: {
      queryTemplateVersion: "v-cursor-missing",
      templateText:
        "SELECT NULL AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo",
      allowedParameters: ["createdAtFrom", "createdAtTo"]
    }
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-cursor-missing",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
        requestId: "req-query-cursor-missing"
      }),
    /QUERY_EXECUTION_ERROR/
  );
});

serialTest("query executor rejects duplicate cursor values", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "cursor-duplicate",
    queryTemplate: {
      queryTemplateVersion: "v-cursor-duplicate",
      templateText:
        "SELECT order_status AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo",
      allowedParameters: ["createdAtFrom", "createdAtTo"]
    }
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-cursor-duplicate",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
        requestId: "req-query-cursor-duplicate"
      }),
    /QUERY_EXECUTION_ERROR/
  );
});

serialTest("query executor rejects non-increasing cursor values without duplicates", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, {
    runId: "cursor-non-increasing",
    queryTemplate: {
      queryTemplateVersion: "v-cursor-non-increasing",
      templateText:
        "SELECT CASE order_id WHEN 'order-001' THEN 'A' WHEN 'order-002' THEN 'a' ELSE order_id END AS orderId, tenant_id AS tenantId, org_id AS orgId, owner_operator_id AS operatorId, allowed_role_code AS roleCode, order_no AS orderNo, contact_phone AS contactPhone FROM purchase_orders WHERE created_at >= :createdAtFrom AND created_at <= :createdAtTo",
      allowedParameters: ["createdAtFrom", "createdAtTo"]
    }
  });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-cursor-non-increasing",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
        requestId: "req-query-cursor-non-increasing"
      }),
    /QUERY_EXECUTION_ERROR/
  );
});

serialTest("query executor rejects checkpoints missing required cursor fields", async (t) => {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const { taskCode, subsystemCode } = await seedRegistry(db, { batchSize: 1 });
  await seedPurchaseOrders(db, now);
  const task = await seedTask(db, {
    taskId: "exp-query-checkpoint-cursor-missing",
    taskCode,
    subsystemCode
  });
  const processor = createTestQueryExecutorBatchProcessor();

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
          takeoverRule: "EXPIRED_LEASE_TAKEOVER_KEEP_ATTEMPT"
        },
        checkpoint: {
          taskId: task.taskId,
          attemptNo: task.attemptNo,
          lastCursor: JSON.stringify({
            version: 1,
            values: {
              otherCursor: "order-001"
            }
          }),
          processedCount: 1,
          filePartNo: 1,
          retryCount: 0,
          batchSize: 1,
          batchRowCount: 1,
          backoffMs: 0
        },
        requestId: "req-query-checkpoint-cursor-missing"
      }),
    /QUERY_EXECUTION_ERROR/
  );
});

serialTest("query executor rejects unsafe template forms and undeclared placeholders", async (t) => {
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
    const processor = createTestQueryExecutorBatchProcessor();

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

serialTest("seed registry rejects missing masking rules for sensitive exportable fields before persistence", async (t) => {
  const db = await createTestDatabase(t);

  await assert.rejects(
    () =>
      seedRegistry(db, {
        runId: "mask-missing",
        maskingPolicy: { rules: {} }
      }),
    (error) => error.code === "MASKING_RULE_ERROR"
  );
});

serialTest("query executor rejects field mappings that do not match selected columns", async (t) => {
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
  const processor = createTestQueryExecutorBatchProcessor();

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

serialTest("query executor enforces exportMaxRows before crossing registry limit", async (t) => {
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
  const processor = createTestQueryExecutorBatchProcessor();

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

test("query executor classifies datasource adapter and credential failures as DATASOURCE_UNAVAILABLE", () => {
  assert.equal(
    mapDatasourceAdapterError(Object.assign(new Error("access denied"), { code: "ER_ACCESS_DENIED_ERROR" })).name,
    "DATASOURCE_UNAVAILABLE"
  );
  assert.equal(
    mapDatasourceAdapterError(Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" })).name,
    "DATASOURCE_UNAVAILABLE"
  );
  assert.equal(
    mapDatasourceAdapterError(new TypeError("Invalid URL: mysql://secret")).name,
    "DATASOURCE_UNAVAILABLE"
  );
  assert.equal(
    mapDatasourceAdapterError(new RangeError("missing password=secret")).message,
    "DATASOURCE_UNAVAILABLE: datasource unavailable"
  );
  const queryError = mapDatasourceAdapterError(
    Object.assign(new Error("bad field password=secret"), { code: "ER_BAD_FIELD_ERROR" })
  );
  assert.equal(
    queryError.name,
    "QUERY_EXECUTION_ERROR"
  );
  assert.equal(queryError.message, "QUERY_EXECUTION_ERROR: query execution failed");
});
