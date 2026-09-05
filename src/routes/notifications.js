import { verifyAuth, verifyAdmin } from '../auth.js';
import {
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  sendPushNotification,
  broadcastPushNotification
} from '../pushService.js';
import { getRows } from '../db.js';

export default async function notificationsRoutes(fastify, options) {
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

    try {
      await saveSubscription(request.user.id, subscription, userAgent || request.headers['user-agent'] || '');
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
      title: '🔔 ShazuSoft HRMS Test Notification',
      body: `Hello ${request.user.name}! Push notifications are successfully active and working.`,
      url: '/',
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
    const { title, message, url } = request.body || {};

    if (!title || !message) {
      return reply.status(400).send({ error: 'Title and message are required for broadcast notification.' });
    }

    const payload = {
      title: `📢 ${title}`,
      body: message,
      url: url || '/'
    };

    const result = await broadcastPushNotification(payload);
    return {
      success: true,
      message: `Broadcast sent to ${result.sent} active device(s).`,
      details: result
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
