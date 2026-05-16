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
import {
  ApiError,
  assertExportPermission,
  isTrustedRegistryAdminTenant,
  type AuthContext
} from "../audit-log/auth-context.ts";
import {
  buildValidatedRegistryUpsertInput,
  type RegistryBody
} from "./contract.ts";

function stableText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(stableText(value)).digest("hex")}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { code?: unknown; errno?: unknown; cause?: unknown };
    if (candidate.code === "ER_DUP_ENTRY" || candidate.errno === 1062) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
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

  if (!isTrustedRegistryAdminTenant(input.auth)) {
    return rejectRegistryWithAudit({
      ...input,
      error: new ApiError(403, "PERMISSION_DENIED", "operator has no permission")
    });
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
  taskCodeOverride?: string,
  options: { rejectExistingOnCreate?: boolean } = {}
) {
  return withDatabase(async (db) => {
    const taskCode = taskCodeOverride ?? (typeof body.taskCode === "string" ? body.taskCode : undefined);
    const now = await getDatabaseTime(db);
    const action = taskCodeOverride ? "REGISTRY_UPDATE" : "REGISTRY_CREATE";
    await requireRegistryAdmin({
      db,
      auth,
      action,
      now,
      taskCode: taskCode ?? null,
      subsystemCode: typeof body.subsystemCode === "string" ? body.subsystemCode : null
    });

    let registryInput;
    try {
      registryInput = buildValidatedRegistryUpsertInput({
        body,
        now,
        taskCodeOverride
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectRegistryWithAudit({
          db,
          auth,
          error,
          action,
          now,
          taskCode: taskCode ?? null,
          subsystemCode: typeof body.subsystemCode === "string" ? body.subsystemCode : null
        });
      }
      throw error;
    }

    const repository = createExportRegistryRepository(db);

    try {
      if (!taskCodeOverride && options.rejectExistingOnCreate) {
        await repository.insertRegistry(registryInput);
      } else {
        await repository.upsertRegistry(registryInput);
      }
    } catch (error) {
      if (!taskCodeOverride && options.rejectExistingOnCreate && isDuplicateKeyError(error)) {
        return rejectRegistryWithAudit({
          db,
          auth,
          error: new ApiError(409, "REGISTRY_CONFLICT", "taskCode already exists"),
          action,
          now,
          taskCode: registryInput.taskCode,
          subsystemCode: registryInput.subsystemCode
        });
      }
      throw error;
    }

    const registry = await repository.findRegistryByTaskCode(registryInput.taskCode);
    if (!registry) {
      return rejectRegistryWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_REGISTERED", "registry not found"),
        action,
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
      action,
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
