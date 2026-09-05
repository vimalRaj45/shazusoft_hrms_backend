import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

const R2_ACCESS_KEY_ID = config.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = config.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = config.r2BucketName || process.env.R2_BUCKET_NAME;
const R2_ENDPOINT = config.r2Endpoint || process.env.R2_ENDPOINT;
// Optional: Set R2_PUBLIC_URL in .env if your bucket has a public custom domain
// e.g. R2_PUBLIC_URL=https://pub-abc123.r2.dev  or  https://files.yourdomain.com
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

/**
 * Helper: Convert AWS SDK v3 Body (web ReadableStream / Node stream) → Buffer
 */
async function streamToBuffer(stream) {
  // AWS SDK v3 returns a web ReadableStream in some environments
  if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }
  // Fallback for Node.js native stream
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Upload a file/buffer to Cloudflare R2 bucket
 */
export async function uploadToR2({ key, buffer, contentType = 'application/octet-stream', metadata = {} }) {
  const cleanKey = key.replace(/^\/+/, '');
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata
  });

  await s3Client.send(command);

  // If a public R2 URL is configured, use it directly (avoids proxying through backend)
  // Otherwise fall back to the backend proxy route
  const url = R2_PUBLIC_URL
    ? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${cleanKey}`
    : `/api/uploads/file/${cleanKey}`;

  return {
    key: cleanKey,
    bucket: R2_BUCKET_NAME,
    url
  };
}

/**
 * Retrieve a file from Cloudflare R2 and return it as a Buffer
 */
export async function getFromR2(key) {
  const cleanKey = key.replace(/^\/+/, '');
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanKey
  });

  const response = await s3Client.send(command);

  // Convert AWS SDK v3 Body stream → Node.js Buffer
  const buffer = await streamToBuffer(response.Body);

  return {
    body: buffer,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: buffer.length
  };
}

/**
 * Delete an object from Cloudflare R2
 */
export async function deleteFromR2(key) {
  const cleanKey = key.replace(/^\/+/, '');
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanKey
  });

  await s3Client.send(command);
  return { success: true, key: cleanKey };
}

