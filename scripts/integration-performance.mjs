import { createHmac } from "node:crypto";
import mysql from "mysql2/promise";

const baseUrl = process.env.EXPORT_PLATFORM_INTEGRATION_BASE_URL ?? "http://127.0.0.1:43000";
const platformUrl =
  process.env.EXPORT_PLATFORM_DATABASE_URL ??
  "mysql://root@127.0.0.1:43306/export_platform_integration";
const readonlyUrl =
  process.env.EXPORT_PLATFORM_DATASOURCE_PURCHASE_RO_URL ??
  "mysql://root@127.0.0.1:43307/purchase_readonly";
const secret =
  process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET ??
  "integration-auth-signing-secret";

const rowCounts = readRowCounts(
  process.env.EXPORT_PLATFORM_PERF_ROW_COUNTS ?? "1000,10000,50000,100000"
);

const platform = await mysql.createConnection(platformUrl);
const readonly = await mysql.createConnection(readonlyUrl);

const results = [];

try {
  for (const rowCount of rowCounts) {
    const scenario = await runScenario({
      rowCount,
      platform,
      readonly,
      baseUrl,
      secret
    });
    results.push(scenario);
  }
} finally {
  await platform.end();
  await readonly.end();
}

console.log(JSON.stringify({ results }, null, 2));

async function runScenario(input) {
  const runId = `perf-${input.rowCount}-${Date.now()}`;
  const keyword = `PERF-${runId}`;
  const supplierId = `SUP-${runId}`;
  const purchaseOrgId = `PO-${runId}`;

  await resetReadonlyRows(input.readonly, keyword);
  await seedReadonlyRows(input.readonly, {
    rowCount: input.rowCount,
    keyword,
    supplierId,
    purchaseOrgId
  });

  const headers = createHeaders(input.secret, {
    operatorId: "u001",
    tenantId: "tenant-001",
    roleCodes: ["EXPORT_USER"],
    orgScope: "ORG-001,ORG-002",
    requestId: `req-${runId}`
  });

  const startedAt = Date.now();
  const createResp = await fetch(`${input.baseUrl}/api/export/tasks`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      taskCode: "purchase-order-export",
      subsystemCode: "purchase",
      fileFormat: "XLSX",
      clientRequestId: `client-${runId}`,
      queryParams: {
        createdAtFrom: "2026-05-01T00:00:00.000Z",
        createdAtTo: "2026-05-31T23:59:59.000Z",
        orderStatus: "APPROVED",
        supplierId,
        purchaseOrgId,
        keyword
      }
    })
  });

  if (!createResp.ok) {
    throw new Error(`create task failed for ${input.rowCount}: ${createResp.status}`);
  }

  const createPayload = await createResp.json();
  const taskId = createPayload?.data?.taskId;
  if (!taskId) {
    throw new Error(`missing taskId for ${input.rowCount}`);
  }

  let detailPayload = null;
  for (let index = 0; index < 600; index += 1) {
    const detailResp = await fetch(`${input.baseUrl}/api/export/tasks/${taskId}`, {
      headers
    });
    if (!detailResp.ok) {
      throw new Error(`detail failed for ${taskId}: ${detailResp.status}`);
    }

    detailPayload = await detailResp.json();
    const status = detailPayload?.data?.status;
    if (status === "COMPLETED") {
      break;
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`task ${taskId} ended with ${status}`);
    }
    await sleep(2000);
  }

  if (detailPayload?.data?.status !== "COMPLETED") {
    return {
      rowCount: input.rowCount,
      taskId,
      status: detailPayload?.data?.status ?? "TIMEOUT",
      durationMs: null,
      durationSec: null,
      fileName: null,
      fileSize: null,
      partCount: null,
      throughputRowsPerSec: null,
      publishedStorageKey: null,
      timeout: true
    };
  }

  const finishedAt = Date.now();
  const [rows] = await input.platform.execute(
    "SELECT file_name, file_size, published_storage_key FROM export_task_files WHERE task_id = ? AND attempt_no = 0",
    [taskId]
  );
  const metadata = rows[0];
  if (!metadata) {
    throw new Error(`missing file metadata for ${taskId}`);
  }

  const partCount = String(metadata.file_name).endsWith(".zip")
    ? Math.ceil(input.rowCount / 20000)
    : 1;
  const durationMs = finishedAt - startedAt;
  const throughputRowsPerSec = Number((input.rowCount / (durationMs / 1000)).toFixed(2));

  return {
    rowCount: input.rowCount,
    taskId,
    status: "COMPLETED",
    durationMs,
    durationSec: Number((durationMs / 1000).toFixed(2)),
    fileName: metadata.file_name,
    fileSize: Number(metadata.file_size),
    partCount,
    throughputRowsPerSec,
    publishedStorageKey: metadata.published_storage_key
  };
}

async function resetReadonlyRows(connection, keyword) {
  await connection.execute(
    "DELETE FROM purchase_orders_sample WHERE keyword_text LIKE ?",
    [`${keyword}%`]
  );
}

async function seedReadonlyRows(connection, input) {
  const rows = [];
  for (let index = 0; index < input.rowCount; index += 1) {
    const sequence = String(index + 1).padStart(6, "0");
    const dayOfMonth = (index % 28) + 1;
    rows.push([
      `perf-order-${input.keyword}-${sequence}`,
      "tenant-001",
      index % 2 === 0 ? "ORG-001" : "ORG-002",
      "u001",
      "EXPORT_USER",
      `${input.keyword}-${sequence}`,
      "APPROVED",
      input.supplierId,
      "Performance Supplier",
      input.purchaseOrgId,
      "Performance Purchasing",
      `Buyer ${sequence}`,
      `Contact ${sequence}`,
      `138${String(10000000 + index).slice(-8)}`,
      `${input.keyword} ${sequence}`,
      String(1000 + index),
      "CNY",
      `2026-05-${String(dayOfMonth).padStart(2, "0")} 00:00:00.000`
    ]);
  }

  const sql = `
    INSERT INTO purchase_orders_sample (
      order_id, tenant_id, org_id, owner_operator_id, allowed_role_code,
      order_no, order_status, supplier_id, supplier_name, purchase_org_id,
      purchase_org_name, purchaser_name, contact_name, contact_phone,
      keyword_text, total_amount, currency_code, created_at
    ) VALUES ?
  `;

  const chunkSize = 2000;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await connection.query(sql, [chunk]);
  }
}

function createHeaders(secret, auth) {
  const issuedAt = new Date().toISOString();
  const roleCodes = auth.roleCodes.join(",");
  const payload = [
    auth.operatorId,
    auth.tenantId,
    roleCodes,
    auth.orgScope,
    auth.requestId,
    issuedAt
  ].join("\n");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");

  return {
    "x-operator-id": auth.operatorId,
    "x-tenant-id": auth.tenantId,
    "x-role-codes": roleCodes,
    "x-org-scope": auth.orgScope,
    "x-request-id": auth.requestId,
    "x-auth-context-issued-at": issuedAt,
    "x-auth-context-signature-algorithm": "HMAC-SHA256",
    "x-auth-context-signature": signature
  };
}

function readRowCounts(value) {
  return value
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
