/**
 * SHAZUSOFT HRMS — REAL-TIME DEMO DATA SEED UTILITY
 * 
 * Seeds 1 Admin (Vimal Raj) + 2 Real Staff Members (Priya Sharma, Karthik Raja)
 * with complete, realistic operational data across all system modules:
 * - Live Today Attendance (Punched-in & working) + 5-day historical timesheets
 * - Configured Base Salary structures & Bank packages
 * - Daily WorkDone task logs & Assigned tasks (In-Progress / Completed)
 * - Leaves & Emergency Permission passes (Pending for live approval demo)
 * - Support Tickets with threaded chat conversations
 * - September 2026 Payroll records with 1-click PDF payslips ready
 * - Company Broadcast & Live in-app notifications
 */

import { initDB, addRow, getRows, upsertSalaryStructure, invalidateCache } from './src/db.js';

async function seedDemoData() {
  console.log('================================================================');
  console.log('🚀 SEEDING REALISTIC DEMO DATA (1 ADMIN + 2 STAFF MEMBERS)');
  console.log('================================================================');

  const connected = await initDB();
  if (!connected) {
    console.error('❌ Could not connect to Neon PostgreSQL database.');
    process.exit(1);
  }

  const now = new Date().toISOString();
  const todayStr = '2026-09-07';

  // 1. EMPLOYEES (1 Admin + 2 Staff)
  console.log('\n👤 1. Registering Staff Accounts...');
  const employees = [
    {
      id: 'EMP-ADMIN-01',
      name: 'Vimal Raj',
      email: 'vimalraj5207@gmail.com',
      password_hash: 'OTP_AUTH_ENABLED',
      role: 'admin',
      department: 'Executive Management',
      designation: 'Managing Director & CEO',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98765 00001',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      created_at: '2026-01-01T09:00:00.000Z'
    },
    {
      id: 'EMP-STAFF-01',
      name: 'Priya Sharma',
      email: 'priya.sharma@shazusofttechnologies.org',
      password_hash: 'OTP_AUTH_ENABLED',
      role: 'employee',
      department: 'Product Engineering',
      designation: 'Senior Frontend Developer',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98451 22334',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
      created_at: '2026-02-15T09:00:00.000Z'
    },
    {
      id: 'EMP-STAFF-02',
      name: 'Karthik Raja',
      email: 'karthik.raja@shazusofttechnologies.org',
      password_hash: 'OTP_AUTH_ENABLED',
      role: 'employee',
      department: 'UI/UX Design & Branding',
      designation: 'Lead Product Designer',
      work_mode: 'wfh',
      status: 'active',
      phone: '+91 97892 44556',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      created_at: '2026-03-01T09:00:00.000Z'
    }
  ];

  for (const emp of employees) {
    await addRow('Employees', emp);
    console.log(`  ✔ [Employee] ${emp.name} (${emp.id}) — ${emp.designation} [${emp.work_mode.toUpperCase()}]`);
  }

  // 2. SALARY PACKAGES & BANK STRUCTURES
  console.log('\n💰 2. Configuring Base Salaries & Bank Remuneration...');
  const salaryData = [
    {
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      department: 'Executive Management',
      designation: 'Managing Director & CEO',
      monthly_salary: 85000,
      bank_name: 'HDFC Bank',
      account_number: '50100234567890',
      ifsc_code: 'HDFC0001234',
      upi_id: 'vimalraj@okhdfcbank',
      pan_number: 'ABCDE1234F'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      department: 'Product Engineering',
      designation: 'Senior Frontend Developer',
      monthly_salary: 48000,
      bank_name: 'HDFC Bank',
      account_number: '501004928172',
      ifsc_code: 'HDFC0001234',
      upi_id: 'priyasharma@okhdfcbank',
      pan_number: 'ABCPS1234K'
    },
    {
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      department: 'UI/UX Design & Branding',
      designation: 'Lead Product Designer',
      monthly_salary: 42000,
      bank_name: 'ICICI Bank',
      account_number: '002901582914',
      ifsc_code: 'ICIC0000029',
      upi_id: 'karthik.design@okicici',
      pan_number: 'BCPKR5678L'
    }
  ];

  for (const s of salaryData) {
    await upsertSalaryStructure(s);
    console.log(`  ✔ [Salary Package] ${s.employee_name}: ₹${s.monthly_salary.toLocaleString('en-IN')}/mo (${s.bank_name})`);
  }

  // 3. TODAY'S LIVE ATTENDANCE (Punched In & Working) + PAST 5 DAYS
  console.log('\n⏱️  3. Seeding Live Today Attendance & Weekly Timesheets...');
  const attendanceRecords = [
    // Today (Live Punched-in Status for Demo)
    {
      id: `ATT-${todayStr}-EMP-ADMIN-01`,
      date: todayStr,
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:15 AM',
      logout_time: '',
      total_hours: '0',
      break_hours: '0.00',
      net_hours: '0',
      status: 'Present',
      punch_in_lat: '11.6643',
      punch_in_lng: '78.1460',
      in_geofence: 'TRUE',
      created_at: `${todayStr}T09:15:00.000Z`
    },
    {
      id: `ATT-${todayStr}-EMP-STAFF-01`,
      date: todayStr,
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:28 AM',
      logout_time: '',
      total_hours: '0',
      break_hours: '0.00',
      net_hours: '0',
      status: 'Present',
      punch_in_lat: '11.6643',
      punch_in_lng: '78.1460',
      in_geofence: 'TRUE',
      created_at: `${todayStr}T09:28:00.000Z`
    },
    {
      id: `ATT-${todayStr}-EMP-STAFF-02`,
      date: todayStr,
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:35 AM',
      logout_time: '',
      total_hours: '0',
      break_hours: '0.00',
      net_hours: '0',
      status: 'Present',
      punch_in_lat: 'WFH_REMOTE',
      punch_in_lng: 'WFH_REMOTE',
      in_geofence: 'WFH',
      created_at: `${todayStr}T09:35:00.000Z`
    },
    // September past completed workdays for timesheet charts
    {
      id: 'ATT-2026-09-01-EMP-ADMIN-01',
      date: '2026-09-01',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:10 AM',
      logout_time: '06:45 PM',
      total_hours: '9.58',
      break_hours: '0.50',
      net_hours: '9.08',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-01T09:10:00.000Z'
    },
    {
      id: 'ATT-2026-09-02-EMP-ADMIN-01',
      date: '2026-09-02',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:14 AM',
      logout_time: '06:50 PM',
      total_hours: '9.60',
      break_hours: '0.50',
      net_hours: '9.10',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-02T09:14:00.000Z'
    },
    {
      id: 'ATT-2026-09-03-EMP-ADMIN-01',
      date: '2026-09-03',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:08 AM',
      logout_time: '06:40 PM',
      total_hours: '9.53',
      break_hours: '0.50',
      net_hours: '9.03',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-03T09:08:00.000Z'
    },
    {
      id: 'ATT-2026-09-04-EMP-ADMIN-01',
      date: '2026-09-04',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:15 AM',
      logout_time: '06:45 PM',
      total_hours: '9.50',
      break_hours: '0.50',
      net_hours: '9.00',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-04T09:15:00.000Z'
    },
    {
      id: 'ATT-2026-09-05-EMP-ADMIN-01',
      date: '2026-09-05',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:12 AM',
      logout_time: '06:40 PM',
      total_hours: '9.47',
      break_hours: '0.50',
      net_hours: '8.97',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-05T09:12:00.000Z'
    },
    {
      id: 'ATT-2026-09-01-EMP-STAFF-01',
      date: '2026-09-01',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:22 AM',
      logout_time: '06:30 PM',
      total_hours: '9.13',
      break_hours: '0.50',
      net_hours: '8.63',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-01T09:22:00.000Z'
    },
    {
      id: 'ATT-2026-09-02-EMP-STAFF-01',
      date: '2026-09-02',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:25 AM',
      logout_time: '06:35 PM',
      total_hours: '9.17',
      break_hours: '0.50',
      net_hours: '8.67',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-02T09:25:00.000Z'
    },
    {
      id: 'ATT-2026-09-03-EMP-STAFF-01',
      date: '2026-09-03',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:20 AM',
      logout_time: '06:30 PM',
      total_hours: '9.17',
      break_hours: '0.50',
      net_hours: '8.67',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-03T09:20:00.000Z'
    },
    {
      id: 'ATT-2026-09-04-EMP-STAFF-01',
      date: '2026-09-04',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:30 AM',
      logout_time: '06:45 PM',
      total_hours: '9.25',
      break_hours: '0.50',
      net_hours: '8.75',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-04T09:30:00.000Z'
    },
    {
      id: 'ATT-2026-09-05-EMP-STAFF-01',
      date: '2026-09-05',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:25 AM',
      logout_time: '06:30 PM',
      total_hours: '9.08',
      break_hours: '0.50',
      net_hours: '8.58',
      status: 'Present',
      in_geofence: 'TRUE',
      created_at: '2026-09-05T09:25:00.000Z'
    },
    {
      id: 'ATT-2026-09-01-EMP-STAFF-02',
      date: '2026-09-01',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:35 AM',
      logout_time: '06:35 PM',
      total_hours: '9.00',
      break_hours: '0.50',
      net_hours: '8.50',
      status: 'Present',
      in_geofence: 'WFH',
      created_at: '2026-09-01T09:35:00.000Z'
    },
    {
      id: 'ATT-2026-09-02-EMP-STAFF-02',
      date: '2026-09-02',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:40 AM',
      logout_time: '06:45 PM',
      total_hours: '9.08',
      break_hours: '0.50',
      net_hours: '8.58',
      status: 'Present',
      in_geofence: 'WFH',
      created_at: '2026-09-02T09:40:00.000Z'
    },
    {
      id: 'ATT-2026-09-03-EMP-STAFF-02',
      date: '2026-09-03',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:30 AM',
      logout_time: '06:30 PM',
      total_hours: '9.00',
      break_hours: '0.50',
      net_hours: '8.50',
      status: 'Present',
      in_geofence: 'WFH',
      created_at: '2026-09-03T09:30:00.000Z'
    },
    {
      id: 'ATT-2026-09-04-EMP-STAFF-02',
      date: '2026-09-04',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:38 AM',
      logout_time: '06:38 PM',
      total_hours: '9.00',
      break_hours: '0.50',
      net_hours: '8.50',
      status: 'Present',
      in_geofence: 'WFH',
      created_at: '2026-09-04T09:38:00.000Z'
    },
    {
      id: 'ATT-2026-09-05-EMP-STAFF-02',
      date: '2026-09-05',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      login_time: '09:40 AM',
      logout_time: '06:40 PM',
      total_hours: '9.00',
      break_hours: '0.50',
      net_hours: '8.50',
      status: 'Present',
      in_geofence: 'WFH',
      created_at: '2026-09-05T09:40:00.000Z'
    }
  ];

  // Generate complete August 2026 legacy month attendance (Mon-Sat, excluding Sundays)
  for (let day = 1; day <= 31; day++) {
    const dStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-08-${dStr}`;
    const dayOfWeek = new Date(dateStr).getDay(); // 0 is Sunday
    if (dayOfWeek === 0) continue; // Skip Sundays

    // Vimal Raj (Admin)
    attendanceRecords.push({
      id: `ATT-${dateStr}-EMP-ADMIN-01`,
      date: dateStr,
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      login_time: '09:12 AM',
      logout_time: '06:45 PM',
      total_hours: '9.55',
      break_hours: '0.50',
      net_hours: '9.05',
      status: 'Present',
      punch_in_lat: '11.6643',
      punch_in_lng: '78.1460',
      in_geofence: 'TRUE',
      created_at: `${dateStr}T09:12:00.000Z`
    });

    // Priya Sharma (Staff - Office)
    attendanceRecords.push({
      id: `ATT-${dateStr}-EMP-STAFF-01`,
      date: dateStr,
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      login_time: '09:25 AM',
      logout_time: '06:30 PM',
      total_hours: '9.08',
      break_hours: '0.50',
      net_hours: '8.58',
      status: 'Present',
      punch_in_lat: '11.6643',
      punch_in_lng: '78.1460',
      in_geofence: 'TRUE',
      created_at: `${dateStr}T09:25:00.000Z`
    });

    // Karthik Raja (Staff - WFH), 1 absent/LOP day on Aug 18
    if (dateStr === '2026-08-18') {
      attendanceRecords.push({
        id: `ATT-${dateStr}-EMP-STAFF-02`,
        date: dateStr,
        employee_id: 'EMP-STAFF-02',
        employee_name: 'Karthik Raja',
        login_time: '',
        logout_time: '',
        total_hours: '0',
        break_hours: '0',
        net_hours: '0',
        status: 'Absent',
        in_geofence: 'WFH',
        created_at: `${dateStr}T09:00:00.000Z`
      });
    } else {
      attendanceRecords.push({
        id: `ATT-${dateStr}-EMP-STAFF-02`,
        date: dateStr,
        employee_id: 'EMP-STAFF-02',
        employee_name: 'Karthik Raja',
        login_time: '09:35 AM',
        logout_time: '06:35 PM',
        total_hours: '9.00',
        break_hours: '0.50',
        net_hours: '8.50',
        status: 'Present',
        punch_in_lat: 'WFH_REMOTE',
        punch_in_lng: 'WFH_REMOTE',
        in_geofence: 'WFH',
        created_at: `${dateStr}T09:35:00.000Z`
      });
    }
  }

  for (const att of attendanceRecords) {
    await addRow('Attendance', att);
    console.log(`  ✔ [Attendance] ${att.employee_name || att.employee_id} on ${att.date}: ${att.login_time || '—'} (${att.status})`);
  }

  // 4. WORK DONE (Daily Task Logging)
  console.log('\n📝 4. Seeding WorkDone Daily Progress Entries...');
  const workDoneEntries = [
    {
      id: 'TASK-001',
      date: todayStr,
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      project_name: 'HRMS Core',
      task_title: 'Material-UI v5 Design System & Live SSE Integration',
      description: 'Refactored employee tables, added real-time SSE dynamic state updates for attendance and salary packages.',
      estimated_hours: '6.0',
      actual_hours: '5.5',
      status: 'Completed',
      remarks: 'Build verified with 0 lint errors',
      created_at: `${todayStr}T14:30:00.000Z`
    },
    {
      id: 'TASK-002',
      date: todayStr,
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      project_name: 'Mobile PWA Experience',
      task_title: 'High-Fidelity Mobile Geofence & Quick-Punch Mockups',
      description: 'Designed interactive mobile cards, animated punch-in ring indicators, and biometric break trackers.',
      estimated_hours: '6.5',
      actual_hours: '6.0',
      status: 'Completed',
      remarks: 'Figma file shared with engineering team',
      created_at: `${todayStr}T15:00:00.000Z`
    },
    {
      id: 'TASK-003',
      date: '2026-09-05',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      project_name: 'Payroll Automation',
      task_title: 'Loss of Pay (LOP) & Working Sunday Calculation Engine',
      description: 'Implemented mathematical model deducting LOP while including approved Working Sundays in remuneration.',
      estimated_hours: '7.0',
      actual_hours: '7.0',
      status: 'Completed',
      remarks: 'Automated test suite passing 100%',
      created_at: '2026-09-05T17:00:00.000Z'
    }
  ];

  for (const w of workDoneEntries) {
    await addRow('WorkDone', w);
    console.log(`  ✔ [WorkDone] ${w.employee_name}: "${w.task_title}" (${w.actual_hours}h)`);
  }

  // 5. MANAGER ASSIGNED TASKS
  console.log('\n📋 5. Delegating Manager Assigned Tasks...');
  const assignedTasks = [
    {
      id: 'TASK-ASSIGN-101',
      task_title: 'Client Demo Staging & Production Deployment Check',
      project_name: 'Product Launch',
      description: 'Ensure Cloudflare Pages frontend and Render Fastify backend are synced with zero connection errors.',
      assigned_by_id: 'EMP-ADMIN-01',
      assigned_by_name: 'Vimal Raj',
      assigned_to_id: 'EMP-STAFF-01',
      assigned_to_name: 'Priya Sharma',
      priority: 'Urgent',
      due_date: todayStr,
      estimated_hours: '4',
      actual_hours: '3',
      progress: '85',
      status: 'In-Progress',
      work_notes: 'All routes and live SSE tests passing cleanly.',
      created_at: '2026-09-07T08:30:00.000Z'
    },
    {
      id: 'TASK-ASSIGN-102',
      task_title: 'Executive PDF Payslip Vector Layout Finalization',
      project_name: 'Remuneration Suite',
      description: 'Style the official salary payslip document with corporate forest-green branding, INR formatting, and tax deduction blocks.',
      assigned_by_id: 'EMP-ADMIN-01',
      assigned_by_name: 'Vimal Raj',
      assigned_to_id: 'EMP-STAFF-02',
      assigned_to_name: 'Karthik Raja',
      priority: 'High',
      due_date: '2026-09-08',
      estimated_hours: '5',
      actual_hours: '5',
      progress: '100',
      status: 'Completed',
      work_notes: 'Tested PDF generator across Chrome, Safari, and mobile browsers.',
      created_at: '2026-09-06T10:00:00.000Z'
    }
  ];

  for (const t of assignedTasks) {
    await addRow('Assigned_Tasks', t);
    console.log(`  ✔ [Assigned Task] ${t.task_title} -> ${t.assigned_to_name} [${t.status} - ${t.progress}%]`);
  }

  // 6. LEAVES & PERMISSIONS (Including 1 Pending for Live Approval Demo)
  console.log('\n🏖️  6. Seeding Leaves & Short Permissions (With Pending for Live Demo)...');
  const leaves = [
    {
      id: 'LEV-DEMO-01',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      leave_type: 'Casual Leave',
      start_date: '2026-09-11',
      end_date: '2026-09-11',
      total_days: '1',
      reason: 'Attending sibling graduation ceremony in hometown',
      status: 'Pending', // PENDING so the admin can click "Approve" live in the demo!
      reviewed_by: '',
      applied_at: `${todayStr}T10:00:00.000Z`
    },
    {
      id: 'LEV-DEMO-02',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      leave_type: 'Sick Leave',
      start_date: '2026-09-02',
      end_date: '2026-09-02',
      total_days: '1',
      reason: 'Severe migraine and eye strain consultation',
      status: 'Approved',
      reviewed_by: 'Vimal Raj',
      applied_at: '2026-09-01T18:00:00.000Z'
    }
  ];

  for (const l of leaves) {
    await addRow('Leaves', l);
    console.log(`  ✔ [Leave Application] ${l.employee_name}: ${l.leave_type} on ${l.start_date} [STATUS: ${l.status}]`);
  }

  const permissions = [
    {
      id: 'PERM-DEMO-01',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      date: '2026-09-04',
      start_time: '04:00 PM',
      end_time: '05:30 PM',
      duration_hours: '1.5',
      reason: 'Physical bank KYC documentation verification',
      status: 'Approved',
      reviewed_by: 'Vimal Raj',
      review_remarks: 'Approved by management',
      applied_at: '2026-09-04T12:00:00.000Z'
    }
  ];

  for (const p of permissions) {
    await addRow('Permissions', p);
    console.log(`  ✔ [Short Permission] ${p.employee_name}: ${p.duration_hours}h on ${p.date} (${p.status})`);
  }

  // 7. HELPDESK & SUPPORT TICKETS
  console.log('\n🎫 7. Setting Up Helpdesk Tickets & Threaded Messages...');
  const tickets = [
    {
      id: 'TKT-DEMO-1001',
      ticket_number: 'TKT-1001',
      category: 'Hardware & IT Support',
      subject: 'Dual 27-inch 4K Monitors & USB-C Dock Setup',
      description: 'Requesting USB-C hub and dual display connection for high-resolution web app development.',
      priority: 'Medium',
      status: 'In-Progress',
      creator_id: 'EMP-STAFF-01',
      creator_name: 'Priya Sharma',
      assigned_to_id: 'EMP-ADMIN-01',
      assigned_to_name: 'Vimal Raj',
      created_at: '2026-09-06T11:00:00.000Z',
      updated_at: `${todayStr}T11:30:00.000Z`
    },
    {
      id: 'TKT-DEMO-1002',
      ticket_number: 'TKT-1002',
      category: 'Software Licensing',
      subject: 'Figma Enterprise Workspace Annual Seat Renewal',
      description: 'Need design seat renewal for component library syncing across frontend teams.',
      priority: 'High',
      status: 'Resolved',
      creator_id: 'EMP-STAFF-02',
      creator_name: 'Karthik Raja',
      assigned_to_id: 'EMP-ADMIN-01',
      assigned_to_name: 'Vimal Raj',
      resolution_notes: 'Enterprise license renewed and seat assigned.',
      resolved_at: `${todayStr}T10:15:00.000Z`,
      created_at: '2026-09-05T09:30:00.000Z',
      updated_at: `${todayStr}T10:15:00.000Z`
    }
  ];

  for (const tk of tickets) {
    await addRow('Support_Tickets', tk);
    console.log(`  ✔ [Ticket] #${tk.ticket_number}: "${tk.subject}" [${tk.status}]`);
  }

  const ticketMessages = [
    {
      id: 'MSG-001',
      ticket_id: 'TKT-DEMO-1001',
      sender_id: 'EMP-STAFF-01',
      sender_name: 'Priya Sharma',
      sender_role: 'employee',
      message: 'Hi Vimal, could we procure the HDMI to Type-C dock for multi-screen testing?',
      created_at: '2026-09-06T11:05:00.000Z'
    },
    {
      id: 'MSG-002',
      ticket_id: 'TKT-DEMO-1001',
      sender_id: 'EMP-ADMIN-01',
      sender_name: 'Vimal Raj',
      sender_role: 'admin',
      message: 'Approved Priya. The hardware team has dispatched the Belkin Thunderbolt dock to your workstation.',
      created_at: '2026-09-06T14:20:00.000Z'
    }
  ];

  for (const m of ticketMessages) {
    await addRow('Ticket_Messages', m);
  }

  // 8. AUGUST 2026 & SEPTEMBER 2026 PAYROLL RECORDS (Pre-computed for 1-Click PDF Demo)
  console.log('\n💵 8. Publishing Official August (Legacy Paid) & September 2026 Monthly Payroll...');
  const payrollRecords = [
    // --- AUGUST 2026 LEGACY PAYROLL (Fully Settled & Paid) ---
    {
      id: 'PAY-2026-08-EMP-ADMIN-01',
      payroll_month: '2026-08',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      department: 'Executive Management',
      designation: 'Managing Director & CEO',
      monthly_salary: 85000,
      daily_rate: 3269.23,
      total_working_days: 26,
      present_days: 26,
      paid_leaves: 0,
      lop_days: 0,
      lop_deduction: 0,
      net_payable: 85000,
      status: 'Paid',
      payment_mode: 'Corporate Bank Transfer (NEFT)',
      payment_date: '2026-08-31',
      payment_reference: 'HDFC-NEFT-20260831-001',
      remarks: 'August 2026 executive salary settled',
      generated_at: '2026-08-30T10:00:00.000Z',
      generated_by: 'Vimal Raj',
      paid_at: '2026-08-31T11:00:00.000Z',
      paid_by: 'Vimal Raj'
    },
    {
      id: 'PAY-2026-08-EMP-STAFF-01',
      payroll_month: '2026-08',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      department: 'Product Engineering',
      designation: 'Senior Frontend Developer',
      monthly_salary: 48000,
      daily_rate: 1846.15,
      total_working_days: 26,
      present_days: 26,
      paid_leaves: 0,
      lop_days: 0,
      lop_deduction: 0,
      net_payable: 48000,
      status: 'Paid',
      payment_mode: 'Corporate Bank Transfer (NEFT)',
      payment_date: '2026-08-31',
      payment_reference: 'HDFC-NEFT-20260831-002',
      remarks: 'August 2026 remuneration disbursed in full',
      generated_at: '2026-08-30T10:00:00.000Z',
      generated_by: 'Vimal Raj',
      paid_at: '2026-08-31T11:00:00.000Z',
      paid_by: 'Vimal Raj'
    },
    {
      id: 'PAY-2026-08-EMP-STAFF-02',
      payroll_month: '2026-08',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      department: 'UI/UX Design & Branding',
      designation: 'Lead Product Designer',
      monthly_salary: 42000,
      daily_rate: 1615.38,
      total_working_days: 26,
      present_days: 25,
      paid_leaves: 0,
      lop_days: 1,
      lop_deduction: 1615.38,
      net_payable: 40384.62,
      status: 'Paid',
      payment_mode: 'ICICI IMPS Bank Transfer',
      payment_date: '2026-08-31',
      payment_reference: 'ICICI-IMPS-20260831-003',
      remarks: '1 LOP deduction applied for unapproved absence on Aug 18',
      generated_at: '2026-08-30T10:00:00.000Z',
      generated_by: 'Vimal Raj',
      paid_at: '2026-08-31T11:00:00.000Z',
      paid_by: 'Vimal Raj'
    },
    // --- SEPTEMBER 2026 PAYROLL ---
    {
      id: 'PAY-2026-09-EMP-ADMIN-01',
      payroll_month: '2026-09',
      employee_id: 'EMP-ADMIN-01',
      employee_name: 'Vimal Raj',
      department: 'Executive Management',
      designation: 'Managing Director & CEO',
      monthly_salary: 85000,
      daily_rate: 3269.23,
      total_working_days: 26,
      present_days: 26,
      paid_leaves: 0,
      lop_days: 0,
      lop_deduction: 0,
      net_payable: 85000,
      status: 'Paid',
      payment_mode: 'Corporate Bank Transfer (NEFT)',
      payment_date: '2026-09-05',
      payment_reference: 'HDFC-NEFT-20260905-001',
      remarks: 'Executive remuneration disbursed',
      generated_at: '2026-09-05T09:00:00.000Z',
      generated_by: 'Vimal Raj',
      paid_at: '2026-09-05T10:00:00.000Z',
      paid_by: 'Vimal Raj'
    },
    {
      id: 'PAY-2026-09-EMP-STAFF-01',
      payroll_month: '2026-09',
      employee_id: 'EMP-STAFF-01',
      employee_name: 'Priya Sharma',
      department: 'Product Engineering',
      designation: 'Senior Frontend Developer',
      monthly_salary: 48000,
      daily_rate: 1846.15,
      total_working_days: 26,
      present_days: 25,
      paid_leaves: 1,
      lop_days: 0,
      lop_deduction: 0,
      net_payable: 48000,
      status: 'Pending', // Pending so admin can demonstrate "Mark as Paid" or "Download Payslip PDF"
      remarks: 'Full attendance & approved leave coverage',
      generated_at: `${todayStr}T09:00:00.000Z`,
      generated_by: 'Vimal Raj'
    },
    {
      id: 'PAY-2026-09-EMP-STAFF-02',
      payroll_month: '2026-09',
      employee_id: 'EMP-STAFF-02',
      employee_name: 'Karthik Raja',
      department: 'UI/UX Design & Branding',
      designation: 'Lead Product Designer',
      monthly_salary: 42000,
      daily_rate: 1615.38,
      total_working_days: 26,
      present_days: 25,
      paid_leaves: 1,
      lop_days: 0,
      lop_deduction: 0,
      net_payable: 42000,
      status: 'Pending',
      remarks: 'Remote attendance audited and approved',
      generated_at: `${todayStr}T09:00:00.000Z`,
      generated_by: 'Vimal Raj'
    }
  ];

  for (const pr of payrollRecords) {
    await addRow('Monthly_Payrolls', pr);
    console.log(`  ✔ [Payroll Record] ${pr.employee_name}: Net Payable ₹${pr.net_payable.toLocaleString('en-IN')} [STATUS: ${pr.status}]`);
  }

  // 9. COMPANY BROADCAST ANNOUNCEMENT
  console.log('\n📢 9. Broadcasting Company Announcement...');
  await addRow('Broadcasts', {
    id: 'BRD-001',
    title: '🚀 Q3 Operational Excellence & Live Product Launch',
    content: 'All staff members are requested to log daily tasks in the WorkDone portal by 06:30 PM. Attendance and GPS geofence checks are active on company devices.',
    priority: 'Urgent',
    created_by_id: 'EMP-ADMIN-01',
    created_by_name: 'Vimal Raj',
    created_at: `${todayStr}T09:00:00.000Z`
  });
  console.log('  ✔ [Broadcast] Published "Q3 Operational Excellence" announcement.');

  // 10. IN-APP NOTIFICATIONS
  console.log('\n🔔 10. Generating Live In-App Alerts...');
  const notifications = [
    {
      id: `NOTIF-${Date.now()}-1`,
      user_id: 'EMP-ADMIN-01',
      title: 'New Leave Request 📅',
      message: 'Priya Sharma submitted a Casual Leave request for Sep 11, 2026.',
      type: 'leave',
      target_tab: 'leaves',
      target_url: '/?tab=leaves',
      is_read: false,
      created_at: `${todayStr}T10:00:00.000Z`
    },
    {
      id: `NOTIF-${Date.now()}-2`,
      user_id: 'EMP-ADMIN-01',
      title: 'Staff Punched In ⏱️',
      message: 'Priya Sharma (Senior Frontend Developer) punched in at 09:28 AM within office perimeter.',
      type: 'attendance',
      target_tab: 'live',
      target_url: '/?tab=live',
      is_read: false,
      created_at: `${todayStr}T09:28:00.000Z`
    },
    {
      id: `NOTIF-${Date.now()}-3`,
      user_id: 'EMP-ADMIN-01',
      title: 'WFH Punch In 🏠',
      message: 'Karthik Raja (Lead Product Designer) punched in at 09:35 AM in Work-From-Home mode.',
      type: 'attendance',
      target_tab: 'live',
      target_url: '/?tab=live',
      is_read: false,
      created_at: `${todayStr}T09:35:00.000Z`
    }
  ];

  for (const n of notifications) {
    await addRow('In_App_Notifications', n);
  }
  console.log(`  ✔ Generated ${notifications.length} live in-app notifications.`);

  // Invalidate in-memory and database cache
  invalidateCache();

  console.log('\n================================================================');
  console.log('🎉 DEMO DATA SEEDING COMPLETE WITH 100% SUCCESS!');
  console.log('================================================================');
  console.log('Summary of Seeded Team:');
  console.log('  1. Vimal Raj (Admin)              - vimalraj5207@gmail.com');
  console.log('  2. Priya Sharma (In-Office Staff) - priya.sharma@shazusofttechnologies.org');
  console.log('  3. Karthik Raja (WFH Staff)       - karthik.raja@shazusofttechnologies.org');
  console.log('\nReady for live client demonstration!\n');

  process.exit(0);
}

seedDemoData().catch(err => {
  console.error('Fatal Seeding Error:', err);
  process.exit(1);
});
