import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { type Kysely } from "kysely";
import type { ExportPlatformDatabase } from "../db/schema.ts";
import {
  createExportFileRepository,
  createExportTaskEventRepository,
  getDatabaseTime,
  type ExportRegistryRecord,
  type ExportTaskRecord
} from "../repositories/index.ts";
import { renderExportPackage } from "./xlsx-package.ts";

export type ObjectStoragePutInput = {
  storageKey: string;
  body: Buffer;
  contentType: string;
};

export type ObjectStoragePublishInput = {
  tempStorageKey: string;
  publishedStorageKey: string;
};

export type ObjectStorage = {
  putObject(input: ObjectStoragePutInput): Promise<void>;
  readObject(storageKey: string): Promise<Buffer>;
  publishObject(input: ObjectStoragePublishInput): Promise<void>;
  createDownloadUrl(storageKey: string, expiresAt: Date): Promise<string>;
};

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

const checksumAlgorithm = "SHA-256";
const signedUrlExpiresMinutes = 10;

export function createObjectStorageFromEnv(): ObjectStorage {
  const endpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
  const bucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;

  if (!endpoint || !bucket) {
    throw new Error(
      "BLOCKED - 需要人工介入: object storage endpoint and bucket must be configured for file publishing."
    );
  }

  const baseUrl = `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;
  return {
    async putObject(input) {
      const response = await fetch(`${baseUrl}/${encodeStorageKey(input.storageKey)}`, {
        method: "PUT",
        headers: { "content-type": input.contentType },
        body: toArrayBuffer(input.body)
      });
      if (!response.ok) {
        throw fileError("FILE_VERIFY_ERROR", `object storage put failed: ${response.status}`);
      }
    },
    async readObject(storageKey) {
      const response = await fetch(`${baseUrl}/${encodeStorageKey(storageKey)}`);
      if (!response.ok) {
        throw fileError("FILE_VERIFY_ERROR", `object storage read failed: ${response.status}`);
      }
      return Buffer.from(await response.arrayBuffer());
    },
    async publishObject(input) {
      const response = await fetch(`${baseUrl}/${encodeStorageKey(input.publishedStorageKey)}`, {
        method: "PUT",
        headers: {
          "x-export-copy-source": `${bucket}/${input.tempStorageKey}`
        }
      });
      if (!response.ok) {
        throw fileError("FILE_VERIFY_ERROR", `object storage publish failed: ${response.status}`);
      }
    },
    async createDownloadUrl(storageKey, expiresAt) {
      const url = new URL(`${baseUrl}/${encodeStorageKey(storageKey)}`);
      url.searchParams.set("expiresAt", expiresAt.toISOString());
      return url.toString();
    }
  };
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
    const body = await renderFileBody(parts, packageFileName, {
      totalRowCount: input.rows.length,
      singleFileMaxRows
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

    const persistedBody = await storage.readObject(tempStorageKey);
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

  async function createDownloadUrl(storageKey: string, expiresAt: Date): Promise<string> {
    return storage.createDownloadUrl(storageKey, expiresAt);
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

async function renderFileBody(
  parts: FilePart[],
  packageFileName: string,
  summary: {
    totalRowCount: number;
    singleFileMaxRows: number;
  }
): Promise<Buffer> {
  void summary;
  return renderExportPackage({
    packageFileName,
    parts
  });
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

function encodeStorageKey(storageKey: string): string {
  return storageKey.split("/").map(encodeURIComponent).join("/");
}

function toArrayBuffer(body: Buffer): ArrayBuffer {
  return body.buffer.slice(
    body.byteOffset,
    body.byteOffset + body.byteLength
  ) as ArrayBuffer;
}

function fileError(code: string, message: string): Error {
  const error = new Error(`${code}: ${message}`);
  error.name = code;
  return error;
}

function toFileVerifyError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error && error.name === "FILE_VERIFY_ERROR") {
    return error;
  }
  return fileError(
    "FILE_VERIFY_ERROR",
    error instanceof Error ? error.message : fallbackMessage
  );
}
