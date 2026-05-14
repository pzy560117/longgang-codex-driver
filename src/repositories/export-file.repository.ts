import type { Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";

export type SaveFileMetadataInput = {
  taskId: string;
  attemptNo: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  checksum: string;
  checksumAlgorithm: string;
  tempStorageKey: string | null;
  publishedStorageKey: string | null;
  expiresAt: Date;
  publishedAt: Date | null;
  deliveryReadyAt: Date | null;
  checksumVerifiedAt: Date | null;
  now: Date;
};

export type FileMetadataRecord = Omit<SaveFileMetadataInput, "now">;

function toFileMetadataRecord(row: {
  task_id: string;
  attempt_no: number;
  file_name: string;
  content_type: string;
  file_size: number;
  checksum: string;
  checksum_algorithm: string;
  temp_storage_key: string | null;
  published_storage_key: string | null;
  expires_at: Date;
  published_at: Date | null;
  delivery_ready_at: Date | null;
  checksum_verified_at: Date | null;
}): FileMetadataRecord {
  return {
    taskId: row.task_id,
    attemptNo: row.attempt_no,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: Number(row.file_size),
    checksum: row.checksum,
    checksumAlgorithm: row.checksum_algorithm,
    tempStorageKey: row.temp_storage_key,
    publishedStorageKey: row.published_storage_key,
    expiresAt: row.expires_at,
    publishedAt: row.published_at,
    deliveryReadyAt: row.delivery_ready_at,
    checksumVerifiedAt: row.checksum_verified_at
  };
}

export function createExportFileRepository(db: Kysely<ExportPlatformDatabase>) {
  return {
    async saveFileMetadata(input: SaveFileMetadataInput): Promise<void> {
      await db
        .insertInto("export_task_files")
        .values({
          task_id: input.taskId,
          attempt_no: input.attemptNo,
          file_name: input.fileName,
          content_type: input.contentType,
          file_size: input.fileSize,
          checksum: input.checksum,
          checksum_algorithm: input.checksumAlgorithm,
          temp_storage_key: input.tempStorageKey,
          published_storage_key: input.publishedStorageKey,
          expires_at: input.expiresAt,
          published_at: input.publishedAt,
          delivery_ready_at: input.deliveryReadyAt,
          checksum_verified_at: input.checksumVerifiedAt,
          created_at: input.now,
          updated_at: input.now
        })
        .onDuplicateKeyUpdate({
          file_name: input.fileName,
          content_type: input.contentType,
          file_size: input.fileSize,
          checksum: input.checksum,
          checksum_algorithm: input.checksumAlgorithm,
          temp_storage_key: input.tempStorageKey,
          published_storage_key: input.publishedStorageKey,
          expires_at: input.expiresAt,
          published_at: input.publishedAt,
          delivery_ready_at: input.deliveryReadyAt,
          checksum_verified_at: input.checksumVerifiedAt,
          updated_at: input.now
        })
        .execute();
    },

    async findFileMetadata(
      taskId: string,
      attemptNo: number
    ): Promise<FileMetadataRecord | undefined> {
      const row = await db
        .selectFrom("export_task_files")
        .selectAll()
        .where("task_id", "=", taskId)
        .where("attempt_no", "=", attemptNo)
        .executeTakeFirst();

      return row ? toFileMetadataRecord(row) : undefined;
    }
  };
}
