import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type AppendAuditLogInput = {
  auditId: string;
  taskId: string | null;
  attemptNo: number | null;
  taskCode: string | null;
  subsystemCode: string | null;
  operatorId: string;
  action: string;
  result: string;
  errorCode: string;
  requestId: string;
  occurredAt: Date;
  now: Date;
};

export type AuditLogRecord = Omit<AppendAuditLogInput, "now">;

function toAuditLogRecord(row: {
  audit_id: string;
  task_id: string | null;
  attempt_no: number | null;
  task_code: string | null;
  subsystem_code: string | null;
  operator_id: string;
  action: string;
  result: string;
  error_code: string;
  request_id: string;
  occurred_at: Date;
}): AuditLogRecord {
  return {
    auditId: row.audit_id,
    taskId: row.task_id,
    attemptNo: row.attempt_no,
    taskCode: row.task_code,
    subsystemCode: row.subsystem_code,
    operatorId: row.operator_id,
    action: row.action,
    result: row.result,
    errorCode: row.error_code,
    requestId: row.request_id,
    occurredAt: row.occurred_at
  };
}

export function createExportAuditRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async appendAuditLog(input: AppendAuditLogInput): Promise<void> {
      await db
        .insertInto("export_audit_logs")
        .values({
          audit_id: input.auditId,
          task_id: input.taskId,
          attempt_no: input.attemptNo,
          task_code: input.taskCode,
          subsystem_code: input.subsystemCode,
          operator_id: input.operatorId,
          action: input.action,
          result: input.result,
          error_code: input.errorCode,
          request_id: input.requestId,
          occurred_at: input.occurredAt,
          created_at: input.now
        })
        .execute();
    },

    async listAuditLogsForTask(taskId: string): Promise<AuditLogRecord[]> {
      const rows = await db
        .selectFrom("export_audit_logs")
        .selectAll()
        .where("task_id", "=", taskId)
        .orderBy("occurred_at", "asc")
        .execute();

      return rows.map(toAuditLogRecord);
    }
  };
}
