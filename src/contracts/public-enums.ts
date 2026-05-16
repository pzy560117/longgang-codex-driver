export const PUBLIC_RESPONSE_CODES = [
  "SUCCESS",
  "VALIDATION_ERROR",
  "AUTH_CONTEXT_MISSING",
  "PERMISSION_DENIED",
  "TASK_NOT_FOUND",
  "TASK_NOT_REGISTERED",
  "TASK_DISABLED",
  "QUERY_PARAMS_TOO_LARGE",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_TASK_STATE",
  "FILE_EXPIRED",
  "FILE_NOT_READY",
  "FILE_VERIFY_ERROR",
  "FILE_CLEANUP_DELETE_ERROR",
  "QUERY_TEMPLATE_INVALID",
  "DATASOURCE_UNAVAILABLE",
  "QUERY_EXECUTION_ERROR",
  "FIELD_MAPPING_INVALID",
  "MASKING_RULE_ERROR",
  "EXPORT_RENDER_ERROR",
  "EXPORT_LIMIT_EXCEEDED",
  "REGISTRY_CONFLICT",
  "ACTIVE_ATTEMPT_CONFLICT",
  "INTERNAL_ERROR"
] as const;

export type PublicResponseCode = (typeof PUBLIC_RESPONSE_CODES)[number];

const PUBLIC_RESPONSE_CODE_SET = new Set<string>(PUBLIC_RESPONSE_CODES);

export function isPublicResponseCode(value: string): value is PublicResponseCode {
  return PUBLIC_RESPONSE_CODE_SET.has(value);
}

export function normalizePublicResponseCode(
  value: string | null | undefined,
  fallback: PublicResponseCode
): PublicResponseCode {
  return value && isPublicResponseCode(value) ? value : fallback;
}

export const PUBLIC_TASK_EVENT_TYPES = [
  "QUERY_READY",
  "QUERY_BATCH_DONE",
  "FILE_PART_WRITTEN",
  "PACKAGE_DONE",
  "FILE_VERIFIED",
  "DELIVERY_READY"
] as const;

export type PublicTaskEventType = (typeof PUBLIC_TASK_EVENT_TYPES)[number];

const PUBLIC_TASK_EVENT_TYPE_SET = new Set<string>(PUBLIC_TASK_EVENT_TYPES);

export function isPublicTaskEventType(value: string): value is PublicTaskEventType {
  return PUBLIC_TASK_EVENT_TYPE_SET.has(value);
}
