import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { config } from './config.js';
import { initDB, getStatus } from './db.js';

// Enforce organizational timezone across all Date operations
if (config.timeZone) {
  process.env.TZ = config.timeZone;
}

import authRoutes from './routes/auth.js';
import attendanceRoutes from './routes/attendance.js';
import workDoneRoutes from './routes/workdone.js';
import leaveRoutes from './routes/leaves.js';
import reportsRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import evaluationRoutes from './routes/evaluations.js';
import tasksRoutes from './routes/tasks.js';
import communicationsRoutes from './routes/communications.js';
import searchRoutes from './routes/search.js';
import ticketsRoutes from './routes/tickets.js';
import uploadRoutes from './routes/uploads.js';
import notificationsRoutes from './routes/notifications.js';

async function buildServer() {
  const fastify = Fastify({
    logger: config.isProduction ? { level: 'info' } : true,
    bodyLimit: 52428800 // 50MB for document & image uploads
  });

  // Setup Plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  await fastify.register(jwt, {
    secret: config.jwtSecret
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      service: 'Shazusoft HRMS Backend API',
      timestamp: new Date().toISOString(),
      databaseStatus: getStatus(),
      sheetsStatus: getStatus()
    };
  });

  // Register API Routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(attendanceRoutes, { prefix: '/api/attendance' });
  await fastify.register(workDoneRoutes, { prefix: '/api/workdone' });
  await fastify.register(leaveRoutes, { prefix: '/api/leaves' });
  await fastify.register(reportsRoutes, { prefix: '/api/reports' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });
  await fastify.register(evaluationRoutes, { prefix: '/api/evaluations' });
  await fastify.register(tasksRoutes, { prefix: '/api/tasks' });
  await fastify.register(communicationsRoutes, { prefix: '/api/communications' });
  await fastify.register(searchRoutes, { prefix: '/api/search' });
  await fastify.register(ticketsRoutes, { prefix: '/api/tickets' });
  await fastify.register(uploadRoutes, { prefix: '/api/uploads' });
  await fastify.register(notificationsRoutes, { prefix: '/api/notifications' });

  return fastify;
}

async function start() {
  try {
    console.log('----------------------------------------------------');
    console.log(`🚀 Initializing Shazusoft HRMS Backend [${config.nodeEnv.toUpperCase()}]...`);
    console.log('🔒 Production Integrity: Seed & Mock Data Generation DISABLED');
    console.log('----------------------------------------------------');

    await initDB();

    const server = await buildServer();
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`📡 HRMS Fastify API Server running at http://localhost:${config.port}`);
    console.log(`🔒 Geofence set to Lat: ${config.officeLatitude}, Lng: ${config.officeLongitude} (Radius: ${config.officeRadiusMeters}m)`);
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

start();
