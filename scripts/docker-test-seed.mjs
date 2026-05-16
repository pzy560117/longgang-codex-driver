import mysql from "mysql2";
import { Kysely, MysqlDialect, sql } from "kysely";
import { runMigrations } from "../src/db/migrator.ts";
import { createSamplePurchaseOrderRegistryContract } from "../src/sample-purchase-order/index.ts";
import { upsertExportRegistry } from "../src/registry-config/service.ts";

const databaseUrl = assertLocalTestDatabaseUrl(
  process.env.EXPORT_PLATFORM_DATABASE_URL ?? process.env.EXPORT_PLATFORM_TEST_DATABASE_URL
);

process.env.EXPORT_PLATFORM_DATABASE_URL = databaseUrl;
process.env.EXPORT_PLATFORM_TEST_DATABASE_URL ??= databaseUrl;

const db = new Kysely({
  dialect: new MysqlDialect({
    pool: mysql.createPool(databaseUrl)
  })
});

try {
  await runMigrations(db);
  await ensurePurchaseOrderSeedTable(db);
  const seededRows = await seedPurchaseOrderRows(db);
  await registerPurchaseOrderExport();

  console.log(
    JSON.stringify({
      event: "export-platform.docker-test.seeded",
      registry: "purchase-order-export",
      table: "purchase_orders_sample",
      view: "purchase_orders_view",
      seededRows
    })
  );
} finally {
  await db.destroy();
}

function assertLocalTestDatabaseUrl(value) {
  if (!value) {
    throw new Error(
      "BLOCKED - 需要人工介入: docker test seed requires EXPORT_PLATFORM_DATABASE_URL or EXPORT_PLATFORM_TEST_DATABASE_URL."
    );
  }

  const url = new URL(value);
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(url.hostname.toLowerCase())) {
    throw new Error(
      "BLOCKED - 需要人工介入: docker test seed refuses non-local MySQL URLs to avoid seeding external databases."
    );
  }

  const expectedDatabaseName = process.env.EXPORT_PLATFORM_DOCKER_TEST_DATABASE_NAME ?? "export_platform_test";
  const actualDatabaseName = decodeURIComponent(url.pathname.replace(/^\/+/u, ""));
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `BLOCKED - 需要人工介入: docker test seed refuses non-test MySQL databases. Expected ${expectedDatabaseName}, received ${actualDatabaseName || "(empty)"}.`
    );
  }

  return value;
}

async function ensurePurchaseOrderSeedTable(database) {
  await database.schema
    .createTable("purchase_orders_sample")
    .ifNotExists()
    .addColumn("order_id", "varchar(64)", (column) => column.primaryKey())
    .addColumn("tenant_id", "varchar(128)", (column) => column.notNull())
    .addColumn("org_id", "varchar(128)", (column) => column.notNull())
    .addColumn("owner_operator_id", "varchar(128)", (column) => column.notNull())
    .addColumn("allowed_role_code", "varchar(128)", (column) => column.notNull())
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

  await ensureColumn(database, "owner_operator_id", "varchar(128) NOT NULL DEFAULT 'u001'");
  await ensureColumn(database, "allowed_role_code", "varchar(128) NOT NULL DEFAULT 'EXPORT_USER'");

  await sql`
    CREATE OR REPLACE VIEW purchase_orders_view AS
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
  `.execute(database);
}

async function ensureColumn(database, columnName, definition) {
  const result = await sql`
    SELECT COUNT(*) AS column_count
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'purchase_orders_sample'
      AND COLUMN_NAME = ${columnName}
  `.execute(database);
  const count = Number(result.rows[0]?.column_count ?? 0);
  if (count === 0) {
    await sql.raw(`ALTER TABLE purchase_orders_sample ADD COLUMN ${columnName} ${definition}`).execute(database);
  }
}

async function seedPurchaseOrderRows(database) {
  await database
    .deleteFrom("purchase_orders_sample")
    .where("order_id", "like", "docker-test-%")
    .execute();

  const rows = [
    createPurchaseOrderRow(1, "APPROVED", "SUP-DOCKER-001", "Docker Supplies", "ORG-001"),
    createPurchaseOrderRow(2, "APPROVED", "SUP-DOCKER-001", "Docker Supplies", "ORG-002"),
    createPurchaseOrderRow(3, "PENDING", "SUP-DOCKER-002", "Local Parts", "ORG-001"),
    createPurchaseOrderRow(4, "REJECTED", "SUP-DOCKER-003", "Rejected Vendor", "ORG-003")
  ];

  await database.insertInto("purchase_orders_sample").values(rows).execute();
  return rows.length;
}

function createPurchaseOrderRow(sequence, status, supplierId, supplierName, orgId) {
  const suffix = String(sequence).padStart(6, "0");
  return {
    order_id: `docker-test-order-${suffix}`,
    tenant_id: "tenant-001",
    org_id: orgId,
    owner_operator_id: "u001",
    allowed_role_code: "EXPORT_USER",
    order_no: `DOCKER-PO-${suffix}`,
    order_status: status,
    supplier_id: supplierId,
    supplier_name: supplierName,
    purchase_org_id: "PO-DOCKER",
    purchase_org_name: "Docker Test Purchasing",
    purchaser_name: `Docker Buyer ${suffix}`,
    contact_name: `Docker Contact ${suffix}`,
    contact_phone: `139${String(10000000 + sequence).slice(-8)}`,
    keyword_text: `docker-test DOCKER-PO-${suffix}`,
    total_amount: String(2000 + sequence),
    currency_code: "CNY",
    created_at: new Date(`2026-05-${String(10 + sequence).padStart(2, "0")}T00:00:00.000Z`)
  };
}

async function registerPurchaseOrderExport() {
  const contract = createSamplePurchaseOrderRegistryContract();
  await upsertExportRegistry(
    {
      operatorId: "docker-test-admin",
      tenantId: "tenant-001",
      roleCodes: ["EXPORT_ADMIN"],
      orgScope: "ORG-001,ORG-002,ORG-003",
      requestId: "req-docker-test-registry"
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
      datasourceCode: contract.datasourceCode,
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
