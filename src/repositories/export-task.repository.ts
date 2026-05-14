import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type CreatePendingTaskInput = {
  taskId: string;
  taskCode: string;
  subsystemCode: string;
  clientRequestId: string | null;
  idempotencyScope: string | null;
  requestDigest: string;
  configSnapshotDigest: string;
  now: Date;
};

export type ExportTaskRecord = {
  taskId: string;
  taskCode: string;
  subsystemCode: string;
  status: string;
  clientRequestId: string | null;
  idempotencyScope: string | null;
  requestDigest: string;
  configSnapshotDigest: string;
  attemptNo: number;
  lockOwner: string | null;
  lockExpireAt: Date | null;
  leaseRenewedAt: Date | null;
};

export type ExportTaskIdempotencyRecord = {
  idempotencyScope: string;
  taskId: string;
  requestDigest: string;
};

function toTaskRecord(row: {
  task_id: string;
  task_code: string;
  subsystem_code: string;
  status: string;
  client_request_id: string | null;
  idempotency_scope: string | null;
  request_digest: string;
  config_snapshot_digest: string;
  attempt_no: number;
  lock_owner: string | null;
  lock_expire_at: Date | null;
  lease_renewed_at: Date | null;
}): ExportTaskRecord {
  return {
    taskId: row.task_id,
    taskCode: row.task_code,
    subsystemCode: row.subsystem_code,
    status: row.status,
    clientRequestId: row.client_request_id,
    idempotencyScope: row.idempotency_scope,
    requestDigest: row.request_digest,
    configSnapshotDigest: row.config_snapshot_digest,
    attemptNo: row.attempt_no,
    lockOwner: row.lock_owner,
    lockExpireAt: row.lock_expire_at,
    leaseRenewedAt: row.lease_renewed_at
  };
}

export function createExportTaskRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async createPendingTask(input: CreatePendingTaskInput): Promise<ExportTaskRecord> {
      await db.transaction().execute(async (trx) => {
        await trx
          .insertInto("export_tasks")
          .values({
            task_id: input.taskId,
            task_code: input.taskCode,
            subsystem_code: input.subsystemCode,
            status: "PENDING",
            client_request_id: input.clientRequestId,
            idempotency_scope: input.idempotencyScope,
            request_digest: input.requestDigest,
            config_snapshot_digest: input.configSnapshotDigest,
            attempt_no: 0,
            lock_owner: null,
            lock_expire_at: null,
            lease_renewed_at: null,
            created_at: input.now,
            updated_at: input.now
          })
          .execute();

        if (input.idempotencyScope) {
          await trx
            .insertInto("export_task_idempotency")
            .values({
              idempotency_scope: input.idempotencyScope,
              task_id: input.taskId,
              request_digest: input.requestDigest,
              created_at: input.now
            })
            .execute();
        }
      });

      const task = await this.findTaskById(input.taskId);
      if (!task) {
        throw new Error(`Created task ${input.taskId} was not found`);
      }
      return task;
    },

    async findTaskById(taskId: string): Promise<ExportTaskRecord | undefined> {
      const row = await db
        .selectFrom("export_tasks")
        .selectAll()
        .where("task_id", "=", taskId)
        .executeTakeFirst();

      return row ? toTaskRecord(row) : undefined;
    },

    async findByIdempotencyScope(
      idempotencyScope: string
    ): Promise<ExportTaskIdempotencyRecord | undefined> {
      const row = await db
        .selectFrom("export_task_idempotency")
        .selectAll()
        .where("idempotency_scope", "=", idempotencyScope)
        .executeTakeFirst();

      return row
        ? {
            idempotencyScope: row.idempotency_scope,
            taskId: row.task_id,
            requestDigest: row.request_digest
          }
        : undefined;
    }
  };
}
