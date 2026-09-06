import { getRows, addRow, updateRow, getLeavePolicy } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { sendProfessionalRejectionEmail } from '../mailer.js';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { sendPushNotification } from '../pushService.js';
import { getCurrentMonthStr } from '../utils/dateTime.js';

export default async function leaveRoutes(fastify, options) {
  // GET /api/leaves/policy (Read current active leave policy)
  fastify.get('/policy', { preHandler: [verifyAuth] }, async (request, reply) => {
    const policy = await getLeavePolicy();
    return { policy };
  });

  // GET /api/leaves/balances (Get user's real-time monthly leave quota balance & monthly permissions)
  fastify.get('/balances', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { employee_id } = request.query || {};
    const targetEmpId = request.user.role === 'admin' && employee_id ? employee_id : request.user.id;
    const currentMonth = getCurrentMonthStr();

    const [policy, allLeaves, allPermissions] = await Promise.all([
      getLeavePolicy(),
      getRows('Leaves'),
      getRows('Permissions')
    ]);

    const userLeaves = allLeaves.filter(l => l.employee_id === targetEmpId);
    const userPermissions = allPermissions.filter(p => p.employee_id === targetEmpId);

    // Strictly monthly-wise calculation: filter leaves falling in current month
    const thisMonthLeaves = userLeaves.filter(l => {
      const startMonth = l.start_date ? l.start_date.substring(0, 7) : '';
      const endMonth = l.end_date ? l.end_date.substring(0, 7) : '';
      return startMonth === currentMonth || endMonth === currentMonth;
    });

    const monthlyQuotas = {
      'Casual Leave': policy.casual_leave,
      'Sick Leave': policy.sick_leave,
      'Paid Leave': policy.paid_leave
    };

    // Calculate Monthly Leave Balances by Type
    const balances = {};
    for (const [type, monthlyQuota] of Object.entries(monthlyQuotas)) {
      const approvedDays = thisMonthLeaves
        .filter(l => l.leave_type === type && l.status === 'Approved')
        .reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);

      const pendingDays = thisMonthLeaves
        .filter(l => l.leave_type === type && l.status === 'Pending')
        .reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);

      const remaining = Math.max(0, monthlyQuota - approvedDays);

      balances[type] = {
        monthlyQuota,
        totalQuota: monthlyQuota, // Backwards-compatible field
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
      isMonthlyPolicy: true,
      policy,
      balances,
      permissionPolicy: {
        monthlyLimit: policy.monthly_permission_limit,
        maxPermissionHours: policy.max_permission_hours,
        usedThisMonth: totalUsedPermissions,
        approvedThisMonth,
        pendingThisMonth,
        remainingThisMonth: Math.max(0, policy.monthly_permission_limit - totalUsedPermissions),
        limitReached: totalUsedPermissions >= policy.monthly_permission_limit
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
    const targetMonth = start_date.substring(0, 7);

    // Check monthly quota balance for the requested month
    const [policy, allLeaves] = await Promise.all([
      getLeavePolicy(),
      getRows('Leaves')
    ]);

    const monthlyQuotas = {
      'Casual Leave': policy.casual_leave,
      'Sick Leave': policy.sick_leave,
      'Paid Leave': policy.paid_leave
    };

    const userMonthLeaves = allLeaves.filter(l =>
      l.employee_id === request.user.id &&
      l.leave_type === leave_type &&
      l.status === 'Approved' &&
      (l.start_date?.startsWith(targetMonth) || l.end_date?.startsWith(targetMonth))
    );
    const usedDays = userMonthLeaves.reduce((sum, l) => sum + (parseFloat(l.total_days) || 0), 0);
    const quota = monthlyQuotas[leave_type] ?? 1;
    const remaining = Math.max(0, quota - usedDays);

    const isExceedingQuota = totalDays > remaining;

    const newLeave = {
      id: `LEV-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      leave_type,
      start_date,
      end_date,
      total_days: String(totalDays),
      reason: isExceedingQuota ? `${reason} (Exceeds monthly ${leave_type} quota - Subject to Loss of Pay)` : reason,
      status: 'Pending',
      reviewed_by: '',
      applied_at: new Date().toISOString()
    };

    const saved = await addRow('Leaves', newLeave);

    // Push notification to admin of new leave application (with deep-link tab)
    sendPushNotification('EMP-ADMIN-01', {
      title: 'New Leave Request',
      body: `${request.user.name} applied for ${leave_type} (${start_date} – ${end_date}, ${totalDays} day(s)).`,
      url: '/?tab=leaves',
      tab: 'leaves',
      tag: `leave-apply-${saved.id}`
    }).catch(() => {});

    return {
      message: isExceedingQuota 
        ? `Leave submitted. Note: This request exceeds your available monthly ${leave_type} balance (${remaining} days remaining this month).`
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
    const [policy, allPermissions] = await Promise.all([
      getLeavePolicy(),
      getRows('Permissions')
    ]);
    const monthlyLimit = policy.monthly_permission_limit || 2;
    const thisMonthPerms = allPermissions.filter(
      p => p.employee_id === request.user.id && p.date?.startsWith(currentMonth) && p.status !== 'Rejected'
    );

    if (thisMonthPerms.length >= monthlyLimit) {
      return reply.status(400).send({
        error: `Monthly Permission Limit Reached: You have already used ${thisMonthPerms.length} out of ${monthlyLimit} allowed permissions for this month.`
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

    // Push notification to admin of new permission request (with deep link tab)
    sendPushNotification('EMP-ADMIN-01', {
      title: 'New Permission Request',
      body: `${request.user.name} requested a short permission on ${date} (${start_time} – ${end_time}, ${duration_hours} hrs).`,
      url: '/?tab=leaves',
      tab: 'leaves',
      tag: `perm-apply-${saved.id}`
    }).catch(() => {});

    return {
      message: `Permission request for ${duration_hours} hrs submitted successfully! (${thisMonthPerms.length + 1} of ${monthlyLimit} monthly permissions used).`,
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

    // Push notification to employee about leave decision
    sendPushNotification(existing.employee_id, {
      title: `Leave ${status}`,
      body: `Your ${existing.leave_type} request (${existing.start_date} – ${existing.end_date}) has been ${status.toLowerCase()} by ${request.user.name}.`,
      url: '/?tab=leaves',
      tab: 'leaves',
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

    // Push notification to employee about permission decision
    sendPushNotification(existing.employee_id, {
      title: `Permission ${status}`,
      body: `Your permission request on ${existing.date} (${existing.start_time} – ${existing.end_time}) has been ${status.toLowerCase()} by ${request.user.name}.`,
      url: '/?tab=leaves',
      tab: 'leaves',
      tag: `perm-status-${id}`
    }).catch(() => {});

    return {
      message: `Permission request ${status.toLowerCase()} successfully.`,
      permission: updated
    };
  });
}
