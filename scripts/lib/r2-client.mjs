import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const CONTENT_TYPES = {
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
};

/**
 * @param {string} format Derivative format, e.g. `"avif"`.
 * @returns {string} The Content-Type to upload it under.
 * @throws {Error} For an unmapped format: uploading with an undefined
 *   Content-Type would leave unusable objects in the bucket.
 */
export function contentTypeFor(format) {
  const contentType = CONTENT_TYPES[format];
  if (!contentType) {
    throw new Error(
      `No content type mapped for derivative format "${format}". Add it to ` +
        `CONTENT_TYPES in scripts/lib/r2-client.mjs — uploading with an undefined ` +
        `Content-Type would leave unusable objects in the bucket.`
    );
  }
  return contentType;
}

/**
 * Check the four R2 credentials every CLI here needs. Exits rather than
 * throwing: a stack trace over a missing env var reads like a bug in the
 * script.
 *
 * @returns {void}
 */
export function requireR2Env() {
  for (const name of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]) {
    if (!process.env[name]) {
      console.error(`Missing required env var ${name} — see docs/setup/external-services.md §1.`);
      process.exit(1);
    }
  }
}

/**
 * @returns {import("@aws-sdk/client-s3").S3Client} The client the four R2 env
 *   vars describe.
 */
export function r2ClientFromEnv() {
  requireR2Env();
  return createR2Client({
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  });
}

/**
 * @param {{ accountId: string, accessKeyId: string, secretAccessKey: string }} credentials
 * @returns {import("@aws-sdk/client-s3").S3Client}
 */
export function createR2Client({ accountId, accessKeyId, secretAccessKey }) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload one object.
 *
 * @param {import("@aws-sdk/client-s3").S3Client} client
 * @param {{ bucket: string, key: string, body: any, contentType: string, contentLength?: number }} object
 *   `contentLength` is required when `body` is a stream: without a known
 *   length the SDK cannot sign the request and buffers the whole file in
 *   memory, which a multi-hundred-megabyte video will not survive.
 * @returns {Promise<void>}
 */
export async function uploadDerivative(client, { bucket, key, body, contentType, contentLength }) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(contentLength === undefined ? {} : { ContentLength: contentLength }),
    })
  );
}

/**
 * Every key currently in the bucket, following pagination. The folder
 * publisher uses it to skip files that are already up.
 *
 * @param {import("@aws-sdk/client-s3").S3Client} client
 * @param {string} bucket
 * @returns {Promise<Set<string>>}
 */
export async function listKeys(client, bucket) {
  const keys = new Set();
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token })
    );
    for (const object of page.Contents ?? []) keys.add(object.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys;
}
