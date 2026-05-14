import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type AppendTaskEventInput = {
  eventId: string;
  taskId: string;
  attemptNo: number;
  eventType: string;
  requestId: string;
  datasourceCode?: string;
  queryTemplateVersion?: string;
  batchCheckpoint?: string;
  occurredAt: Date;
  now: Date;
};

export type TaskEventRecord = {
  eventId: string;
  taskId: string;
  attemptNo: number;
  eventType: string;
  requestId: string;
  datasourceCode: string | null;
  queryTemplateVersion: string | null;
  batchCheckpoint: string | null;
  occurredAt: Date;
};

function toTaskEventRecord(row: {
  event_id: string;
  task_id: string;
  attempt_no: number;
  event_type: string;
  request_id: string;
  datasource_code: string | null;
  query_template_version: string | null;
  batch_checkpoint: string | null;
  occurred_at: Date;
}): TaskEventRecord {
  return {
    eventId: row.event_id,
    taskId: row.task_id,
    attemptNo: row.attempt_no,
    eventType: row.event_type,
    requestId: row.request_id,
    datasourceCode: row.datasource_code,
    queryTemplateVersion: row.query_template_version,
    batchCheckpoint: row.batch_checkpoint,
    occurredAt: row.occurred_at
  };
}

export function createExportTaskEventRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async appendTaskEvent(input: AppendTaskEventInput): Promise<void> {
      await db
        .insertInto("export_task_events")
        .values({
          event_id: input.eventId,
          task_id: input.taskId,
          attempt_no: input.attemptNo,
          event_type: input.eventType,
          request_id: input.requestId,
          datasource_code: input.datasourceCode ?? null,
          query_template_version: input.queryTemplateVersion ?? null,
          batch_checkpoint: input.batchCheckpoint ?? null,
          occurred_at: input.occurredAt,
          created_at: input.now
        })
        .execute();
    },

    async listRecentTaskEvents(taskId: string): Promise<TaskEventRecord[]> {
      const rows = await db
        .selectFrom("export_task_events")
        .selectAll()
        .where("task_id", "=", taskId)
        .orderBy("occurred_at", "desc")
        .orderBy("event_id", "desc")
        .limit(20)
        .execute();

      return rows.map(toTaskEventRecord);
    }
  };
}
