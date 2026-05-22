import { createHmac } from "node:crypto";

const secret =
  process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET ??
  "integration-auth-signing-secret";

const auth = {
  operatorId: process.env.EXPORT_PLATFORM_INTEGRATION_OPERATOR_ID ?? "u001",
  tenantId: process.env.EXPORT_PLATFORM_INTEGRATION_TENANT_ID ?? "tenant-001",
  roleCodes: (process.env.EXPORT_PLATFORM_INTEGRATION_ROLE_CODES ?? "EXPORT_USER")
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean),
  orgScope: process.env.EXPORT_PLATFORM_INTEGRATION_ORG_SCOPE ?? "ORG-001,ORG-002",
  requestId: process.env.EXPORT_PLATFORM_INTEGRATION_REQUEST_ID ?? `req-${Date.now()}`
};

const issuedAt = new Date().toISOString();
const roleCodesHeader = auth.roleCodes.join(",");
const payload = [
  auth.operatorId,
  auth.tenantId,
  roleCodesHeader,
  auth.orgScope,
  auth.requestId,
  issuedAt
].join("\n");

const signature = createHmac("sha256", secret).update(payload).digest("hex");

console.log(
  JSON.stringify(
    {
      "x-operator-id": auth.operatorId,
      "x-tenant-id": auth.tenantId,
      "x-role-codes": roleCodesHeader,
      "x-org-scope": auth.orgScope,
      "x-request-id": auth.requestId,
      "x-auth-context-issued-at": issuedAt,
      "x-auth-context-signature-algorithm": "HMAC-SHA256",
      "x-auth-context-signature": signature
    },
    null,
    2
  )
);
