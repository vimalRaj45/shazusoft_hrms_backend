import { verifyAuth, verifyAdmin } from '../auth.js';
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushNotification,
  broadcastPushNotification
} from '../pushService.js';
import { getRows } from '../db.js';
import {
  registerSseClient,
  dispatchNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '../inAppNotificationService.js';

export default async function notificationsRoutes(fastify, options) {
  // GET /api/notifications/stream (Server-Sent Events real-time notification stream)
  fastify.get('/stream', async (request, reply) => {
    const token = request.query?.token || (request.headers.authorization ? request.headers.authorization.replace(/^Bearer\s+/i, '') : null);
    if (!token) {
      return reply.status(401).send({ error: 'Authentication token required for notification stream' });
    }

    let user;
    try {
      user = fastify.jwt.verify(token);
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired authentication token' });
    }

    if (!user || !user.id) {
      return reply.status(401).send({ error: 'User identity could not be verified' });
    }

    registerSseClient(user.id, reply, request);
    return reply;
  });

  // GET /api/notifications/in-app (Fetch user's in-app notifications and unread count)
  fastify.get('/in-app', { preHandler: [verifyAuth] }, async (request, reply) => {
    const limit = parseInt(request.query?.limit, 10) || 50;
    const data = await getUserNotifications(request.user.id, limit);
    return data;
  });

  // PUT /api/notifications/in-app/:id/read (Mark a single notification as read)
  fastify.put('/in-app/:id/read', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const success = await markNotificationAsRead(id, request.user.id);
    return { success };
  });

  // PUT /api/notifications/in-app/read-all (Mark all notifications as read)
  fastify.put('/in-app/read-all', { preHandler: [verifyAuth] }, async (request, reply) => {
    const count = await markAllNotificationsAsRead(request.user.id);
    return { success: true, count };
  });

  // DELETE /api/notifications/in-app/:id (Delete a notification)
  fastify.delete('/in-app/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const success = await deleteNotification(id, request.user.id);
    return { success };
  });

  // POST /api/notifications/in-app/test (Dispatch unified test notification)
  fastify.post('/in-app/test', { preHandler: [verifyAuth] }, async (request, reply) => {
    const inserted = await dispatchNotification({
      recipientId: request.user.id,
      title: 'Notification System Active! 🔔',
      message: `Hi ${request.user.name}, real-time in-app alerts and Web Push are now operating with 100% reliability.`,
      type: 'info',
      targetTab: 'dashboard',
      targetUrl: '/?tab=dashboard',
      metadata: { test: true },
      sendPush: true
    });
    return {
      success: true,
      message: 'Test notification dispatched across Real-Time In-App and Web Push layers.',
      data: inserted
    };
  });

  // GET /api/notifications/vapid-public-key
  fastify.get('/vapid-public-key', async (request, reply) => {
    const publicKey = getVapidPublicKey();
    return { publicKey };
  });

  // POST /api/notifications/subscribe (Register browser PushSubscription)
  fastify.post('/subscribe', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { subscription, userAgent } = request.body || {};

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return reply.status(400).send({ error: 'Valid PushSubscription object is required.' });
    }

    const userId = request.user?.id;
    if (!userId) {
      return reply.status(401).send({ error: 'User identity could not be verified from session token.' });
    }

    try {
      await saveSubscription(userId, subscription, userAgent || request.headers['user-agent'] || '');
      return {
        success: true,
        message: 'Push notification subscription registered successfully.'
      };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: err.message || 'Failed to save subscription.' });
    }
  });

  // POST /api/notifications/unsubscribe (Opt out / remove subscription)
  fastify.post('/unsubscribe', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { endpoint } = request.body || {};
    if (!endpoint) {
      return reply.status(400).send({ error: 'Subscription endpoint is required.' });
    }

    try {
      await removeSubscription(endpoint);
      return { success: true, message: 'Unsubscribed from push notifications.' };
    } catch (err) {
      return reply.status(500).send({ error: 'Failed to unsubscribe.' });
    }
  });

  // POST /api/notifications/send-test (Immediate self-test push notification)
  fastify.post('/send-test', { preHandler: [verifyAuth] }, async (request, reply) => {
    const payload = {
      title: 'ShazuSoft HRMS Test Notification',
      body: `Hello ${request.user.name}! Push notifications are successfully active and working.`,
      url: '/?tab=dashboard',
      tab: 'dashboard',
      tag: 'shazu-test-push'
    };

    const result = await sendPushNotification(request.user.id, payload);
    return {
      success: true,
      message: result.sent > 0 ? 'Test push notification dispatched!' : 'No active subscriptions found for your account. Please click Enable Push Notifications first.',
      details: result
    };
  });

  // POST /api/notifications/broadcast (Admin only: company-wide announcement)
  fastify.post('/broadcast', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { title, message, url, tab } = request.body || {};

    if (!title || !message) {
      return reply.status(400).send({ error: 'Title and message are required for broadcast notification.' });
    }

    await dispatchNotification({
      recipientId: 'ALL',
      title: title,
      message: message,
      type: 'broadcast',
      targetTab: tab || 'announcements',
      targetUrl: url || '/?tab=announcements',
      sendPush: true
    });

    return {
      success: true,
      message: 'Broadcast notification dispatched successfully to all employees.'
    };
  });

  // GET /api/notifications/status (Check if user has registered subscriptions)
  fastify.get('/status', { preHandler: [verifyAuth] }, async (request, reply) => {
    const allSubs = await getRows('Push_Subscriptions');
    const userSubs = allSubs.filter(s => s.employee_id === request.user.id);
    return {
      isSubscribed: userSubs.length > 0,
      activeDeviceCount: userSubs.length
    };
  });
}
