import { getRows, addRow, updateRow, deleteRow, getStatus, getLeavePolicy, updateLeavePolicy } from '../db.js';
import { verifyAdmin, hashPassword } from '../auth.js';
import { runtimeSettings } from '../config.js';
import { format } from 'date-fns';
import { formatTime12h, getTodayDateStr } from '../utils/dateTime.js';
import { sendInvitationEmail } from '../mailer.js';

export default async function adminRoutes(fastify, options) {
  // Live Office Attendance & Presence Board
  fastify.get('/live-status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const todayStr = getTodayDateStr();
    const employees = await getRows('Employees');
    const attendance = await getRows('Attendance');

    const todayAttendance = attendance.filter(a => a.date === todayStr);
    const activeEmployees = employees.filter(e => e.status !== 'inactive' && e.status !== 'resigned');

    const liveBoard = activeEmployees.map(emp => {
      const att = todayAttendance.find(a => a.employee_id === emp.id);

      let currentStatus = 'Absent';
      if (att) {
        if (att.logout_time) {
          currentStatus = 'Punched Out';
        } else {
          currentStatus = 'Present & Working';
        }
      }

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        department: emp.department,
        designation: emp.designation,
        statusToday: currentStatus,
        loginTime: att ? formatTime12h(att.login_time) : null,
        logoutTime: att ? formatTime12h(att.logout_time) : null,
        netHours: att ? (att.net_hours || att.total_hours || '0') : '0'
      };
    });

    const counts = {
      totalStaff: activeEmployees.length,
      present: liveBoard.filter(b => b.statusToday === 'Present & Working').length,
      punchedOut: liveBoard.filter(b => b.statusToday === 'Punched Out').length,
      absent: liveBoard.filter(b => b.statusToday === 'Absent').length
    };

    return {
      date: todayStr,
      counts,
      board: liveBoard
    };
  });

  // Get all employees with full compliance records & documents
  fastify.get('/employees', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Employees');
    const sanitized = rows.map(({ password_hash, ...rest }) => {
      let personalInfo = {};
      let statutoryInfo = {};
      let emergencyContacts = {};
      let documents = [];

      try { personalInfo = rest.personal_info ? (typeof rest.personal_info === 'string' ? JSON.parse(rest.personal_info) : rest.personal_info) : {}; } catch (e) {}
      try { statutoryInfo = rest.statutory_info ? (typeof rest.statutory_info === 'string' ? JSON.parse(rest.statutory_info) : rest.statutory_info) : {}; } catch (e) {}
      try { emergencyContacts = rest.emergency_contacts ? (typeof rest.emergency_contacts === 'string' ? JSON.parse(rest.emergency_contacts) : rest.emergency_contacts) : {}; } catch (e) {}
      try { documents = rest.documents_json ? (typeof rest.documents_json === 'string' ? JSON.parse(rest.documents_json) : rest.documents_json) : []; } catch (e) {}

      return {
        ...rest,
        personal_info: personalInfo,
        statutory_info: statutoryInfo,
        emergency_contacts: emergencyContacts,
        documents: Array.isArray(documents) ? documents : [],
        profile_completeness: parseInt(rest.profile_completeness, 10) || 0,
        documents_frozen: Boolean(rest.documents_frozen === true || rest.documents_frozen === 'true' || rest.documents_frozen === 't')
      };
    });
    return { employees: sanitized };
  });

  // Create new employee (OTP Auth enabled - password not needed)
  fastify.post('/employees', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { name, email, role = 'employee', department = 'General', designation = 'Staff', work_mode = 'office' } = request.body || {};

    if (!name?.trim() || !email?.trim()) {
      return reply.status(400).send({ error: 'Name and email are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const rows = await getRows('Employees');
    const exists = rows.find(e => e.email?.toLowerCase() === trimmedEmail);

    if (exists) {
      return reply.status(400).send({ error: 'An employee with this email already exists.' });
    }

    // Robust Collision-Free ID Generation
    let maxNum = 0;
    rows.forEach(r => {
      const match = r.id?.match(/^EMP-(?:STAFF-)?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    let nextNum = Math.max(maxNum + 1, rows.length + 1);
    let candidateId = `EMP-${String(nextNum).padStart(3, '0')}`;
    while (rows.some(r => r.id?.toLowerCase() === candidateId.toLowerCase())) {
      nextNum++;
      candidateId = `EMP-${String(nextNum).padStart(3, '0')}`;
    }

    const newEmp = {
      id: candidateId,
      name: name.trim(),
      email: trimmedEmail,
      password_hash: 'OTP_AUTH_ENABLED',
      role: role === 'admin' ? 'admin' : 'employee',
      department: department?.trim() || 'General',
      designation: designation?.trim() || 'Staff',
      work_mode: work_mode === 'wfh' ? 'wfh' : 'office',
      status: 'active',
      profile_completeness: 0,
      documents_frozen: false,
      created_at: new Date().toISOString()
    };

    try {
      const saved = await addRow('Employees', newEmp);
      const { password_hash, ...clean } = saved;

      // Dispatch official onboarding invitation email asynchronously
      sendInvitationEmail({
        toEmail: clean.email,
        employeeName: clean.name,
        employeeId: clean.id,
        role: clean.role,
        department: clean.department,
        designation: clean.designation,
        workMode: clean.work_mode,
        portalUrl: request.headers.origin || 'http://localhost:5173'
      }).catch(err => {
        fastify.log.warn(`[Hostinger Mail] Onboarding email failed for ${clean.email}: ${err?.message}`);
      });

      return {
        message: 'Employee created successfully & onboarding invitation email dispatched!',
        employee: clean,
        invitation_sent: true
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: `Failed to create employee in database: ${err.message}` });
    }
  });

  // Update employee
  fastify.put('/employees/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, email, role, department, designation, status, password, work_mode } = request.body || {};

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (department) updateData.department = department;
    if (designation) updateData.designation = designation;
    if (status) updateData.status = status;
    if (work_mode) updateData.work_mode = work_mode === 'wfh' ? 'wfh' : 'office';
    if (password) updateData.password_hash = hashPassword(password);

    const updated = await updateRow('Employees', 'id', id, updateData);
    if (!updated) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const { password_hash, ...clean } = updated;
    return { message: 'Employee updated successfully', employee: clean };
  });

  // Quick toggle work mode (office <-> wfh)
  fastify.patch('/employees/:id/work-mode', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { work_mode } = request.body || {};

    const targetMode = work_mode === 'wfh' ? 'wfh' : 'office';
    const updated = await updateRow('Employees', 'id', id, { work_mode: targetMode });
    if (!updated) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const { password_hash, ...clean } = updated;
    return {
      message: `Work mode updated to ${targetMode === 'wfh' ? 'Work From Home (WFH)' : 'In-Office'} for ${clean.name}.`,
      employee: clean
    };
  });

  // Freeze / Unfreeze employee compliance documents and profile records
  fastify.post('/employees/:id/freeze-documents', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { frozen = true, remarks = '' } = request.body || {};

    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const freezePayload = {
      documents_frozen: Boolean(frozen),
      frozen_at: frozen ? new Date().toISOString() : null,
      frozen_by: frozen ? request.user.id : null,
      frozen_by_name: frozen ? request.user.name : null
    };

    const updated = await updateRow('Employees', 'id', id, freezePayload);
    const { password_hash, ...clean } = updated;

    return {
      success: true,
      message: frozen
        ? `Compliance documents & profile for ${clean.name} have been FROZEN and verified.`
        : `Compliance documents & profile for ${clean.name} have been UNFROZEN for employee edits.`,
      employee: {
        ...clean,
        documents_frozen: Boolean(clean.documents_frozen === true || clean.documents_frozen === 'true' || clean.documents_frozen === 't')
      }
    };
  });

  // POST /api/admin/employees/:id/deactivate — Deactivate or mark employee as resigned (soft delete with audit & cascade archival)
  fastify.post('/employees/:id/deactivate', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { status = 'resigned', reason = '', effective_date = '' } = request.body || {};

    const targetStatus = status === 'inactive' ? 'inactive' : 'resigned';
    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    let personalInfo = {};
    try {
      personalInfo = user.personal_info ? (typeof user.personal_info === 'string' ? JSON.parse(user.personal_info) : user.personal_info) : {};
    } catch (e) {}

    const nowIso = new Date().toISOString();
    const effectiveDate = effective_date || nowIso.split('T')[0];

    personalInfo.exit_details = {
      status: targetStatus,
      effective_date: effectiveDate,
      reason: reason?.trim() || (targetStatus === 'resigned' ? 'Staff Resignation' : 'Account Deactivated'),
      processed_by: request.user.name,
      processed_by_id: request.user.id,
      processed_at: nowIso
    };

    const updated = await updateRow('Employees', 'id', id, {
      status: targetStatus,
      personal_info: JSON.stringify(personalInfo)
    });

    // Cascade archival to pending requests in associated tables
    try {
      const leaves = await getRows('Leaves');
      const pendingLeaves = leaves.filter(l => l.employee_id === id && l.status === 'Pending');
      for (const pl of pendingLeaves) {
        await updateRow('Leaves', 'id', pl.id, {
          status: 'Rejected',
          review_remarks: `Archived: Staff member ${user.name} marked as ${targetStatus}.`
        });
      }

      const perms = await getRows('Permissions');
      const pendingPerms = perms.filter(p => p.employee_id === id && p.status === 'Pending');
      for (const pp of pendingPerms) {
        await updateRow('Permissions', 'id', pp.id, {
          status: 'Rejected',
          review_remarks: `Archived: Staff member ${user.name} marked as ${targetStatus}.`
        });
      }

      const regs = await getRows('Regularizations');
      const pendingRegs = regs.filter(r => r.employee_id === id && r.status === 'Pending');
      for (const pr of pendingRegs) {
        await updateRow('Regularizations', 'id', pr.id, {
          status: 'Rejected',
          review_remarks: `Archived: Staff member ${user.name} marked as ${targetStatus}.`,
          reviewed_by_id: request.user.id,
          reviewed_by_name: request.user.name,
          updated_at: nowIso
        });
      }
    } catch (err) {
      fastify.log.warn(`[Cascade Archival Warning] ${err.message}`);
    }

    // Add Audit Log Entry
    try {
      await addRow('Communications_Log', {
        id: `AUDIT-${Date.now()}`,
        type: 'STAFF_STATUS_CHANGE',
        sender_id: request.user.id,
        sender_name: request.user.name,
        recipient_id: user.id,
        recipient_name: user.name,
        subject: `Staff Status Changed: ${user.name} (${user.id}) marked as ${targetStatus.toUpperCase()}`,
        message: `Employee marked as ${targetStatus} effective ${effectiveDate}. Reason: ${reason || 'Administrative update'}. Processed by ${request.user.name}.`,
        metadata_json: JSON.stringify({
          employee_id: user.id,
          employee_name: user.name,
          previous_status: user.status,
          new_status: targetStatus,
          effective_date: effectiveDate,
          reason
        }),
        created_at: nowIso
      });
    } catch (auditErr) {
      fastify.log.warn(`[Audit Log Warning] ${auditErr.message}`);
    }

    const { password_hash, ...clean } = updated;
    return {
      success: true,
      message: `Staff member "${user.name}" has been marked as ${targetStatus === 'resigned' ? 'Resigned' : 'Inactive'}. Associated pending requests have been archived.`,
      employee: clean
    };
  });

  // POST /api/admin/employees/:id/reactivate — Restore employee to active status
  fastify.post('/employees/:id/reactivate', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    let personalInfo = {};
    try {
      personalInfo = user.personal_info ? (typeof user.personal_info === 'string' ? JSON.parse(user.personal_info) : user.personal_info) : {};
    } catch (e) {}

    const nowIso = new Date().toISOString();
    if (personalInfo.exit_details) {
      personalInfo.exit_details.reactivated_at = nowIso;
      personalInfo.exit_details.reactivated_by = request.user.name;
    }

    const updated = await updateRow('Employees', 'id', id, {
      status: 'active',
      personal_info: JSON.stringify(personalInfo)
    });

    // Add Audit Log
    try {
      await addRow('Communications_Log', {
        id: `AUDIT-${Date.now()}`,
        type: 'STAFF_STATUS_CHANGE',
        sender_id: request.user.id,
        sender_name: request.user.name,
        recipient_id: user.id,
        recipient_name: user.name,
        subject: `Staff Reactivated: ${user.name} (${user.id}) restored to ACTIVE status`,
        message: `Employee was restored to active working status by ${request.user.name}.`,
        metadata_json: JSON.stringify({
          employee_id: user.id,
          employee_name: user.name,
          previous_status: user.status,
          new_status: 'active'
        }),
        created_at: nowIso
      });
    } catch (auditErr) {
      fastify.log.warn(`[Audit Log Warning] ${auditErr.message}`);
    }

    const { password_hash, ...clean } = updated;
    return {
      success: true,
      message: `Staff member "${user.name}" has been restored to ACTIVE status.`,
      employee: clean
    };
  });

  // GET /api/admin/settings — Read-only geofence info (values come from .env only)
  fastify.get('/settings', { preHandler: [verifyAdmin] }, async (request, reply) => {
    return {
      geofence: {
        officeLatitude: runtimeSettings.officeLatitude,
        officeLongitude: runtimeSettings.officeLongitude,
        officeRadiusMeters: runtimeSettings.officeRadiusMeters,
        env_only: true  // UI must treat these as read-only
      },
      system: getStatus()
    };
  });

  // GET /api/admin/leave-policy — Get active monthly leave policy
  fastify.get('/leave-policy', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const policy = await getLeavePolicy();
    return { policy };
  });

  // PUT /api/admin/leave-policy — Update monthly leave policy
  fastify.put('/leave-policy', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { casual_leave, sick_leave, paid_leave, monthly_permission_limit, max_permission_hours } = request.body || {};

    if (casual_leave !== undefined && (isNaN(casual_leave) || Number(casual_leave) < 0)) {
      return reply.status(400).send({ error: 'Casual Leave quota must be a valid non-negative number.' });
    }
    if (sick_leave !== undefined && (isNaN(sick_leave) || Number(sick_leave) < 0)) {
      return reply.status(400).send({ error: 'Sick Leave quota must be a valid non-negative number.' });
    }
    if (paid_leave !== undefined && (isNaN(paid_leave) || Number(paid_leave) < 0)) {
      return reply.status(400).send({ error: 'Paid Leave quota must be a valid non-negative number.' });
    }
    if (monthly_permission_limit !== undefined && (isNaN(monthly_permission_limit) || Number(monthly_permission_limit) < 0)) {
      return reply.status(400).send({ error: 'Monthly Permission limit must be a valid non-negative number.' });
    }

    const updated = await updateLeavePolicy(request.body, request.user.name);
    return {
      message: 'Monthly leave policy updated successfully.',
      policy: updated
    };
  });

  // ─────────────────────────────────────────────────────────────
  //  HOLIDAY & CALENDAR OVERRIDE MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  // GET /api/admin/holidays — List all admin-defined holidays & Sunday overrides
  fastify.get('/holidays', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Holidays');
    rows.sort((a, b) => (a.date > b.date ? 1 : -1));
    return { holidays: rows };
  });

  // POST /api/admin/holidays — Add a new holiday or Sunday working day override
  fastify.post('/holidays', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { date, name, type = 'Public Holiday' } = request.body || {};

    if (!date || !name) {
      return reply.status(400).send({ error: 'Both date (yyyy-MM-dd) and name/description are required.' });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'Date must be in yyyy-MM-dd format.' });
    }

    // Reject duplicate dates
    const existing = await getRows('Holidays');
    const duplicate = existing.find(h => h.date === date);
    if (duplicate) {
      return reply.status(400).send({ error: `A calendar entry already exists on ${date}: "${duplicate.name}" (${duplicate.type})` });
    }

    const holiday = {
      id: `HOL-${Date.now()}`,
      date,
      name: name.trim(),
      type,
      created_by: request.user.name || request.user.id,
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Holidays', holiday);
    return { message: `Calendar entry "${name}" (${type}) configured for ${date}.`, holiday: saved };
  });

  // DELETE /api/admin/holidays/:date — Remove a holiday by date
  fastify.delete('/holidays/:date', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { date } = request.params;
    const rows = await getRows('Holidays');
    const holiday = rows.find(h => h.date === date);
    if (!holiday) {
      return reply.status(404).send({ error: `No holiday found on ${date}.` });
    }

    await deleteRow('Holidays', 'date', date);
    return { message: `Holiday on ${date} ("${holiday.name}") removed successfully.` };
  });
}
