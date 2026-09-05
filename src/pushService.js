import webpush from 'web-push';
import { getRows, addRow, deleteRow, updateRow } from './db.js';
import { config } from './config.js';

// VAPID Keys configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || config.vapidPublicKey || 'BPzYce6UvC8ShowBUmiQFxeKSAwKqOt-F88DErrFG5UyUExDNuNDVnyPgfXmQM5quBSQ2sDuwowiNv42189KVnA';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || config.vapidPrivateKey || '-wVAHRSLiI6QQa0gGVcWpj2gC8Ll6iKmw-3_d6k47YQ';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@shazusoft.com';

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  console.log('[WebPush] VAPID configuration initialized successfully.');
} catch (err) {
  console.error('[WebPush] Error setting VAPID details:', err);
}

/**
 * Returns the public VAPID key to send to browsers for PushSubscription
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Registers or updates a browser push subscription for an employee.
 * Uses addRow which handles upsert via ON CONFLICT (id).
 * To handle upsert on endpoint uniqueness we first remove any existing record
 * with the same endpoint, then insert fresh.
 */
export async function saveSubscription(employeeId, subscription, userAgent = '') {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid push subscription payload.');
  }

  const { endpoint, keys } = subscription;
  const p256dh = keys.p256dh;
  const auth = keys.auth;

  // Remove any stale record for this endpoint first (safe no-op if none exists)
  await deleteRow('Push_Subscriptions', 'endpoint', endpoint).catch(() => {});

  const newSub = {
    id: `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    employee_id: employeeId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent,
    created_at: new Date().toISOString()
  };

  await addRow('Push_Subscriptions', newSub);
  return { success: true, message: 'Push subscription registered successfully.' };
}

/**
 * Removes a subscription when user opts out or unregisters
 */
export async function removeSubscription(endpoint) {
  if (!endpoint) return { success: false };
  await deleteRow('Push_Subscriptions', 'endpoint', endpoint);
  return { success: true };
}


/**
 * Sends a push notification to all active devices of an employee
 */
export async function sendPushNotification(employeeId, notificationPayload) {
  if (!employeeId || !notificationPayload) return { sent: 0, failed: 0 };

  const allSubs = await getRows('Push_Subscriptions');
  const userSubs = allSubs.filter(s => s.employee_id === employeeId || s.employee_id === 'ALL');

  if (userSubs.length === 0) {
    return { sent: 0, failed: 0, message: 'No registered push subscriptions for employee.' };
  }

  const payloadString = JSON.stringify({
    title: notificationPayload.title || 'ShazuSoft HRMS',
    body: notificationPayload.body || notificationPayload.message || 'You have a new update.',
    icon: notificationPayload.icon || '/logo.png',
    badge: notificationPayload.badge || '/logo.png',
    url: notificationPayload.url || '/',
    tag: notificationPayload.tag || `shazu-notif-${Date.now()}`,
    data: notificationPayload.data || {},
    timestamp: Date.now()
  });

  let sent = 0;
  let failed = 0;

  for (const sub of userSubs) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, payloadString);
      sent++;
    } catch (err) {
      failed++;
      console.warn(`[WebPush] Delivery failed for endpoint ${sub.endpoint.slice(0, 30)}... status: ${err.statusCode}`);
      // If subscription has expired or is unsubscribed (HTTP 410 or 404), clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(sub.endpoint).catch(() => {});
      }
    }
  }

  return { sent, failed, total: userSubs.length };
}

/**
 * Broadcasts a push notification to all subscribers in the organization
 */
export async function broadcastPushNotification(notificationPayload) {
  const allSubs = await getRows('Push_Subscriptions');
  if (allSubs.length === 0) return { sent: 0, failed: 0 };

  const payloadString = JSON.stringify({
    title: notificationPayload.title || 'ShazuSoft HRMS Announcement',
    body: notificationPayload.body || notificationPayload.message || '',
    icon: notificationPayload.icon || '/logo.png',
    badge: notificationPayload.badge || '/logo.png',
    url: notificationPayload.url || '/',
    tag: notificationPayload.tag || `shazu-broadcast-${Date.now()}`,
    data: notificationPayload.data || {},
    timestamp: Date.now()
  });

  let sent = 0;
  let failed = 0;

  for (const sub of allSubs) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, payloadString);
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeSubscription(sub.endpoint).catch(() => {});
      }
    }
  }

  return { sent, failed, total: allSubs.length };
}
