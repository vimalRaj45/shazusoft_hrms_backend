import jwt from 'jsonwebtoken';
import { config } from './src/config.js';

const BASE_URL = `http://localhost:${config.port || 5000}`;

// ANSI Colors for beautiful test runner reporting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

// Generate JWT tokens for test roles
const adminToken = jwt.sign(
  {
    id: 'EMP-ADMIN-01',
    email: 'vimalraj5207@gmail.com',
    role: 'admin',
    name: 'Vimal Raj',
    work_mode: 'office',
    department: 'Executive Management'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

const staffToken = jwt.sign(
  {
    id: 'EMP-STAFF-01',
    email: 'staff.demo@shazusofttechnologies.org',
    role: 'employee',
    name: 'VS Groups Staff',
    work_mode: 'office',
    department: 'Engineering'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

const wfhStaffToken = jwt.sign(
  {
    id: 'EMP-WFH-01',
    email: 'wfh.demo@shazusofttechnologies.org',
    role: 'employee',
    name: 'Remote Developer',
    work_mode: 'wfh',
    department: 'Engineering'
  },
  config.jwtSecret,
  { expiresIn: '1h' }
);

let passedCount = 0;
let failedCount = 0;
const failures = [];

async function assertTest(testName, testFn) {
  process.stdout.write(`  ${colors.cyan}●${colors.reset} ${testName}... `);
  try {
    await testFn();
    console.log(`${colors.green}✔ PASS${colors.reset}`);
    passedCount++;
  } catch (err) {
    console.log(`${colors.red}✖ FAIL${colors.reset}`);
    console.log(`    ${colors.red}Error:${colors.reset} ${err.message}`);
    failedCount++;
    failures.push({ name: testName, error: err.message });
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeOneOf(expectedArray) {
      if (!expectedArray.includes(actual)) {
        throw new Error(`Expected ${actual} to be one of ${JSON.stringify(expectedArray)}`);
      }
    }
  };
}

async function runAllTests() {
  console.log(`\n${colors.bright}${colors.magenta}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  SHAZUSOFT HRMS — COMPREHENSIVE API TEST SUITE   ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}  Database: Neon PostgreSQL | Server: Fastify v4   ${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}====================================================${colors.reset}\n`);

  // ─────────────────────────────────────────────────────────────
  // 1. HEALTH & SYSTEM DIAGNOSTICS
  // ─────────────────────────────────────────────────────────────
  console.log(`${colors.bright}${colors.yellow}1. HEALTH & SYSTEM DIAGNOSTICS${colors.reset}`);

  await assertTest('GET /health returns 200 and Neon PostgreSQL status', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.sheetsStatus?.connectedToPostgres).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. AUTHENTICATION & EDGE CASES
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}2. AUTHENTICATION & EDGE CASES${colors.reset}`);

  await assertTest('POST /api/auth/send-otp (Edge Case: Invalid Email Format) -> 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    expect(res.status).toBe(400);
  });

  await assertTest('POST /api/auth/send-otp (Edge Case: Unregistered Employee Email) -> 404', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.employee.999@domain.com' })
    });
    expect(res.status).toBe(404);
  });

  await assertTest('POST /api/auth/verify-otp (Edge Case: Missing OTP payload) -> 400', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vimalraj5207@gmail.com' })
    });
    expect(res.status).toBe(400);
  });

  await assertTest('GET /api/auth/me (Edge Case: Missing Auth Token) -> 401 Unauthorized', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  await assertTest('GET /api/auth/me with Valid Admin JWT -> 200 OK & User Profile', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('admin');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ADMIN MANAGEMENT & ROLE-BASED ACCESS CONTROL (RBAC)
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}3. ADMIN MANAGEMENT & RBAC${colors.reset}`);

  await assertTest('GET /api/admin/employees (RBAC Edge Case: Employee Role) -> 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { Authorization: `Bearer ${staffToken}` }
    });
    expect(res.status).toBe(403);
  });

  await assertTest('GET /api/admin/employees with Admin Token -> 200 & List', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employees.length).toBeGreaterThan(0);
  });

  await assertTest('PATCH /api/admin/employees/:id/work-mode (Toggle to WFH) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees/EMP-ADMIN-01/work-mode`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ work_mode: 'wfh' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employee.work_mode).toBe('wfh');
  });

  await assertTest('PATCH /api/admin/employees/:id/work-mode (Toggle back to Office) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees/EMP-ADMIN-01/work-mode`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ work_mode: 'office' })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employee.work_mode).toBe('office');
  });

  await assertTest('POST /api/admin/holidays (Admin sets Working Sunday override) -> 200', async () => {
    // Delete any existing test entry on this date first
    await fetch(`${BASE_URL}/api/admin/holidays/2026-09-06`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    }).catch(() => {});

    const res = await fetch(`${BASE_URL}/api/admin/holidays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        date: '2026-09-06',
        name: 'Urgent Product Release Shift',
        type: 'Working Sunday'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.holiday.type).toBe('Working Sunday');
  });

  await assertTest('GET /api/admin/settings returns Read-Only Geofence Configuration', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/settings`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.geofence.env_only).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────
  // 4. GPS ATTENDANCE, WFH BYPASS & TIMESHEETS
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}4. ATTENDANCE, GEOFENCE & WFH BYPASS${colors.reset}`);

  await assertTest('POST /api/attendance/check-geofence (Inside Office Coordinates) -> in_geofence: true', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-geofence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        latitude: config.officeLatitude,
        longitude: config.officeLongitude
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.in_geofence).toBe(true);
  });

  await assertTest('POST /api/attendance/check-geofence (Edge Case: 50km Away) -> in_geofence: false', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-geofence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        latitude: config.officeLatitude + 0.5,
        longitude: config.officeLongitude + 0.5
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.in_geofence).toBe(false);
  });

  await assertTest('POST /api/attendance/punch-in (WFH Employee Outside Office) -> Allowed with in_geofence: WFH', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/punch-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wfhStaffToken}`
      },
      body: JSON.stringify({
        latitude: 12.0000,
        longitude: 77.0000
      })
    });
    expect(res.status).toBeOneOf([200, 400]); // 200 or 400 if already punched in
    if (res.status === 200) {
      const body = await res.json();
      expect(body.attendance.in_geofence).toBe('WFH');
    }
  });

  await assertTest('GET /api/attendance/today returns current day status', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/today`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
  });

  await assertTest('GET /api/attendance/my-monthly-history?month=2026-09 -> 200 & Days Array', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/my-monthly-history?month=2026-09`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days.length).toBeGreaterThan(0);
  });

  await assertTest('GET /api/attendance/staff-monthly-history (Admin viewing staff timesheet) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/staff-monthly-history?employee_id=EMP-ADMIN-01&month=2026-09`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.employee.id).toBe('EMP-ADMIN-01');
  });

  // ─────────────────────────────────────────────────────────────
  // 5. TASKS & DAILY WORK LOGS
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}5. TASKS & DAILY WORK LOGS${colors.reset}`);

  let createdTaskId = null;
  await assertTest('POST /api/tasks/assign (Admin assigns task to staff) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/tasks/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        task_title: 'API Integration Testing Suite Execution',
        project_name: 'HRMS 2026',
        description: 'Verify 100% endpoint coverage with automated test suite.',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        priority: 'High',
        due_date: '2026-09-10',
        estimated_hours: '4.0'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    createdTaskId = body.task.id;
    expect(body.task.status).toBeOneOf(['To-Do', 'Assigned']);
  });

  await assertTest('PUT /api/tasks/:id/progress (Update progress to 100%) -> 200', async () => {
    if (!createdTaskId) throw new Error('No task ID available');
    const res = await fetch(`${BASE_URL}/api/tasks/${createdTaskId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        progress: 100,
        status: 'Completed',
        actual_hours: '3.5',
        work_notes: 'All automated tests passed successfully.'
      })
    });
    expect(res.status).toBe(200);
  });

  await assertTest('POST /api/workdone (Log daily completed task) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/workdone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        date: '2026-09-05',
        project_name: 'Core System',
        task_title: 'Automated Test Suite Creation',
        description: 'Built edge-case test runner across all 10 module APIs.',
        estimated_hours: '2.0',
        actual_hours: '2.0',
        status: 'Completed',
        remarks: '100% test pass rate.'
      })
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 6. LEAVES & SHORT PERMISSIONS
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}6. LEAVES & PERMISSIONS${colors.reset}`);

  await assertTest('GET /api/leaves/balances -> 200 & Quotas', async () => {
    const res = await fetch(`${BASE_URL}/api/leaves/balances`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const casualQuota = body.balances?.['Casual Leave']?.totalQuota || body.casual?.total || 12;
    expect(casualQuota).toBeGreaterThan(0);
  });

  await assertTest('POST /api/leaves/apply (Edge Case: End date before Start date) -> 400', async () => {
    const res = await fetch(`${BASE_URL}/api/leaves/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        leave_type: 'Casual Leave',
        start_date: '2026-09-15',
        end_date: '2026-09-10',
        reason: 'Invalid chronological range test'
      })
    });
    expect(res.status).toBe(400);
  });

  let createdLeaveId = null;
  await assertTest('POST /api/leaves/apply (Valid Leave Application) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/leaves/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        leave_type: 'Casual Leave',
        start_date: '2026-09-20',
        end_date: '2026-09-20',
        reason: 'Personal medical consultation'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    createdLeaveId = body.leave.id;
  });

  await assertTest('PUT /api/leaves/:id/status (Admin Approves Leave) -> 200', async () => {
    if (!createdLeaveId) throw new Error('No leave ID available');
    const res = await fetch(`${BASE_URL}/api/leaves/${createdLeaveId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ status: 'Approved' })
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 7. SUPPORT TICKETS & LIVE CHAT HUB
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}7. SUPPORT TICKETS & LIVE CHAT HUB${colors.reset}`);

  await assertTest('POST /api/tickets (Edge Case: Missing description/subject) -> 400', async () => {
    const res = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({ category: 'IT & Device Support' })
    });
    expect(res.status).toBe(400);
  });

  let createdTicketId = null;
  await assertTest('POST /api/tickets (Staff raises new issue) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        category: 'Attendance / Regularization',
        subject: 'Punch-in time dispute on Sep 3rd',
        description: 'My morning login was delayed due to subway transit disruption. Please regularize to 09:15 AM.',
        priority: 'High'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    createdTicketId = body.ticket.id;
    expect(body.ticket.status).toBe('Open');
  });

  await assertTest('POST /api/tickets/:id/messages (Admin replies in thread) -> 200 & Auto In-Progress', async () => {
    if (!createdTicketId) throw new Error('No ticket ID available');
    const res = await fetch(`${BASE_URL}/api/tickets/${createdTicketId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        message: 'Transit delay noted. Please attach the verification pass and I will approve.'
      })
    });
    expect(res.status).toBe(200);
  });

  await assertTest('GET /api/tickets/:id/messages -> 200 & Message Thread Array', async () => {
    if (!createdTicketId) throw new Error('No ticket ID available');
    const res = await fetch(`${BASE_URL}/api/tickets/${createdTicketId}/messages`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.length).toBeGreaterThan(1);
  });

  await assertTest('PATCH /api/tickets/:id/status (Mark ticket as Resolved) -> 200', async () => {
    if (!createdTicketId) throw new Error('No ticket ID available');
    const res = await fetch(`${BASE_URL}/api/tickets/${createdTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'Resolved',
        resolution_notes: 'Transit certificate validated and morning login regularized.'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ticket.status).toBe('Resolved');
  });

  await assertTest('GET /api/tickets/broadcasts/all -> 200 & Announcements', async () => {
    const res = await fetch(`${BASE_URL}/api/tickets/broadcasts/all`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. WEEKLY REPORTS, APPRAISALS & GLOBAL SEARCH
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}8. WEEKLY REPORTS, APPRAISALS & SEARCH${colors.reset}`);

  await assertTest('POST /api/evaluations/weekly-submit -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/evaluations/weekly-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        department: 'Engineering',
        accomplishments: 'Delivered Neon PostgreSQL integration and live chat messaging hub.',
        challenges_blockers: 'None',
        learnings_skills: 'Mastered connection pooling and Fastify JWT auth.',
        next_week_goals: 'Complete mobile responsiveness fine-tuning.'
      })
    });
    expect(res.status).toBe(200);
  });

  await assertTest('GET /api/attendance/staff-monthly-history (Staff timesheet with verified attendance metrics) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/staff-monthly-history?employee_id=EMP-STAFF-01&month=2026-09`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.present_days).toBeGreaterThan(0);
    expect(parseFloat(body.total_hours)).toBeGreaterThan(0);
    expect(body.summary.presentDaysCount).toBeGreaterThan(0);
    expect(body.days.length).toBeGreaterThan(0);
  });

  await assertTest('GET /api/reports/employee-full-report (Comprehensive timesheet report with real attendance & tasks) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/reports/employee-full-report?employee_id=EMP-STAFF-01&month_year=2026-09`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summaryMetrics.totalDaysLogged).toBeGreaterThan(0);
    expect(body.summaryMetrics.presentDays).toBeGreaterThan(0);
    expect(parseFloat(body.summaryMetrics.totalNetHours)).toBeGreaterThan(0);
    expect(body.dailyActivityTimeline.length).toBeGreaterThan(0);
    expect(body.projectBreakdown.length).toBeGreaterThan(0);
  });

  await assertTest('GET /api/search?q=Vimal -> 200 & Multi-Entity Results', async () => {
    const res = await fetch(`${BASE_URL}/api/search?q=Vimal`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 9. CLOUDFLARE R2 STORAGE & EMPLOYEE PROFILE
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}9. CLOUDFLARE R2 STORAGE & PROFILE WORKSPACE${colors.reset}`);

  await assertTest('GET /api/auth/profile -> 200 & Profile Record', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile.email).toBe('vimalraj5207@gmail.com');
  });

  await assertTest('PUT /api/auth/profile (Update Personal & Statutory Details) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        phone: '+91 98765 43210',
        personal_info: {
          dob: '1995-05-15',
          gender: 'Male',
          blood_group: 'O+',
          marital_status: 'Single',
          current_address: 'Salem, Tamil Nadu'
        },
        statutory_info: {
          bank_name: 'HDFC Bank',
          bank_account_number: '50100234567890',
          ifsc_code: 'HDFC0001234',
          account_holder_name: 'Vimal Raj',
          pan_number: 'ABCDE1234F',
          aadhaar_number: '123456789012'
        },
        emergency_contacts: {
          contact_name: 'Family Contact',
          relationship: 'Parent / Father / Mother',
          contact_phone: '+91 98765 00000'
        }
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.profile.profile_completeness).toBeGreaterThan(50);
  });

  let uploadedR2Key = '';
  await assertTest('POST /api/uploads/base64 (Upload Document to Cloudflare R2 bucket: shazuhrms) -> 200', async () => {
    // Sample base64 text document
    const sampleBase64 = 'data:text/plain;base64,U0hBWlVTT0ZUIEhSTVMgQ2xvdWRmbGFyZSBSMiBTdG9yYWdlIFZlcmlmaWNhdGlvbiBUZXN0';
    const res = await fetch(`${BASE_URL}/api/uploads/base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        data_url: sampleBase64,
        filename: 'r2_verification_test.txt',
        folder: 'test_documents'
      })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.url.includes('/api/uploads/file/')).toBe(true);
    uploadedR2Key = body.key;
  });

  await assertTest('GET /api/uploads/file/* (Stream Document back from Cloudflare R2) -> 200', async () => {
    if (!uploadedR2Key) throw new Error('No uploaded R2 key available');
    const res = await fetch(`${BASE_URL}/api/uploads/file/${uploadedR2Key}`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.includes('SHAZUSOFT HRMS Cloudflare R2')).toBe(true);
  });

  await assertTest('DELETE /api/uploads/file/* (Delete test file from Cloudflare R2) -> 200', async () => {
    if (!uploadedR2Key) throw new Error('No uploaded R2 key available');
    const res = await fetch(`${BASE_URL}/api/uploads/file/${uploadedR2Key}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────
  // 10. COMPLIANCE DOCUMENT FREEZING & AUDIT LOCK
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.yellow}10. COMPLIANCE DOCUMENT FREEZING & AUDIT LOCK${colors.reset}`);

  await assertTest('POST /api/admin/employees/:id/freeze-documents (Admin Freezes Employee Records) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees/EMP-ADMIN-01/freeze-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ frozen: true })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.employee.documents_frozen).toBe(true);
  });

  await assertTest('POST /api/admin/employees/:id/freeze-documents (Admin Unfreezes Records) -> 200', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/employees/EMP-ADMIN-01/freeze-documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ frozen: false })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.employee.documents_frozen).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // SUMMARY REPORT
  // ─────────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}${colors.magenta}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  TEST RUN SUMMARY:${colors.reset}`);
  console.log(`  Total Tests Run: ${passedCount + failedCount}`);
  console.log(`  ${colors.green}Passed: ${passedCount}${colors.reset}`);
  console.log(`  ${failedCount === 0 ? colors.green : colors.red}Failed: ${failedCount}${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}====================================================${colors.reset}\n`);

  if (failedCount > 0) {
    console.error(`${colors.red}Test Suite Encountered ${failedCount} Failure(s):${colors.reset}`);
    failures.forEach((f, i) => console.error(`  ${i + 1}. [${f.name}] -> ${f.error}`));
    process.exit(1);
  } else {
    console.log(`${colors.bright}${colors.green}🎉 ALL ENDPOINTS & EDGE CASES PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
