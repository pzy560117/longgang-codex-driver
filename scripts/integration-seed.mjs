import mysql from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { runMigrations } from "../src/db/migrator.ts";
import { createSamplePurchaseOrderRegistryContract } from "../src/sample-purchase-order/index.ts";
import { upsertExportRegistry } from "../src/registry-config/service.ts";

const platformUrl =
  process.env.EXPORT_PLATFORM_DATABASE_URL ??
  "mysql://root@127.0.0.1:43306/export_platform_integration";
const readonlyUrl = resolveReadonlyUrl();

process.env.EXPORT_PLATFORM_DATABASE_URL = platformUrl;
process.env.EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL = readonlyUrl ?? "";

if (!platformUrl || !readonlyUrl) {
  console.error(
    "BLOCKED - 需要人工介入: integration seed requires EXPORT_PLATFORM_DATABASE_URL and EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL."
  );
  process.exit(1);
}

const platformDb = new Kysely({
  dialect: new MysqlDialect({
    pool: mysql.createPool(platformUrl)
  })
});

const readonlyDb = new Kysely({
  dialect: new MysqlDialect({
    pool: mysql.createPool(readonlyUrl)
  })
});

const seedRowCount = readSeedRowCount(process.env.EXPORT_PLATFORM_INTEGRATION_SEED_ROW_COUNT);

try {
  await runMigrations(platformDb);
  await ensureReadonlySchema(readonlyDb);
  await seedReadonlyRows(readonlyDb, seedRowCount);
  await registerRegistry();

  console.log(
    JSON.stringify({
      event: "export-platform.integration.seeded",
      seededRows: seedRowCount,
      datasource: "purchase-ro",
      table: "purchase_orders_sample",
      view: "purchase_orders_view"
    })
  );
} finally {
  await platformDb.destroy();
  await readonlyDb.destroy();
}

function resolveReadonlyUrl() {
  const direct = process.env.EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL;
  if (direct) {
    return direct;
  }
  const hostDefault = "mysql://root@127.0.0.1:43307/purchase_readonly";
  const jsonValue = process.env.EXPORT_PLATFORM_DATASOURCES_JSON;
  if (!jsonValue) {
    return hostDefault;
  }
  try {
    const parsed = JSON.parse(jsonValue);
    return parsed?.["purchase-ro"]?.url ?? parsed?.["purchase-ro"] ?? hostDefault;
  } catch {
    return hostDefault;
  }
}

function readSeedRowCount(value) {
  if (!value) {
    return 10000;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `BLOCKED - 需要人工介入: invalid EXPORT_PLATFORM_INTEGRATION_SEED_ROW_COUNT value ${value}.`
    );
  }
  return parsed;
}

async function ensureReadonlySchema(db) {
  await db.schema.dropView("purchase_orders_view").ifExists().execute();
  await db.schema.dropTable("purchase_orders_sample").ifExists().execute();
  await db.schema
    .createTable("purchase_orders_sample")
    .ifNotExists()
    .addColumn("order_id", "varchar(64)", (col) => col.primaryKey())
    .addColumn("tenant_id", "varchar(128)", (col) => col.notNull())
    .addColumn("org_id", "varchar(128)", (col) => col.notNull())
    .addColumn("owner_operator_id", "varchar(128)", (col) => col.notNull())
    .addColumn("allowed_role_code", "varchar(128)", (col) => col.notNull())
    .addColumn("order_no", "varchar(128)", (col) => col.notNull())
    .addColumn("order_status", "varchar(64)", (col) => col.notNull())
    .addColumn("supplier_id", "varchar(128)", (col) => col.notNull())
    .addColumn("supplier_name", "varchar(128)", (col) => col.notNull())
    .addColumn("purchase_org_id", "varchar(128)", (col) => col.notNull())
    .addColumn("purchase_org_name", "varchar(128)", (col) => col.notNull())
    .addColumn("purchaser_name", "varchar(128)", (col) => col.notNull())
    .addColumn("contact_name", "varchar(128)", (col) => col.notNull())
    .addColumn("contact_phone", "varchar(64)", (col) => col.notNull())
    .addColumn("keyword_text", "varchar(255)", (col) => col.notNull())
    .addColumn("total_amount", "varchar(32)", (col) => col.notNull())
    .addColumn("currency_code", "varchar(16)", (col) => col.notNull())
    .addColumn("created_at", "datetime(3)", (col) => col.notNull())
    .execute();

  await sql`
    CREATE VIEW purchase_orders_view AS
    SELECT
      order_id,
      tenant_id,
      org_id,
      owner_operator_id,
      allowed_role_code,
      order_no,
      order_status,
      supplier_id,
      supplier_name,
      purchase_org_id,
      purchase_org_name,
      purchaser_name,
      contact_name,
      contact_phone,
      keyword_text,
      total_amount,
      currency_code,
      created_at
    FROM purchase_orders_sample
  `.execute(db);
}

async function seedReadonlyRows(db, count) {
  const chunkSize = 1000;
  let inserted = 0;

  while (inserted < count) {
    const rows = [];
    const currentChunkSize = Math.min(count - inserted, chunkSize);
    for (let offset = 0; offset < currentChunkSize; offset += 1) {
      const sequence = inserted + offset + 1;
      const suffix = String(sequence).padStart(6, "0");
      const dayOfMonth = ((sequence - 1) % 28) + 1;
      rows.push({
        order_id: `integration-order-${suffix}`,
        tenant_id: "tenant-001",
        org_id: sequence % 2 === 0 ? "ORG-002" : "ORG-001",
        owner_operator_id: "u001",
        allowed_role_code: "EXPORT_USER",
        order_no: `INT-PO-${suffix}`,
        order_status: sequence % 17 === 0 ? "REJECTED" : sequence % 5 === 0 ? "PENDING" : "APPROVED",
        supplier_id: `SUP-INT-${String((sequence % 12) + 1).padStart(3, "0")}`,
        supplier_name: `Integration Supplier ${(sequence % 12) + 1}`,
        purchase_org_id: "PO-INTEGRATION",
        purchase_org_name: "Integration Purchasing",
        purchaser_name: `Buyer ${suffix}`,
        contact_name: `Contact ${suffix}`,
        contact_phone: `138${String(10000000 + sequence).slice(-8)}`,
        keyword_text: `integration INT-PO-${suffix}`,
        total_amount: String(5000 + sequence),
        currency_code: "CNY",
        created_at: new Date(`2026-05-${String(dayOfMonth).padStart(2, "0")}T00:00:00.000Z`)
      });
    }

    await db.insertInto("purchase_orders_sample").values(rows).execute();
    inserted += rows.length;
  }
}

async function registerRegistry() {
  const contract = createSamplePurchaseOrderRegistryContract();
  await upsertExportRegistry(
    {
      operatorId: "integration-admin",
      tenantId: "tenant-001",
      roleCodes: ["EXPORT_ADMIN"],
      orgScope: "ORG-001,ORG-002",
      requestId: "req-integration-registry"
    },
    {
      taskCode: contract.taskCode,
      subsystemCode: contract.subsystemCode,
      displayName: contract.displayName,
      enabled: true,
      concurrencyLimit: 1,
      fileRetentionDays: 7,
      taskHistoryRetentionDays: 30,
      singleFileMaxRows: contract.singleFileMaxRows,
      exportMaxRows: contract.exportMaxRows,
      datasourceCode: "purchase-ro",
      supportedFormats: [...contract.supportedFormats],
      parameterSchema: contract.parameterSchema,
      queryTemplate: contract.queryTemplate,
      fieldMappings: contract.fieldMappings.map((field) => ({ ...field })),
      maskingPolicy: {
        rules: {
          ...contract.maskingPolicy.rules
        }
      },
      dataScopeTemplate:
        "tenantId = :tenantId AND operatorId = :operatorId AND roleCode IN (:roleCodes) AND orgId IN (:orgScope)",
      cursorField: contract.cursorField,
      orderBy: contract.orderBy.map((item) => ({ ...item })),
      batchSize: 500
    }
  );
}
