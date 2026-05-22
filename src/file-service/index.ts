import { createHash, randomUUID } from "node:crypto";
import { type Kysely } from "kysely";
import { loadConfig, type ObjectStorageConfig, type SecurityConfig } from "../config/index.ts";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import {
  createExportFileRepository,
  createExportTaskEventRepository,
  getDatabaseTime,
  type ExportRegistryRecord,
  type ExportTaskRecord
} from "../repositories/index.ts";
import { renderExportPackage } from "./xlsx-package.ts";
import {
  createObjectStorageDepsFromConfig,
  type ObjectStorage
} from "../object-storage/index.ts";

export type PublishRowsInput = {
  task: ExportTaskRecord;
  registry: ExportRegistryRecord;
  attemptNo: number;
  requestId: string;
  rows: Record<string, unknown>[];
};

export type PublishedFile = {
  fileName: string;
  contentType: string;
  fileSize: number;
  checksum: string;
  checksumAlgorithm: "SHA-256";
  storageKey: string;
  expiresAt: Date;
  attemptNo: number;
};

export type SignedDownloadUrl = {
  downloadUrl: string;
  expiresAt: Date;
  ttlSeconds: number;
};

export type ExportFileServiceOptions = {
  db: Kysely<ExportPlatformDatabase>;
  storage?: ObjectStorage;
};

type FilePart = {
  partNo: number;
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

type RenderInputSummary = {
  taskId: string;
  taskCode: string;
  attemptNo: number;
  fileName: string;
  format: string;
  totalRowCount: number;
  partCount: number;
  singleFileMaxRows: number;
};

const checksumAlgorithm = "SHA-256";
const signedUrlExpiresMinutes = 10;

export function createObjectStorageFromEnv(): ObjectStorage {
  const config = loadConfig();
  return createObjectStorageFromConfig(config.objectStorage, config.security);
}

export function createObjectStorageFromConfig(
  objectStorage: ObjectStorageConfig,
  security: SecurityConfig
): ObjectStorage {
  return createObjectStorageDepsFromConfig(objectStorage, security).objectStorage;
}

export function createExportFileService(options: ExportFileServiceOptions) {
  const storage = options.storage ?? createObjectStorageFromEnv();
  const files = createExportFileRepository(options.db);
  const events = createExportTaskEventRepository(options.db);

  async function publishRows(input: PublishRowsInput): Promise<PublishedFile> {
    const now = await getDatabaseTime(options.db);
    const singleFileMaxRows = positiveInteger(input.registry.singleFileMaxRows, 20000);
    const exportMaxRows = positiveInteger(input.registry.exportMaxRows, 100000);
    if (input.rows.length > exportMaxRows) {
      throw fileError("EXPORT_RENDER_ERROR", "row count exceeds registry exportMaxRows");
    }

    const headers = resolveHeaders(input.registry, input.rows);
    const parts = splitRows(input.rows, headers, singleFileMaxRows);
    const packageFileName = buildFileName(input);
    const contentType = packageFileName.endsWith(".zip")
      ? "application/zip"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const renderInputSummary = {
      taskId: input.task.taskId,
      taskCode: input.task.taskCode,
      attemptNo: input.attemptNo,
      fileName: packageFileName,
      format: contentType === "application/zip" ? "ZIP" : input.task.fileFormat,
      totalRowCount: input.rows.length,
      partCount: parts.length,
      singleFileMaxRows
    };
    const body = await renderFileBody({
      events,
      input,
      parts,
      packageFileName,
      summary: renderInputSummary,
      now
    });
    const checksum = createChecksum(body);
    const storagePrefix = buildStoragePrefix(input.task, input.attemptNo, now);
    const tempStorageKey = `${storagePrefix}/tmp/${packageFileName}`;
    const publishedStorageKey = `${storagePrefix}/${packageFileName}`;
    const expiresAt = new Date(
      now.getTime() + positiveInteger(input.registry.fileRetentionDays, 15) * 24 * 60 * 60 * 1000
    );

    for (const part of parts) {
      await appendFileEvent({
        events,
        input,
        eventType: "FILE_PART_WRITTEN",
        now: new Date(now.getTime() + part.partNo),
        checkpoint: {
          partNo: part.partNo,
          fileName: part.fileName,
          rowCount: part.rows.length,
          tempStorageKey
        }
      });
    }

    try {
      await storage.putObject({
        storageKey: tempStorageKey,
        body,
        contentType
      });
    } catch (error) {
      throw toFileVerifyError(error, "object storage put failed");
    }
    await appendFileEvent({
      events,
      input,
      eventType: "PACKAGE_DONE",
      now: new Date(now.getTime() + parts.length + 1),
      checkpoint: {
        fileName: packageFileName,
        fileSize: body.byteLength,
        partCount: parts.length,
        tempStorageKey
      }
    });

    let persistedBody: Buffer;
    try {
      persistedBody = await storage.readObject(tempStorageKey);
    } catch (error) {
      throw toFileVerifyError(error, "object storage read failed");
    }
    if (createChecksum(persistedBody) !== checksum) {
      throw fileError("FILE_VERIFY_ERROR", "file checksum verification failed");
    }

    const verifiedAt = await getDatabaseTime(options.db);
    const verifiedEventAt = new Date(
      Math.max(verifiedAt.getTime(), now.getTime() + parts.length + 2)
    );
    await appendFileEvent({
      events,
      input,
      eventType: "FILE_VERIFIED",
      now: verifiedEventAt,
      checkpoint: {
        checksum,
        checksumAlgorithm,
        tempStorageKey
      }
    });

    try {
      await storage.publishObject({
        tempStorageKey,
        publishedStorageKey
      });
    } catch (error) {
      throw toFileVerifyError(error, "object storage publish failed");
    }
    const publishedAt = await getDatabaseTime(options.db);
    const deliveryEventAt = new Date(
      Math.max(publishedAt.getTime(), now.getTime() + parts.length + 3)
    );
    await files.saveFileMetadata({
      taskId: input.task.taskId,
      attemptNo: input.attemptNo,
      fileName: packageFileName,
      contentType,
      fileSize: body.byteLength,
      checksum,
      checksumAlgorithm,
      tempStorageKey,
      publishedStorageKey,
      expiresAt,
      publishedAt,
      deliveryReadyAt: publishedAt,
      checksumVerifiedAt: verifiedAt,
      now: publishedAt
    });
    await appendFileEvent({
      events,
      input,
      eventType: "DELIVERY_READY",
      now: deliveryEventAt,
      checkpoint: {
        publishedStorageKey,
        expiresAt: expiresAt.toISOString()
      }
    });

    return {
      fileName: packageFileName,
      contentType,
      fileSize: body.byteLength,
      checksum,
      checksumAlgorithm,
      storageKey: publishedStorageKey,
      expiresAt,
      attemptNo: input.attemptNo
    };
  }

  async function createDownloadUrl(
    storageKey: string,
    input: { now?: Date; ttlMs?: number } = {}
  ): Promise<SignedDownloadUrl> {
    const ttlMs = positiveInteger(input.ttlMs, signedUrlExpiresMinutes * 60 * 1000);
    const issuedAt = input.now ?? await getDatabaseTime(options.db);
    const expiresAt = new Date(issuedAt.getTime() + ttlMs);
    return {
      downloadUrl: await storage.createDownloadUrl(storageKey, expiresAt),
      expiresAt,
      ttlSeconds: Math.floor(ttlMs / 1000)
    };
  }

  async function readObject(storageKey: string): Promise<Buffer> {
    return storage.readObject(storageKey);
  }

  return { publishRows, createDownloadUrl, readObject };
}

async function appendFileEvent(input: {
  events: ReturnType<typeof createExportTaskEventRepository>;
  input: PublishRowsInput;
  eventType: string;
  now: Date;
  checkpoint: unknown;
}): Promise<void> {
  await input.events.appendTaskEvent({
    eventId: `event_${randomUUID()}`,
    taskId: input.input.task.taskId,
    attemptNo: input.input.attemptNo,
    eventType: input.eventType,
    requestId: input.input.requestId,
    datasourceCode: input.input.registry.datasourceCode,
    queryTemplateVersion: input.input.registry.configSnapshotDigest,
    batchCheckpoint: JSON.stringify(input.checkpoint),
    occurredAt: input.now,
    now: input.now
  });
}

function splitRows(
  rows: Record<string, unknown>[],
  headers: string[],
  singleFileMaxRows: number
): FilePart[] {
  if (rows.length === 0) {
    return [{ partNo: 1, fileName: "part-0001.xlsx", headers, rows: [] }];
  }

  const parts: FilePart[] = [];
  for (let index = 0; index < rows.length; index += singleFileMaxRows) {
    const partNo = parts.length + 1;
    parts.push({
      partNo,
      fileName: `part-${String(partNo).padStart(4, "0")}.xlsx`,
      headers,
      rows: rows.slice(index, index + singleFileMaxRows)
    });
  }
  return parts;
}

function buildFileName(input: PublishRowsInput): string {
  const extension = input.rows.length > positiveInteger(input.registry.singleFileMaxRows, 20000)
    ? "zip"
    : input.task.fileFormat.toLowerCase();
  return `${input.task.taskCode}-${input.task.taskId}-attempt-${input.attemptNo}.${extension}`;
}

function buildStoragePrefix(task: ExportTaskRecord, attemptNo: number, now: Date): string {
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `exports/${task.subsystemCode}/${task.taskCode}/${datePart}/${task.taskId}/${attemptNo}`;
}

async function renderFileBody(input: {
  events: ReturnType<typeof createExportTaskEventRepository>;
  input: PublishRowsInput;
  parts: FilePart[];
  packageFileName: string;
  summary: RenderInputSummary;
  now: Date;
}): Promise<Buffer> {
  try {
    return await renderExportPackage({
      packageFileName: input.packageFileName,
      parts: input.parts
    });
  } catch (error) {
    const renderError = toExportRenderError(error, "export package render failed");
    await appendFileEvent({
      events: input.events,
      input: input.input,
      eventType: "PACKAGE_FAILED",
      now: input.now,
      checkpoint: {
        errorCode: "EXPORT_RENDER_ERROR",
        failureReason: "export render error",
        renderInputSummary: input.summary
      }
    });
    throw renderError;
  }
}

function createChecksum(body: Buffer): string {
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

function resolveHeaders(
  registry: ExportRegistryRecord,
  rows: Record<string, unknown>[]
): string[] {
  const headers = parseFieldHeaders(registry);
  if (headers.length === 0 && rows.length > 0) {
    return Object.keys(rows[0]);
  }
  for (const row of rows) {
    const rowHeaders = Object.keys(row);
    if (
      rowHeaders.length !== headers.length ||
      rowHeaders.some((header, index) => header !== headers[index])
    ) {
      throw fileError("FIELD_MAPPING_INVALID", "row headers do not match registry field order");
    }
  }
  return headers;
}

function parseFieldHeaders(registry: ExportRegistryRecord): string[] {
  if (!registry.fieldMappings) {
    return [];
  }
  let fieldMappings: Array<{
    headerName?: unknown;
    orderNo?: unknown;
    exportable?: boolean;
  }>;
  try {
    fieldMappings = JSON.parse(registry.fieldMappings) as Array<{
      headerName?: unknown;
      orderNo?: unknown;
      exportable?: boolean;
    }>;
  } catch {
    throw fileError("FIELD_MAPPING_INVALID", "registry fieldMappings must be valid JSON");
  }
  if (!Array.isArray(fieldMappings)) {
    throw fileError("FIELD_MAPPING_INVALID", "registry fieldMappings must be an array");
  }
  return fieldMappings
    .filter((mapping) => mapping.exportable !== false)
    .sort((left, right) => Number(left.orderNo ?? 0) - Number(right.orderNo ?? 0))
    .map((mapping) => {
      if (typeof mapping.headerName !== "string" || mapping.headerName.length === 0) {
        throw fileError("FIELD_MAPPING_INVALID", "registry fieldMappings contain empty headers");
      }
      return mapping.headerName;
    });
}

function positiveInteger(value: number | null | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function fileError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  error.name = code;
  return error;
}

function toFileVerifyError(error: unknown, fallbackMessage: string): Error {
  void error;
  void fallbackMessage;
  return fileError("FILE_VERIFY_ERROR", "file verification failed");
}

function toExportRenderError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error && error.name === "EXPORT_RENDER_ERROR") {
    return error;
  }
  return fileError(
    "EXPORT_RENDER_ERROR",
    error instanceof Error ? error.message : fallbackMessage
  );
}
