import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type SaveCheckpointInput = {
  taskId: string;
  attemptNo: number;
  lastCursor: string | null;
  processedCount: number;
  filePartNo: number | null;
  retryCount: number;
  batchSize: number | null;
  batchRowCount: number | null;
  backoffMs: number | null;
  now: Date;
};

export type CheckpointRecord = Omit<SaveCheckpointInput, "now"> & {
  createdAt: Date;
  updatedAt: Date;
};

function toCheckpointRecord(row: {
  task_id: string;
  attempt_no: number;
  last_cursor: string | null;
  processed_count: number;
  file_part_no: number | null;
  retry_count: number;
  batch_size: number | null;
  batch_row_count: number | null;
  backoff_ms: number | null;
  created_at: Date;
  updated_at: Date;
}): CheckpointRecord {
  return {
    taskId: row.task_id,
    attemptNo: row.attempt_no,
    lastCursor: row.last_cursor,
    processedCount: Number(row.processed_count),
    filePartNo: row.file_part_no,
    retryCount: row.retry_count,
    batchSize: row.batch_size,
    batchRowCount: row.batch_row_count,
    backoffMs: row.backoff_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createCheckpointRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async saveCheckpoint(input: SaveCheckpointInput): Promise<void> {
      await db
        .insertInto("export_task_checkpoints")
        .values({
          task_id: input.taskId,
          attempt_no: input.attemptNo,
          last_cursor: input.lastCursor,
          processed_count: input.processedCount,
          file_part_no: input.filePartNo,
          retry_count: input.retryCount,
          batch_size: input.batchSize,
          batch_row_count: input.batchRowCount,
          backoff_ms: input.backoffMs,
          created_at: input.now,
          updated_at: input.now
        })
        .onDuplicateKeyUpdate({
          last_cursor: input.lastCursor,
          processed_count: input.processedCount,
          file_part_no: input.filePartNo,
          retry_count: input.retryCount,
          batch_size: input.batchSize,
          batch_row_count: input.batchRowCount,
          backoff_ms: input.backoffMs,
          updated_at: input.now
        })
        .execute();
    },

    async findLatestCheckpoint(
      taskId: string,
      attemptNo: number
    ): Promise<CheckpointRecord | undefined> {
      const row = await db
        .selectFrom("export_task_checkpoints")
        .selectAll()
        .where("task_id", "=", taskId)
        .where("attempt_no", "=", attemptNo)
        .executeTakeFirst();

      return row ? toCheckpointRecord(row) : undefined;
    }
  };
}
