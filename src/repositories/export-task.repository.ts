import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type CreatePendingTaskInput = {
  taskId: string;
  taskCode: string;
  subsystemCode: string;
  tenantId: string;
  createdBy: string;
  fileFormat: string;
  clientRequestId: string | null;
  idempotencyScope: string | null;
  requestDigest: string;
  configSnapshotDigest: string;
  requestPayload: string | null;
  authContextPayload: string | null;
  now: Date;
};

export type ExportTaskRecord = {
  taskId: string;
  taskCode: string;
  subsystemCode: string;
  tenantId: string;
  createdBy: string;
  fileFormat: string;
  status: string;
  clientRequestId: string | null;
  idempotencyScope: string | null;
  requestDigest: string;
  configSnapshotDigest: string;
  requestPayload: string | null;
  authContextPayload: string | null;
  attemptNo: number;
  lockOwner: string | null;
  lockExpireAt: Date | null;
  leaseRenewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
}): ExportTaskRecord {
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
            tenant_id: input.tenantId,
            created_by: input.createdBy,
            file_format: input.fileFormat,
            status: "PENDING",
            client_request_id: input.clientRequestId,
            idempotency_scope: input.idempotencyScope,
            request_digest: input.requestDigest,
            config_snapshot_digest: input.configSnapshotDigest,
            request_payload: input.requestPayload,
            auth_context_payload: input.authContextPayload,
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

    async listTasks(filters: {
      taskCode?: string;
      status?: string;
      subsystemCode?: string;
      tenantId?: string;
      createdBy?: string;
      fileFormat?: string;
      createdAtFrom?: Date;
      createdAtTo?: Date;
      limit?: number;
      offset?: number;
    } = {}): Promise<ExportTaskRecord[]> {
      let query = db.selectFrom("export_tasks").selectAll();

      if (filters.taskCode) {
        query = query.where("task_code", "=", filters.taskCode);
      }
      if (filters.status) {
        query = query.where("status", "=", filters.status);
      }
      if (filters.subsystemCode) {
        query = query.where("subsystem_code", "=", filters.subsystemCode);
      }
      if (filters.tenantId) {
        query = query.where("tenant_id", "=", filters.tenantId);
      }
      if (filters.createdBy) {
        query = query.where("created_by", "=", filters.createdBy);
      }
      if (filters.fileFormat) {
        query = query.where("file_format", "=", filters.fileFormat);
      }
      if (filters.createdAtFrom) {
        query = query.where("created_at", ">=", filters.createdAtFrom);
      }
      if (filters.createdAtTo) {
        query = query.where("created_at", "<=", filters.createdAtTo);
      }

      const rows = await query
        .orderBy("created_at", "desc")
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)
        .execute();

      return rows.map(toTaskRecord);
    },

    async updateTaskStatus(input: {
      taskId: string;
      status: string;
      now: Date;
    }): Promise<ExportTaskRecord | undefined> {
      await db
        .updateTable("export_tasks")
        .set({
          status: input.status,
          updated_at: input.now
        })
        .where("task_id", "=", input.taskId)
        .execute();

      return this.findTaskById(input.taskId);
    },

    async retryFailedTask(input: {
      taskId: string;
      now: Date;
    }): Promise<ExportTaskRecord | undefined> {
      return db.transaction().execute(async (trx) => {
        const task = await trx
          .selectFrom("export_tasks")
          .select(["status", "attempt_no"])
          .where("task_id", "=", input.taskId)
          .forUpdate()
          .executeTakeFirst();

        if (!task || task.status !== "FAILED") {
          return undefined;
        }

        await trx
          .updateTable("export_tasks")
          .set({
            status: "PENDING",
            attempt_no: task.attempt_no + 1,
            lock_owner: null,
            lock_expire_at: null,
            lease_renewed_at: null,
            updated_at: input.now
          })
          .where("task_id", "=", input.taskId)
          .execute();

        const row = await trx
          .selectFrom("export_tasks")
          .selectAll()
          .where("task_id", "=", input.taskId)
          .executeTakeFirst();

        return row ? toTaskRecord(row) : undefined;
      });
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
