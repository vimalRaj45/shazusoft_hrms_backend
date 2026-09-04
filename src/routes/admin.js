import { getRows, addRow, updateRow, deleteRow, getStatus } from '../sheets.js';
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

  // Get all employees
  fastify.get('/employees', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Employees');
    const sanitized = rows.map(({ password_hash, ...rest }) => rest);
    return { employees: sanitized };
  });

  // Create new employee (OTP Auth enabled - password not needed)
  fastify.post('/employees', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { name, email, role = 'employee', department = 'General', designation = 'Staff' } = request.body || {};

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
    const { name, email, role, department, designation, status, password } = request.body || {};

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (department) updateData.department = department;
    if (designation) updateData.designation = designation;
    if (status) updateData.status = status;
    if (password) updateData.password_hash = hashPassword(password);

    const updated = await updateRow('Employees', 'id', id, updateData);
    if (!updated) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    const { password_hash, ...clean } = updated;
    return { message: 'Employee updated successfully', employee: clean };
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
  //  HOLIDAY MANAGEMENT
  // ─────────────────────────────────────────────────────────────

  // GET /api/admin/holidays — List all admin-defined holidays
  fastify.get('/holidays', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Holidays');
    rows.sort((a, b) => (a.date > b.date ? 1 : -1));
    return { holidays: rows };
  });

  // POST /api/admin/holidays — Add a new holiday
  fastify.post('/holidays', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { date, name, type = 'Public Holiday' } = request.body || {};

    if (!date || !name) {
      return reply.status(400).send({ error: 'Both date (yyyy-MM-dd) and name are required.' });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ error: 'Date must be in yyyy-MM-dd format.' });
    }

    // Reject Sundays — already automatically non-working
    const dayOfWeek = new Date(date).getDay();
    if (dayOfWeek === 0) {
      return reply.status(400).send({ error: 'Sundays are automatically non-working days. No need to add them.' });
    }

    // Reject duplicate dates
    const existing = await getRows('Holidays');
    const duplicate = existing.find(h => h.date === date);
    if (duplicate) {
      return reply.status(400).send({ error: `A holiday already exists on ${date}: "${duplicate.name}"` });
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
    return { message: `Holiday "${name}" added for ${date}.`, holiday: saved };
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
