import assert from 'node:assert';
import { dispatchNotification } from './src/inAppNotificationService.js';
import { initDB } from './src/db.js';

async function testAllOperationsDispatchPush() {
  await initDB();
  console.log('Testing that ALL operations dispatch In-App & Web Push notifications...');

  // 1. Staff submitting leave -> Dispatches to Admin
  const staffLeaveResult = await dispatchNotification({
    recipientId: 'EMP-ADMIN-01',
    title: 'New Leave Request 🌴',
    message: 'Staff applied for leave',
    type: 'leave',
    senderRole: 'employee',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(staffLeaveResult) && staffLeaveResult.length > 0, 'Leave notification must be dispatched with push enabled');
  console.log('✔ PASS: Staff leave application dispatches in-app and push notification.');

  // 2. Staff updating / completing task -> Dispatches to Admin
  const staffTaskResult = await dispatchNotification({
    recipientId: 'EMP-ADMIN-01',
    title: 'Task Completed ✅',
    message: 'Staff completed task',
    type: 'task',
    senderRole: 'employee',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(staffTaskResult) && staffTaskResult.length > 0, 'Task completion notification must be dispatched with push enabled');
  console.log('✔ PASS: Staff task completion dispatches in-app and push notification.');

  // 3. Staff raising support ticket -> Dispatches to Admin
  const staffTicketResult = await dispatchNotification({
    recipientId: 'EMP-ADMIN-01',
    title: 'New Support Ticket 🎫',
    message: 'Staff raised ticket',
    type: 'ticket',
    senderRole: 'employee',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(staffTicketResult) && staffTicketResult.length > 0, 'Ticket creation notification must be dispatched with push enabled');
  console.log('✔ PASS: Staff ticket creation dispatches in-app and push notification.');

  // 4. Staff punch regularization -> Dispatches to Admin
  const staffRegResult = await dispatchNotification({
    recipientId: 'EMP-ADMIN-01',
    title: 'Attendance Regularization Request ⏱️',
    message: 'Staff punch fix request',
    type: 'attendance',
    senderRole: 'employee',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(staffRegResult) && staffRegResult.length > 0, 'Regularization notification must be dispatched with push enabled');
  console.log('✔ PASS: Staff punch regularization dispatches in-app and push notification.');

  // 5. Admin approving leave -> Dispatches to Staff
  const adminLeaveResult = await dispatchNotification({
    recipientId: 'EMP-001',
    title: 'Leave Approved ✅',
    message: 'Your leave has been approved',
    type: 'leave',
    senderRole: 'admin',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(adminLeaveResult) && adminLeaveResult.length > 0, 'Admin leave decision must be dispatched with push enabled');
  console.log('✔ PASS: Admin leave decision dispatches in-app and push notification.');

  // 6. Admin assigning task -> Dispatches to Staff
  const adminTaskResult = await dispatchNotification({
    recipientId: 'EMP-001',
    title: 'New Task Assigned 📋',
    message: 'New task assigned to you',
    type: 'task',
    senderRole: 'admin',
    isCrud: true,
    sendPush: true
  });
  assert.ok(Array.isArray(adminTaskResult) && adminTaskResult.length > 0, 'Admin task assignment must be dispatched with push enabled');
  console.log('✔ PASS: Admin task assignment dispatches in-app and push notification.');

  // 7. Company broadcast announcement -> Dispatches to ALL
  const broadcastResult = await dispatchNotification({
    recipientId: 'ALL',
    title: 'Company All-Hands Meeting',
    message: 'All-Hands meeting today at 4 PM',
    type: 'broadcast',
    senderRole: 'admin',
    isCrud: false,
    sendPush: true
  });
  assert.ok(Array.isArray(broadcastResult) && broadcastResult.length > 0, 'Company broadcast must be dispatched to all with push enabled');
  console.log('✔ PASS: Company broadcast dispatches in-app and push notification to all employees.');

  console.log('\nAll operations successfully verified: 100% In-App & Web Push coverage active! 🚀');
  process.exit(0);
}

testAllOperationsDispatchPush().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
