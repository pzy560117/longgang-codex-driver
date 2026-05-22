import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import type { ObjectStorageConfig, SecurityConfig } from "../config/index.ts";

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

export type CleanupObjectStorage = {
  deleteObject(storageKey: string): Promise<void>;
};

type ObjectStorageDeps = {
  objectStorage: ObjectStorage;
  cleanupStorage: CleanupObjectStorage;
};

export function createObjectStorageDepsFromConfig(
  objectStorage: ObjectStorageConfig,
  security: SecurityConfig
): ObjectStorageDeps {
  if (objectStorage.driver === "s3") {
    return createS3ObjectStorageDeps(objectStorage);
  }
  return createHttpObjectStorageDeps(objectStorage, security);
}

function createHttpObjectStorageDeps(
  objectStorage: ObjectStorageConfig,
  security: SecurityConfig
): ObjectStorageDeps {
  const endpoint = objectStorage.endpoint;
  const bucket = objectStorage.bucket;
  const downloadSigningSecret = security.downloadUrlSigningSecret;

  if (!endpoint || !bucket) {
    throw new Error(
      "BLOCKED - 需要人工介入: object storage endpoint and bucket must be configured for file publishing."
    );
  }
  if (!downloadSigningSecret) {
    throw new Error(
      "BLOCKED - 需要人工介入: download URL signing secret must be configured for signed downloads."
    );
  }

  const baseUrl = `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}`;
  const objectStorageImpl: ObjectStorage = {
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
      const response = await fetch(`${baseUrl}/${encodeStorageKey(storageKey)}`, {
        headers: {
          "x-export-internal-object-read": "true"
        }
      });
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
      const expiresAtIso = expiresAt.toISOString();
      url.searchParams.set("expiresAt", expiresAtIso);
      url.searchParams.set("signatureAlgorithm", "HMAC-SHA256");
      url.searchParams.set(
        "signature",
        createHttpDownloadUrlSignature({
          bucket,
          storageKey,
          expiresAt: expiresAtIso,
          secret: downloadSigningSecret
        })
      );
      return url.toString();
    }
  };

  const cleanupStorage: CleanupObjectStorage = {
    async deleteObject(storageKey) {
      const response = await fetch(
        `${endpoint.replace(/\/+$/, "")}/${encodeURIComponent(bucket)}/${encodeStorageKey(storageKey)}`,
        {
          method: "DELETE"
        }
      );
      if (!response.ok && response.status !== 404) {
        const error = new Error(`object storage delete failed: ${response.status}`);
        error.name = "FILE_CLEANUP_DELETE_ERROR";
        throw error;
      }
    }
  };

  return {
    objectStorage: objectStorageImpl,
    cleanupStorage
  };
}

function createS3ObjectStorageDeps(objectStorage: ObjectStorageConfig): ObjectStorageDeps {
  const client = createS3Client(objectStorage);
  const bucket = requireBucket(objectStorage.bucket);

  const objectStorageImpl: ObjectStorage = {
    async putObject(input) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.storageKey,
            Body: input.body,
            ContentType: input.contentType
          })
        );
      } catch (error) {
        throw fileError("FILE_VERIFY_ERROR", readStorageMessage(error, "object storage put failed"));
      }
    },
    async readObject(storageKey) {
      try {
        const response = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: storageKey
          })
        );
        return await bodyToBuffer(response.Body);
      } catch (error) {
        throw fileError("FILE_VERIFY_ERROR", readStorageMessage(error, "object storage read failed"));
      }
    },
    async publishObject(input) {
      try {
        const current = await objectStorageImpl.readObject(input.tempStorageKey);
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: input.publishedStorageKey,
            Body: current
          })
        );
      } catch (error) {
        if (error instanceof Error && error.name === "FILE_VERIFY_ERROR") {
          throw error;
        }
        throw fileError(
          "FILE_VERIFY_ERROR",
          readStorageMessage(error, "object storage publish failed")
        );
      }
    },
    async createDownloadUrl(storageKey, expiresAt) {
      const expiresInSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: storageKey
        }),
        {
          expiresIn: expiresInSeconds
        }
      );
    }
  };

  const cleanupStorage: CleanupObjectStorage = {
    async deleteObject(storageKey) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: storageKey
          })
        );
      } catch (error) {
        const deleteError = new Error(
          readStorageMessage(error, "object storage delete failed")
        );
        deleteError.name = "FILE_CLEANUP_DELETE_ERROR";
        throw deleteError;
      }
    }
  };

  return {
    objectStorage: objectStorageImpl,
    cleanupStorage
  };
}

function createS3Client(objectStorage: ObjectStorageConfig): S3Client {
  if (!objectStorage.endpoint || !objectStorage.bucket) {
    throw new Error(
      "BLOCKED - 需要人工介入: object storage endpoint and bucket must be configured for file publishing."
    );
  }
  if (!objectStorage.accessKeyId || !objectStorage.secretAccessKey) {
    throw new Error(
      "BLOCKED - 需要人工介入: object storage access key and secret must be configured for s3 driver."
    );
  }

  return new S3Client({
    region: objectStorage.region,
    endpoint: objectStorage.endpoint,
    forcePathStyle: objectStorage.forcePathStyle,
    credentials: {
      accessKeyId: objectStorage.accessKeyId,
      secretAccessKey: objectStorage.secretAccessKey
    }
  });
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body === "object" && body !== null && "transformToByteArray" in body) {
    const bytes = await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  throw new Error("unsupported object storage body type");
}

function requireBucket(bucket: string | undefined): string {
  if (!bucket) {
    throw new Error(
      "BLOCKED - 需要人工介入: object storage endpoint and bucket must be configured for file publishing."
    );
  }
  return bucket;
}

function createHttpDownloadUrlSignature(input: {
  bucket: string;
  storageKey: string;
  expiresAt: string;
  secret: string;
}): string {
  return createHmac("sha256", input.secret)
    .update(["GET", input.bucket, input.storageKey, input.expiresAt].join("\n"))
    .digest("hex");
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

function readStorageMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
