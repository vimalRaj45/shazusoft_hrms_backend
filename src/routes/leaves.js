import { getRows, addRow, updateRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { sendProfessionalRejectionEmail } from '../mailer.js';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { sendPushNotification } from '../pushService.js';

// Standard Corporate Business Leave Policy Quotas (Annual)
const LEAVE_QUOTAS = {
  'Casual Leave': 12, // 1 per month
  'Sick Leave': 12,   // 1 per month
  'Paid Leave': 12    // 1 per month
};

const MONTHLY_PERMISSION_LIMIT = 2; // Max 2 short permission passes per month (up to 2h each)

export default async function leaveRoutes(fastify, options) {
  // GET /api/leaves/balances (Get user's real-time leave quota balance & monthly permissions)
  fastify.get('/balances', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { employee_id } = request.query || {};
    const targetEmpId = request.user.role === 'admin' && employee_id ? employee_id : request.user.id;
    const currentMonth = format(new Date(), 'yyyy-MM');

    const [allLeaves, allPermissions] = await Promise.all([
      getRows('Leaves'),
      getRows('Permissions')
    ]);

    const userLeaves = allLeaves.filter(l => l.employee_id === targetEmpId);
    const userPermissions = allPermissions.filter(p => p.employee_id === targetEmpId);

    // Calculate Leave Balances by Type
    const balances = {};
    for (const [type, totalQuota] of Object.entries(LEAVE_QUOTAS)) {
      const approvedDays = userLeaves
        .filter(l => l.leave_type === type && l.status === 'Approved')
        .reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);

      const pendingDays = userLeaves
        .filter(l => l.leave_type === type && l.status === 'Pending')
        .reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);

      const remaining = Math.max(0, totalQuota - approvedDays);

      balances[type] = {
        totalQuota,
        approvedDays,
        pendingDays,
        remainingDays: remaining,
        isExhausted: remaining <= 0
      };
    }

    // Monthly Permissions Used
    const thisMonthPermissions = userPermissions.filter(
      p => p.date?.startsWith(currentMonth) && p.status !== 'Rejected'
    );
    const approvedThisMonth = thisMonthPermissions.filter(p => p.status === 'Approved').length;
    const pendingThisMonth = thisMonthPermissions.filter(p => p.status === 'Pending').length;
    const totalUsedPermissions = approvedThisMonth + pendingThisMonth;

    return {
      employeeId: targetEmpId,
      currentMonth,
      balances,
      permissionPolicy: {
        monthlyLimit: MONTHLY_PERMISSION_LIMIT,
        usedThisMonth: totalUsedPermissions,
        approvedThisMonth,
        pendingThisMonth,
        remainingThisMonth: Math.max(0, MONTHLY_PERMISSION_LIMIT - totalUsedPermissions),
        limitReached: totalUsedPermissions >= MONTHLY_PERMISSION_LIMIT
      }
    };
  });

  // Apply for leave
  fastify.post('/apply', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { leave_type, start_date, end_date, reason } = request.body || {};

    if (!leave_type || !start_date || !end_date || !reason) {
      return reply.status(400).send({ error: 'All fields (leave_type, start_date, end_date, reason) are required.' });
    }

    const startDateObj = parseISO(start_date);
    const endDateObj = parseISO(end_date);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return reply.status(400).send({ error: 'Invalid start or end date format.' });
    }

    if (endDateObj < startDateObj) {
      return reply.status(400).send({ error: 'End date cannot be earlier than start date.' });
    }

    const totalDays = Math.max(1, differenceInCalendarDays(endDateObj, startDateObj) + 1);

    // Check quota balance
    const allLeaves = await getRows('Leaves');
    const userLeaves = allLeaves.filter(l => l.employee_id === request.user.id && l.leave_type === leave_type && l.status === 'Approved');
    const usedDays = userLeaves.reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);
    const quota = LEAVE_QUOTAS[leave_type] || 12;
    const remaining = quota - usedDays;

    const isExceedingQuota = totalDays > remaining;

    const newLeave = {
      id: `LEV-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      leave_type,
      start_date,
      end_date,
      total_days: String(totalDays),
      reason: isExceedingQuota ? `${reason} (⚠️ Exceeds annual ${leave_type} quota - Subject to Loss of Pay)` : reason,
      status: 'Pending',
      reviewed_by: '',
      applied_at: new Date().toISOString()
    };

    const saved = await addRow('Leaves', newLeave);

    // 🔔 Notify admin of new leave application
    sendPushNotification('EMP-ADMIN-01', {
      title: '📅 New Leave Request',
      body: `${request.user.name} applied for ${leave_type} (${start_date} – ${end_date}, ${totalDays} day(s)).`,
      url: '/dashboard',
      tag: `leave-apply-${saved.id}`
    }).catch(() => {});

    return {
      message: isExceedingQuota 
        ? `Leave submitted. Note: This request exceeds your available ${leave_type} balance (${remaining} days remaining).`
        : 'Leave application submitted successfully!',
      leave: saved,
      quotaWarning: isExceedingQuota
    };
  });

  // Apply for Short Permission (1-2 Hours pass)
  fastify.post('/apply-permission', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { date, start_time, end_time, duration_hours = '1.5', reason } = request.body || {};

    if (!date || !start_time || !end_time || !reason) {
      return reply.status(400).send({ error: 'Date, start time, end time, and reason are required.' });
    }

    const currentMonth = format(parseISO(date), 'yyyy-MM');
    const allPermissions = await getRows('Permissions');
    const thisMonthPerms = allPermissions.filter(
      p => p.employee_id === request.user.id && p.date?.startsWith(currentMonth) && p.status !== 'Rejected'
    );

    if (thisMonthPerms.length >= MONTHLY_PERMISSION_LIMIT) {
      return reply.status(400).send({
        error: `Monthly Permission Limit Reached: You have already used ${thisMonthPerms.length} out of ${MONTHLY_PERMISSION_LIMIT} allowed permissions for this month.`
      });
    }

    const newPermission = {
      id: `PERM-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      date,
      start_time,
      end_time,
      duration_hours: String(duration_hours),
      reason,
      status: 'Pending',
      reviewed_by: '',
      applied_at: new Date().toISOString()
    };

    const saved = await addRow('Permissions', newPermission);

    // 🔔 Notify admin of new permission request
    sendPushNotification('EMP-ADMIN-01', {
      title: '⏰ New Permission Request',
      body: `${request.user.name} requested a short permission on ${date} (${start_time} – ${end_time}, ${duration_hours} hrs).`,
      url: '/dashboard',
      tag: `perm-apply-${saved.id}`
    }).catch(() => {});

    return {
      message: `Permission request for ${duration_hours} hrs submitted successfully! (${thisMonthPerms.length + 1} of ${MONTHLY_PERMISSION_LIMIT} monthly permissions used).`,
      permission: saved
    };
  });

  // Get user's leaves
  fastify.get('/my-leaves', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Leaves');
    const myLeaves = rows.filter(l => l.employee_id === request.user.id);
    myLeaves.sort((a, b) => new Date(b.applied_at || b.start_date).getTime() - new Date(a.applied_at || a.start_date).getTime());
    return { leaves: myLeaves };
  });

  // Get user's permissions
  fastify.get('/my-permissions', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Permissions');
    const myPerms = rows.filter(p => p.employee_id === request.user.id);
    myPerms.sort((a, b) => new Date(b.applied_at || b.date).getTime() - new Date(a.applied_at || a.date).getTime());
    return { permissions: myPerms };
  });

  // Get all leaves (Admin only)
  fastify.get('/all', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Leaves');
    rows.sort((a, b) => new Date(b.applied_at || b.start_date).getTime() - new Date(a.applied_at || a.start_date).getTime());
    return { leaves: rows };
  });

  // Get all permissions (Admin only)
  fastify.get('/all-permissions', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Permissions');
    rows.sort((a, b) => new Date(b.applied_at || b.date).getTime() - new Date(a.applied_at || a.date).getTime());
    return { permissions: rows };
  });

  // Approve or Reject leave (Admin only)
  fastify.put('/:id/status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { status, rejection_reason = '', remarks = '' } = request.body || {};

    if (!['Approved', 'Rejected'].includes(status)) {
      return reply.status(400).send({ error: 'Status must be Approved or Rejected' });
    }

    const rows = await getRows('Leaves');
    const existing = rows.find(l => l.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Leave request not found.' });
    }

    const reasonText = rejection_reason || remarks || 'Policy alignment / scheduling conflict';

    const updated = await updateRow('Leaves', 'id', id, {
      status,
      reviewed_by: request.user.name,
      review_remarks: status === 'Rejected' ? reasonText : remarks
    });

    // If Rejected, dispatch professional email and audit log
    if (status === 'Rejected') {
      try {
        const employees = await getRows('Employees');
        const emp = employees.find(e => e.id === existing.employee_id);
        const empEmail = emp?.email;

        if (empEmail) {
          await sendProfessionalRejectionEmail({
            toEmail: empEmail,
            employeeName: existing.employee_name || emp.name,
            requestType: `Leave Application (${existing.leave_type})`,
            rejectionReason: reasonText,
            details: {
              date: `${existing.start_date} to ${existing.end_date}`,
              leaveType: existing.leave_type,
              duration: `${existing.total_days} Day(s)`
            },
            adminName: request.user.name
          });
        }

        // Add to Communications_Log
        await addRow('Communications_Log', {
          id: `LOG-${Date.now()}`,
          type: 'LEAVE_REJECTED',
          sender_id: request.user.id,
          sender_name: request.user.name,
          recipient_id: existing.employee_id,
          recipient_name: existing.employee_name,
          subject: `Leave Request Declined (${existing.leave_type}: ${existing.start_date})`,
          message: `Management declined leave application. Reason: ${reasonText}`,
          metadata_json: JSON.stringify({ leave_id: id, reason: reasonText, start_date: existing.start_date, end_date: existing.end_date }),
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Error sending leave rejection notice:', logErr);
      }
    }

    // 🔔 Push notification to employee about leave decision
    const leaveEmoji = status === 'Approved' ? '✅' : '❌';
    sendPushNotification(existing.employee_id, {
      title: `${leaveEmoji} Leave ${status}`,
      body: `Your ${existing.leave_type} request (${existing.start_date} – ${existing.end_date}) has been ${status.toLowerCase()} by ${request.user.name}.`,
      url: '/dashboard',
      tag: `leave-status-${id}`
    }).catch(() => {});

    return {
      message: `Leave request ${status.toLowerCase()} successfully.`,
      leave: updated
    };
  });

  // Approve or Reject permission (Admin only)
  fastify.put('/permissions/:id/status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { status, rejection_reason = '', remarks = '' } = request.body || {};

    if (!['Approved', 'Rejected'].includes(status)) {
      return reply.status(400).send({ error: 'Status must be Approved or Rejected' });
    }

    const rows = await getRows('Permissions');
    const existing = rows.find(p => p.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Permission request not found.' });
    }

    const reasonText = rejection_reason || remarks || 'Shift coverage required';

    const updated = await updateRow('Permissions', 'id', id, {
      status,
      reviewed_by: request.user.name,
      review_remarks: status === 'Rejected' ? reasonText : remarks
    });

    // If Rejected, dispatch professional email and audit log
    if (status === 'Rejected') {
      try {
        const employees = await getRows('Employees');
        const emp = employees.find(e => e.id === existing.employee_id);
        const empEmail = emp?.email;

        if (empEmail) {
          await sendProfessionalRejectionEmail({
            toEmail: empEmail,
            employeeName: existing.employee_name || emp.name,
            requestType: 'Emergency Permission Pass',
            rejectionReason: reasonText,
            details: {
              date: existing.date,
              duration: `${existing.start_time} - ${existing.end_time} (${existing.duration_hours} hrs)`
            },
            adminName: request.user.name
          });
        }

        // Add to Communications_Log
        await addRow('Communications_Log', {
          id: `LOG-${Date.now()}`,
          type: 'PERMISSION_REJECTED',
          sender_id: request.user.id,
          sender_name: request.user.name,
          recipient_id: existing.employee_id,
          recipient_name: existing.employee_name,
          subject: `Short Permission Pass Declined (${existing.date})`,
          message: `Management declined short permission pass. Reason: ${reasonText}`,
          metadata_json: JSON.stringify({ permission_id: id, reason: reasonText, date: existing.date }),
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.error('Error sending permission rejection notice:', logErr);
      }
    }

    // 🔔 Push notification to employee about permission decision
    const permEmoji = status === 'Approved' ? '✅' : '❌';
    sendPushNotification(existing.employee_id, {
      title: `${permEmoji} Permission ${status}`,
      body: `Your permission request on ${existing.date} (${existing.start_time} – ${existing.end_time}) has been ${status.toLowerCase()} by ${request.user.name}.`,
      url: '/dashboard',
      tag: `perm-status-${id}`
    }).catch(() => {});

    return {
      message: `Permission request ${status.toLowerCase()} successfully.`,
      permission: updated
    };
  });
}
