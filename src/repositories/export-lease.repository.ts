import { sql, type Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type AcquirePendingTaskLeaseInput = {
  taskId: string;
  lockOwner: string;
  leaseDurationSeconds: number;
};

export type RenewTaskLeaseInput = {
  taskId: string;
  attemptNo: number;
  lockOwner: string;
  leaseDurationSeconds: number;
};

export type ExportTaskLeaseRecord = {
  taskId: string;
  attemptNo: number;
  lockOwner: string;
  previousLockOwner: string | null;
  lockExpireAt: Date;
  leaseRenewedAt: Date;
  databaseTime: Date;
  takeoverRule: string;
};

function toLeaseRecord(row: {
  task_id: string;
  attempt_no: number;
  lock_owner: string;
  previous_lock_owner: string | null;
  lock_expire_at: Date;
  lease_renewed_at: Date;
  database_time: Date;
  takeover_rule: string;
}): ExportTaskLeaseRecord {
  return {
    taskId: row.task_id,
    attemptNo: row.attempt_no,
    lockOwner: row.lock_owner,
    previousLockOwner: row.previous_lock_owner,
    lockExpireAt: row.lock_expire_at,
    leaseRenewedAt: row.lease_renewed_at,
    databaseTime: row.database_time,
    takeoverRule: row.takeover_rule
  };
}

export function createLeaseRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async acquirePendingTaskLease(
      input: AcquirePendingTaskLeaseInput
    ): Promise<ExportTaskLeaseRecord | undefined> {
      return db.transaction().execute(async (trx) => {
        const databaseTime = await getTransactionDatabaseTime(trx);
        const task = await trx
          .selectFrom("export_tasks")
          .select(["attempt_no", "status", "lock_owner", "lock_expire_at"])
          .where("task_id", "=", input.taskId)
          .where((eb) =>
            eb.or([
              eb("status", "=", "PENDING"),
              eb.and([
                eb("status", "=", "EXECUTING"),
                eb("lock_expire_at", "<", databaseTime)
              ])
            ])
          )
          .forUpdate()
          .executeTakeFirst();

        if (!task) {
          return undefined;
        }

        const lockExpireAt = new Date(databaseTime.getTime() + input.leaseDurationSeconds * 1000);
        const takeoverRule = "PENDING_OR_EXPIRED_KEEP_ATTEMPT";

        await trx
          .updateTable("export_tasks")
          .set({
            status: "EXECUTING",
            lock_owner: input.lockOwner,
            lock_expire_at: lockExpireAt,
            lease_renewed_at: databaseTime,
            updated_at: databaseTime
          })
          .where("task_id", "=", input.taskId)
          .execute();

        await trx
          .insertInto("export_task_leases")
          .values({
            task_id: input.taskId,
            attempt_no: task.attempt_no,
            lock_owner: input.lockOwner,
            previous_lock_owner: task.lock_owner,
            lock_expire_at: lockExpireAt,
            lease_renewed_at: databaseTime,
            database_time: databaseTime,
            takeover_rule: takeoverRule,
            created_at: databaseTime,
            updated_at: databaseTime
          })
          .onDuplicateKeyUpdate({
            lock_owner: input.lockOwner,
            previous_lock_owner: task.lock_owner,
            lock_expire_at: lockExpireAt,
            lease_renewed_at: databaseTime,
            database_time: databaseTime,
            takeover_rule: takeoverRule,
            updated_at: databaseTime
          })
          .execute();

        const lease = await trx
          .selectFrom("export_task_leases")
          .selectAll()
          .where("task_id", "=", input.taskId)
          .where("attempt_no", "=", task.attempt_no)
          .executeTakeFirst();

        return lease ? toLeaseRecord(lease) : undefined;
      });
    },

    async renewTaskLease(input: RenewTaskLeaseInput): Promise<ExportTaskLeaseRecord | undefined> {
      return db.transaction().execute(async (trx) => {
        const databaseTime = await getTransactionDatabaseTime(trx);
        const lockExpireAt = new Date(databaseTime.getTime() + input.leaseDurationSeconds * 1000);

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
          return undefined;
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

        const lease = await trx
          .selectFrom("export_task_leases")
          .selectAll()
          .where("task_id", "=", input.taskId)
          .where("attempt_no", "=", input.attemptNo)
          .where("lock_owner", "=", input.lockOwner)
          .executeTakeFirst();

        return lease ? toLeaseRecord(lease) : undefined;
      });
    }
  };
}

async function getTransactionDatabaseTime(db: Kysely<ExportPlatformDatabase>): Promise<Date> {
  const row = await sql<{ database_time: Date }>`
    SELECT CURRENT_TIMESTAMP(3) AS database_time
  `.execute(db).then((result) => result.rows[0]);

  if (!row?.database_time) {
    throw new Error("Database time query returned no rows");
  }

  return new Date(row.database_time);
}
