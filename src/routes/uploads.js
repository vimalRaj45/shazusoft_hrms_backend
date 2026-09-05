import { uploadToR2, getFromR2, deleteFromR2 } from '../r2.js';
import { verifyAuth } from '../auth.js';
import { getRows } from '../db.js';
import crypto from 'crypto';

export default async function uploadRoutes(fastify, options) {
  // POST /api/uploads/base64 - Direct base64 data upload to Cloudflare R2
  fastify.post('/base64', { preHandler: [verifyAuth], bodyLimit: 52428800 }, async (request, reply) => {
    const { data_url, filename, folder = 'documents' } = request.body || {};

    if (!data_url) {
      return reply.status(400).send({ error: 'data_url string is required.' });
    }

    if (request.user.role !== 'admin') {
      const employees = await getRows('Employees');
      const user = employees.find(e => e.id === request.user.id);
      if (user && (user.documents_frozen === true || user.documents_frozen === 'true' || user.documents_frozen === 't')) {
        return reply.status(403).send({
          error: 'Documents and profile records are locked/frozen by HR Administration.'
        });
      }
    }

    try {
      const matches = data_url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let contentType = 'application/octet-stream';
      let base64Data = data_url;

      if (matches && matches.length === 3) {
        contentType = matches[1];
        base64Data = matches[2];
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const ext = filename ? filename.split('.').pop() : contentType.split('/')[1] || 'bin';
      const cleanName = filename ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : 'file';
      const uniqueKey = `${folder}/${request.user.id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${cleanName}`;

      const uploadResult = await uploadToR2({
        key: uniqueKey,
        buffer,
        contentType,
        metadata: {
          uploader_id: request.user.id,
          uploader_name: request.user.name,
          original_filename: filename || 'file'
        }
      });

      return {
        success: true,
        message: 'File uploaded successfully to Cloudflare R2.',
        key: uploadResult.key,
        url: uploadResult.url,
        contentType,
        size: `${(buffer.length / 1024).toFixed(1)} KB`
      };
    } catch (err) {
      console.error('[R2 Upload Error]', err);
      return reply.status(500).send({
        error: 'Failed to upload document to Cloudflare R2 storage.',
        details: err.message
      });
    }
  });

  // GET /api/uploads/file/* - Serve file from Cloudflare R2 with proper inline display headers
  fastify.get('/file/*', async (request, reply) => {
    const fileKey = request.params['*'];
    if (!fileKey) {
      return reply.status(400).send({ error: 'File key is required.' });
    }

    try {
      const r2Object = await getFromR2(fileKey);

      // Extract filename from key path for Content-Disposition
      const filename = fileKey.split('/').pop() || 'file';
      const isPdf = r2Object.contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
      const isImage = r2Object.contentType?.startsWith('image/');

      // Set headers that instruct browser to DISPLAY the file inline (not download)
      reply.header('Content-Type', r2Object.contentType || (isPdf ? 'application/pdf' : 'application/octet-stream'));
      reply.header('Content-Length', String(r2Object.contentLength || 0));
      reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
      reply.header('Cache-Control', 'public, max-age=86400');
      reply.header('Accept-Ranges', 'bytes');

      // CORS headers — allow browser to render files cross-origin
      reply.header('Access-Control-Allow-Origin', '*');
      reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');

      return reply.send(r2Object.body);
    } catch (err) {
      console.error('[R2 Retrieve Error]', err);
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return reply.status(404).send({ error: 'File not found in storage.' });
      }
      return reply.status(500).send({ error: 'Failed to retrieve file from storage.' });
    }
  });

  // OPTIONS preflight for CORS on file serving
  fastify.options('/file/*', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return reply.status(204).send();
  });


  // DELETE /api/uploads/file/* - Delete file from Cloudflare R2
  fastify.delete('/file/*', { preHandler: [verifyAuth] }, async (request, reply) => {
    const fileKey = request.params['*'];
    if (!fileKey) {
      return reply.status(400).send({ error: 'File key is required.' });
    }

    if (request.user.role !== 'admin') {
      const employees = await getRows('Employees');
      const user = employees.find(e => e.id === request.user.id);
      if (user && (user.documents_frozen === true || user.documents_frozen === 'true' || user.documents_frozen === 't')) {
        return reply.status(403).send({
          error: 'Documents and profile records are locked/frozen by HR Administration.'
        });
      }
    }

    try {
      await deleteFromR2(fileKey);
      return { success: true, message: 'File deleted from Cloudflare R2 storage.' };
    } catch (err) {
      console.error('[R2 Delete Error]', err);
      return reply.status(500).send({ error: 'Failed to delete file from storage.' });
    }
  });
}
