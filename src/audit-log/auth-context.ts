import type { FastifyRequest } from "fastify";

export type AuthContext = {
  operatorId: string;
  tenantId: string;
  roleCodes: string[];
  orgScope: string;
  requestId: string;
};

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

export function requireAuthContext(request: FastifyRequest): AuthContext {
  const operatorId = readHeader(request, "x-operator-id");
  const tenantId = readHeader(request, "x-tenant-id");
  const roleCodes = readHeader(request, "x-role-codes");
  const orgScope = readHeader(request, "x-org-scope");
  const requestId = readHeader(request, "x-request-id");

  if (!operatorId || !tenantId || !roleCodes || !orgScope || !requestId) {
    throw new ApiError(401, "AUTH_CONTEXT_MISSING", "auth context missing");
  }

  return {
    operatorId,
    tenantId,
    roleCodes: roleCodes.split(",").map((role) => role.trim()).filter(Boolean),
    orgScope,
    requestId
  };
}
