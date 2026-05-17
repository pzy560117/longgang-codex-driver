import type { FastifyReply } from "fastify";
import { ApiError } from "../audit-log/auth-context.ts";
import { normalizePublicResponseCode, type PublicResponseCode } from "../contracts/public-enums.ts";
import { sendJson } from "../http/types.ts";

function publicErrorMessage(code: PublicResponseCode): string {
  switch (code) {
    case "VALIDATION_ERROR":
      return "validation failed";
    case "AUTH_CONTEXT_MISSING":
      return "auth context missing";
    case "PERMISSION_DENIED":
      return "permission denied";
    case "TASK_NOT_FOUND":
      return "task not found";
    case "TASK_NOT_REGISTERED":
      return "task code not registered";
    case "TASK_DISABLED":
      return "task code is disabled";
    case "QUERY_PARAMS_TOO_LARGE":
      return "queryParams exceeds 32768 bytes";
    case "IDEMPOTENCY_CONFLICT":
      return "clientRequestId conflicts with a different request digest";
    case "INVALID_TASK_STATE":
      return "current task status does not allow this operation";
    case "FILE_EXPIRED":
      return "file expired";
    case "SIGNATURE_INVALID":
      return "download signature is invalid";
    case "SIGNATURE_EXPIRED":
      return "download signature expired";
    case "FILE_NOT_READY":
      return "file is not ready for download";
    case "FILE_VERIFY_ERROR":
      return "file verification failed";
    case "FILE_CLEANUP_DELETE_ERROR":
      return "file cleanup failed";
    case "QUERY_TEMPLATE_INVALID":
      return "query template invalid";
    case "DATASOURCE_UNAVAILABLE":
      return "datasource unavailable";
    case "QUERY_EXECUTION_ERROR":
      return "query execution failed";
    case "FIELD_MAPPING_INVALID":
      return "field mapping invalid";
    case "MASKING_RULE_ERROR":
      return "masking rule error";
    case "EXPORT_RENDER_ERROR":
      return "export render error";
    case "EXPORT_LIMIT_EXCEEDED":
      return "export limit exceeded";
    case "REGISTRY_CONFLICT":
      return "taskCode already exists";
    case "ACTIVE_ATTEMPT_CONFLICT":
      return "active execution attempt already exists";
    case "INTERNAL_ERROR":
    case "SUCCESS":
      return "internal error";
  }
}

export function sendSuccess(response: FastifyReply, statusCode: number, data: unknown): void {
  sendJson(response, statusCode, {
    code: "SUCCESS",
    message: "success",
    data
  });
}

export async function sendError(response: FastifyReply, error: unknown): Promise<void> {
  if (error instanceof ApiError) {
    const code = normalizePublicResponseCode(error.code, "INTERNAL_ERROR");
    sendJson(response, error.statusCode, {
      code,
      message: publicErrorMessage(code),
      data: error.data
    });
    return;
  }

  sendJson(response, 500, {
    code: "INTERNAL_ERROR",
    message: "internal error",
    data: null
  });
}
