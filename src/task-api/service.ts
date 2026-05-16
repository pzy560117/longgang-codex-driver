import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import { createDatabase } from "../db/kysely.ts";
import {
  createExportAuditRepository,
  createCheckpointRepository,
  createExportFileRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  createExportTaskRepository,
  getDatabaseTime,
  type AuditLogRecord,
  type CheckpointRecord,
  type ExportTaskRecord,
  type TaskEventRecord
} from "../repositories/index.ts";
import { appendAudit } from "../audit-log/service.ts";
import {
  isPublicTaskEventType,
  normalizePublicResponseCode
} from "../contracts/public-enums.ts";
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

export type DownloadDeliveryMode = "SIGNED_URL" | "STREAM";

type DownloadSignedUrlResponse = {
  deliveryMode: "SIGNED_URL";
  downloadUrl: string;
  storageKey: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  checksum: string;
  checksumAlgorithm: string;
  attemptNo: number;
};

type DownloadStreamResponse = {
  deliveryMode: "STREAM";
  body: Buffer;
  storageKey: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  checksum: string;
  checksumAlgorithm: string;
  attemptNo: number;
};

type SignedDownloadQuery = {
  expiresAt?: unknown;
  signature?: unknown;
  signatureAlgorithm?: unknown;
  operatorId?: unknown;
  tenantId?: unknown;
  roleCodes?: unknown;
  orgScope?: unknown;
  requestId?: unknown;
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
    totalCount: 0,
    processedCount: 0,
    progressPercent: 0,
    errorCode: null,
    errorMessage: null,
    failureStage: null,
    lastSuccessStage: null,
    recentEvents: [],
    ...extra
  };
}

function parseJsonRecord(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value;
}

function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Number(value.toFixed(2))));
}

function responseCodeMessage(code: string | null): string | null {
  switch (code) {
    case "QUERY_EXECUTION_ERROR":
      return "query execution error";
    case "DATASOURCE_UNAVAILABLE":
      return "datasource unavailable";
    case "QUERY_TEMPLATE_INVALID":
      return "query template invalid";
    case "FIELD_MAPPING_INVALID":
      return "field mapping invalid";
    case "MASKING_RULE_ERROR":
      return "masking rule error";
    case "EXPORT_RENDER_ERROR":
      return "export render error";
    case "FILE_VERIFY_ERROR":
      return "file verification failed";
    case "EXPORT_LIMIT_EXCEEDED":
      return "export limit exceeded";
    default:
      return null;
  }
}

function resolveTotalCount(input: {
  task: ExportTaskRecord;
  checkpoint: CheckpointRecord | undefined;
  events: TaskEventRecord[];
}): number {
  const eventTotal = input.events.reduce<number | null>((current, event) => {
    const checkpoint = parseJsonRecord(event.batchCheckpoint);
    const totalCount = readNonNegativeInteger(checkpoint?.totalCount);
    if (totalCount !== null) {
      return current === null ? totalCount : Math.max(current, totalCount);
    }
    return current;
  }, null);

  if (eventTotal !== null) {
    return eventTotal;
  }

  if (input.task.status === "COMPLETED") {
    return input.checkpoint?.processedCount ?? 0;
  }

  return 0;
}

function resolveProcessedCount(input: {
  task: ExportTaskRecord;
  checkpoint: CheckpointRecord | undefined;
  totalCount: number;
}): number {
  const checkpointCount = input.checkpoint?.processedCount ?? 0;
  if (input.totalCount > 0) {
    return Math.min(checkpointCount, input.totalCount);
  }

  if (input.task.status === "COMPLETED" && checkpointCount === 0) {
    return input.totalCount;
  }

  return checkpointCount;
}

function resolveProgressPercent(input: {
  task: ExportTaskRecord;
  processedCount: number;
  totalCount: number;
}): number {
  if (input.totalCount > 0) {
    return clampProgressPercent((input.processedCount / input.totalCount) * 100);
  }

  if (input.task.status === "COMPLETED") {
    return 100;
  }

  return 0;
}

function resolveTaskFailure(
  audits: AuditLogRecord[],
  events: TaskEventRecord[]
): {
  errorCode: string | null;
  errorMessage: string | null;
} {
  const auditFailures = audits
    .filter((audit) => audit.result === "FAILED" && audit.errorCode !== "SUCCESS")
    .map((audit) => ({
      occurredAt: audit.occurredAt,
      errorCode: normalizePublicResponseCode(audit.errorCode, "QUERY_EXECUTION_ERROR"),
      errorMessage: responseCodeMessage(
        normalizePublicResponseCode(audit.errorCode, "QUERY_EXECUTION_ERROR")
      )
    }));

  const eventFailures = events.flatMap((event) => {
    const checkpoint = parseJsonRecord(event.batchCheckpoint);
    const rawErrorCode = readNonEmptyString(checkpoint?.errorCode);
    if (!rawErrorCode || rawErrorCode === "SUCCESS") {
      return [];
    }
    const errorCode = normalizePublicResponseCode(rawErrorCode, "QUERY_EXECUTION_ERROR");

    return [
      {
        occurredAt: event.occurredAt,
        errorCode,
        errorMessage: readNonEmptyString(checkpoint?.errorMessage) ?? responseCodeMessage(errorCode)
      }
    ];
  });

  const failedRecord = [...auditFailures, ...eventFailures].sort(
    (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()
  )[0];

  if (!failedRecord) {
    return {
      errorCode: null,
      errorMessage: null
    };
  }

  return {
    errorCode: failedRecord.errorCode,
    errorMessage: failedRecord.errorMessage
  };
}

function publicBatchCheckpoint(value: string | null | undefined): Record<string, unknown> | null {
  const checkpoint = parseJsonRecord(value);
  if (!checkpoint) {
    return null;
  }

  const allowedFields = [
    "lastCursor",
    "processedCount",
    "totalCount",
    "filePartNo",
    "retryCount",
    "batchSize",
    "batchRowCount",
    "backoffMs",
    "failureReason",
    "renderInputSummary",
    "attemptNo",
    "lockOwner",
    "lockExpireAt",
    "leaseRenewedAt",
    "databaseTime",
    "takeoverRule"
  ];
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(checkpoint, field))
      .map((field) => [field, checkpoint[field]])
  );
}

function mapRecentTaskEvent(event: TaskEventRecord) {
  return {
    taskId: event.taskId,
    attemptNo: event.attemptNo,
    eventType: event.eventType,
    requestId: event.requestId,
    datasourceCode: event.datasourceCode,
    queryTemplateVersion: event.queryTemplateVersion,
    batchCheckpoint: publicBatchCheckpoint(event.batchCheckpoint),
    occurredAt: event.occurredAt.toISOString()
  };
}

function mapPublicRecentTaskEvents(events: TaskEventRecord[]) {
  return events
    .filter((event) => isPublicTaskEventType(event.eventType))
    .map(mapRecentTaskEvent);
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
    result: "FAILED",
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

function resolveDownloadMode(mode: string | undefined): DownloadDeliveryMode {
  if (!mode || mode === "SIGNED_URL") {
    return "SIGNED_URL";
  }
  if (mode === "STREAM") {
    return "STREAM";
  }

  throw new ApiError(400, "VALIDATION_ERROR", "mode must be SIGNED_URL or STREAM", {
    mode
  });
}

function toDownloadMetadata(
  file: NonNullable<Awaited<ReturnType<ReturnType<typeof createExportFileRepository>["findFileMetadata"]>>>
) {
  return {
    storageKey: file.publishedStorageKey!,
    expiresAt: file.expiresAt.toISOString(),
    fileName: file.fileName,
    contentType: file.contentType,
    fileSize: file.fileSize,
    checksum: file.checksum,
    checksumAlgorithm: file.checksumAlgorithm,
    attemptNo: file.attemptNo
  };
}

function requireDownloadSigningSecret(): string {
  const secret = process.env.EXPORT_PLATFORM_DOWNLOAD_URL_SIGNING_SECRET;
  if (!secret) {
    throw new ApiError(
      500,
      "FILE_VERIFY_ERROR",
      "download URL signing secret is not configured"
    );
  }
  return secret;
}

function readSignedQueryText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function createSignedDownloadSignature(input: {
  taskId: string;
  storageKey: string;
  expiresAt: string;
  operatorId: string;
  tenantId: string;
  roleCodes: string;
  orgScope: string;
  requestId: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update([
      "GET",
      input.taskId,
      input.storageKey,
      input.expiresAt,
      input.operatorId,
      input.tenantId,
      input.roleCodes,
      input.orgScope,
      input.requestId
    ].join("\n"))
    .digest("hex");
}

function isValidSignature(value: string, expected: string): boolean {
  const signature = Buffer.from(value, "hex");
  const expectedSignature = Buffer.from(expected, "hex");
  return signature.length === expectedSignature.length && timingSafeEqual(signature, expectedSignature);
}

function createPlatformSignedDownloadUrl(input: {
  taskId: string;
  storageKey: string;
  expiresAt: string;
  auth: AuthContext;
  secret: string;
}): string {
  const baseUrl = process.env.EXPORT_PLATFORM_PUBLIC_BASE_URL ?? "http://export-platform.local";
  const url = new URL(`/api/export/tasks/${encodeURIComponent(input.taskId)}/download`, baseUrl);
  const roleCodes = input.auth.roleCodes.join(",");
  url.searchParams.set("mode", "SIGNED_URL");
  url.searchParams.set("expiresAt", input.expiresAt);
  url.searchParams.set("signatureAlgorithm", "HMAC-SHA256");
  url.searchParams.set("operatorId", input.auth.operatorId);
  url.searchParams.set("tenantId", input.auth.tenantId);
  url.searchParams.set("roleCodes", roleCodes);
  url.searchParams.set("orgScope", input.auth.orgScope);
  url.searchParams.set("requestId", input.auth.requestId);
  url.searchParams.set(
    "signature",
    createSignedDownloadSignature({
      taskId: input.taskId,
      storageKey: input.storageKey,
      expiresAt: input.expiresAt,
      operatorId: input.auth.operatorId,
      tenantId: input.auth.tenantId,
      roleCodes,
      orgScope: input.auth.orgScope,
      requestId: input.auth.requestId,
      secret: input.secret
    })
  );
  return url.toString();
}

function toStorageApiError(error: unknown, file: { checksumAlgorithm: string }): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error && error.name === "EXPORT_RENDER_ERROR") {
    return new ApiError(502, "EXPORT_RENDER_ERROR", error.message);
  }

  if (error instanceof Error && error.name === "FILE_VERIFY_ERROR") {
    return new ApiError(500, "FILE_VERIFY_ERROR", error.message, {
      checksumAlgorithm: file.checksumAlgorithm
    });
  }

  return new ApiError(500, "FILE_VERIFY_ERROR", "file verification failed", {
    checksumAlgorithm: file.checksumAlgorithm
  });
}

function validateStreamBody(file: { fileSize: number; checksum: string; checksumAlgorithm: string }, body: Buffer) {
  const checksum = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  if (body.byteLength !== file.fileSize || checksum !== file.checksum) {
    throw new ApiError(500, "FILE_VERIFY_ERROR", "streamed file verification failed", {
      checksumAlgorithm: file.checksumAlgorithm
    });
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
        queryParams: body.queryParams ?? null,
        configSnapshot: {
          taskCode: registry.taskCode,
          subsystemCode: registry.subsystemCode,
          displayName: registry.displayName,
          enabled: registry.enabled,
          concurrencyLimit: registry.concurrencyLimit,
          fileRetentionDays: registry.fileRetentionDays,
          taskHistoryRetentionDays: registry.taskHistoryRetentionDays,
          singleFileMaxRows: registry.singleFileMaxRows,
          exportMaxRows: registry.exportMaxRows,
          datasourceCode: registry.datasourceCode,
          supportedFormats: registry.supportedFormats,
          parameterSchema: registry.parameterSchema,
          queryTemplate: registry.queryTemplate,
          fieldMappings: registry.fieldMappings,
          maskingPolicy: registry.maskingPolicy,
          dataScopeTemplate: registry.dataScopeTemplate,
          cursorField: registry.cursorField,
          orderBy: registry.orderBy,
          batchSize: registry.batchSize,
          configSnapshotDigest: registry.configSnapshotDigest
        }
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
      tenantId: isExportAdmin(auth) ? undefined : auth.tenantId,
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

    const audits = await createExportAuditRepository(db).listAuditLogsForTask(taskId);
    const events = await createExportTaskEventRepository(db).listRecentTaskEvents(taskId);
    const checkpoint = await createCheckpointRepository(db).findLatestCheckpoint(
      taskId,
      task.attemptNo
    );
    const totalCount = resolveTotalCount({
      task,
      checkpoint,
      events
    });
    const processedCount = resolveProcessedCount({
      task,
      checkpoint,
      totalCount
    });
    const progressPercent = resolveProgressPercent({
      task,
      processedCount,
      totalCount
    });
    const failure = task.status === "FAILED"
      ? resolveTaskFailure(audits, events)
      : { errorCode: null, errorMessage: null };

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
      totalCount,
      processedCount,
      progressPercent,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      requestId: auth.requestId,
      recentEvents: mapPublicRecentTaskEvents(events)
    });
  });
}

export async function downloadExportTask(
  auth: AuthContext,
  taskId: string,
  requestedMode?: string
): Promise<DownloadSignedUrlResponse | DownloadStreamResponse> {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const deliveryMode = resolveDownloadMode(requestedMode);
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

    const fileService = createExportFileService({ db });
    const metadata = toDownloadMetadata(file);
    let responseData: DownloadSignedUrlResponse | DownloadStreamResponse;

    try {
      if (deliveryMode === "STREAM") {
        const body = await fileService.readObject(file.publishedStorageKey);
        validateStreamBody(file, body);
        responseData = {
          deliveryMode,
          body,
          ...metadata
        };
      } else {
        const signedDownload = await fileService.createDownloadUrl(file.publishedStorageKey, {
          now
        });
        const downloadUrl = createPlatformSignedDownloadUrl({
          taskId,
          storageKey: file.publishedStorageKey,
          expiresAt: signedDownload.expiresAt.toISOString(),
          auth,
          secret: requireDownloadSigningSecret()
        });
        responseData = {
          deliveryMode,
          downloadUrl,
          ...metadata,
          expiresAt: signedDownload.expiresAt.toISOString()
        };
      }
    } catch (error) {
      return rejectWithAudit({
        db,
        auth,
        error: toStorageApiError(error, file),
        action: "DOWNLOAD",
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
      attemptNo: task.attemptNo,
      taskCode: task.taskCode,
      subsystemCode: task.subsystemCode,
      action: "DOWNLOAD",
      now
    });

    return responseData;
  });
}

export async function downloadSignedExportTask(
  taskId: string,
  query: SignedDownloadQuery
): Promise<DownloadStreamResponse> {
  return withDatabase(async (db) => {
    const now = await getDatabaseTime(db);
    const expiresAt = readSignedQueryText(query.expiresAt);
    const signature = readSignedQueryText(query.signature);
    const untrustedOperatorId = readSignedQueryText(query.operatorId);
    const untrustedTenantId = readSignedQueryText(query.tenantId);
    const untrustedRoleCodes = readSignedQueryText(query.roleCodes) ?? "";
    const untrustedOrgScope = readSignedQueryText(query.orgScope);
    const untrustedRequestId = readSignedQueryText(query.requestId);
    const systemAuth: AuthContext = {
      operatorId: "signed-download",
      tenantId: "",
      roleCodes: [],
      orgScope: "",
      requestId: `signed-download-${randomUUID()}`
    };
    const task = await createExportTaskRepository(db).findTaskById(taskId);
    const file = task
      ? await createExportFileRepository(db).findFileMetadata(taskId, task.attemptNo)
      : null;

    const unverifiedAuditBase = {
      db,
      auth: systemAuth,
      action: "DOWNLOAD",
      now,
      taskId,
      attemptNo: task?.attemptNo ?? null,
      taskCode: task?.taskCode ?? null,
      subsystemCode: task?.subsystemCode ?? null
    };

    if (
      query.signatureAlgorithm !== "HMAC-SHA256" ||
      !expiresAt ||
      !signature ||
      !untrustedOperatorId ||
      !untrustedTenantId ||
      !untrustedRequestId
    ) {
      return rejectWithAudit({
        ...unverifiedAuditBase,
        error: new ApiError(403, "SIGNATURE_INVALID", "download signature is invalid")
      });
    }
    const expiresAtTime = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtTime)) {
      return rejectWithAudit({
        ...unverifiedAuditBase,
        error: new ApiError(403, "SIGNATURE_INVALID", "download signature expiry is invalid")
      });
    }
    if (expiresAtTime <= now.getTime()) {
      return rejectWithAudit({
        ...unverifiedAuditBase,
        error: new ApiError(403, "SIGNATURE_EXPIRED", "download signature expired")
      });
    }
    if (!task || !file?.publishedStorageKey) {
      return rejectWithAudit({
        ...unverifiedAuditBase,
        error: new ApiError(403, "SIGNATURE_INVALID", "download signature is invalid")
      });
    }

    const expectedSignature = createSignedDownloadSignature({
      taskId,
      storageKey: file.publishedStorageKey,
      expiresAt,
      operatorId: untrustedOperatorId,
      tenantId: untrustedTenantId,
      roleCodes: untrustedRoleCodes,
      orgScope: untrustedOrgScope ?? "",
      requestId: untrustedRequestId,
      secret: requireDownloadSigningSecret()
    });
    if (!isValidSignature(signature, expectedSignature)) {
      return rejectWithAudit({
        ...unverifiedAuditBase,
        error: new ApiError(403, "SIGNATURE_INVALID", "download signature is invalid")
      });
    }

    const auth: AuthContext = {
      operatorId: untrustedOperatorId,
      tenantId: untrustedTenantId,
      roleCodes: untrustedRoleCodes.split(",").map((role) => role.trim()).filter(Boolean),
      orgScope: untrustedOrgScope ?? "",
      requestId: untrustedRequestId
    };
    const verifiedAuditBase = {
      ...unverifiedAuditBase,
      auth
    };
    if (task.status !== "COMPLETED" || !file.deliveryReadyAt) {
      return rejectWithAudit({
        ...verifiedAuditBase,
        error: new ApiError(400, "FILE_NOT_READY", "file is not ready")
      });
    }
    if (file.expiresAt <= now) {
      return rejectWithAudit({
        ...verifiedAuditBase,
        error: new ApiError(410, "FILE_EXPIRED", "file expired")
      });
    }
    try {
      assertTaskVisible(auth, task);
    } catch (error) {
      if (error instanceof ApiError) {
        return rejectWithAudit({
          ...verifiedAuditBase,
          error
        });
      }
      throw error;
    }

    const fileService = createExportFileService({ db });
    try {
      const body = await fileService.readObject(file.publishedStorageKey);
      validateStreamBody(file, body);
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
        deliveryMode: "STREAM",
        body,
        ...toDownloadMetadata(file)
      };
    } catch (error) {
      return rejectWithAudit({
        ...verifiedAuditBase,
        error: toStorageApiError(error, file)
      });
    }
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
