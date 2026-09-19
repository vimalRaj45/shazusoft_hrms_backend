import { getRows, addRow, updateRow, deleteRow, getStatus, getLeavePolicy, updateLeavePolicy, setSystemSetting } from '../db.js';
import { verifyAdmin, hashPassword } from '../auth.js';
import { runtimeSettings, saveOfficeTimings } from '../config.js';
import { format } from 'date-fns';
import { formatTime12h, timeTo24h, getTodayDateStr } from '../utils/dateTime.js';
import { sendInvitationEmail } from '../mailer.js';
import { sendSseEvent } from '../inAppNotificationService.js';

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
  fastify.get('/employees', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Employees');
    const sanitized = rows.map(({ password_hash, ...rest }) => {
      let personalInfo = {};
      let statutoryInfo = {};
      let emergencyContacts = {};
      let documents = [];
      let permissions = {};

      try { personalInfo = rest.personal_info ? (typeof rest.personal_info === 'string' ? JSON.parse(rest.personal_info) : rest.personal_info) : {}; } catch (e) {}
      try { statutoryInfo = rest.statutory_info ? (typeof rest.statutory_info === 'string' ? JSON.parse(rest.statutory_info) : rest.statutory_info) : {}; } catch (e) {}
      try { emergencyContacts = rest.emergency_contacts ? (typeof rest.emergency_contacts === 'string' ? JSON.parse(rest.emergency_contacts) : rest.emergency_contacts) : {}; } catch (e) {}
      try { documents = rest.documents_json ? (typeof rest.documents_json === 'string' ? JSON.parse(rest.documents_json) : rest.documents_json) : []; } catch (e) {}
      try {
        permissions = rest.permissions_json
          ? (typeof rest.permissions_json === 'string' ? JSON.parse(rest.permissions_json) : rest.permissions_json)
          : (rest.custom_permissions ? (typeof rest.custom_permissions === 'string' ? JSON.parse(rest.custom_permissions) : rest.custom_permissions) : {});
      } catch (e) {}

      return {
        ...rest,
        personal_info: personalInfo,
        statutory_info: statutoryInfo,
        emergency_contacts: emergencyContacts,
        documents: Array.isArray(documents) ? documents : [],
        permissions: permissions || {},
        profile_completeness: parseInt(rest.profile_completeness, 10) || 0,
        documents_frozen: Boolean(rest.documents_frozen === true || rest.documents_frozen === 'true' || rest.documents_frozen === 't')
      };
    });
    return { success: true, employees: sanitized };
  });

  // Create new employee (OTP Auth enabled - password not needed)
  fastify.post('/employees', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const {
      name,
      email,
      role = 'employee',
      department = 'General',
      designation = 'Staff',
      work_mode = 'office',
      employment_type = 'full_time'
    } = request.body || {};

    if (!name?.trim() || !email?.trim()) {
      return reply.status(400).send({ error: 'Name and email are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const rows = await getRows('Employees');
    const exists = rows.find(e => e.email?.toLowerCase() === trimmedEmail);

    if (exists) {
      return reply.status(400).send({ error: 'An employee with this email already exists.' });
    }

    const isPartTime = ['part_time', 'parttime', 'internship'].includes(String(employment_type || '').toLowerCase());
    const finalEmploymentType = isPartTime ? 'part_time' : 'full_time';

    // Robust Collision-Free ID Generation (uses provided unique ID if supplied)
    let candidateId = (request.body?.id && !rows.some(r => r.id?.toLowerCase() === request.body.id.trim().toLowerCase()))
      ? request.body.id.trim()
      : null;

    if (!candidateId) {
      if (isPartTime) {
        let maxPTNum = 0;
        rows.forEach(r => {
          const match = r.id?.match(/^(?:PT|INT)-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxPTNum) maxPTNum = num;
          }
        });
        let nextNum = maxPTNum + 1;
        candidateId = `PT-${String(nextNum).padStart(3, '0')}`;
        while (rows.some(r => r.id?.toLowerCase() === candidateId.toLowerCase())) {
          nextNum++;
          candidateId = `PT-${String(nextNum).padStart(3, '0')}`;
        }
      } else {
        let maxNum = 0;
        rows.forEach(r => {
          const match = r.id?.match(/^EMP-(?:STAFF-)?(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        });

        let nextNum = Math.max(maxNum + 1, rows.length + 1);
        candidateId = `EMP-${String(nextNum).padStart(3, '0')}`;
        while (rows.some(r => r.id?.toLowerCase() === candidateId.toLowerCase())) {
          nextNum++;
          candidateId = `EMP-${String(nextNum).padStart(3, '0')}`;
        }
      }
    }

    const newEmp = {
      id: candidateId,
      name: name.trim(),
      email: trimmedEmail,
      password_hash: 'OTP_AUTH_ENABLED',
      role: role === 'admin' ? 'admin' : 'employee',
      department: department?.trim() || 'General',
      designation: designation?.trim() || (isPartTime ? 'Junior Developer (Part-Time)' : 'Staff'),
      work_mode: work_mode === 'wfh' ? 'wfh' : 'office',
      employment_type: finalEmploymentType,
      status: 'active',
      profile_completeness: 0,
      documents_frozen: false,
      shift_start_time: request.body?.shift_start_time?.trim() || null,
      shift_end_time: request.body?.shift_end_time?.trim() || null,
      shift_late_grace_time: request.body?.shift_late_grace_time?.trim() || null,
      shift_target_hours: request.body?.shift_target_hours ? parseFloat(request.body.shift_target_hours) : null,
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
        employmentType: clean.employment_type,
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

  // PUT /api/admin/employees/:id — Update employee
  fastify.put('/employees/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const {
      name,
      email,
      role,
      department,
      designation,
      status,
      password,
      work_mode,
      employment_type,
      shift_start_time,
      shift_end_time,
      shift_late_grace_time,
      shift_target_hours
    } = request.body || {};

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (designation !== undefined) updateData.designation = designation;
    if (status !== undefined) updateData.status = status;
    if (work_mode !== undefined) updateData.work_mode = work_mode === 'wfh' ? 'wfh' : 'office';
    if (employment_type !== undefined) {
      updateData.employment_type = ['part_time', 'parttime', 'internship'].includes(String(employment_type).toLowerCase())
        ? 'part_time'
        : 'full_time';
    }
    if (password) updateData.password_hash = hashPassword(password);
    if (shift_start_time !== undefined) updateData.shift_start_time = shift_start_time || null;
    if (shift_end_time !== undefined) updateData.shift_end_time = shift_end_time || null;
    if (shift_late_grace_time !== undefined) updateData.shift_late_grace_time = shift_late_grace_time || null;
    if (shift_target_hours !== undefined) updateData.shift_target_hours = shift_target_hours ? parseFloat(shift_target_hours) : null;

    const updated = await updateRow('Employees', 'id', id, updateData);
    if (!updated) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const { password_hash, ...clean } = updated;
    return { message: 'Employee updated successfully', employee: clean };
  });

  // Dedicated Shift Schedule Configurator for Individual Employee
  fastify.patch('/employees/:id/shift-schedule', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const {
      shift_start_time,
      shift_end_time,
      shift_late_grace_time,
      shift_target_hours,
      reset_to_default
    } = request.body || {};

    const employees = await getRows('Employees');
    const existing = employees.find(e => e.id === id);
    if (!existing) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    let updateData = {};
    if (reset_to_default) {
      updateData = {
        shift_start_time: null,
        shift_end_time: null,
        shift_late_grace_time: null,
        shift_target_hours: null
      };
    } else {
      if (shift_start_time !== undefined) updateData.shift_start_time = shift_start_time || null;
      if (shift_end_time !== undefined) updateData.shift_end_time = shift_end_time || null;
      if (shift_late_grace_time !== undefined) updateData.shift_late_grace_time = shift_late_grace_time || null;
      if (shift_target_hours !== undefined) updateData.shift_target_hours = shift_target_hours ? parseFloat(shift_target_hours) : null;
    }

    const updated = await updateRow('Employees', 'id', id, updateData);
    const { password_hash, ...clean } = updated;

    return {
      success: true,
      message: reset_to_default
        ? `Shift schedule reset to company standard timings for ${clean.name}.`
        : `Custom shift schedule (${clean.shift_start_time || 'Standard'} - ${clean.shift_end_time || 'Standard'}) applied to ${clean.name}.`,
      employee: clean
    };
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

  // 1-Click Instant Conversion: Part-Time <-> Full-Time Staff
  fastify.patch('/employees/:id/employment-type', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { employment_type, designation } = request.body || {};

    const rows = await getRows('Employees');
    const existing = rows.find(e => e.id?.toLowerCase() === id?.toLowerCase());
    if (!existing) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const isCurrentPartTime = ['part_time', 'parttime', 'internship'].includes(String(existing.employment_type || '').toLowerCase());
    const targetType = employment_type
      ? (['part_time', 'parttime', 'internship'].includes(String(employment_type).toLowerCase()) ? 'part_time' : 'full_time')
      : (isCurrentPartTime ? 'full_time' : 'part_time');

    const updateData = {
      employment_type: targetType
    };

    if (designation) {
      updateData.designation = designation.trim();
    } else if (targetType === 'full_time' && (/(?:part-time|part\s*time|intern)/i.test(existing.designation || ''))) {
      // Auto-promote title: e.g. "Junior Developer (Part-Time)" -> "Software Developer"
      updateData.designation = existing.designation
        .replace(/\s*\(Part-Time\)/i, '')
        .replace(/\s*Part-Time\b/i, '')
        .replace(/\s*Intern\b/i, ' Developer')
        .trim() || 'Software Developer';
    } else if (targetType === 'part_time' && !(/(?:part-time|part\s*time|intern)/i.test(existing.designation || ''))) {
      updateData.designation = `${existing.designation} (Part-Time)`;
    }

    const updated = await updateRow('Employees', 'id', existing.id, updateData);
    const { password_hash, ...clean } = updated;

    sendSseEvent('ALL', 'data_update', {
      type: 'employee_updated',
      employee_id: existing.id,
      employee: clean
    });

    return {
      message: targetType === 'full_time'
        ? `🎉 Success: ${clean.name} has been promoted to Full-Time Staff!`
        : `Status updated: ${clean.name} switched to Part-Time track.`,
      employee: clean
    };
  });

  // Dedicated RBAC & Permission Configurator for Individual Employee
  fastify.patch('/employees/:id/rbac', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { role, permissions, reason } = request.body || {};

    const rows = await getRows('Employees');
    const existing = rows.find(e => e.id?.toLowerCase() === id?.toLowerCase() || e.email?.toLowerCase() === id?.toLowerCase());
    if (!existing) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const currentUserId = request.user?.id;
    const targetRole = role ? role.trim().toLowerCase() : existing.role;

    // Safety Guard 1: An admin cannot demote themselves from admin role
    if (existing.id === currentUserId && existing.role === 'admin' && targetRole !== 'admin') {
      return reply.status(400).send({
        error: 'Safety Guard: You cannot remove Admin access from your own current logged-in account to prevent lockout.'
      });
    }

    // Safety Guard 2: Cannot remove the last remaining active Admin in the company
    if (existing.role === 'admin' && targetRole !== 'admin') {
      const activeAdmins = rows.filter(e => e.role === 'admin' && e.status === 'active' && e.id !== existing.id);
      if (activeAdmins.length === 0) {
        return reply.status(400).send({
          error: 'Safety Guard: Cannot revoke Admin privileges from this user as they are the only remaining active Administrator.'
        });
      }
    }

    const updateData = {};
    if (role) {
      updateData.role = targetRole;
    }
    if (permissions !== undefined) {
      updateData.permissions_json = typeof permissions === 'object' ? JSON.stringify(permissions) : String(permissions || '{}');
      updateData.custom_permissions = updateData.permissions_json;
    }

    const updated = await updateRow('Employees', 'id', existing.id, updateData);
    if (!updated) {
      return reply.status(500).send({ error: 'Failed to update user RBAC.' });
    }

    const { password_hash, ...clean } = updated;
    try {
      clean.permissions = clean.permissions_json ? JSON.parse(clean.permissions_json) : {};
    } catch (e) {
      clean.permissions = {};
    }

    // Log to Communications_Log and Kernel_Audit_Logs for security & compliance
    try {
      await addRow('Communications_Log', {
        id: `COMM-${Date.now()}`,
        type: 'RBAC_UPDATED',
        sender_id: request.user?.id || 'admin',
        sender_name: request.user?.name || 'System Administrator',
        recipient_id: existing.id,
        recipient_name: existing.name,
        subject: `RBAC Role & Permissions Updated: ${targetRole.toUpperCase()}`,
        message: reason || `Assigned system role '${targetRole.toUpperCase()}' with customized access privileges by ${request.user?.name || 'Admin'}.`,
        metadata_json: JSON.stringify({
          previous_role: existing.role,
          new_role: targetRole,
          permissions: clean.permissions,
          reason: reason || 'Administrative RBAC configuration'
        }),
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      fastify.log.warn(`Failed to log RBAC update: ${logErr.message}`);
    }

    try {
      await addRow('Kernel_Audit_Logs', {
        id: `AUDIT-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor_id: request.user?.id || 'admin',
        actor_name: request.user?.name || 'Admin',
        actor_role: 'admin',
        actor_ip: request.ip || '127.0.0.1',
        user_agent: request.headers['user-agent'] || 'Admin Console',
        action_type: 'UPDATE_RBAC',
        table_name: 'employees',
        record_id: existing.id,
        previous_state: JSON.stringify({ role: existing.role, permissions: existing.permissions_json }),
        new_state: JSON.stringify({ role: targetRole, permissions: updateData.permissions_json }),
        diff_summary: `Role changed from ${existing.role} to ${targetRole}`,
        reason: reason || 'Admin RBAC configuration',
        status: 'SUCCESS',
        created_at: new Date().toISOString()
      });
    } catch (auditErr) {
      fastify.log.warn(`Failed to record kernel audit log: ${auditErr.message}`);
    }

    sendSseEvent('ALL', 'data_update', {
      type: 'employee_updated',
      employee_id: existing.id,
      employee: clean
    });

    return {
      success: true,
      message: `RBAC updated successfully: ${clean.name} is now assigned as ${targetRole.toUpperCase()}.`,
      employee: clean
    };
  });

  // Freeze / Unfreeze employee compliance documents and profile records
  fastify.post('/employees/:id/freeze-documents', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};

    // Support both 'frozen' and 'freeze' fields, handling boolean or string formats
    let isFrozen;
    if (body.frozen !== undefined) {
      isFrozen = body.frozen === true || body.frozen === 'true' || body.frozen === 1 || body.frozen === '1';
    } else if (body.freeze !== undefined) {
      isFrozen = body.freeze === true || body.freeze === 'true' || body.freeze === 1 || body.freeze === '1';
    } else {
      isFrozen = true;
    }

    const employees = await getRows('Employees');
    const user = employees.find(e => e.id === id);
    if (!user) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const freezePayload = {
      documents_frozen: Boolean(isFrozen),
      frozen_at: isFrozen ? new Date().toISOString() : null,
      frozen_by: isFrozen ? request.user.id : null,
      frozen_by_name: isFrozen ? request.user.name : null
    };

    const updated = await updateRow('Employees', 'id', id, freezePayload);
    const { password_hash, ...clean } = updated;

    return {
      success: true,
      message: isFrozen
        ? `Compliance documents & profile for ${clean.name} have been FROZEN and verified.`
        : `Compliance documents & profile for ${clean.name} have been UNFROZEN for employee edits.`,
      employee: {
        ...clean,
        documents_frozen: Boolean(isFrozen)
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
    const {
      casual_leave,
      sick_leave,
      paid_leave,
      monthly_permission_limit,
      max_permission_hours
    } = request.body || {};

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

  // GET /api/admin/office-timings — Get dynamic office shift opening, closing, grace times & working hour targets
  fastify.get('/office-timings', { preHandler: [verifyAdmin] }, async (request, reply) => {
    return {
      timings: {
        // Staff timings
        opening_time: runtimeSettings.officeOpeningTime || '09:30',
        closing_time: runtimeSettings.officeClosingTime || '18:30',
        late_grace_time: runtimeSettings.officeLateGraceTime || '09:45',
        half_day_hours: runtimeSettings.halfDayHours || 4.5,
        full_day_hours: runtimeSettings.fullDayHours || 8.5,
        avg_daily_hours: runtimeSettings.avgDailyHours || 8.5,
        // Intern timings & lighter target hours
        intern_opening_time: runtimeSettings.internOpeningTime || '10:00',
        intern_closing_time: runtimeSettings.internClosingTime || '16:30',
        intern_late_grace_time: runtimeSettings.internLateGraceTime || '10:15',
        intern_half_day_hours: runtimeSettings.internHalfDayHours || 3.0,
        intern_full_day_hours: runtimeSettings.internFullDayHours || 6.0,
        intern_avg_daily_hours: runtimeSettings.internAvgDailyHours || 6.0
      }
    };
  });

  // PUT /api/admin/office-timings — Update dynamic office shift opening, closing & grace times
  fastify.put('/office-timings', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const body = request.body || {};

    const timeFields = ['opening_time', 'closing_time', 'late_grace_time', 'intern_opening_time', 'intern_closing_time', 'intern_late_grace_time'];
    const validTimeRegex = /^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?(\s*(AM|PM))?$/i;

    for (const field of timeFields) {
      if (body[field] && typeof body[field] === 'string') {
        const str = body[field].trim();
        if (!validTimeRegex.test(str)) {
          return reply.status(400).send({ error: `Invalid time format for "${field}". Must be HH:MM in 24h or 12h AM/PM format.` });
        }
        const [h, m] = str.split(':').map(n => parseInt(n, 10));
        if (h > 23 || m > 59) {
          return reply.status(400).send({ error: `Invalid hour or minute in "${field}".` });
        }
      }
    }

    const normalizedBody = {
      ...body,
      opening_time: body.opening_time ? timeTo24h(body.opening_time) : undefined,
      closing_time: body.closing_time ? timeTo24h(body.closing_time) : undefined,
      late_grace_time: body.late_grace_time ? timeTo24h(body.late_grace_time) : undefined,
      intern_opening_time: body.intern_opening_time ? timeTo24h(body.intern_opening_time) : undefined,
      intern_closing_time: body.intern_closing_time ? timeTo24h(body.intern_closing_time) : undefined,
      intern_late_grace_time: body.intern_late_grace_time ? timeTo24h(body.intern_late_grace_time) : undefined
    };

    const updated = saveOfficeTimings(normalizedBody, request.user.name);
    await setSystemSetting('office_timings', updated, request.user.name);
    return {
      message: 'Office shift hours & intern working hours policy updated successfully.',
      timings: updated
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
