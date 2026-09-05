import { getRows, addRow, updateRow, deleteRow, getStatus } from '../db.js';
import { verifyAdmin, hashPassword } from '../auth.js';
import { runtimeSettings } from '../config.js';
import { format } from 'date-fns';

export default async function adminRoutes(fastify, options) {
  // Live Office Attendance & Presence Board
  fastify.get('/live-status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const employees = await getRows('Employees');
    const attendance = await getRows('Attendance');

    const todayAttendance = attendance.filter(a => a.date === todayStr);
    const activeEmployees = employees.filter(e => e.status !== 'inactive');

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
        loginTime: att ? att.login_time : null,
        logoutTime: att ? att.logout_time : null,
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

    if (!name || !email) {
      return reply.status(400).send({ error: 'Name and email are required.' });
    }

    const rows = await getRows('Employees');
    const exists = rows.find(e => e.email?.toLowerCase() === email.toLowerCase());

    if (exists) {
      return reply.status(400).send({ error: 'An employee with this email already exists.' });
    }

    const newEmp = {
      id: `EMP-${String(rows.length + 1).padStart(3, '0')}`,
      name,
      email,
      password_hash: 'OTP_AUTH_ENABLED',
      role,
      department,
      designation,
      work_mode: work_mode === 'wfh' ? 'wfh' : 'office',
      status: 'active',
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Employees', newEmp);
    const { password_hash, ...clean } = saved;

    return {
      message: 'Employee created successfully!',
      employee: clean
    };
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
