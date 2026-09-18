import {
  getRows,
  addRow,
  updateRow,
  deleteRow,
  invalidateCache,
  getStatus,
  logKernelAction,
  getKernelAuditLogs,
  rollbackKernelRecord,
  getAllTableSchemas
} from '../db.js';
import { sendOTPEmail } from '../mailer.js';
import { config } from '../config.js';

// Dedicated in-memory cache for Kernel Root OTP codes with 10-minute expiry
const kernelOtpCache = new Map();

/**
 * Kernel Level Admin Authentication Middleware
 * Strictly validates elevated kernel root access
 */
export async function verifyKernelAdmin(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized: Kernel authentication token required or expired.' });
  }

  const user = request.user;
  if (!user || (!user.is_kernel_admin && user.role !== 'kernel_admin')) {
    return reply.status(403).send({ error: 'Access Denied: Kernel Level Root Authorization required.' });
  }
}

export default async function kernelAdminRoutes(fastify, options) {
  // ─────────────────────────────────────────────────────────────
  //  1. DEDICATED KERNEL ROOT EMAIL OTP AUTHENTICATION
  // ─────────────────────────────────────────────────────────────

  // GET /api/kernel/auth/config — Retrieve Root Admin Email Info (from .env)
  fastify.get('/auth/config', async (request, reply) => {
    const rootEmail = config.rootAdminEmail;
    // Mask email for security (e.g. v***@gmail.com)
    const [userPart, domainPart] = rootEmail.split('@');
    const maskedUser = userPart.length > 2 
      ? `${userPart.charAt(0)}${'*'.repeat(userPart.length - 2)}${userPart.slice(-1)}`
      : `${userPart.charAt(0)}*`;
    const maskedEmail = `${maskedUser}@${domainPart || 'domain.com'}`;

    return {
      rootEmailConfigured: true,
      rootEmail,
      maskedEmail
    };
  });

  // POST /api/kernel/auth/send-otp — Dispatch 6-digit Root Passcode to configured .env Root Email
  fastify.post('/auth/send-otp', async (request, reply) => {
    const { email } = request.body || {};
    const clientIp = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'Unknown Agent';

    const configuredRootEmail = config.rootAdminEmail;
    const cleanEmail = (email || '').trim().toLowerCase();

    // Strict validation: Email MUST match the root administrator email configured in .env
    if (!cleanEmail || cleanEmail !== configuredRootEmail) {
      await logKernelAction({
        actorId: 'UNAUTHORIZED_ATTEMPT',
        actorName: cleanEmail || 'Unknown',
        actorRole: 'unauthorized',
        actorIp: clientIp,
        userAgent,
        actionType: 'FAILED_ROOT_OTP',
        tableName: 'SYSTEM_SECURITY',
        recordId: cleanEmail,
        reason: `Unauthorized attempt to request Root OTP for non-root email: ${cleanEmail}. Expected: ${configuredRootEmail}`,
        status: 'FAILED'
      });

      return reply.status(403).send({
        error: `Access Denied: Only the designated Root Administrator email configured in system environment (${configuredRootEmail}) is authorized for Kernel Access.`
      });
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    kernelOtpCache.set(configuredRootEmail, {
      otp,
      expiresAt,
      attempts: 0
    });

    try {
      await sendOTPEmail({
        toEmail: configuredRootEmail,
        otp,
        employeeName: 'Root System Administrator'
      });

      await logKernelAction({
        actorId: 'KERNEL-ROOT',
        actorName: 'Root Administrator',
        actorRole: 'kernel_admin',
        actorIp: clientIp,
        userAgent,
        actionType: 'ROOT_OTP_DISPATCHED',
        tableName: 'SYSTEM_SECURITY',
        recordId: configuredRootEmail,
        reason: `Root Verification OTP dispatched to ${configuredRootEmail}`,
        status: 'SUCCESS'
      });

      console.log(`[Kernel Security] Root OTP successfully dispatched to ${configuredRootEmail}`);

      return {
        success: true,
        message: `A single-use 6-digit Root Verification Code has been dispatched to ${configuredRootEmail}.`
      };
    } catch (err) {
      console.error('[Kernel OTP Mailer Error]', err.message);
      return reply.status(500).send({
        error: 'Failed to deliver Root OTP verification email via corporate mail server. Please verify mailer configuration.'
      });
    }
  });

  // POST /api/kernel/auth/verify-otp — Verify Root OTP and Issue Elevated Kernel JWT
  fastify.post('/auth/verify-otp', async (request, reply) => {
    const { email, otp } = request.body || {};
    const clientIp = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    const userAgent = request.headers['user-agent'] || 'Unknown Agent';

    const configuredRootEmail = config.rootAdminEmail;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').toString().trim();

    if (!cleanEmail || !cleanOtp) {
      return reply.status(400).send({ error: 'Root Administrator email and 6-digit OTP code are required.' });
    }

    if (cleanEmail !== configuredRootEmail) {
      return reply.status(403).send({ error: 'Access Denied: Invalid Root Email.' });
    }

    const cached = kernelOtpCache.get(configuredRootEmail);
    if (!cached) {
      return reply.status(400).send({ error: 'No active Root verification session found. Please request a new OTP code.' });
    }

    if (Date.now() > cached.expiresAt) {
      kernelOtpCache.delete(configuredRootEmail);
      return reply.status(400).send({ error: 'Root verification code has expired. Please request a new one.' });
    }

    if (cached.attempts >= 5) {
      kernelOtpCache.delete(configuredRootEmail);
      return reply.status(429).send({ error: 'Too many invalid attempts. Security lockout applied. Please request a new OTP.' });
    }

    if (cached.otp !== cleanOtp) {
      cached.attempts += 1;
      await logKernelAction({
        actorId: 'KERNEL-ROOT',
        actorName: 'Root Administrator',
        actorRole: 'kernel_admin',
        actorIp: clientIp,
        userAgent,
        actionType: 'FAILED_OTP_VERIFY',
        tableName: 'SYSTEM_SECURITY',
        recordId: configuredRootEmail,
        reason: `Invalid Root OTP attempt (${cached.attempts}/5)`,
        status: 'FAILED'
      });

      return reply.status(401).send({ error: `Invalid verification code. ${5 - cached.attempts} attempts remaining.` });
    }

    // OTP Valid - Remove session from cache
    kernelOtpCache.delete(configuredRootEmail);

    // Fetch matching employee record or generate root identity
    const employees = await getRows('Employees');
    const matchedEmployee = employees.find(e => e.email?.toLowerCase() === configuredRootEmail);

    const kernelUser = {
      id: matchedEmployee?.id || 'KERNEL-ROOT-01',
      name: matchedEmployee?.name || 'Master Kernel Administrator',
      email: configuredRootEmail,
      role: 'kernel_admin',
      is_kernel_admin: true,
      department: matchedEmployee?.department || 'System Architecture',
      designation: matchedEmployee?.designation || 'Master Administrator',
      session_created: new Date().toISOString()
    };

    const token = fastify.jwt.sign(kernelUser, { expiresIn: '8h' });

    await logKernelAction({
      actorId: kernelUser.id,
      actorName: kernelUser.name,
      actorRole: 'kernel_admin',
      actorIp: clientIp,
      userAgent,
      actionType: 'ROOT_LOGIN_OTP',
      tableName: 'SYSTEM_SECURITY',
      recordId: kernelUser.id,
      reason: `Root Administrator authenticated successfully via Email OTP (${configuredRootEmail})`,
      status: 'SUCCESS'
    });

    return {
      success: true,
      message: `Kernel Root Console Authorized. Welcome, ${kernelUser.name}!`,
      token,
      user: kernelUser
    };
  });

  // GET /api/kernel/auth/me — Verify active Kernel session
  fastify.get('/auth/me', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    return {
      authenticated: true,
      user: request.user,
      kernel_level: 'ROOT_SUPERADMIN',
      system: getStatus()
    };
  });

  // ─────────────────────────────────────────────────────────────
  //  2. UNIVERSAL TABLE EXPLORER & SCHEMA DISCOVERY
  // ─────────────────────────────────────────────────────────────

  // GET /api/kernel/tables — Discover all tables, column definitions, and live row counts
  fastify.get('/tables', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const schemas = await getAllTableSchemas();
    return {
      success: true,
      totalTables: schemas.length,
      tables: schemas
    };
  });

  // GET /api/kernel/tables/:table — Paginated, Searchable, Filterable Query for ANY table
  fastify.get('/tables/:table', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table } = request.params;
    const {
      page = 1,
      limit = 50,
      search = '',
      sortBy = '',
      sortOrder = 'desc',
      filterField = '',
      filterValue = ''
    } = request.query || {};

    const schemas = await getAllTableSchemas();
    const matchedTable = schemas.find(s =>
      s.modelName.toLowerCase() === table.toLowerCase() ||
      s.sqlName.toLowerCase() === table.toLowerCase()
    );

    if (!matchedTable) {
      return reply.status(404).send({ error: `Table "${table}" does not exist in HRMS schema.` });
    }

    const rows = await getRows(matchedTable.modelName);
    let filtered = [...rows];

    // Field-specific filter
    if (filterField && filterValue) {
      filtered = filtered.filter(r => String(r[filterField] || '').toLowerCase() === String(filterValue).toLowerCase());
    }

    // Global Search across all fields
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => {
        return Object.values(r).some(val => String(val || '').toLowerCase().includes(q));
      });
    }

    // Sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        const valA = a[sortBy] ?? '';
        const valB = b[sortBy] ?? '';
        if (sortOrder === 'asc') {
          return valA > valB ? 1 : (valA < valB ? -1 : 0);
        }
        return valA < valB ? 1 : (valA > valB ? -1 : 0);
      });
    }

    const total = filtered.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 50);
    const offset = (pageNum - 1) * limitNum;
    const paginated = filtered.slice(offset, offset + limitNum);

    return {
      success: true,
      table: matchedTable.modelName,
      sqlTable: matchedTable.sqlName,
      columns: matchedTable.columns,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data: paginated
    };
  });

  // GET /api/kernel/tables/:table/:id — Retrieve single record
  fastify.get('/tables/:table/:id', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table, id } = request.params;
    const schemas = await getAllTableSchemas();
    const matchedTable = schemas.find(s =>
      s.modelName.toLowerCase() === table.toLowerCase() ||
      s.sqlName.toLowerCase() === table.toLowerCase()
    );

    if (!matchedTable) {
      return reply.status(404).send({ error: `Table "${table}" does not exist.` });
    }

    const rows = await getRows(matchedTable.modelName);
    const record = rows.find(r => String(r.id) === String(id));

    if (!record) {
      return reply.status(404).send({ error: `Record with ID "${id}" not found in table "${matchedTable.modelName}".` });
    }

    return {
      success: true,
      table: matchedTable.modelName,
      record
    };
  });

  // ─────────────────────────────────────────────────────────────
  //  3. UNIVERSAL AUDITED CRUD OPERATIONS (CREATE, UPDATE, DELETE)
  // ─────────────────────────────────────────────────────────────

  // POST /api/kernel/tables/:table — Create new record with mandatory audit trail
  fastify.post('/tables/:table', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table } = request.params;
    const { _reason, ...recordData } = request.body || {};

    const schemas = await getAllTableSchemas();
    const matchedTable = schemas.find(s =>
      s.modelName.toLowerCase() === table.toLowerCase() ||
      s.sqlName.toLowerCase() === table.toLowerCase()
    );

    if (!matchedTable) {
      return reply.status(404).send({ error: `Table "${table}" does not exist.` });
    }

    const tableName = matchedTable.modelName;

    // Generate collision-free ID if not provided
    if (!recordData.id) {
      const prefix = tableName.substring(0, 4).toUpperCase();
      recordData.id = `${prefix}-${Date.now()}`;
    }

    if (!recordData.created_at) {
      recordData.created_at = new Date().toISOString();
    }

    try {
      const saved = await addRow(tableName, recordData);

      // Record Kernel Audit Log
      await logKernelAction({
        actorId: request.user.id || 'KERNEL-ROOT',
        actorName: request.user.name || 'Root Administrator',
        actorRole: request.user.role || 'kernel_admin',
        actorIp: request.ip || '127.0.0.1',
        userAgent: request.headers['user-agent'] || 'Kernel Console',
        actionType: 'CREATE',
        tableName,
        recordId: saved.id,
        previousState: null,
        newState: saved,
        reason: _reason || request.headers['x-audit-reason'] || 'Kernel Console Direct Insertion'
      });

      return {
        success: true,
        message: `Successfully created record in "${tableName}".`,
        record: saved
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Failed to create record in "${tableName}": ${err.message}` });
    }
  });

  // PUT /api/kernel/tables/:table/:id — Update record with before/after state diff recording
  fastify.put('/tables/:table/:id', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table, id } = request.params;
    const { _reason, ...updateData } = request.body || {};

    const schemas = await getAllTableSchemas();
    const matchedTable = schemas.find(s =>
      s.modelName.toLowerCase() === table.toLowerCase() ||
      s.sqlName.toLowerCase() === table.toLowerCase()
    );

    if (!matchedTable) {
      return reply.status(404).send({ error: `Table "${table}" does not exist.` });
    }

    const tableName = matchedTable.modelName;
    const existingRows = await getRows(tableName);
    const previousRecord = existingRows.find(r => String(r.id) === String(id));

    if (!previousRecord) {
      return reply.status(404).send({ error: `Record with ID "${id}" not found in "${tableName}".` });
    }

    // Automatically update timestamp if table supports it
    if (matchedTable.columns.includes('updated_at')) {
      updateData.updated_at = new Date().toISOString();
    }

    try {
      const updated = await updateRow(tableName, 'id', id, updateData);

      // Record Kernel Audit Log with automated diff calculation
      await logKernelAction({
        actorId: request.user.id || 'KERNEL-ROOT',
        actorName: request.user.name || 'Root Administrator',
        actorRole: request.user.role || 'kernel_admin',
        actorIp: request.ip || '127.0.0.1',
        userAgent: request.headers['user-agent'] || 'Kernel Console',
        actionType: 'UPDATE',
        tableName,
        recordId: id,
        previousState: previousRecord,
        newState: updated,
        reason: _reason || request.headers['x-audit-reason'] || 'Kernel Console Direct Update'
      });

      return {
        success: true,
        message: `Record "${id}" in "${tableName}" updated successfully.`,
        record: updated
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Failed to update record in "${tableName}": ${err.message}` });
    }
  });

  // DELETE /api/kernel/tables/:table/:id — Delete record with full snapshot archiving in Audit Log
  fastify.delete('/tables/:table/:id', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table, id } = request.params;
    const { reason = '' } = request.body || request.query || {};

    const schemas = await getAllTableSchemas();
    const matchedTable = schemas.find(s =>
      s.modelName.toLowerCase() === table.toLowerCase() ||
      s.sqlName.toLowerCase() === table.toLowerCase()
    );

    if (!matchedTable) {
      return reply.status(404).send({ error: `Table "${table}" does not exist.` });
    }

    const tableName = matchedTable.modelName;
    const existingRows = await getRows(tableName);
    const previousRecord = existingRows.find(r => String(r.id) === String(id));

    if (!previousRecord) {
      return reply.status(404).send({ error: `Record with ID "${id}" not found in "${tableName}".` });
    }

    try {
      const deleted = await deleteRow(tableName, 'id', id);

      if (!deleted) {
        return reply.status(500).send({ error: `Failed to remove record "${id}" from "${tableName}".` });
      }

      // Record Kernel Audit Log preserving full snapshot for instant rollback capability
      await logKernelAction({
        actorId: request.user.id || 'KERNEL-ROOT',
        actorName: request.user.name || 'Root Administrator',
        actorRole: request.user.role || 'kernel_admin',
        actorIp: request.ip || '127.0.0.1',
        userAgent: request.headers['user-agent'] || 'Kernel Console',
        actionType: 'DELETE',
        tableName,
        recordId: id,
        previousState: previousRecord,
        newState: null,
        reason: reason || request.headers['x-audit-reason'] || 'Kernel Console Direct Deletion'
      });

      return {
        success: true,
        message: `Record "${id}" deleted from "${tableName}". Historical snapshot archived in Audit Ledger for rollback.`
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Failed to delete record: ${err.message}` });
    }
  });

  // ─────────────────────────────────────────────────────────────
  //  4. KERNEL AUDIT LEDGER & ROLLBACK ENGINE
  // ─────────────────────────────────────────────────────────────

  // GET /api/kernel/audit/logs — Stream audit logs with filtering and search
  fastify.get('/audit/logs', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const {
      limit = 50,
      offset = 0,
      tableName = '',
      actorId = '',
      actionType = '',
      search = ''
    } = request.query || {};

    const result = await getKernelAuditLogs({
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      tableName,
      actorId,
      actionType,
      search
    });

    return {
      success: true,
      ...result
    };
  });

  // POST /api/kernel/audit/rollback/:logId — One-Click Historical Snapshot Rollback
  fastify.post('/audit/rollback/:logId', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { logId } = request.params;
    const { reason = '' } = request.body || {};

    try {
      const rollbackResult = await rollbackKernelRecord(logId, {
        id: request.user.id,
        name: request.user.name,
        role: request.user.role,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        reason
      });

      return {
        success: true,
        message: `Rollback applied successfully from log entry "${logId}".`,
        ...rollbackResult
      };
    } catch (err) {
      return reply.status(400).send({ error: `Rollback failed: ${err.message}` });
    }
  });

  // GET /api/kernel/audit/export — Export audit logs as CSV / JSON
  fastify.get('/audit/export', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { format = 'json' } = request.query || {};
    const logs = await getRows('Kernel_Audit_Logs');

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'actor_name', 'actor_role', 'action_type', 'table_name', 'record_id', 'reason', 'status'];
      const csvLines = [headers.join(',')];

      for (const log of logs) {
        const row = headers.map(h => {
          const val = String(log[h] || '').replace(/"/g, '""');
          return `"${val}"`;
        });
        csvLines.push(row.join(','));
      }

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', `attachment; filename="kernel_audit_logs_${Date.now()}.csv"`);
      return reply.send(csvLines.join('\n'));
    }

    return {
      exportTimestamp: new Date().toISOString(),
      totalRecords: logs.length,
      logs
    };
  });

  // ─────────────────────────────────────────────────────────────
  //  5. SYSTEM DIAGNOSTICS & MAINTENANCE
  // ─────────────────────────────────────────────────────────────

  // GET /api/kernel/system/diagnostics — Real-time telemetry & DB metrics
  fastify.get('/system/diagnostics', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const schemas = await getAllTableSchemas();
    const totalRecords = schemas.reduce((sum, s) => sum + (s.rowCount || 0), 0);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      status: getStatus(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        totalTables: schemas.length,
        totalRecords,
        tables: schemas.map(s => ({ table: s.modelName, count: s.rowCount }))
      }
    };
  });

  // POST /api/kernel/system/clear-cache — Purge in-memory caching
  fastify.post('/system/clear-cache', { preHandler: [verifyKernelAdmin] }, async (request, reply) => {
    const { table } = request.body || {};
    invalidateCache(table || null);

    await logKernelAction({
      actorId: request.user.id || 'KERNEL-ROOT',
      actorName: request.user.name || 'Root Administrator',
      actorRole: 'kernel_admin',
      actorIp: request.ip || '127.0.0.1',
      userAgent: request.headers['user-agent'] || 'Kernel Console',
      actionType: 'CACHE_PURGE',
      tableName: table || 'ALL_TABLES',
      recordId: 'CACHE',
      reason: `Manual Cache Purge executed for ${table || 'all tables'}`
    });

    return {
      success: true,
      message: `In-memory cache purged successfully for ${table || 'all tables'}.`
    };
  });
}
