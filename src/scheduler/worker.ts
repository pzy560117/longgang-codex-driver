import { randomUUID } from "node:crypto";
import { sql, type Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import { createExportFileService } from "../file-service/index.ts";
import { createQueryExecutorBatchProcessor } from "../query-executor/index.ts";
import {
  createCheckpointRepository,
  createExportAuditRepository,
  createExportRegistryRepository,
  createExportTaskEventRepository,
  getDatabaseTime,
  type CheckpointRecord,
  type ExportRegistryRecord,
  type ExportTaskLeaseRecord,
  type ExportTaskRecord
} from "../repositories/index.ts";
import { normalizePublicResponseCode } from "../contracts/public-enums.ts";

export type SchedulerBatchCheckpoint = {
  lastCursor: string | null;
  processedCount: number;
  filePartNo: number | null;
  retryCount: number;
  batchSize: number | null;
  batchRowCount: number | null;
  backoffMs: number | null;
};

export type SchedulerBatchResult = {
  checkpoint?: SchedulerBatchCheckpoint;
  outcome?: "continue" | "completed";
  rows?: Record<string, unknown>[];
  registry?: ExportRegistryRecord;
};

export type SchedulerBatchContext = {
  db: Kysely<ExportPlatformDatabase>;
  task: ExportTaskRecord;
  lease: ExportTaskLeaseRecord;
  checkpoint: CheckpointRecord | undefined;
  requestId: string;
};

export type SchedulerBatchProcessor = (
  context: SchedulerBatchContext
) => Promise<SchedulerBatchResult>;

export type SchedulerWorkerOptions = {
  db: Kysely<ExportPlatformDatabase>;
  workerId: string;
  leaseDurationSeconds?: number;
  maxTasksPerPoll?: number;
  maxQueryBatchRetries?: number;
  queryBatchBackoffBaseMs?: number;
  batchProcessor?: SchedulerBatchProcessor;
  fileService?: {
    publishRows(input: {
      task: ExportTaskRecord;
      registry: ExportRegistryRecord;
      attemptNo: number;
      requestId: string;
      rows: Record<string, unknown>[];
    }): Promise<unknown>;
  };
};

export type SchedulerPollResult = {
  dispatched: number;
  renewed: number;
  canceled: number;
  completed: number;
  failed: number;
};

type TerminalTaskStatus = "COMPLETED" | "FAILED" | "CANCELED";

type CandidateRow = {
  task_id: string;
  task_code: string;
  subsystem_code: string;
  tenant_id: string;
  created_by: string;
  file_format: string;
  status: string;
  client_request_id: string | null;
  idempotency_scope: string | null;
  request_digest: string;
  config_snapshot_digest: string;
  request_payload: string | null;
  auth_context_payload: string | null;
  attempt_no: number;
  lock_owner: string | null;
  lock_expire_at: Date | null;
  lease_renewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type TaskRequestSnapshot = {
  configSnapshot?: ExportRegistryRecord;
};

function toTaskRecord(row: CandidateRow): ExportTaskRecord {
  return {
    taskId: row.task_id,
    taskCode: row.task_code,
    subsystemCode: row.subsystem_code,
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    fileFormat: row.file_format,
    status: row.status,
    clientRequestId: row.client_request_id,
    idempotencyScope: row.idempotency_scope,
    requestDigest: row.request_digest,
    configSnapshotDigest: row.config_snapshot_digest,
    requestPayload: row.request_payload,
    authContextPayload: row.auth_context_payload,
    attemptNo: row.attempt_no,
    lockOwner: row.lock_owner,
    lockExpireAt: row.lock_expire_at,
    leaseRenewedAt: row.lease_renewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function queryDatabaseTime(db: Kysely<ExportPlatformDatabase>): Promise<Date> {
  const row = await sql<{ database_time: Date }>`SELECT CURRENT_TIMESTAMP(3) AS database_time`
    .execute(db)
    .then((result) => result.rows[0]);

  if (!row?.database_time) {
    throw new Error("Database time query returned no rows");
  }

  return new Date(row.database_time);
}

const defaultBatchProcessor = createQueryExecutorBatchProcessor();

export function createSchedulerWorker(options: SchedulerWorkerOptions) {
  const leaseDurationSeconds = options.leaseDurationSeconds ?? 300;
  const maxTasksPerPoll = options.maxTasksPerPoll ?? 1;
  const maxQueryBatchRetries = options.maxQueryBatchRetries ?? 2;
  const queryBatchBackoffBaseMs = options.queryBatchBackoffBaseMs ?? 1000;
  const batchProcessor = options.batchProcessor ?? defaultBatchProcessor;

  async function pollAndProcessOnce(): Promise<SchedulerPollResult> {
    const result: SchedulerPollResult = {
      dispatched: 0,
      renewed: 0,
      canceled: 0,
      completed: 0,
      failed: 0
    };

    for (let index = 0; index < maxTasksPerPoll; index += 1) {
      const acquired = await acquireNextLease({
        db: options.db,
        workerId: options.workerId,
        leaseDurationSeconds
      });

      if (!acquired) {
        break;
      }

      result.dispatched += 1;
      const requestId = await findRequestIdForTask(
        options.db,
        acquired.task.taskId,
        options.workerId
      );
      const now = await getDatabaseTime(options.db);

      await appendWorkerAudit({
        db: options.db,
        task: acquired.task,
        attemptNo: acquired.lease.attemptNo,
        action: "DISPATCH",
        result: "SUCCESS",
        requestId,
        now
      });
      await appendWorkerAudit({
        db: options.db,
        task: acquired.task,
        attemptNo: acquired.lease.attemptNo,
        action: "EXECUTE_START",
        result: "SUCCESS",
        requestId,
        now
      });

      const processed = await processAcquiredLease({
        db: options.db,
        task: acquired.task,
        lease: acquired.lease,
        requestId,
        leaseDurationSeconds,
        maxQueryBatchRetries,
        queryBatchBackoffBaseMs,
        batchProcessor,
        fileService: options.fileService
      });

      result.renewed += processed.renewed;
      result.canceled += processed.canceled;
      result.completed += processed.completed;
      result.failed += processed.failed;
    }

    return result;
  }

  return { pollAndProcessOnce };
}

async function acquireNextLease(input: {
  db: Kysely<ExportPlatformDatabase>;
  workerId: string;
  leaseDurationSeconds: number;
}): Promise<{ task: ExportTaskRecord; lease: ExportTaskLeaseRecord } | undefined> {
  return input.db.transaction().execute(async (trx) => {
    const databaseTime = await queryDatabaseTime(trx);
    const candidates = await trx
      .selectFrom("export_tasks as t")
      .leftJoin("export_task_checkpoints as cp", (join) =>
        join
          .onRef("cp.task_id", "=", "t.task_id")
          .onRef("cp.attempt_no", "=", "t.attempt_no")
      )
      .select([
        "t.task_id",
        "t.task_code",
        "t.subsystem_code",
        "t.tenant_id",
        "t.created_by",
        "t.file_format",
        "t.status",
        "t.client_request_id",
        "t.idempotency_scope",
        "t.request_digest",
        "t.config_snapshot_digest",
        "t.request_payload",
        "t.auth_context_payload",
        "t.attempt_no",
        "t.lock_owner",
        "t.lock_expire_at",
        "t.lease_renewed_at",
        "t.created_at",
        "t.updated_at"
      ])
      .where((eb) =>
        eb.or([
          eb("t.status", "=", "PENDING"),
          eb.and([
            eb("t.status", "=", "EXECUTING"),
            eb("t.lock_owner", "=", input.workerId),
            eb("t.lock_expire_at", ">", databaseTime)
          ]),
          eb.and([
            eb("t.status", "=", "EXECUTING"),
            eb("t.lock_expire_at", "<", databaseTime)
          ])
        ])
      )
      .where((eb) =>
        eb.or([
          eb("cp.task_id", "is", null),
          eb("cp.backoff_ms", "is", null),
          eb("cp.backoff_ms", "<=", 0),
          eb(
            sql`TIMESTAMPADD(MICROSECOND, COALESCE(cp.backoff_ms, 0) * 1000, cp.updated_at)`,
            "<=",
            sql`CURRENT_TIMESTAMP(3)`
          )
        ])
      )
      .orderBy("t.created_at", "asc")
      .orderBy("t.task_id", "asc")
      .limit(25)
      .forUpdate()
      .execute();

    for (const candidate of candidates) {
      const isOwnActiveLeaseResume =
        candidate.status === "EXECUTING" &&
        candidate.lock_owner === input.workerId &&
        candidate.lock_expire_at instanceof Date &&
        candidate.lock_expire_at > databaseTime;

      await trx
        .selectFrom("export_registries")
        .select("task_code")
        .where("subsystem_code", "=", candidate.subsystem_code)
        .orderBy("task_code", "asc")
        .forUpdate()
        .execute();

      const activeTasks = await trx
        .selectFrom("export_tasks")
        .select("task_id")
        .where("subsystem_code", "=", candidate.subsystem_code)
        .where("status", "=", "EXECUTING")
        .where("lock_expire_at", ">", databaseTime)
        .forUpdate()
        .execute();

      const concurrencyLimit = resolveTaskConcurrencyLimit(toTaskRecord(candidate));
      const activeCount = activeTasks.length;
      if (!isOwnActiveLeaseResume && activeCount >= concurrencyLimit) {
        continue;
      }

      const lockExpireAt = new Date(
        databaseTime.getTime() + input.leaseDurationSeconds * 1000
      );
      const takeoverRule =
        isOwnActiveLeaseResume
          ? "ACTIVE_LEASE_RESUME_SAME_OWNER"
          : candidate.status === "EXECUTING"
          ? "EXPIRED_LEASE_TAKEOVER_KEEP_ATTEMPT"
          : "PENDING_OR_EXPIRED_KEEP_ATTEMPT";
      const previousLockOwner =
        takeoverRule === "EXPIRED_LEASE_TAKEOVER_KEEP_ATTEMPT"
          ? candidate.lock_owner
          : null;

      await trx
        .updateTable("export_tasks")
        .set({
          status: "EXECUTING",
          lock_owner: input.workerId,
          lock_expire_at: lockExpireAt,
          lease_renewed_at: databaseTime,
          updated_at: databaseTime
        })
        .where("task_id", "=", candidate.task_id)
        .where("attempt_no", "=", candidate.attempt_no)
        .execute();

      await trx
        .insertInto("export_task_leases")
        .values({
          task_id: candidate.task_id,
          attempt_no: candidate.attempt_no,
          lock_owner: input.workerId,
          previous_lock_owner: previousLockOwner,
          lock_expire_at: lockExpireAt,
          lease_renewed_at: databaseTime,
          database_time: databaseTime,
          takeover_rule: takeoverRule,
          created_at: databaseTime,
          updated_at: databaseTime
        })
        .onDuplicateKeyUpdate({
          lock_owner: input.workerId,
          previous_lock_owner: previousLockOwner,
          lock_expire_at: lockExpireAt,
          lease_renewed_at: databaseTime,
          database_time: databaseTime,
          takeover_rule: takeoverRule,
          updated_at: databaseTime
        })
        .execute();

      const task = toTaskRecord({
        ...candidate,
        status: "EXECUTING",
        lock_owner: input.workerId,
        lock_expire_at: lockExpireAt,
        lease_renewed_at: databaseTime,
        updated_at: databaseTime
      });

      return {
        task,
        lease: {
          taskId: candidate.task_id,
          attemptNo: candidate.attempt_no,
          lockOwner: input.workerId,
          previousLockOwner,
          lockExpireAt,
          leaseRenewedAt: databaseTime,
          databaseTime,
          takeoverRule
        }
      };
    }

    return undefined;
  });
}

async function processAcquiredLease(input: {
  db: Kysely<ExportPlatformDatabase>;
  task: ExportTaskRecord;
  lease: ExportTaskLeaseRecord;
  requestId: string;
  leaseDurationSeconds: number;
  maxQueryBatchRetries: number;
  queryBatchBackoffBaseMs: number;
  batchProcessor: SchedulerBatchProcessor;
  fileService?: SchedulerWorkerOptions["fileService"];
}): Promise<Omit<SchedulerPollResult, "dispatched">> {
  const result = {
    renewed: 0,
    canceled: 0,
    completed: 0,
    failed: 0
  };

  try {
    const checkpoints = createCheckpointRepository(input.db);
    const checkpoint = await checkpoints.findLatestCheckpoint(
      input.task.taskId,
      input.lease.attemptNo
    );
    let batch: SchedulerBatchResult;
    try {
      batch = await input.batchProcessor({
        db: input.db,
        task: input.task,
        lease: input.lease,
        checkpoint,
        requestId: input.requestId
      });
    } catch (error) {
      if (
        isRetryableBatchError(error) &&
        (checkpoint?.retryCount ?? 0) < input.maxQueryBatchRetries
      ) {
        const retryCount = (checkpoint?.retryCount ?? 0) + 1;
        const backoffMs = calculateBackoffMs(input.queryBatchBackoffBaseMs, retryCount);
        const now = await getDatabaseTime(input.db);
        await checkpoints.saveCheckpoint({
          taskId: input.task.taskId,
          attemptNo: input.lease.attemptNo,
          lastCursor: checkpoint?.lastCursor ?? null,
          processedCount: checkpoint?.processedCount ?? 0,
          filePartNo: checkpoint?.filePartNo ?? 1,
          retryCount,
          batchSize: checkpoint?.batchSize ?? null,
          batchRowCount: checkpoint?.batchRowCount ?? 0,
          backoffMs,
          now
        });
        const renewed = await renewLeaseAtBatchBoundary({
          db: input.db,
          taskId: input.task.taskId,
          attemptNo: input.lease.attemptNo,
          lockOwner: input.lease.lockOwner,
          leaseDurationSeconds: input.leaseDurationSeconds
        });
        result.renewed = renewed ? 1 : 0;
        return result;
      }
      throw error;
    }
    const now = await getDatabaseTime(input.db);

    if (batch.checkpoint) {
      await checkpoints.saveCheckpoint({
        taskId: input.task.taskId,
        attemptNo: input.lease.attemptNo,
        ...batch.checkpoint,
        now
      });
    }

    if (await hasAcceptedCancelRequest(input.db, input.task.taskId, input.lease.attemptNo)) {
      const canceledAt = await markTaskTerminal({
        db: input.db,
        task: input.task,
        attemptNo: input.lease.attemptNo,
        lockOwner: input.lease.lockOwner,
        status: "CANCELED"
      });
      await appendWorkerAudit({
        db: input.db,
        task: input.task,
        attemptNo: input.lease.attemptNo,
        action: "CANCEL_DONE",
        result: "SUCCESS",
        requestId: input.requestId,
        now: canceledAt
      });
      result.canceled = 1;
      return result;
    }

    if (batch.outcome === "completed") {
      if (Array.isArray(batch.rows)) {
        const registry =
          batch.registry ??
          resolveTaskRegistrySnapshot(input.task) ??
          (await createExportRegistryRepository(input.db).findRegistryByTaskCode(input.task.taskCode));
        if (!registry) {
          throw new Error("TASK_NOT_REGISTERED: registry snapshot is not available for file publish");
        }
        const fileService = input.fileService ?? createExportFileService({ db: input.db });
        await ensureLeaseAtBatchBoundary({
          db: input.db,
          taskId: input.task.taskId,
          attemptNo: input.lease.attemptNo,
          lockOwner: input.lease.lockOwner,
          leaseDurationSeconds: input.leaseDurationSeconds
        });
        await fileService.publishRows({
          task: input.task,
          registry,
          attemptNo: input.lease.attemptNo,
          requestId: input.requestId,
          rows: batch.rows
        });
      }
      const completedAt = await markTaskTerminal({
        db: input.db,
        task: input.task,
        attemptNo: input.lease.attemptNo,
        lockOwner: input.lease.lockOwner,
        status: "COMPLETED"
      });
      await appendWorkerAudit({
        db: input.db,
        task: input.task,
        attemptNo: input.lease.attemptNo,
        action: "EXECUTE_SUCCESS",
        result: "SUCCESS",
        requestId: input.requestId,
        now: completedAt
      });
      result.completed = 1;
      return result;
    }

    const renewed = await renewLeaseAtBatchBoundary({
      db: input.db,
      taskId: input.task.taskId,
      attemptNo: input.lease.attemptNo,
      lockOwner: input.lease.lockOwner,
      leaseDurationSeconds: input.leaseDurationSeconds
    });

    result.renewed = renewed ? 1 : 0;
    return result;
  } catch (error) {
    if (isLeaseLostError(error)) {
      return result;
    }

    let failedAt: Date;
    try {
      failedAt = await markTaskTerminal({
        db: input.db,
        task: input.task,
        attemptNo: input.lease.attemptNo,
        lockOwner: input.lease.lockOwner,
        status: "FAILED"
      });
    } catch (terminalError) {
      if (isLeaseLostError(terminalError)) {
        return result;
      }
      throw terminalError;
    }

    await appendWorkerAudit({
      db: input.db,
      task: input.task,
      attemptNo: input.lease.attemptNo,
      action: "EXECUTE_FAILED",
      result: "FAILED",
      errorCode: normalizePublicResponseCode(
        error instanceof Error && error.name !== "Error" ? error.name : null,
        "QUERY_EXECUTION_ERROR"
      ),
      requestId: input.requestId,
      now: failedAt
    });
    result.failed = 1;
    return result;
  }
}

async function ensureLeaseAtBatchBoundary(input: {
  db: Kysely<ExportPlatformDatabase>;
  taskId: string;
  attemptNo: number;
  lockOwner: string;
  leaseDurationSeconds: number;
}): Promise<void> {
  const renewed = await renewLeaseAtBatchBoundary(input);
  if (!renewed) {
    throw leaseLostError(
      `worker ${input.lockOwner} no longer owns an active lease for task ${input.taskId}`
    );
  }
}

async function renewLeaseAtBatchBoundary(input: {
  db: Kysely<ExportPlatformDatabase>;
  taskId: string;
  attemptNo: number;
  lockOwner: string;
  leaseDurationSeconds: number;
}): Promise<boolean> {
  return input.db.transaction().execute(async (trx) => {
    const databaseTime = await queryDatabaseTime(trx);
    const lockExpireAt = new Date(
      databaseTime.getTime() + input.leaseDurationSeconds * 1000
    );
    const task = await trx
      .selectFrom("export_tasks")
      .select(["task_id"])
      .where("task_id", "=", input.taskId)
      .where("attempt_no", "=", input.attemptNo)
      .where("lock_owner", "=", input.lockOwner)
      .where("status", "=", "EXECUTING")
      .where("lock_expire_at", ">", databaseTime)
      .forUpdate()
      .executeTakeFirst();

    if (!task) {
      return false;
    }

    await trx
      .updateTable("export_tasks")
      .set({
        lock_expire_at: lockExpireAt,
        lease_renewed_at: databaseTime,
        updated_at: databaseTime
      })
      .where("task_id", "=", input.taskId)
      .execute();

    await trx
      .updateTable("export_task_leases")
      .set({
        lock_expire_at: lockExpireAt,
        lease_renewed_at: databaseTime,
        database_time: databaseTime,
        updated_at: databaseTime
      })
      .where("task_id", "=", input.taskId)
      .where("attempt_no", "=", input.attemptNo)
      .where("lock_owner", "=", input.lockOwner)
      .execute();

    return true;
  });
}

async function markTaskTerminal(input: {
  db: Kysely<ExportPlatformDatabase>;
  task: ExportTaskRecord;
  attemptNo: number;
  lockOwner: string;
  status: TerminalTaskStatus;
}): Promise<Date> {
  return input.db.transaction().execute(async (trx) => {
    const databaseTime = await queryDatabaseTime(trx);
    const activeLease = await trx
      .selectFrom("export_tasks")
      .select("task_id")
      .where("task_id", "=", input.task.taskId)
      .where("attempt_no", "=", input.attemptNo)
      .where("lock_owner", "=", input.lockOwner)
      .where("status", "=", "EXECUTING")
      .where("lock_expire_at", ">", databaseTime)
      .forUpdate()
      .executeTakeFirst();

    if (!activeLease) {
      throw leaseLostError(
        `worker ${input.lockOwner} cannot mark task ${input.task.taskId} as ${input.status}`
      );
    }

    const updateResult = await trx
      .updateTable("export_tasks")
      .set({
        status: input.status,
        lock_owner: null,
        lock_expire_at: null,
        lease_renewed_at: null,
        updated_at: databaseTime
      })
      .where("task_id", "=", input.task.taskId)
      .where("attempt_no", "=", input.attemptNo)
      .where("lock_owner", "=", input.lockOwner)
      .where("status", "=", "EXECUTING")
      .where("lock_expire_at", ">", databaseTime)
      .executeTakeFirst();

    if (toUpdatedRowCount(updateResult.numUpdatedRows) !== 1) {
      throw leaseLostError(
        `worker ${input.lockOwner} lost the lease before marking task ${input.task.taskId} terminal`
      );
    }

    return databaseTime;
  });
}

async function hasAcceptedCancelRequest(
  db: Kysely<ExportPlatformDatabase>,
  taskId: string,
  attemptNo: number
): Promise<boolean> {
  const row = await db
    .selectFrom("export_audit_logs")
    .select((eb) => eb.fn.count<number>("audit_id").as("cancel_count"))
    .where("task_id", "=", taskId)
    .where("attempt_no", "=", attemptNo)
    .where("action", "=", "CANCEL_REQUEST")
    .where("result", "=", "ACCEPTED")
    .executeTakeFirst();

  return Number(row?.cancel_count ?? 0) > 0;
}

async function findRequestIdForTask(
  db: Kysely<ExportPlatformDatabase>,
  taskId: string,
  workerId: string
): Promise<string> {
  const row = await db
    .selectFrom("export_audit_logs")
    .select("request_id")
    .where("task_id", "=", taskId)
    .where("action", "in", ["CREATE", "RETRY_REQUEST", "CANCEL_REQUEST"])
    .orderBy("occurred_at", "asc")
    .executeTakeFirst();

  return row?.request_id ?? `scheduler:${workerId}`;
}

async function appendWorkerAudit(input: {
  db: Kysely<ExportPlatformDatabase>;
  task: ExportTaskRecord;
  attemptNo: number;
  action: string;
  result: string;
  requestId: string;
  now: Date;
  errorCode?: string;
}): Promise<void> {
  await createExportAuditRepository(input.db).appendAuditLog({
    auditId: `audit_${randomUUID()}`,
    taskId: input.task.taskId,
    attemptNo: input.attemptNo,
    taskCode: input.task.taskCode,
    subsystemCode: input.task.subsystemCode,
    operatorId: input.task.createdBy,
    action: input.action,
    result: input.result,
    errorCode: input.errorCode ?? "SUCCESS",
    requestId: input.requestId,
    occurredAt: input.now,
    now: input.now
  });
}

function leaseLostError(message: string): Error {
  const error = new Error(message);
  error.name = "WORKER_LEASE_LOST";
  return error;
}

function isLeaseLostError(error: unknown): boolean {
  return error instanceof Error && error.name === "WORKER_LEASE_LOST";
}

function isRetryableBatchError(error: unknown): boolean {
  return (
    error instanceof Error &&
    ["QUERY_EXECUTION_ERROR", "DATASOURCE_UNAVAILABLE"].includes(error.name)
  );
}

function resolveTaskRegistrySnapshot(task: ExportTaskRecord): ExportRegistryRecord | undefined {
  const snapshot = parseTaskRequestSnapshot(task).configSnapshot;
  if (snapshot?.configSnapshotDigest === task.configSnapshotDigest) {
    return snapshot;
  }
  return undefined;
}

function resolveTaskConcurrencyLimit(task: ExportTaskRecord): number {
  const registry = resolveTaskRegistrySnapshot(task);
  return Number.isInteger(registry?.concurrencyLimit) && Number(registry?.concurrencyLimit) > 0
    ? Number(registry?.concurrencyLimit)
    : 1;
}

function parseTaskRequestSnapshot(task: ExportTaskRecord): TaskRequestSnapshot {
  if (!task.requestPayload) {
    return {};
  }
  try {
    const parsed = JSON.parse(task.requestPayload) as TaskRequestSnapshot;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function calculateBackoffMs(baseMs: number, retryCount: number): number {
  const normalizedBase = Number.isInteger(baseMs) && baseMs > 0 ? baseMs : 1000;
  return normalizedBase * 2 ** Math.max(0, retryCount - 1);
}

function toUpdatedRowCount(value: bigint | number | undefined): number {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return Number(value ?? 0);
}
