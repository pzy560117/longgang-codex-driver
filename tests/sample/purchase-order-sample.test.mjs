import assert from "node:assert/strict";
import test, { describe } from "node:test";
import mysql from "mysql2";
import { Kysely, MysqlDialect } from "kysely";
import { runMigrations } from "../../src/db/migrator.ts";
import {
  createCheckpointRepository,
  createExportAuditRepository,
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime
} from "../../src/repositories/index.ts";
import { createSchedulerWorker } from "../../src/scheduler/worker.ts";
import {
  createExportFileService,
  createObjectStorageFromEnv
} from "../../src/file-service/index.ts";
import { createSamplePurchaseOrderRegistryContract } from "../../src/sample-purchase-order/index.ts";
import { upsertExportRegistry } from "../../src/registry-config/service.ts";
import {
  createExportTask,
  downloadExportTask
} from "../../src/task-api/service.ts";
import {
  inspectXlsxBuffer,
  inspectZipOfXlsxBuffer,
  xlsxContainsText,
  zipOfXlsxContainsText
} from "../file/xlsx-zip-helpers.mjs";

function serialTest(name, fn) {
  return test(name, { concurrency: false }, fn);
}

describe("sample purchase-order integration tests", { concurrency: false }, () => {

function getTestDatabaseUrl() {
  const databaseUrl = process.env.EXPORT_PLATFORM_TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "BLOCKED - 需要人工介入: tests/sample requires a real MySQL URL in EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  return databaseUrl;
}

function toMysqlDateTimeLiteral(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const seconds = String(value.getSeconds()).padStart(2, "0");
  const milliseconds = String(value.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}

process.env.EXPORT_PLATFORM_DATABASE_URL = getTestDatabaseUrl();
process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT ??= "https://oss.example.test";
process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET ??= "export-platform-test";

function getExpectedObjectStorageDownloadUrlPattern() {
  const endpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  const bucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
  const prefix = `${endpoint.replace(/\/+$/u, "")}/${encodeURIComponent(bucket)}/`;
  return new RegExp(`^${escapeRegExp(prefix)}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
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
  await db.deleteFrom("export_task_events").execute();
  await db.deleteFrom("export_task_checkpoints").execute();
  await db.deleteFrom("export_task_files").execute();
  await db.deleteFrom("export_task_leases").execute();
  await db.deleteFrom("export_audit_logs").execute();
  await db.deleteFrom("export_task_idempotency").execute();
  await db.deleteFrom("export_tasks").execute();
  await db.deleteFrom("export_registry_versions").execute();
  await db.deleteFrom("export_registries").execute();
  await db.schema.dropTable("purchase_orders_sample").ifExists().execute();
  await db.schema
    .createTable("purchase_orders_sample")
    .ifNotExists()
    .addColumn("order_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("tenant_id", "varchar(128)", (column) => column.notNull())
    .addColumn("org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("order_no", "varchar(128)", (column) => column.notNull())
    .addColumn("order_status", "varchar(64)", (column) => column.notNull())
    .addColumn("supplier_id", "varchar(128)", (column) => column.notNull())
    .addColumn("supplier_name", "varchar(128)", (column) => column.notNull())
    .addColumn("purchase_org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("purchase_org_name", "varchar(128)", (column) => column.notNull())
    .addColumn("purchaser_name", "varchar(128)", (column) => column.notNull())
    .addColumn("contact_name", "varchar(128)", (column) => column.notNull())
    .addColumn("contact_phone", "varchar(64)", (column) => column.notNull())
    .addColumn("keyword_text", "varchar(255)", (column) => column.notNull())
    .addColumn("total_amount", "varchar(32)", (column) => column.notNull())
    .addColumn("currency_code", "varchar(16)", (column) => column.notNull())
    .addColumn("created_at", "datetime(3)", (column) => column.notNull())
    .execute();

  return db;
}

function createProductionEquivalentObjectStorageAdapter() {
  const objects = new Map();
  const writes = [];
  const publishes = [];

  return {
    objects,
    writes,
    publishes,
    async putObject(input) {
      writes.push(input);
      objects.set(input.storageKey, Buffer.from(input.body));
    },
    async readObject(storageKey) {
      const object = objects.get(storageKey);
      if (!object) {
        throw new Error(`missing object ${storageKey}`);
      }
      return Buffer.from(object);
    },
    async publishObject(input) {
      publishes.push(input);
      const object = objects.get(input.tempStorageKey);
      if (!object) {
        throw new Error(`missing temp object ${input.tempStorageKey}`);
      }
      objects.set(input.publishedStorageKey, Buffer.from(object));
    },
    async createDownloadUrl(storageKey) {
      return `signed://adapter/${storageKey}`;
    }
  };
}

function createAdminAuth(requestId) {
  return {
    operatorId: "admin-001",
    tenantId: "tenant-001",
    roleCodes: ["EXPORT_ADMIN"],
    orgScope: "ORG-001,ORG-002",
    requestId
  };
}

function createUserAuth(requestId) {
  return {
    operatorId: "u001",
    tenantId: "tenant-001",
    roleCodes: ["EXPORT_USER"],
    orgScope: "ORG-001,ORG-002",
    requestId
  };
}

function createSampleRegistryPayload(overrides = {}) {
  const contract = createSamplePurchaseOrderRegistryContract();
  return {
    taskCode: contract.taskCode,
    subsystemCode: contract.subsystemCode,
    displayName: contract.displayName,
    enabled: true,
    concurrencyLimit: 1,
    fileRetentionDays: 7,
    taskHistoryRetentionDays: 30,
    singleFileMaxRows: overrides.singleFileMaxRows ?? contract.singleFileMaxRows,
    exportMaxRows: overrides.exportMaxRows ?? contract.exportMaxRows,
    datasourceCode: contract.datasourceCode,
    supportedFormats: [...contract.supportedFormats],
    parameterSchema: contract.parameterSchema,
    queryTemplate: {
      ...contract.queryTemplate,
      templateText: (overrides.templateText ?? contract.queryTemplate.templateText).replace(
        "purchase_orders_view",
        "purchase_orders_sample"
      )
    },
    fieldMappings: overrides.fieldMappings ?? contract.fieldMappings.map((item) => ({ ...item })),
    maskingPolicy:
      overrides.maskingPolicy ?? {
        rules: {
          ...contract.maskingPolicy.rules
        }
      },
    dataScopeTemplate: "tenantId = :tenantId and orgId in (:orgScope)",
    cursorField: contract.cursorField,
    orderBy: contract.orderBy.map((item) => ({ ...item })),
    batchSize: overrides.batchSize ?? 500
  };
}

async function registerSampleRegistry(overrides = {}) {
  return upsertExportRegistry(
    createAdminAuth(overrides.requestId ?? `req-sample-registry-${Date.now()}`),
    createSampleRegistryPayload(overrides)
  );
}

async function seedRows(db, count, seed) {
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const sequence = String(index + 1).padStart(6, "0");
    rows.push({
      order_id: `${seed.runId}-order-${sequence}`,
      tenant_id: "tenant-001",
      org_id: index % 2 === 0 ? "ORG-001" : "ORG-002",
      order_no: `${seed.keyword}-${sequence}`,
      order_status: "APPROVED",
      supplier_id: seed.supplierId,
      supplier_name: "Acme Supplies",
      purchase_org_id: seed.purchaseOrgId,
      purchase_org_name: "Central Purchasing",
      purchaser_name: `Buyer ${sequence}`,
      contact_name: `Contact ${sequence}`,
      contact_phone: `138${String(10000000 + index).slice(-8)}`,
      keyword_text:
        index % 2 === 0
          ? `${seed.keyword} ${sequence}`
          : `${seed.keyword} other ${sequence}`,
      total_amount: String(100 + index),
      currency_code: "CNY",
      created_at: seed.createdAt
    });
  }

  const chunkSize = 2000;
  for (let index = 0; index < rows.length; index += chunkSize) {
    await db.insertInto("purchase_orders_sample").values(rows.slice(index, index + chunkSize)).execute();
  }
}

async function createSampleTask(input) {
  const response = await createExportTask(createUserAuth(input.requestId), {
    taskCode: "purchase-order-export",
    subsystemCode: "purchase",
    fileFormat: "XLSX",
    clientRequestId: input.clientRequestId,
    queryParams: {
      createdAtFrom: input.createdAtFrom,
      createdAtTo: input.createdAtTo,
      orderStatus: "APPROVED",
      supplierId: input.supplierId,
      purchaseOrgId: input.purchaseOrgId,
      keyword: input.keyword
    }
  });

  assert.equal(response.statusCode, 201);
  return response.data;
}

async function processTaskUntilTerminal(db, taskId, storage) {
  const worker = createSchedulerWorker({
    db,
    workerId: "worker-sample",
    leaseDurationSeconds: 300,
    maxTasksPerPoll: 1,
    fileService: createExportFileService({ db, storage })
  });
  const totals = {
    polls: 0,
    dispatched: 0,
    renewed: 0,
    canceled: 0,
    completed: 0,
    failed: 0
  };
  const startedAt = Date.now();

  for (let index = 0; index < 1000; index += 1) {
    const pollResult = await worker.pollAndProcessOnce();
    totals.polls += 1;
    totals.dispatched += pollResult.dispatched;
    totals.renewed += pollResult.renewed;
    totals.canceled += pollResult.canceled;
    totals.completed += pollResult.completed;
    totals.failed += pollResult.failed;

    const task = await createExportTaskRepository(db).findTaskById(taskId);
    if (task && ["COMPLETED", "FAILED", "CANCELED"].includes(task.status)) {
      return {
        task,
        totals: {
          ...totals,
          durationMs: Date.now() - startedAt
        }
      };
    }

    if (
      pollResult.dispatched === 0 &&
      pollResult.renewed === 0 &&
      pollResult.canceled === 0 &&
      pollResult.completed === 0 &&
      pollResult.failed === 0
    ) {
      break;
    }
  }

  throw new Error(`worker did not reach a terminal state for task ${taskId}`);
}

async function listAuditsByRequestId(db, requestId) {
  return db
    .selectFrom("export_audit_logs")
    .selectAll()
    .where("request_id", "=", requestId)
    .orderBy("created_at", "asc")
    .execute();
}

async function runSampleExport(t, rowCount, overrides = {}) {
  const db = await createTestDatabase(t);
  const now = await getDatabaseTime(db);
  const runId = overrides.runId ?? `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const createdAt = new Date(now.getTime() + 1000);
  const seed = {
    runId,
    createdAt,
    createdAtFrom: toMysqlDateTimeLiteral(new Date(createdAt.getTime() - 1000)),
    createdAtTo: toMysqlDateTimeLiteral(new Date(createdAt.getTime() + 1000)),
    supplierId: `SUP-${runId}`,
    purchaseOrgId: `PO-${runId}`,
    keyword: `PO-${runId}`
  };
  await registerSampleRegistry({
    ...overrides.registryOverrides,
    requestId: overrides.registryRequestId ?? `req-sample-registry-${rowCount}`
  });
  await seedRows(db, rowCount, seed);
  const createdTask = await createSampleTask({
    requestId: overrides.taskRequestId ?? `req-sample-create-${rowCount}`,
    clientRequestId: `${overrides.clientRequestId ?? `sample-client-${rowCount}`}-${runId}`,
    createdAtFrom: seed.createdAtFrom,
    createdAtTo: seed.createdAtTo,
    supplierId: seed.supplierId,
    purchaseOrgId: seed.purchaseOrgId,
    keyword: seed.keyword
  });
  const storage = createProductionEquivalentObjectStorageAdapter();
  const { task, totals } = await processTaskUntilTerminal(db, createdTask.taskId, storage);
  const fileMetadata = await createExportFileRepository(db).findFileMetadata(task.taskId, task.attemptNo);
  const events = await createExportTaskEventRepository(db).listRecentTaskEvents(task.taskId);
  const audits = await createExportAuditRepository(db).listAuditLogsForTask(task.taskId);
  const checkpoint = await createCheckpointRepository(db).findLatestCheckpoint(
    task.taskId,
    task.attemptNo
  );

  return {
    db,
    task,
    createdTask,
    seed,
    storage,
    metrics: totals,
    fileMetadata,
    events,
    audits,
    checkpoint,
    packageData: fileMetadata?.publishedStorageKey
      ? await inspectPublishedFile(storage, fileMetadata.publishedStorageKey)
      : null
  };
}

async function inspectPublishedFile(storage, storageKey) {
  const object = storage.objects.get(storageKey);
  assert.ok(object, `expected published object ${storageKey}`);
  if (storageKey.endsWith(".zip")) {
    return inspectZipOfXlsxBuffer(Buffer.from(object), { mode: "summary" });
  }
  return inspectXlsxBuffer(Buffer.from(object), { mode: "summary" });
}

serialTest("sample suite blocks env-backed live object storage when config is missing and keeps adapter evidence scoped as production-equivalent", () => {
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

serialTest("sample purchase-order registry contract is registered through the public registry service", async (t) => {
  const db = await createTestDatabase(t);
  await registerSampleRegistry({ requestId: "req-sample-registry-contract" });

  const registry = await createExportRegistryRepository(db).findRegistryByTaskCode(
    "purchase-order-export"
  );
  const registryAudits = await listAuditsByRequestId(db, "req-sample-registry-contract");

  assert.equal(registry?.taskCode, "purchase-order-export");
  assert.equal(registry?.subsystemCode, "purchase");
  assert.equal(registry?.enabled, true);
  assert.equal(registry?.cursorField, "orderId");
  assert.equal(registry?.singleFileMaxRows, 20000);
  assert.equal(registry?.exportMaxRows, 100000);
  assert.ok(registryAudits.some((audit) => audit.action === "REGISTRY_CREATE"));
});

serialTest("sample boundary 0 rows completes through the public create and worker chain", async (t) => {
  const { task, fileMetadata, events, audits, packageData } = await runSampleExport(t, 0);

  assert.equal(task.status, "COMPLETED");
  assert.equal(fileMetadata?.fileName.endsWith(".xlsx"), true);
  assert.deepEqual(packageData?.header, [
    "订单号",
    "订单状态",
    "供应商",
    "采购组织",
    "采购员",
    "创建时间",
    "总金额",
    "币种",
    "联系人姓名",
    "联系人手机号"
  ]);
  assert.equal(packageData?.rowCount, 0);
  assert.ok(events.some((event) => event.eventType === "QUERY_READY"));
  assert.ok(events.some((event) => event.eventType === "FILE_VERIFIED"));
  assert.ok(audits.some((audit) => audit.action === "CREATE"));
  assert.ok(audits.some((audit) => audit.action === "EXECUTE_SUCCESS"));
});

serialTest("sample boundary 1 row keeps final file masked and records create/query/file/audit/download evidence", async (t) => {
  const scenario = await runSampleExport(t, 1, {
    registryRequestId: "req-sample-registry-e2e",
    taskRequestId: "req-sample-create-e2e",
    clientRequestId: "sample-client-e2e"
  });
  const download = await downloadExportTask(
    createUserAuth("req-sample-download-e2e"),
    scenario.task.taskId
  );
  const downloadAudits = await createExportAuditRepository(scenario.db).listAuditLogsForTask(
    scenario.task.taskId
  );
  const registryAudits = await listAuditsByRequestId(scenario.db, "req-sample-registry-e2e");
  const createAudits = await listAuditsByRequestId(scenario.db, "req-sample-create-e2e");
  const publishedBuffer = Buffer.from(
    scenario.storage.objects.get(scenario.fileMetadata.publishedStorageKey)
  );

  assert.equal(scenario.task.status, "COMPLETED");
  assert.equal(scenario.fileMetadata?.fileName.endsWith(".xlsx"), true);
  assert.equal(download.fileName, scenario.fileMetadata.fileName);
  assert.equal(download.storageKey, scenario.fileMetadata.publishedStorageKey);
  assert.match(download.downloadUrl, getExpectedObjectStorageDownloadUrlPattern());
  assert.ok(registryAudits.some((audit) => audit.action === "REGISTRY_CREATE"));
  assert.ok(createAudits.some((audit) => audit.action === "CREATE"));
  assert.ok(downloadAudits.some((audit) => audit.action === "DISPATCH"));
  assert.ok(downloadAudits.some((audit) => audit.action === "EXECUTE_START"));
  assert.ok(downloadAudits.some((audit) => audit.action === "EXECUTE_SUCCESS"));
  assert.ok(downloadAudits.some((audit) => audit.action === "DOWNLOAD"));
  assert.ok(scenario.events.some((event) => event.eventType === "QUERY_READY"));
  assert.ok(scenario.events.some((event) => event.eventType === "QUERY_BATCH_DONE"));
  assert.equal(
    scenario.events.filter((event) => event.eventType === "QUERY_BATCH_DONE").length,
    1
  );
  assert.ok(scenario.events.some((event) => event.eventType === "FILE_PART_WRITTEN"));
  assert.ok(scenario.events.some((event) => event.eventType === "PACKAGE_DONE"));
  assert.ok(scenario.events.some((event) => event.eventType === "FILE_VERIFIED"));
  assert.ok(scenario.events.some((event) => event.eventType === "DELIVERY_READY"));
  assert.equal(scenario.packageData.rowCount, 1);
  assert.equal(scenario.packageData.firstDataRow[0], `${scenario.seed.keyword}-000001`);
  assert.equal(scenario.packageData.firstDataRow[1], "APPROVED");
  assert.equal(scenario.packageData.firstDataRow[2], "Acme Supplies");
  assert.equal(scenario.packageData.firstDataRow[8], "C************1");
  assert.equal(scenario.packageData.firstDataRow[9], "138****0000");
  assert.equal(await xlsxContainsText(publishedBuffer, "Contact 000001"), false);
  assert.equal(await xlsxContainsText(publishedBuffer, "13810000000"), false);
});

serialTest("sample boundary 20000 rows completes with a single-file package", async (t) => {
  const { task, fileMetadata, packageData } = await runSampleExport(t, 20000, {
    clientRequestId: "sample-client-20000"
  });

  assert.equal(task.status, "COMPLETED");
  assert.equal(fileMetadata?.fileName.endsWith(".xlsx"), true);
  assert.equal(packageData?.rowCount, 20000);
});

serialTest("sample boundary 20001 rows packages ZIP evidence without losing rows", async (t) => {
  const { task, fileMetadata, packageData } = await runSampleExport(t, 20001, {
    clientRequestId: "sample-client-20001"
  });

  assert.equal(task.status, "COMPLETED");
  assert.equal(fileMetadata?.fileName.endsWith(".zip"), true);
  assert.equal(packageData?.parts.length, 2);
  assert.deepEqual(
    packageData?.parts.map((part) => part.name),
    ["part-0001.xlsx", "part-0002.xlsx"]
  );
  assert.equal(packageData?.totalRowCount, 20001);
});

serialTest("sample boundary 100000 rows stays on the default batch path and publishes every row", async (t) => {
  const scenario = await runSampleExport(t, 100000, {
    clientRequestId: "sample-client-100000"
  });
  const { task, fileMetadata, packageData, metrics, checkpoint, storage, seed } = scenario;
  const publishedBuffer = Buffer.from(storage.objects.get(fileMetadata.publishedStorageKey));

  assert.equal(task.status, "COMPLETED");
  assert.equal(fileMetadata?.fileName.endsWith(".zip"), true);
  assert.equal(checkpoint?.batchSize, 500);
  assert.equal(packageData?.parts.length, 5);
  assert.equal(packageData?.totalRowCount, 100000);
  assert.deepEqual(
    packageData?.parts.map((part) => part.name),
    ["part-0001.xlsx", "part-0002.xlsx", "part-0003.xlsx", "part-0004.xlsx", "part-0005.xlsx"]
  );
  assert.equal(packageData?.parts[0].workbook.rowCount, 20000);
  assert.equal(packageData?.parts[4].workbook.rowCount, 20000);
  assert.equal(packageData?.parts[0].workbook.firstDataRow[0], `${seed.keyword}-000001`);
  assert.equal(packageData?.parts[4].workbook.lastDataRow[0], `${seed.keyword}-100000`);
  assert.equal(packageData?.parts[0].workbook.firstDataRow[8], "C************1");
  assert.equal(packageData?.parts[0].workbook.firstDataRow[9], "138****0000");
  assert.ok(metrics.renewed >= 199);
  assert.equal(checkpoint?.retryCount, 0);
  assert.ok(metrics.durationMs >= 0);
  assert.ok(fileMetadata.fileSize > 0);
  assert.ok(fileMetadata.checksum.startsWith("sha256:"));
  assert.equal(
    await zipOfXlsxContainsText(
      publishedBuffer,
      "Contact 000001"
    ),
    false
  );
  assert.equal(
    await zipOfXlsxContainsText(
      publishedBuffer,
      "13810000000"
    ),
    false
  );
});

serialTest("sample boundary 100001 rows must be rejected under the default export limit", async (t) => {
  const { task, fileMetadata, audits } = await runSampleExport(t, 100001, {
    clientRequestId: "sample-client-100001"
  });

  assert.equal(task.status, "FAILED");
  assert.equal(fileMetadata, undefined);
  assert.ok(
    audits.some(
      (audit) =>
        audit.action === "EXECUTE_FAILED" &&
        audit.errorCode === "EXPORT_LIMIT_EXCEEDED"
    )
  );
});

serialTest("sample masking failure leaves the task failed and does not publish a file", async (t) => {
  const { task, fileMetadata, audits } = await runSampleExport(t, 1, {
    clientRequestId: "sample-client-mask-failure",
    registryOverrides: {
      maskingPolicy: {
        rules: {
          phone_mask: {
            type: "PHONE",
            preservePrefix: 3,
            preserveSuffix: 4
          }
        }
      }
    }
  });

  assert.equal(task.status, "FAILED");
  assert.equal(fileMetadata, undefined);
  assert.ok(
    audits.some(
      (audit) =>
        audit.action === "EXECUTE_FAILED" &&
        audit.errorCode === "MASKING_RULE_ERROR"
    )
  );
});

});
