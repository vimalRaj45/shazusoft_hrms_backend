import { addRow, getRows, updateRow, deleteRow } from './db.js';
import { sendPushNotification, broadcastPushNotification } from './pushService.js';

// Connected SSE clients map: userId -> Set of Fastify reply objects
const sseClients = new Map();

/**
 * Register a client's SSE connection
 */
export function registerSseClient(userId, reply, request) {
  if (!userId) return;

  // Set SSE response headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  // Track client
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(reply);

  // Send initial handshake confirmation
  reply.raw.write(`event: connected\ndata: ${JSON.stringify({ 
    status: 'connected', 
    userId, 
    timestamp: Date.now() 
  })}\n\n`);

  // 25s keepalive ping to prevent intermediary proxies/timeouts from closing the stream
  const keepAliveTimer = setInterval(() => {
    try {
      reply.raw.write(': ping\n\n');
    } catch (err) {
      clearInterval(keepAliveTimer);
    }
  }, 25000);

  // Clean up on disconnect
  const cleanup = () => {
    clearInterval(keepAliveTimer);
    unregisterSseClient(userId, reply);
  };

  request.raw.on('close', cleanup);
  request.raw.on('end', cleanup);
}

/**
 * Unregister a client's SSE connection
 */
export function unregisterSseClient(userId, reply) {
  if (!userId || !sseClients.has(userId)) return;
  const userSet = sseClients.get(userId);
  userSet.delete(reply);
  if (userSet.size === 0) {
    sseClients.delete(userId);
  }
}

/**
 * Send real-time SSE event to connected browser client(s)
 */
export function sendSseEvent(recipientId, eventName, payload) {
  const dataString = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

  if (recipientId === 'ALL') {
    for (const [_, clientSet] of sseClients.entries()) {
      for (const reply of clientSet) {
        try {
          reply.raw.write(dataString);
        } catch (e) {
          // Handled on stream close
        }
      }
    }
    return;
  }

  const clientSet = sseClients.get(recipientId);
  if (clientSet && clientSet.size > 0) {
    for (const reply of clientSet) {
      try {
        reply.raw.write(dataString);
      } catch (e) {
        // Handled on stream close
      }
    }
  }
}

/**
 * Core notification dispatcher:
 * 1. Persists notification record(s) into database table `in_app_notifications`
 * 2. Emits immediate SSE event to online browsers
 * 3. Safely triggers Web Push notification in background (non-blocking)
 */
export async function dispatchNotification({
  recipientId,          // Employee ID or 'ALL'
  title,                // Notification title
  message,              // Notification body
  type = 'info',        // 'info' | 'leave' | 'task' | 'ticket' | 'attendance' | 'payroll' | 'broadcast'
  targetTab = '',       // Tab to activate on click (e.g. 'leaves', 'tasks', 'tickets')
  targetUrl = '',       // Full target URL
  metadata = {},        // Arbitrary extra payload
  sendPush = true       // Whether to attempt background Web Push
}) {
  if (!recipientId || !title || !message) {
    console.warn('[NotificationService] Missing required dispatch fields:', { recipientId, title });
    return null;
  }

  const createdAt = new Date().toISOString();
  const url = targetUrl || (targetTab ? `/?tab=${encodeURIComponent(targetTab)}` : '/');

  let insertedRecords = [];

  try {
    if (recipientId === 'ALL') {
      // Create individual records for all active employees so read state is personalized
      const employees = await getRows('Employees');
      const activeEmployees = employees.filter(e => e.status === 'active');

      for (const emp of activeEmployees) {
        const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const record = {
          id: notifId,
          user_id: emp.id,
          title,
          message,
          type,
          target_tab: targetTab,
          target_url: url,
          is_read: false,
          created_at: createdAt
        };
        await addRow('In_App_Notifications', record);
        insertedRecords.push(record);
      }

      // Broadcast real-time SSE
      sendSseEvent('ALL', 'notification', {
        title,
        message,
        type,
        target_tab: targetTab,
        target_url: url,
        metadata,
        created_at: createdAt
      });

      // Background Push Broadcast
      if (sendPush) {
        broadcastPushNotification({
          title,
          message,
          tab: targetTab,
          url,
          type,
          data: metadata
        }).catch(err => {
          console.warn('[NotificationService] Push broadcast background error:', err.message);
        });
      }

    } else {
      // Single recipient
      const notifId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const record = {
        id: notifId,
        user_id: recipientId,
        title,
        message,
        type,
        target_tab: targetTab,
        target_url: url,
        is_read: false,
        created_at: createdAt
      };

      await addRow('In_App_Notifications', record);
      insertedRecords.push(record);

      // Emit real-time SSE to user's open browser tabs
      sendSseEvent(recipientId, 'notification', record);

      // Background Web Push to user's registered devices
      if (sendPush) {
        sendPushNotification(recipientId, {
          title,
          message,
          tab: targetTab,
          url,
          type,
          data: metadata
        }).catch(err => {
          console.warn(`[NotificationService] Push delivery notice for ${recipientId}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[NotificationService] Error saving/dispatching notification:', err);
  }

  return insertedRecords;
}

/**
 * Fetch notifications for a user with unread count
 */
export async function getUserNotifications(userId, limit = 50) {
  if (!userId) return { notifications: [], unreadCount: 0 };

  const all = await getRows('In_App_Notifications');
  const userNotifs = all
    .filter(n => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const unreadCount = userNotifs.filter(n => !n.is_read).length;
  const notifications = userNotifs.slice(0, limit);

  return { notifications, unreadCount };
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId, userId) {
  if (!notificationId || !userId) return false;

  const all = await getRows('In_App_Notifications');
  const notif = all.find(n => n.id === notificationId && n.user_id === userId);
  if (!notif) return false;

  await updateRow('In_App_Notifications', 'id', notificationId, { is_read: true });
  return true;
}

/**
 * Mark all notifications for a user as read
 */
export async function markAllNotificationsAsRead(userId) {
  if (!userId) return 0;

  const all = await getRows('In_App_Notifications');
  const unread = all.filter(n => n.user_id === userId && !n.is_read);

  for (const n of unread) {
    await updateRow('In_App_Notifications', 'id', n.id, { is_read: true });
  }

  return unread.length;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId, userId) {
  if (!notificationId || !userId) return false;

  const all = await getRows('In_App_Notifications');
  const notif = all.find(n => n.id === notificationId && n.user_id === userId);
  if (!notif) return false;

  await deleteRow('In_App_Notifications', 'id', notificationId);
  return true;
}
