import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client
} from "@aws-sdk/client-s3";

const endpoint = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ENDPOINT;
const bucket = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_BUCKET;
const accessKeyId = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_SECRET_ACCESS_KEY;
const region = process.env.EXPORT_PLATFORM_OBJECT_STORAGE_REGION ?? "us-east-1";

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  console.error(
    "BLOCKED - 需要人工介入: MinIO local smoke requires endpoint, bucket, access key and secret."
  );
  process.exit(1);
}

const client = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
});

try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  console.log(`MINIO_BUCKET_READY ${bucket}`);
} catch (error) {
  console.error(
    `FAILED: minio local smoke failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
