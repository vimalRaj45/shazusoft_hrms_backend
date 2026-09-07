/**
 * SHAZUSOFT HRMS — ROLE-BASED ACCESS CONTROL (RBAC) & CRUD END-TO-END TEST SUITE
 * 
 * Tests complete CRUD lifecycle and strict RBAC isolation between Admin and Staff roles:
 * - Admin Role (Full Access: Remuneration, Approvals, Staff Directory, Overrides)
 * - Staff Role (Restricted Access: Self-Service Only, 403 Forbidden on Admin Actions)
 * - Unauthenticated (401 Unauthorized across protected endpoints)
 * 
 * Can run standalone via in-process Fastify injection or over HTTP against a running server.
 */

import jwt from 'jsonwebtoken';
import { config } from './src/config.js';
import { initDB, getRows, addRow, deleteRow } from './src/db.js';
import { buildServer } from './src/server.js';

// ANSI terminal colors for clear reporting
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m'
};

// 1. Generate JWT Tokens for Test Personas
const ADMIN_USER = {
  id: 'EMP-ADMIN-01',
  name: 'Vimal Raj (Admin)',
  email: 'vimalraj5207@gmail.com',
  role: 'admin',
  department: 'Executive Management',
  designation: 'Managing Director'
};

const STAFF_USER = {
  id: 'EMP-STAFF-E2E',
  name: 'Dev Staff Member',
  email: 'staff.e2e@shazusofttechnologies.org',
  role: 'employee',
  department: 'Engineering',
  designation: 'Frontend Engineer'
};

const adminToken = jwt.sign(ADMIN_USER, config.jwtSecret, { expiresIn: '2h' });
const staffToken = jwt.sign(STAFF_USER, config.jwtSecret, { expiresIn: '2h' });

let app = null;
const HTTP_BASE_URL = process.env.BASE_URL || null;

let passed = 0;
let failed = 0;
const failures = [];

/**
 * Universal Request Dispatcher (Supports in-process inject or HTTP fetch)
 */
async function apiRequest({ method = 'GET', url, role = 'anonymous', body = null }) {
  const headers = { 'Content-Type': 'application/json' };
  if (role === 'admin') headers['Authorization'] = `Bearer ${adminToken}`;
  if (role === 'staff') headers['Authorization'] = `Bearer ${staffToken}`;

  if (HTTP_BASE_URL) {
    const fullUrl = `${HTTP_BASE_URL.replace(/\/$/, '')}${url}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(fullUrl, options);
    let json = null;
    try { json = await res.json(); } catch (e) {}
    return { status: res.status, body: json };
  } else {
    const res = await app.inject({
      method,
      url,
      headers,
      payload: body || undefined
    });
    let json = null;
    try { json = JSON.parse(res.payload); } catch (e) {}
    return { status: res.statusCode, body: json };
  }
}

/**
 * Test assertion runner
 */
async function test(name, fn) {
  process.stdout.write(`  ${c.cyan}▸${c.reset} ${name}... `);
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    console.log(`${c.green}✔ PASS${c.reset} ${c.dim}(${duration}ms)${c.reset}`);
    passed++;
  } catch (err) {
    console.log(`${c.red}✖ FAIL${c.reset}`);
    console.log(`    ${c.red}Error:${c.reset} ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function expect(val) {
  return {
    toBe: (exp) => {
      if (val !== exp) throw new Error(`Expected ${exp}, got ${val}`);
    },
    toBeOneOf: (arr) => {
      if (!arr.includes(val)) throw new Error(`Expected ${val} to be one of [${arr.join(', ')}]`);
    },
    toBeDefined: () => {
      if (val === undefined || val === null) throw new Error(`Expected value to be defined`);
    },
    toBeTruthy: () => {
      if (!val) throw new Error(`Expected value to be truthy`);
    }
  };
}

async function runSuite() {
  console.log(`\n${c.bold}${c.magenta}================================================================${c.reset}`);
  console.log(`${c.bold}${c.magenta}     SHAZUSOFT HRMS — END-TO-END ROLE-BASED (RBAC) & CRUD SUITE ${c.reset}`);
  console.log(`${c.bold}${c.magenta}================================================================${c.reset}`);
  console.log(`  Target: ${HTTP_BASE_URL ? `HTTP Endpoint [${HTTP_BASE_URL}]` : 'In-Process Fastify Kernel'}`);
  console.log(`  Database: ${config.databaseUrl ? 'Neon PostgreSQL' : 'In-Memory DB'}\n`);

  // Initialize DB & ensure staff member exists for testing
  await initDB();
  const existingEmployees = await getRows('Employees');
  if (!existingEmployees.some(e => e.id === STAFF_USER.id)) {
    await addRow('Employees', {
      id: STAFF_USER.id,
      name: STAFF_USER.name,
      email: STAFF_USER.email,
      password_hash: 'HASH_STAFF_E2E',
      role: 'employee',
      department: STAFF_USER.department,
      designation: STAFF_USER.designation,
      work_mode: 'office',
      status: 'active',
      created_at: new Date().toISOString()
    });
  }

  if (!HTTP_BASE_URL) {
    app = await buildServer();
    await app.ready();
  }

  // ─────────────────────────────────────────────────────────────
  // 1. BASE SALARY & REMUNERATION CRUD + RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 1. Base Salary & Payroll Packages (RBAC & CRUD) ───${c.reset}`);

  await test('[RBAC] Staff CANNOT access /api/payroll/salary-structures -> 403', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/payroll/salary-structures', role: 'staff' });
    expect(res.status).toBe(403);
  });

  await test('[RBAC] Staff CANNOT update salary package -> 403', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/payroll/salary-structures/${STAFF_USER.id}`,
      role: 'staff',
      body: { monthly_salary: 999999 }
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - UPDATE] Admin CAN set and update base salary package -> 200', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/payroll/salary-structures/${STAFF_USER.id}`,
      role: 'admin',
      body: {
        monthly_salary: 52000,
        bank_name: 'HDFC Bank',
        account_number: '501004918274',
        ifsc_code: 'HDFC0001234',
        pan_number: 'ABCDE1234F'
      }
    });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(parseFloat(res.body?.salary_structure?.monthly_salary)).toBe(52000);
  });

  await test('[CRUD - READ] Admin CAN fetch all salary structures and verify update -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/payroll/salary-structures', role: 'admin' });
    expect(res.status).toBe(200);
    const struct = res.body?.salary_structures?.find(s => s.employee_id === STAFF_USER.id);
    expect(struct).toBeDefined();
    expect(parseFloat(struct?.monthly_salary)).toBe(52000);
    expect(struct?.bank_name).toBe('HDFC Bank');
  });

  await test('[COMPUTATION] Admin preview calculation computes daily rate with new salary -> 200', async () => {
    const month = new Date().toISOString().slice(0, 7);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/payroll/calculate-month',
      role: 'admin',
      body: { month }
    });
    expect(res.status).toBe(200);
    const staffRecord = res.body?.records?.find(r => r.employee_id === STAFF_USER.id);
    expect(staffRecord).toBeDefined();
    expect(parseFloat(staffRecord?.monthly_salary)).toBe(52000);
  });

  await test('[CRUD - READ] Staff CAN view own payslips -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/payroll/my-payslips', role: 'staff' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.payslips)).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. LEAVES & SHORT PERMISSIONS CRUD + RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 2. Leaves & Permissions (RBAC & CRUD) ───${c.reset}`);

  let createdLeaveId = null;
  let createdPermId = null;

  await test('[CRUD - CREATE] Staff CAN apply for Casual Leave -> 200', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/leaves/apply',
      role: 'staff',
      body: {
        leave_type: 'Casual Leave',
        start_date: today,
        end_date: today,
        reason: 'Personal urgent work'
      }
    });
    expect(res.status).toBe(200);
    createdLeaveId = res.body?.leave?.id;
    expect(createdLeaveId).toBeDefined();
    expect(res.body?.leave?.status).toBe('Pending');
  });

  await test('[CRUD - READ] Staff CAN view own leaves -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/leaves/my-leaves', role: 'staff' });
    expect(res.status).toBe(200);
    const exists = res.body?.leaves?.some(l => l.id === createdLeaveId);
    expect(exists).toBe(true);
  });

  await test('[RBAC] Staff CANNOT approve own leave application -> 403', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/leaves/${createdLeaveId}/status`,
      role: 'staff',
      body: { status: 'Approved' }
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - UPDATE] Admin CAN approve leave application -> 200', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/leaves/${createdLeaveId}/status`,
      role: 'admin',
      body: { status: 'Approved', remarks: 'Approved by management' }
    });
    expect(res.status).toBe(200);
    expect(res.body?.leave?.status).toBe('Approved');
  });

  await test('[CRUD - CREATE] Staff CAN apply for short emergency permission -> 200', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/leaves/apply-permission',
      role: 'staff',
      body: {
        date: today,
        start_time: '04:00 PM',
        end_time: '05:30 PM',
        duration_hours: 1.5,
        reason: 'Doctor appointment'
      }
    });
    expect(res.status).toBe(200);
    createdPermId = res.body?.permission?.id;
    expect(createdPermId).toBeDefined();
  });

  await test('[RBAC] Staff CANNOT approve permission pass -> 403', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/leaves/permissions/${createdPermId}/status`,
      role: 'staff',
      body: { status: 'Approved' }
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - UPDATE] Admin CAN approve short permission pass -> 200', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/leaves/permissions/${createdPermId}/status`,
      role: 'admin',
      body: { status: 'Approved', remarks: 'Granted' }
    });
    expect(res.status).toBe(200);
    expect(res.body?.permission?.status).toBe('Approved');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. WORK DONE & ASSIGNED TASKS CRUD + RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 3. WorkDone & Task Management (RBAC & CRUD) ───${c.reset}`);

  let createdWorkLogId = null;
  let assignedTaskId = null;

  await test('[CRUD - CREATE] Staff CAN log daily work done -> 200', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/workdone',
      role: 'staff',
      body: {
        date: today,
        project_name: 'Core System',
        task_title: 'Implement RBAC Tests',
        description: 'Built comprehensive automated tests for Admin and Staff personas.',
        actual_hours: 4.5
      }
    });
    expect(res.status).toBe(200);
    createdWorkLogId = res.body?.task?.id;
    expect(createdWorkLogId).toBeDefined();
  });

  await test('[CRUD - READ] Staff CAN view own work done logs -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/workdone/my-tasks', role: 'staff' });
    expect(res.status).toBe(200);
    const exists = res.body?.tasks?.some(t => t.id === createdWorkLogId);
    expect(exists).toBe(true);
  });

  await test('[CRUD - READ] Admin CAN view company-wide work done logs -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/workdone/all', role: 'admin' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.tasks)).toBe(true);
  });

  await test('[CRUD - CREATE] Admin CAN delegate / assign task to Staff -> 200', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/tasks/assign',
      role: 'admin',
      body: {
        task_title: 'Security Audit Verification',
        project_name: 'HRMS Platform',
        assigned_to_id: STAFF_USER.id,
        due_date: today,
        estimated_hours: 3.0,
        priority: 'High'
      }
    });
    expect(res.status).toBe(200);
    assignedTaskId = res.body?.task?.id;
    expect(assignedTaskId).toBeDefined();
  });

  await test('[CRUD - UPDATE] Staff CAN update status on assigned task -> 200', async () => {
    const res = await apiRequest({
      method: 'PUT',
      url: `/api/tasks/${assignedTaskId}/progress`,
      role: 'staff',
      body: { status: 'In Progress', progress: 50, work_notes: 'Started testing' }
    });
    expect(res.status).toBe(200);
  });

  await test('[RBAC] Staff CANNOT delete assigned task -> 403', async () => {
    const res = await apiRequest({
      method: 'DELETE',
      url: `/api/tasks/${assignedTaskId}`,
      role: 'staff'
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - DELETE] Admin CAN delete assigned task -> 200', async () => {
    const res = await apiRequest({
      method: 'DELETE',
      url: `/api/tasks/${assignedTaskId}`,
      role: 'admin'
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. SUPPORT TICKETS CRUD + RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 4. Support Tickets & Helpdesk (RBAC & CRUD) ───${c.reset}`);

  let ticketId = null;

  await test('[CRUD - CREATE] Staff CAN file a support ticket -> 200', async () => {
    const res = await apiRequest({
      method: 'POST',
      url: '/api/tickets',
      role: 'staff',
      body: {
        category: 'Hardware & IT Support',
        subject: 'Second monitor request',
        description: 'Require HDMI adapter and second monitor for design work.',
        priority: 'Medium'
      }
    });
    expect(res.status).toBe(200);
    ticketId = res.body?.ticket?.id;
    expect(ticketId).toBeDefined();
  });

  await test('[CRUD - READ] Staff CAN view own support tickets -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/tickets', role: 'staff' });
    expect(res.status).toBe(200);
    const exists = res.body?.tickets?.some(t => t.id === ticketId);
    expect(exists).toBe(true);
  });

  await test('[CRUD - READ] Admin CAN view all organization tickets -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/tickets', role: 'admin' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.tickets)).toBe(true);
  });

  await test('[CRUD - UPDATE] Admin CAN resolve support ticket -> 200', async () => {
    const res = await apiRequest({
      method: 'PATCH',
      url: `/api/tickets/${ticketId}/status`,
      role: 'admin',
      body: {
        status: 'Resolved',
        resolution_notes: 'Adapter issued from IT inventory.'
      }
    });
    expect(res.status).toBe(200);
    expect(res.body?.ticket?.status).toBe('Resolved');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. ATTENDANCE & GEOFENCING CRUD + RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 5. Attendance & Geofencing (RBAC & CRUD) ───${c.reset}`);

  await test('[READ] Staff CAN check today attendance status -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/attendance/today', role: 'staff' });
    expect(res.status).toBe(200);
    expect(res.body?.date).toBeDefined();
  });

  await test('[GEOFENCE] Staff CAN query geofence coordinates validation -> 200', async () => {
    const res = await apiRequest({
      method: 'POST',
      url: '/api/attendance/check-geofence',
      role: 'staff',
      body: { lat: config.officeLatitude, lng: config.officeLongitude }
    });
    expect(res.status).toBe(200);
    expect(res.body?.inside).toBe(true);
  });

  await test('[RBAC] Staff CANNOT perform manual attendance override -> 403', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/attendance/admin-override',
      role: 'staff',
      body: {
        employee_id: STAFF_USER.id,
        date: today,
        status: 'Present',
        login_time: '09:30 AM',
        logout_time: '06:30 PM',
        reason: 'Illegal staff self-override attempt'
      }
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - CREATE] Admin CAN execute manual attendance override -> 200', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await apiRequest({
      method: 'POST',
      url: '/api/attendance/admin-override',
      role: 'admin',
      body: {
        employee_id: STAFF_USER.id,
        date: today,
        status: 'Present',
        login_time: '09:30 AM',
        logout_time: '06:30 PM',
        reason: 'Official field duty authorized by management'
      }
    });
    expect(res.status).toBe(200);
    expect(res.body?.attendance?.status).toBe('Present');
  });

  // ─────────────────────────────────────────────────────────────
  // 6. STAFF DIRECTORY & SECURITY ADMIN RBAC
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 6. Staff Directory & Administration (RBAC) ───${c.reset}`);

  await test('[RBAC] Staff CANNOT access admin staff directory -> 403', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/admin/employees', role: 'staff' });
    expect(res.status).toBe(403);
  });

  await test('[RBAC] Staff CANNOT create a new employee -> 403', async () => {
    const res = await apiRequest({
      method: 'POST',
      url: '/api/admin/employees',
      role: 'staff',
      body: { name: 'Hacker', email: 'hacker@shazusoft.org', role: 'admin' }
    });
    expect(res.status).toBe(403);
  });

  await test('[CRUD - READ] Admin CAN view full employee directory -> 200', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/admin/employees', role: 'admin' });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.employees)).toBe(true);
  });

  await test('[CRUD - UPDATE] Admin CAN toggle employee work mode (office <-> wfh) -> 200', async () => {
    const res = await apiRequest({
      method: 'PATCH',
      url: `/api/admin/employees/${STAFF_USER.id}/work-mode`,
      role: 'admin',
      body: { work_mode: 'wfh' }
    });
    expect(res.status).toBe(200);
    expect(res.body?.employee?.work_mode).toBe('wfh');
  });

  // Revert work mode to office
  await apiRequest({
    method: 'PATCH',
    url: `/api/admin/employees/${STAFF_USER.id}/work-mode`,
    role: 'admin',
    body: { work_mode: 'office' }
  });

  // ─────────────────────────────────────────────────────────────
  // 7. UNAUTHENTICATED SECURITY SANITY
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.yellow}─── 7. Unauthenticated Protection Sanity ───${c.reset}`);

  await test('[AUTH] Anonymous requests to protected routes return 401', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/leaves/my-leaves', role: 'anonymous' });
    expect(res.status).toBe(401);
  });

  await test('[AUTH] Anonymous requests to admin routes return 401', async () => {
    const res = await apiRequest({ method: 'GET', url: '/api/admin/employees', role: 'anonymous' });
    expect(res.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.magenta}================================================================${c.reset}`);
  console.log(`${c.bold}${c.cyan}  TEST RUN SUMMARY:${c.reset}`);
  console.log(`  Total Tests Run: ${passed + failed}`);
  console.log(`  ${c.green}Passed: ${passed}${c.reset}`);
  console.log(`  ${failed === 0 ? c.green : c.red}Failed: ${failed}${c.reset}`);
  console.log(`${c.bold}${c.magenta}================================================================${c.reset}\n`);

  if (failed > 0) {
    console.error(`${c.red}E2E Suite Encountered ${failed} Failure(s):${c.reset}`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. [${f.name}] -> ${f.error}`));
    process.exit(1);
  } else {
    console.log(`${c.bold}${c.green}🎉 ALL ROLE-BASED ACCESS CONTROL & CRUD TESTS PASSED 100%!${c.reset}\n`);
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Fatal Test Runner Exception:', err);
  process.exit(1);
});
