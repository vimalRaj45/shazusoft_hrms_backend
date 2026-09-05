import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from './config.js';

const R2_ACCESS_KEY_ID = config.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = config.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = config.r2BucketName || process.env.R2_BUCKET_NAME;
const R2_ENDPOINT = config.r2Endpoint || process.env.R2_ENDPOINT;

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

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

  return {
    key: cleanKey,
    bucket: R2_BUCKET_NAME,
    url: `/api/uploads/file/${cleanKey}`
  };
}

/**
 * Retrieve a file stream and headers from Cloudflare R2
 */
export async function getFromR2(key) {
  const cleanKey = key.replace(/^\/+/, '');
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cleanKey
  });

  const response = await s3Client.send(command);
  return {
    body: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength
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
