import { createHash, randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import { createDatabase } from "../db/kysely.ts";
import {
  createCheckpointRepository,
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime,
  type ExportTaskRecord
} from "../repositories/index.ts";
import { appendAudit } from "../audit-log/service.ts";
import {
  ApiError,
  assertExportPermission,
  isExportAdmin,
  type AuthContext
} from "../audit-log/auth-context.ts";
import { createExportFileService } from "../file-service/index.ts";

type CreateTaskBody = {
  taskCode?: string;
  subsystemCode?: string;
  fileFormat?: string;
  clientRequestId?: string;
  queryParams?: unknown;
};

function digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function taskEnvelope(task: ExportTaskRecord, extra: Record<string, unknown> = {}) {
  return {
    taskId: task.taskId,
    taskCode: task.taskCode,
    subsystemCode: task.subsystemCode,
    tenantId: task.tenantId,
    createdBy: task.createdBy,
    fileFormat: task.fileFormat,
    status: task.status,
    clientRequestId: task.clientRequestId,
    idempotencyScope: task.idempotencyScope,
    requestDigest: task.requestDigest,
    configSnapshotDigest: task.configSnapshotDigest,
    attemptNo: task.attemptNo,
    lockOwner: task.lockOwner,
    lockExpireAt: task.lockExpireAt?.toISOString() ?? null,
    leaseRenewedAt: task.leaseRenewedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    totalCount: null,
    processedCount: 0,
    progressPercent: 0,
    errorCode: null,
    errorMessage: null,
    failureStage: null,
    lastSuccessStage: null,
    ...extra
  };
}

async function rejectWithAudit(input: {
  db: Kysely<ExportPlatformDatabase>;
  auth: AuthContext;
  error: ApiError;
  action: string;
  now: Date;
  taskId?: string | null;
  attemptNo?: number | null;
  taskCode?: string | null;
  subsystemCode?: string | null;
}): Promise<never> {
  await appendAudit({
    db: input.db,
    auth: input.auth,
    taskId: input.taskId ?? null,
    attemptNo: input.attemptNo ?? null,
    taskCode: input.taskCode ?? null,
    subsystemCode: input.subsystemCode ?? null,
    action: input.action,
    result: "FAILURE",
    errorCode: input.error.code,
    now: input.now
  });
  throw input.error;
}

function parseDateFilter(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function assertTaskVisible(auth: AuthContext, task: ExportTaskRecord): void {
  if (task.tenantId === auth.tenantId && (isExportAdmin(auth) || task.createdBy === auth.operatorId)) {
    return;
  }

  throw new ApiError(403, "PERMISSION_DENIED", "operator has no permission for task", {
    taskId: task.taskId
  });
}

async function withDatabase<T>(operation: (db: Kysely<ExportPlatformDatabase>) => Promise<T>) {
  const db = createDatabase();
  try {
    return await operation(db);
  } finally {
    await db.destroy();
  }
}

export async function createExportTask(auth: AuthContext, body: CreateTaskBody) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    try {
      assertExportPermission(auth, ["EXPORT_ADMIN", "EXPORT_USER"]);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          db,
          auth,
          error,
          action: "CREATE",
          now,
          taskCode: body.taskCode ?? null,
          subsystemCode: body.subsystemCode ?? null
        });
      }
      throw error;
    }

    if (!body.taskCode || !body.subsystemCode || !body.fileFormat) {
      throw new ApiError(
        400,
        "QUERY_TEMPLATE_INVALID",
        "taskCode, subsystemCode and fileFormat are required"
      );
    }

    const registries = createExportRegistryRepository(db);
    const tasks = createExportTaskRepository(db);
    const registry = await registries.findRegistryByTaskCode(body.taskCode);

    if (!registry) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_REGISTERED", "task code is not registered"),
        action: "CREATE",
        now,
        taskCode: body.taskCode,
        subsystemCode: body.subsystemCode
      });
    }
    if (!registry.enabled) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(400, "TASK_DISABLED", "task code is disabled", {
          taskCode: body.taskCode
        }),
        action: "CREATE",
        now,
        taskCode: body.taskCode,
        subsystemCode: body.subsystemCode
      });
    }

    const requestDigest = digest({
      taskCode: body.taskCode,
      subsystemCode: body.subsystemCode,
      fileFormat: body.fileFormat,
      queryParams: body.queryParams ?? null
    });
    const idempotencyScope = body.clientRequestId
      ? `${auth.tenantId}:${auth.operatorId}:${body.taskCode}:${body.clientRequestId}`
      : null;

    if (idempotencyScope) {
      const existing = await tasks.findByIdempotencyScope(idempotencyScope);
      if (existing) {
        if (existing.requestDigest !== requestDigest) {
          return rejectWithAudit({
            db,
            auth,
            error: new ApiError(409, "IDEMPOTENCY_CONFLICT", "clientRequestId conflicts", {
              idempotencyScope
            }),
            action: "CREATE",
            now,
            taskCode: body.taskCode,
            subsystemCode: body.subsystemCode
          });
        }

        const task = await tasks.findTaskById(existing.taskId);
        if (!task) {
          return rejectWithAudit({
            db,
            auth,
            error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
            action: "CREATE",
            now,
            taskCode: body.taskCode,
            subsystemCode: body.subsystemCode
          });
        }
        return {
          statusCode: 200,
          data: taskEnvelope(task, { idempotencyHit: true, requestId: auth.requestId })
        };
      }
    }

    const task = await tasks.createPendingTask({
      taskId: `exp_${randomUUID()}`,
      taskCode: body.taskCode,
      subsystemCode: body.subsystemCode,
      tenantId: auth.tenantId,
      createdBy: auth.operatorId,
      fileFormat: body.fileFormat,
      clientRequestId: body.clientRequestId ?? null,
      idempotencyScope,
      requestDigest,
      configSnapshotDigest: registry.configSnapshotDigest,
      requestPayload: JSON.stringify({
        fileFormat: body.fileFormat,
        queryParams: body.queryParams ?? null
      }),
      authContextPayload: JSON.stringify({
        operatorId: auth.operatorId,
        tenantId: auth.tenantId,
        roleCodes: auth.roleCodes,
        orgScope: auth.orgScope,
        requestId: auth.requestId
      }),
      now
    });

    await appendAudit({
      db,
      auth,
      taskId: task.taskId,
      attemptNo: task.attemptNo,
      taskCode: task.taskCode,
      subsystemCode: task.subsystemCode,
      action: "CREATE",
      now
    });

    return {
      statusCode: 201,
      data: taskEnvelope(task, { idempotencyHit: false, requestId: auth.requestId })
    };
  });
}

export async function listExportTasks(auth: AuthContext, query: Record<string, unknown>) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const page = parsePositiveInteger(query.page, 1);
    const pageSize = Math.min(parsePositiveInteger(query.pageSize, 50), 100);
    const createdBy = isExportAdmin(auth)
      ? typeof query.createdBy === "string"
        ? query.createdBy
        : undefined
      : auth.operatorId;
    const tasks = await createExportTaskRepository(db).listTasks({
      taskCode: typeof query.taskCode === "string" ? query.taskCode : undefined,
      status: typeof query.status === "string" ? query.status : undefined,
      subsystemCode: typeof query.subsystemCode === "string" ? query.subsystemCode : undefined,
      tenantId: auth.tenantId,
      createdBy,
      fileFormat: typeof query.fileFormat === "string" ? query.fileFormat : undefined,
      createdAtFrom: parseDateFilter(query.createdAtFrom),
      createdAtTo: parseDateFilter(query.createdAtTo),
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    await appendAudit({
      db,
      auth,
      taskId: null,
      attemptNo: null,
      taskCode: typeof query.taskCode === "string" ? query.taskCode : null,
      subsystemCode: typeof query.subsystemCode === "string" ? query.subsystemCode : null,
      action: "QUERY_HISTORY",
      now
    });

    return {
      items: tasks.map((task) => taskEnvelope(task, { requestId: auth.requestId })),
      page,
      pageSize,
      total: tasks.length
    };
  });
}

export async function getExportTask(auth: AuthContext, taskId: string) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const task = await createExportTaskRepository(db).findTaskById(taskId);
    if (!task) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
        action: "DETAIL_VIEW",
        now,
        taskId
      });
    }
    try {
      assertTaskVisible(auth, task);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          db,
          auth,
          error,
          action: "DETAIL_VIEW",
          now,
          taskId,
          attemptNo: task.attemptNo,
          taskCode: task.taskCode,
          subsystemCode: task.subsystemCode
        });
      }
      throw error;
    }

    const events = await createExportTaskEventRepository(db).listRecentTaskEvents(taskId);
    const checkpoint = await createCheckpointRepository(db).findLatestCheckpoint(
      taskId,
      task.attemptNo
    );

    await appendAudit({
      db,
      auth,
      taskId,
      attemptNo: task.attemptNo,
      taskCode: task.taskCode,
      subsystemCode: task.subsystemCode,
      action: "DETAIL_VIEW",
      now
    });

    return taskEnvelope(task, {
      totalCount: null,
      processedCount: checkpoint?.processedCount ?? 0,
      progressPercent: 0,
      errorCode: null,
      errorMessage: null,
      requestId: auth.requestId,
      events
    });
  });
}

export async function downloadExportTask(auth: AuthContext, taskId: string) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const task = await createExportTaskRepository(db).findTaskById(taskId);
    if (!task) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
        action: "DOWNLOAD",
        now,
        taskId
      });
    }
    try {
      assertTaskVisible(auth, task);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          db,
          auth,
          error,
          action: "DOWNLOAD",
          now,
          taskId,
          attemptNo: task.attemptNo,
          taskCode: task.taskCode,
          subsystemCode: task.subsystemCode
        });
      }
      throw error;
    }

    const file = await createExportFileRepository(db).findFileMetadata(taskId, task.attemptNo);
    if (task.status !== "COMPLETED" || !file || !file.publishedStorageKey || !file.deliveryReadyAt) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(400, "FILE_NOT_READY", "file is not ready"),
        action: "DOWNLOAD",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }
    if (file.expiresAt <= now) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(410, "FILE_EXPIRED", "file expired"),
        action: "DOWNLOAD",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }
    if (!file.checksumVerifiedAt || !file.publishedAt) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(500, "FILE_VERIFY_ERROR", "file verification failed", {
          checksumAlgorithm: file.checksumAlgorithm
        }),
        action: "DOWNLOAD",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }

    const downloadUrl = await createExportFileService({ db }).createDownloadUrl(
      file.publishedStorageKey,
      file.expiresAt
    );

    await appendAudit({
      db,
      auth,
      taskId,
      attemptNo: task.attemptNo,
      taskCode: task.taskCode,
      subsystemCode: task.subsystemCode,
      action: "DOWNLOAD",
      now
    });

    return {
      deliveryMode: "SIGNED_URL",
      downloadUrl,
      storageKey: file.publishedStorageKey,
      expiresAt: file.expiresAt.toISOString(),
      fileName: file.fileName,
      contentType: file.contentType,
      fileSize: file.fileSize,
      checksum: file.checksum,
      checksumAlgorithm: file.checksumAlgorithm,
      attemptNo: file.attemptNo
    };
  });
}

export async function cancelExportTask(auth: AuthContext, taskId: string) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const repository = createExportTaskRepository(db);
    const task = await repository.findTaskById(taskId);
    if (!task) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
        action: "CANCEL_REQUEST",
        now,
        taskId
      });
    }
    try {
      assertTaskVisible(auth, task);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          db,
          auth,
          error,
          action: "CANCEL_REQUEST",
          now,
          taskId,
          attemptNo: task.attemptNo,
          taskCode: task.taskCode,
          subsystemCode: task.subsystemCode
        });
      }
      throw error;
    }
    if (!["PENDING", "EXECUTING"].includes(task.status)) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(400, "INVALID_TASK_STATE", "current task status does not allow this operation", {
          status: task.status
        }),
        action: "CANCEL_REQUEST",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }

    const status = task.status === "PENDING" ? "CANCELED" : "EXECUTING";
    const updated = await repository.updateTaskStatus({ taskId, status, now });
    if (!updated) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
        action: "CANCEL_REQUEST",
        now,
        taskId
      });
    }

    await appendAudit({
      db,
      auth,
      taskId,
      attemptNo: updated.attemptNo,
      taskCode: updated.taskCode,
      subsystemCode: updated.subsystemCode,
      action: task.status === "PENDING" ? "CANCEL_DONE" : "CANCEL_REQUEST",
      result: task.status === "PENDING" ? "SUCCESS" : "ACCEPTED",
      now
    });

    return {
      taskId,
      status: updated.status,
      attemptNo: updated.attemptNo,
      acceptedAt: now.toISOString()
    };
  });
}

export async function retryExportTask(auth: AuthContext, taskId: string) {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const repository = createExportTaskRepository(db);
    const task = await repository.findTaskById(taskId);
    if (!task) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(404, "TASK_NOT_FOUND", "task not found"),
        action: "RETRY_REQUEST",
        now,
        taskId
      });
    }
    try {
      assertTaskVisible(auth, task);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          db,
          auth,
          error,
          action: "RETRY_REQUEST",
          now,
          taskId,
          attemptNo: task.attemptNo,
          taskCode: task.taskCode,
          subsystemCode: task.subsystemCode
        });
      }
      throw error;
    }
    if (task.status !== "FAILED") {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(400, "INVALID_TASK_STATE", "current task status does not allow this operation", {
          status: task.status
        }),
        action: "RETRY_REQUEST",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }

    const updated = await repository.retryFailedTask({ taskId, now });
    if (!updated) {
      return rejectWithAudit({
        db,
        auth,
        error: new ApiError(400, "INVALID_TASK_STATE", "current task status does not allow this operation"),
        action: "RETRY_REQUEST",
        now,
        taskId,
        attemptNo: task.attemptNo,
        taskCode: task.taskCode,
        subsystemCode: task.subsystemCode
      });
    }

    await appendAudit({
      db,
      auth,
      taskId,
      attemptNo: updated.attemptNo,
      taskCode: updated.taskCode,
      subsystemCode: updated.subsystemCode,
      action: "RETRY_REQUEST",
      result: "ACCEPTED",
      now
    });

    return {
      taskId,
      status: updated.status,
      attemptNo: updated.attemptNo,
      acceptedAt: now.toISOString()
    };
  });
}
