import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { createDatabase } from "../db/kysely.ts";
import { getDatabaseTime } from "../repositories/index.ts";
import { appendAudit } from "./service.ts";

export type AuthContext = {
  operatorId: string;
  tenantId: string;
  roleCodes: string[];
  orgScope: string;
  requestId: string;
};

const AUTH_CONTEXT_MAX_AGE_MS = 5 * 60 * 1000;
const AUTH_CONTEXT_CLOCK_SKEW_MS = 5 * 60 * 1000;

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly data: unknown = null
  ) {
    super(message);
  }
}

export function hasRole(auth: AuthContext, roleCode: string): boolean {
  return auth.roleCodes.includes(roleCode);
}

export function isExportAdmin(auth: AuthContext): boolean {
  return hasRole(auth, "EXPORT_ADMIN");
}

export function isTrustedRegistryAdminTenant(auth: AuthContext): boolean {
  const raw = process.env.EXPORT_PLATFORM_REGISTRY_ADMIN_TENANT_IDS;
  if (!raw || raw.trim() === "*") {
    return !process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET || raw?.trim() === "*";
  }

  return raw
    .split(",")
    .map((tenantId) => tenantId.trim())
    .filter(Boolean)
    .includes(auth.tenantId);
}

export function assertExportPermission(auth: AuthContext, allowedRoles: string[]): void {
  if (allowedRoles.some((roleCode) => hasRole(auth, roleCode))) {
    return;
  }

  throw new ApiError(403, "PERMISSION_DENIED", "operator has no permission", {
    operatorId: auth.operatorId,
    requiredRoles: allowedRoles
  });
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function readRequiredHeader(request: FastifyRequest, name: string): string {
  const value = readHeader(request, name)?.trim();
  if (!value) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }
  return value;
}

function readOptionalHeader(request: FastifyRequest, name: string): string | undefined {
  const value = readHeader(request, name)?.trim();
  return value || undefined;
}

function requireAuthContextSigningSecret(): string {
  const secret = process.env.EXPORT_PLATFORM_AUTH_CONTEXT_SIGNING_SECRET;
  if (!secret) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }
  return secret;
}

function createAuthContextSignature(input: {
  operatorId: string;
  tenantId: string;
  roleCodes: string;
  orgScope: string;
  requestId: string;
  issuedAt: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update([
      input.operatorId,
      input.tenantId,
      input.roleCodes,
      input.orgScope,
      input.requestId,
      input.issuedAt
    ].join("\n"))
    .digest("hex");
}

function assertValidSignature(value: string, expected: string): void {
  const signature = Buffer.from(value, "hex");
  const expectedSignature = Buffer.from(expected, "hex");
  if (signature.length !== expectedSignature.length || !timingSafeEqual(signature, expectedSignature)) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }
}

function assertValidAuthField(name: string, value: string): void {
  if (value.length > 128) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", `${name} is invalid`);
  }
}

function parseIssuedAt(value: string): number {
  const issuedAtTime = Date.parse(value);
  if (!Number.isFinite(issuedAtTime)) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }
  return issuedAtTime;
}

function assertAuthContextFreshness(issuedAtTime: number, now = Date.now()): void {
  const oldestAcceptedIssuedAt = now - AUTH_CONTEXT_MAX_AGE_MS - AUTH_CONTEXT_CLOCK_SKEW_MS;
  const newestAcceptedIssuedAt = now + AUTH_CONTEXT_CLOCK_SKEW_MS;

  if (issuedAtTime < oldestAcceptedIssuedAt || issuedAtTime > newestAcceptedIssuedAt) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }
}

async function auditAuthContextFailure(
  request: FastifyRequest,
  action: string,
  error: ApiError
): Promise<void> {
  const requestId = readOptionalHeader(request, "x-request-id");
  if (!requestId) {
    return;
  }

  const db = createDatabase();
  try {
    const now = await getDatabaseTime(db);
    await appendAudit({
      db,
      auth: {
        operatorId: readOptionalHeader(request, "x-operator-id") ?? "untrusted",
        tenantId: readOptionalHeader(request, "x-tenant-id") ?? "untrusted",
        roleCodes: [],
        orgScope: readOptionalHeader(request, "x-org-scope") ?? "untrusted",
        requestId
      },
      taskId: null,
      attemptNo: null,
      taskCode: null,
      subsystemCode: null,
      action,
      result: "FAILED",
      errorCode: error.code,
      now
    });
  } catch {
    // Keep authentication failures generic even if audit persistence is unavailable.
  } finally {
    await db.destroy();
  }
}

function readAuthContext(request: FastifyRequest): AuthContext {
  const operatorId = readRequiredHeader(request, "x-operator-id");
  const tenantId = readRequiredHeader(request, "x-tenant-id");
  const roleCodesHeader = readRequiredHeader(request, "x-role-codes");
  const orgScope = readRequiredHeader(request, "x-org-scope");
  const requestId = readRequiredHeader(request, "x-request-id");
  const issuedAt = readRequiredHeader(request, "x-auth-context-issued-at");
  const signatureAlgorithm = readRequiredHeader(request, "x-auth-context-signature-algorithm");
  const signature = readRequiredHeader(request, "x-auth-context-signature");
  const roleCodes = roleCodesHeader.split(",").map((role) => role.trim()).filter(Boolean);
  const issuedAtTime = parseIssuedAt(issuedAt);

  for (const [name, value] of [
    ["operatorId", operatorId],
    ["tenantId", tenantId],
    ["orgScope", orgScope],
    ["requestId", requestId],
    ["issuedAt", issuedAt]
  ] as const) {
    assertValidAuthField(name, value);
  }

  if (roleCodes.length === 0 || signatureAlgorithm !== "HMAC-SHA256") {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }

  assertAuthContextFreshness(issuedAtTime);

  assertValidSignature(
    signature,
    createAuthContextSignature({
      operatorId,
      tenantId,
      roleCodes: roleCodesHeader,
      orgScope,
      requestId,
      issuedAt,
      secret: requireAuthContextSigningSecret()
    })
  );

  return {
    operatorId,
    tenantId,
    roleCodes,
    orgScope,
    requestId
  };
}

export async function requireAuthContext(
  request: FastifyRequest,
  action = "AUTH_CONTEXT"
): Promise<AuthContext> {
  try {
    return readAuthContext(request);
  } catch (error) {
    if (error instanceof ApiError) {
      await auditAuthContextFailure(request, action, error);
    }
    throw error;
  }
}
