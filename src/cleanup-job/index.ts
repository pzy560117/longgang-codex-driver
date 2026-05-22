import { randomUUID } from "node:crypto";
import type { Kysely } from "kysely";
import { loadConfig } from "../config/index.ts";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import {
  createExportAuditRepository,
  createExportFileRepository,
  createExportTaskEventRepository,
  getDatabaseTime
} from "../repositories/index.ts";
import {
  createObjectStorageDepsFromConfig,
  type CleanupObjectStorage
} from "../object-storage/index.ts";

export type CleanupJobOptions = {
  db: Kysely<ExportPlatformDatabase>;
  workerId: string;
  storage?: CleanupObjectStorage;
  maxFilesPerPoll?: number;
};

export type CleanupPollResult = {
  scanned: number;
  deleted: number;
  retried: number;
};

export function createCleanupJob(options: CleanupJobOptions) {
  const files = createExportFileRepository(options.db);
  const audits = createExportAuditRepository(options.db);
  const events = createExportTaskEventRepository(options.db);
  const storage = options.storage ?? createCleanupObjectStorageFromEnv();
  const maxFilesPerPoll = options.maxFilesPerPoll ?? 10;

  async function pollOnce(): Promise<CleanupPollResult> {
    const now = await getDatabaseTime(options.db);
    const candidates = await files.listExpiredPublishedFiles({
      now,
      limit: maxFilesPerPoll
    });
    const result: CleanupPollResult = {
      scanned: candidates.length,
      deleted: 0,
      retried: 0
    };

    for (const candidate of candidates) {
      const invalidatedAt = await getDatabaseTime(options.db);
      await files.invalidateDownloadMetadata({
        taskId: candidate.taskId,
        attemptNo: candidate.attemptNo,
        now: invalidatedAt
      });

      try {
        await storage.deleteObject(candidate.publishedStorageKey);
        if (candidate.tempStorageKey) {
          await storage.deleteObject(candidate.tempStorageKey);
        }
        const deletedAt = await getDatabaseTime(options.db);
        await files.markObjectDeleted({
          taskId: candidate.taskId,
          attemptNo: candidate.attemptNo,
          now: deletedAt
        });
        await appendCleanupEvent({
          events,
          candidate,
          eventType: "FILE_CLEANUP_DONE",
          requestId: cleanupRequestId(options.workerId),
          now: deletedAt,
          checkpoint: {
            storageKey: candidate.publishedStorageKey,
            tempStorageKey: candidate.tempStorageKey,
            cleanupResult: "deleted"
          }
        });
        await audits.appendAuditLog({
          auditId: `audit_${randomUUID()}`,
          taskId: candidate.taskId,
          attemptNo: candidate.attemptNo,
          taskCode: candidate.taskCode,
          subsystemCode: candidate.subsystemCode,
          operatorId: candidate.operatorId,
          action: "EXPIRE_MARK",
          result: "SUCCESS",
          errorCode: "SUCCESS",
          requestId: cleanupRequestId(options.workerId),
          occurredAt: deletedAt,
          now: deletedAt
        });
        result.deleted += 1;
      } catch (error) {
        const failedAt = await getDatabaseTime(options.db);
        await appendCleanupEvent({
          events,
          candidate,
          eventType: "FILE_CLEANUP_RETRY",
          requestId: cleanupRequestId(options.workerId),
          now: failedAt,
          checkpoint: {
            storageKey: candidate.publishedStorageKey,
            tempStorageKey: candidate.tempStorageKey,
            cleanupResult: "retry",
            error: error instanceof Error ? error.message : String(error)
          }
        });
        await audits.appendAuditLog({
          auditId: `audit_${randomUUID()}`,
          taskId: candidate.taskId,
          attemptNo: candidate.attemptNo,
          taskCode: candidate.taskCode,
          subsystemCode: candidate.subsystemCode,
          operatorId: candidate.operatorId,
          action: "CLEANUP_FAILED",
          result: "FAILED",
          errorCode: "FILE_CLEANUP_DELETE_ERROR",
          requestId: cleanupRequestId(options.workerId),
          occurredAt: failedAt,
          now: failedAt
        });
        result.retried += 1;
      }
    }

    return result;
  }

  return { pollOnce };
}

export function createCleanupObjectStorageFromEnv(): CleanupObjectStorage {
  const config = loadConfig();
  return createObjectStorageDepsFromConfig(config.objectStorage, config.security).cleanupStorage;
}

async function appendCleanupEvent(input: {
  events: ReturnType<typeof createExportTaskEventRepository>;
  candidate: {
    taskId: string;
    attemptNo: number;
    taskCode: string;
    subsystemCode: string;
  };
  eventType: string;
  requestId: string;
  now: Date;
  checkpoint: unknown;
}): Promise<void> {
  await input.events.appendTaskEvent({
    eventId: `event_${randomUUID()}`,
    taskId: input.candidate.taskId,
    attemptNo: input.candidate.attemptNo,
    eventType: input.eventType,
    requestId: input.requestId,
    queryTemplateVersion: "cleanup-job",
    batchCheckpoint: JSON.stringify(input.checkpoint),
    occurredAt: input.now,
    now: input.now
  });
}

function cleanupRequestId(workerId: string): string {
  return `cleanup:${workerId}`;
}
