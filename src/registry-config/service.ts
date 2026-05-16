import { createHash } from "node:crypto";
import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import { createDatabase } from "../db/kysely.ts";
import {
  createExportRegistryRepository,
  getDatabaseTime,
  type ExportRegistryRecord
} from "../repositories/index.ts";
import { appendAudit } from "../audit-log/service.ts";
import { ApiError, assertExportPermission, type AuthContext } from "../audit-log/auth-context.ts";

type RegistryBody = {
  taskCode?: string;
  subsystemCode?: string;
  displayName?: string;
  enabled?: boolean;
  concurrencyLimit?: number;
  fileRetentionDays?: number;
  taskHistoryRetentionDays?: number;
  singleFileMaxRows?: number;
  exportMaxRows?: number;
  supportedFormats?: unknown;
  datasourceCode?: string;
  parameterSchema?: unknown;
  queryTemplate?: unknown;
  fieldMappings?: unknown;
  maskingPolicy?: unknown;
  dataScopeTemplate?: string;
  cursorField?: string;
  orderBy?: unknown;
  batchSize?: number;
};

function stableText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableText(value)).digest("hex")}`;
}

async function withDatabase<T>(operation: (db: Kysely<ExportPlatformDatabase>) => Promise<T>) {
  const db = createDatabase();
  try {
    return await operation(db);
  } finally {
    await db.destroy();
  }
}

async function rejectRegistryWithAudit(input: {
  db: Kysely<ExportPlatformDatabase>;
  auth: AuthContext;
  error: ApiError;
  action: string;
  now: Date;
  taskCode?: string | null;
  subsystemCode?: string | null;
}): Promise<never> {
  await appendAudit({
    db: input.db,
    auth: input.auth,
    taskId: null,
    attemptNo: null,
    taskCode: input.taskCode ?? null,
    subsystemCode: input.subsystemCode ?? null,
    action: input.action,
    result: "FAILED",
    errorCode: input.error.code,
    now: input.now
  });
  throw input.error;
}

async function requireRegistryAdmin(input: {
  db: Kysely<ExportPlatformDatabase>;
  auth: AuthContext;
  action: string;
  now: Date;
  taskCode?: string | null;
  subsystemCode?: string | null;
}): Promise<void> {
  try {
    assertExportPermission(input.auth, ["EXPORT_ADMIN"]);
  } catch (error) {
    if (error instanceof ApiError) {
      return rejectRegistryWithAudit({ ...input, error });
    }
    throw error;
  }
}

function registryEnvelope(registry: ExportRegistryRecord, auth: AuthContext) {
  return {
    taskCode: registry.taskCode,
    subsystemCode: registry.subsystemCode,
    displayName: registry.displayName,
    enabled: registry.enabled,
    concurrencyLimit: registry.concurrencyLimit,
    fileRetentionDays: registry.fileRetentionDays,
    taskHistoryRetentionDays: registry.taskHistoryRetentionDays,
    singleFileMaxRows: registry.singleFileMaxRows,
    exportMaxRows: registry.exportMaxRows,
    supportedFormats: JSON.parse(registry.supportedFormats ?? "[]"),
    datasourceCode: registry.datasourceCode,
    parameterSchema: JSON.parse(registry.parameterSchema ?? "null"),
    queryTemplate: JSON.parse(registry.queryTemplate ?? "null"),
    fieldMappings: JSON.parse(registry.fieldMappings ?? "[]"),
    maskingPolicy: JSON.parse(registry.maskingPolicy ?? "null"),
    dataScopeTemplate: registry.dataScopeTemplate,
    cursorField: registry.cursorField,
    orderBy: JSON.parse(registry.orderBy ?? "[]"),
    batchSize: registry.batchSize,
    configSnapshotDigest: registry.configSnapshotDigest,
    parameterSchemaDigest: digest(registry.parameterSchema),
    fieldMappingDigest: digest(registry.fieldMappings),
    maskingPolicyDigest: digest(registry.maskingPolicy),
    updatedAt: registry.updatedAt?.toISOString() ?? new Date(0).toISOString(),
    updatedBy: auth.operatorId
  };
}

export async function upsertExportRegistry(
  auth: AuthContext,
  body: RegistryBody,
  taskCodeOverride?: string
) {
  return withDatabase(async (db) => {
    const taskCode = taskCodeOverride ?? body.taskCode;
    const now = await getDatabaseTime(db);
    await requireRegistryAdmin({
      db,
      auth,
      action: taskCodeOverride ? "REGISTRY_UPDATE" : "REGISTRY_CREATE",
      now,
      taskCode: taskCode ?? null,
      subsystemCode: body.subsystemCode ?? null
    });

    if (!taskCode || !body.subsystemCode || !body.displayName || !body.datasourceCode) {
      throw new ApiError(400, "QUERY_TEMPLATE_INVALID", "registry payload is incomplete");
    }

    const repository = createExportRegistryRepository(db);
    const parameterSchemaDigest = digest(body.parameterSchema);
    const fieldMappingDigest = digest(body.fieldMappings);
    const maskingPolicyDigest = digest(body.maskingPolicy);
    const configSnapshotDigest = digest({
      taskCode,
      parameterSchemaDigest,
      fieldMappingDigest,
      maskingPolicyDigest,
      queryTemplate: body.queryTemplate,
      dataScopeTemplate: body.dataScopeTemplate,
      cursorField: body.cursorField,
      orderBy: body.orderBy,
      batchSize: body.batchSize
    });

    await repository.upsertRegistry({
      taskCode,
      subsystemCode: body.subsystemCode,
      displayName: body.displayName,
      enabled: body.enabled ?? true,
      concurrencyLimit: body.concurrencyLimit ?? 1,
      fileRetentionDays: body.fileRetentionDays ?? 7,
      taskHistoryRetentionDays: body.taskHistoryRetentionDays ?? 30,
      singleFileMaxRows: body.singleFileMaxRows ?? 20000,
      exportMaxRows: body.exportMaxRows ?? 100000,
      datasourceCode: body.datasourceCode,
      supportedFormats: stableText(body.supportedFormats ?? []),
      parameterSchema: stableText(body.parameterSchema),
      queryTemplate: stableText(body.queryTemplate),
      fieldMappings: stableText(body.fieldMappings ?? []),
      maskingPolicy: stableText(body.maskingPolicy),
      dataScopeTemplate: body.dataScopeTemplate ?? "",
      cursorField: body.cursorField ?? "",
      orderBy: stableText(body.orderBy ?? []),
      batchSize: body.batchSize ?? 500,
      configSnapshotDigest,
      parameterSchemaDigest,
      fieldMappingDigest,
      maskingPolicyDigest,
      now
    });

    const registry = await repository.findRegistryByTaskCode(taskCode);
    if (!registry) {
      return rejectRegistryWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_REGISTERED", "registry not found"),
        action: taskCodeOverride ? "REGISTRY_UPDATE" : "REGISTRY_CREATE",
        now,
        taskCode
      });
    }

    await appendAudit({
      db,
      auth,
      taskId: null,
      attemptNo: null,
      taskCode: registry.taskCode,
      subsystemCode: registry.subsystemCode,
      action: taskCodeOverride ? "REGISTRY_UPDATE" : "REGISTRY_CREATE",
      now
    });

    return registryEnvelope(registry, auth);
  });
}

export async function listExportRegistries(auth: AuthContext, query: Record<string, unknown>) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    await requireRegistryAdmin({
      db,
      auth,
      action: "REGISTRY_QUERY",
      now
    });

    const registries = await createExportRegistryRepository(db).listRegistries({
      taskCode: typeof query.taskCode === "string" ? query.taskCode : undefined,
      subsystemCode: typeof query.subsystemCode === "string" ? query.subsystemCode : undefined,
      enabled:
        typeof query.enabled === "string"
          ? query.enabled === "true"
          : typeof query.enabled === "boolean"
            ? query.enabled
            : undefined
    });

    await appendAudit({
      db,
      auth,
      taskId: null,
      attemptNo: null,
      taskCode: typeof query.taskCode === "string" ? query.taskCode : null,
      subsystemCode: typeof query.subsystemCode === "string" ? query.subsystemCode : null,
      action: "REGISTRY_QUERY",
      now
    });

    return {
      items: registries.map((registry) => registryEnvelope(registry, auth)),
      page: 1,
      pageSize: registries.length,
      total: registries.length
    };
  });
}

export async function getExportRegistry(auth: AuthContext, taskCode: string) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    await requireRegistryAdmin({
      db,
      auth,
      action: "REGISTRY_DETAIL",
      now,
      taskCode
    });

    const registry = await createExportRegistryRepository(db).findRegistryByTaskCode(taskCode);
    if (!registry) {
      return rejectRegistryWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_REGISTERED", "registry not found"),
        action: "REGISTRY_DETAIL",
        now,
        taskCode
      });
    }
    await appendAudit({
      db,
      auth,
      taskId: null,
      attemptNo: null,
      taskCode: registry.taskCode,
      subsystemCode: registry.subsystemCode,
      action: "REGISTRY_DETAIL",
      now
    });
    return registryEnvelope(registry, auth);
  });
}

export async function setExportRegistryEnabled(
  auth: AuthContext,
  taskCode: string,
  enabled: boolean
) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    await requireRegistryAdmin({
      db,
      auth,
      action: enabled ? "REGISTRY_ENABLE" : "REGISTRY_DISABLE",
      now,
      taskCode
    });

    const repository = createExportRegistryRepository(db);
    const registry = await repository.setRegistryEnabled({ taskCode, enabled, now });
    if (!registry) {
      return rejectRegistryWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_REGISTERED", "registry not found"),
        action: enabled ? "REGISTRY_ENABLE" : "REGISTRY_DISABLE",
        now,
        taskCode
      });
    }

    await appendAudit({
      db,
      auth,
      taskId: null,
      attemptNo: null,
      taskCode: registry.taskCode,
      subsystemCode: registry.subsystemCode,
      action: enabled ? "REGISTRY_ENABLE" : "REGISTRY_DISABLE",
      now
    });

    return registryEnvelope(registry, auth);
  });
}
