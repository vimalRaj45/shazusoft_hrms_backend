import { initDB, addRow, getRows } from './db.js';
import bcrypt from 'bcryptjs';

async function seedFullBusinessData() {
  console.log('🚀 Starting Neon PostgreSQL Comprehensive Business Mock Data Seeding (September & August 2026)...');
  const connected = await initDB();
  if (!connected) {
    console.error('❌ Failed to connect to Neon PostgreSQL database.');
    process.exit(1);
  }

  // 1. Check existing employees
  const existingEmployees = await getRows('Employees');
  console.log(`Current employees in DB: ${existingEmployees.length}`);
  
  // Collect all staff employee IDs (non-admin preferred, plus specific ones)
  const staffEmployees = existingEmployees.filter(e => e.role !== 'admin');
  const targetEmpIds = ['EMP-002', 'EMP-003', 'EMP-STAFF-01'];
  
  // 2. Comprehensive Work Done Tasks for September 2026 (Demo Days: Sep 1, 2, 3, 4)
  const sepTasks = [
    // --- EMP-STAFF-01 (VS Groups Staff) ---
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-01',
      project_name: 'Client Portal Revamp',
      task_title: 'API Authentication & Token Refresh Flow',
      description: 'Built secure JWT token rotation and session expiration interceptors for the web dashboard.',
      estimated_hours: '4.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Validated across browser reload scenarios.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-01',
      project_name: 'Client Portal Revamp',
      task_title: 'Responsive Navbar & Profile Dropdown',
      description: 'Created modern header layout with role indicator and smooth mobile drawer transition.',
      estimated_hours: '3.5',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Passes accessibility contrast checks.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-02',
      project_name: 'HRMS Mobile App',
      task_title: 'PWA Service Worker Caching & Offline Fallback',
      description: 'Registered service worker and configured runtime cache for static assets and web icons.',
      estimated_hours: '5.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Tested offline mode and background sync prompt.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-03',
      project_name: 'E-Commerce Engine',
      task_title: 'Stripe Payment Webhook & Checkout Verification',
      description: 'Implemented webhook listener for successful order events and automated invoice trigger.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Zero errors on test environment transactions.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-03',
      project_name: 'E-Commerce Engine',
      task_title: 'Cart Discount Code Validation Service',
      description: 'Added promo code engine supporting percentage off, minimum cart value, and usage limits.',
      estimated_hours: '3.0',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Edge case handled for expired promotional coupons.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-04',
      project_name: 'HRMS Geofence System',
      task_title: 'Haversine Office Boundary Radius Verification',
      description: 'Enhanced GPS geolocation punch with real-time distance calculation and precision coordinates.',
      estimated_hours: '4.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'High-accuracy mode tested within 150m perimeter.'
    },
    {
      employee_id: 'EMP-STAFF-01',
      employee_name: 'VS Groups Staff',
      date: '2026-09-04',
      project_name: 'HRMS Geofence System',
      task_title: 'Admin Timesheet Daily Work Done Dialog',
      description: 'Created day-wise task viewer dialog with detailed estimated vs actual hour analytics.',
      estimated_hours: '3.5',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Fully reviewed and deployed to production.'
    },

    // --- EMP-002 (Alex Rivera) ---
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-09-01',
      project_name: 'DevOps & Cloud',
      task_title: 'Render Production Environment Setup & Dockerfile Optimization',
      description: 'Configured secret files mount for service.json and automated deployment build scripts.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Reduced cold-start latency by 40%.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-09-02',
      project_name: 'Database Architecture',
      task_title: 'Google Sheets Batch Append Rate Limiting',
      description: 'Implemented queue manager with exponential backoff to handle concurrent punch requests smoothly.',
      estimated_hours: '4.5',
      actual_hours: '5.0',
      status: 'Completed',
      remarks: 'Stress tested with 50 parallel requests.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-09-03',
      project_name: 'AI Insights Engine',
      task_title: 'Mistral AI Monthly Evaluation Auto-Summary',
      description: 'Integrated Mistral 7B prompt template to generate executive summaries of staff KPIs.',
      estimated_hours: '4.0',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Executive reports generate in under 2 seconds.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-09-04',
      project_name: 'Security & Compliance',
      task_title: 'Email OTP Authentication & Password Sunset',
      description: 'Migrated employee registration and login to 6-digit cryptographic email OTP.',
      estimated_hours: '4.5',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Hostinger transactional SMTP active.'
    },

    // --- EMP-003 (Priya Sharma) ---
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-09-01',
      project_name: 'UI/UX Redesign',
      task_title: 'Dark Mode Color Palette & High Contrast Ratios',
      description: 'Designed WCAG 2.1 AA compliant color schemes and updated design tokens.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Figma specs shared with engineering team.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-09-02',
      project_name: 'UI/UX Redesign',
      task_title: 'Executive Attendance KPI Metrics Cards Design',
      description: 'Created high-fidelity mockups for 6 KPI summary cards with trend indicators.',
      estimated_hours: '3.5',
      actual_hours: '3.0',
      status: 'Completed',
      remarks: 'Approved by executive management.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-09-03',
      project_name: 'Mobile PWA Experience',
      task_title: 'Bottom Sheet Install Banner & Micro-Animations',
      description: 'Crafted mobile-first install prompt replacing cluttered navbar icons.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Optimized touch tap targets.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-09-04',
      project_name: 'Design System',
      task_title: 'Component Library Documentation & Storybook Tokens',
      description: 'Standardized buttons, input modals, chips, and toast notification styles.',
      estimated_hours: '5.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Clean export ready for onboarding.'
    }
  ];

  // 3. September Attendance Records (Covering Present, Late, Regularized)
  const sepAttendance = [
    // EMP-STAFF-01
    { id: 'ATT-20260901-EMPSTAFF', date: '2026-09-01', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', login_time: '09:15:00', logout_time: '18:15:00', total_hours: '9.00', break_hours: '1.00', net_hours: '8.00', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260902-EMPSTAFF', date: '2026-09-02', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', login_time: '09:42:00', logout_time: '18:30:00', total_hours: '8.80', break_hours: '0.80', net_hours: '8.00', status: 'Late', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260903-EMPSTAFF', date: '2026-09-03', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', login_time: '09:15:00', logout_time: '18:15:00', total_hours: '9.00', break_hours: '0.75', net_hours: '8.25', status: 'Regularized', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260904-EMPSTAFF', date: '2026-09-04', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', login_time: '09:30:00', logout_time: '18:30:00', total_hours: '9.00', break_hours: '1.00', net_hours: '8.00', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },

    // EMP-002
    { id: 'ATT-20260901-EMP002', date: '2026-09-01', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:10:00', logout_time: '18:15:00', total_hours: '9.08', break_hours: '1.00', net_hours: '8.08', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260902-EMP002', date: '2026-09-02', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:05:00', logout_time: '18:00:00', total_hours: '8.92', break_hours: '0.75', net_hours: '8.17', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260903-EMP002', date: '2026-09-03', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:40:00', logout_time: '18:30:00', total_hours: '8.83', break_hours: '0.80', net_hours: '8.03', status: 'Late', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260904-EMP002', date: '2026-09-04', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:15:00', logout_time: '18:45:00', total_hours: '9.50', break_hours: '1.00', net_hours: '8.50', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },

    // EMP-003
    { id: 'ATT-20260901-EMP003', date: '2026-09-01', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:20:00', logout_time: '18:00:00', total_hours: '8.67', break_hours: '0.75', net_hours: '7.92', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260902-EMP003', date: '2026-09-02', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:12:00', logout_time: '18:20:00', total_hours: '9.13', break_hours: '0.80', net_hours: '8.33', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260903-EMP003', date: '2026-09-03', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:08:00', logout_time: '18:05:00', total_hours: '8.95', break_hours: '0.70', net_hours: '8.25', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' },
    { id: 'ATT-20260904-EMP003', date: '2026-09-04', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:18:00', logout_time: '18:15:00', total_hours: '8.95', break_hours: '0.75', net_hours: '8.20', status: 'Present', punch_in_lat: '11.6569', punch_in_lng: '78.1635', punch_out_lat: '11.6569', punch_out_lng: '78.1635', in_geofence: 'TRUE' }
  ];

  // 4. September Breaks
  const sepBreaks = [
    { id: 'BRK-SEP-001', attendance_id: 'ATT-20260904-EMPSTAFF', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-04', break_type: 'Tea Break', start_time: '11:15:00', end_time: '11:30:00', duration_minutes: '15', status: 'completed' },
    { id: 'BRK-SEP-002', attendance_id: 'ATT-20260904-EMPSTAFF', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-04', break_type: 'Lunch Break', start_time: '13:30:00', end_time: '14:15:00', duration_minutes: '45', status: 'completed' },
    { id: 'BRK-SEP-003', attendance_id: 'ATT-20260904-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-09-04', break_type: 'Tea Break', start_time: '11:00:00', end_time: '11:15:00', duration_minutes: '15', status: 'completed' },
    { id: 'BRK-SEP-004', attendance_id: 'ATT-20260904-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-09-04', break_type: 'Lunch Break', start_time: '13:15:00', end_time: '13:45:00', duration_minutes: '30', status: 'completed' }
  ];

  // 5. September Leaves
  const sepLeaves = [
    { id: 'LEV-SEP-001', employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', leave_type: 'Casual Leave', start_date: '2026-09-08', end_date: '2026-09-08', total_days: '1', reason: 'Family celebration ceremony', status: 'Approved', reviewed_by: 'System Admin' },
    { id: 'LEV-SEP-002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', leave_type: 'Medical Leave', start_date: '2026-09-15', end_date: '2026-09-16', total_days: '2', reason: 'Dental surgery and rest', status: 'Approved', reviewed_by: 'System Admin' },
    { id: 'LEV-SEP-003', employee_id: 'EMP-003', employee_name: 'Priya Sharma', leave_type: 'Paid Leave', start_date: '2026-09-22', end_date: '2026-09-24', total_days: '3', reason: 'Annual regional design conference', status: 'Approved', reviewed_by: 'System Admin' }
  ];

  // Fetch existing rows to avoid duplicate seeding
  const existingTasks = await getRows('WorkDone');
  const existingAtt = await getRows('Attendance');
  const existingBrk = await getRows('Breaks');
  const existingLev = await getRows('Leaves');

  console.log(`Current: ${existingTasks.length} tasks, ${existingAtt.length} attendance, ${existingBrk.length} breaks, ${existingLev.length} leaves.`);

  // Insert WorkDone tasks
  let tasksAdded = 0;
  for (const t of sepTasks) {
    const exists = existingTasks.some(x => x.employee_id === t.employee_id && x.date === t.date && x.task_title === t.task_title);
    if (!exists) {
      await addRow('WorkDone', {
        id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        created_at: new Date().toISOString(),
        ...t
      });
      tasksAdded++;
    }
  }
  console.log(`✅ Added ${tasksAdded} new WorkDone tasks for September 2026.`);

  // Insert Attendance records
  let attAdded = 0;
  for (const a of sepAttendance) {
    const exists = existingAtt.some(x => x.employee_id === a.employee_id && x.date === a.date);
    if (!exists) {
      await addRow('Attendance', {
        created_at: new Date().toISOString(),
        ...a
      });
      attAdded++;
    }
  }
  console.log(`✅ Added ${attAdded} new Attendance records for September 2026.`);

  // Insert Break records
  let brkAdded = 0;
  for (const b of sepBreaks) {
    const exists = existingBrk.some(x => x.employee_id === b.employee_id && x.date === b.date && x.break_type === b.break_type);
    if (!exists) {
      await addRow('Breaks', {
        created_at: new Date().toISOString(),
        ...b
      });
      brkAdded++;
    }
  }
  console.log(`✅ Added ${brkAdded} new Break records for September 2026.`);

  // Insert Leave records
  let levAdded = 0;
  for (const l of sepLeaves) {
    const exists = existingLev.some(x => x.employee_id === l.employee_id && x.start_date === l.start_date);
    if (!exists) {
      await addRow('Leaves', {
        applied_at: new Date().toISOString(),
        ...l
      });
      levAdded++;
    }
  }
  console.log(`✅ Added ${levAdded} new Leave records for September 2026.`);

  // 6. Support Tickets & Chat Messages
  const existingTickets = await getRows('Support_Tickets');
  if (existingTickets.length === 0) {
    const sampleTickets = [
      {
        id: 'TKT-SAMPLE-001',
        ticket_number: 'TKT-101',
        category: 'Attendance / Regularization',
        subject: 'Punch-in GPS time adjustment for Sep 2nd client visit',
        description: 'I visited the client site in the morning on Sep 2nd and need my morning punch-in regularized to 09:15 AM.',
        priority: 'High',
        status: 'In-Progress',
        creator_id: 'EMP-STAFF-01',
        creator_name: 'VS Groups Staff',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        resolution_notes: '',
        resolved_at: '',
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'TKT-SAMPLE-002',
        ticket_number: 'TKT-102',
        category: 'Payroll / Salary',
        subject: 'August Salary Slip & Tax Deduction Breakdown Query',
        description: 'Could management provide the official PDF copy of the August salary slip with the tax breakdown?',
        priority: 'Medium',
        status: 'Resolved',
        creator_id: 'EMP-002',
        creator_name: 'Alex Rivera',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        resolution_notes: 'Salary slip PDF sent to registered email.',
        resolved_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    for (const t of sampleTickets) {
      await addRow('Support_Tickets', t);
    }

    // Sample conversation messages for TKT-101
    await addRow('Ticket_Messages', {
      id: 'MSG-SAMPLE-001',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-STAFF-01',
      sender_name: 'VS Groups Staff',
      sender_role: 'employee',
      message: 'I visited the client site in the morning on Sep 2nd and need my morning punch-in regularized to 09:15 AM.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: new Date(Date.now() - 3600000 * 24).toISOString()
    });

    await addRow('Ticket_Messages', {
      id: 'MSG-SAMPLE-002',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-ADMIN-01',
      sender_name: 'Vimal Raj',
      sender_role: 'admin',
      message: 'Hi VS Groups Staff, please attach your client visit sign-off note so I can approve the 09:15 AM adjustment.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: new Date(Date.now() - 3600000 * 20).toISOString()
    });

    await addRow('Ticket_Messages', {
      id: 'MSG-SAMPLE-003',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-STAFF-01',
      sender_name: 'VS Groups Staff',
      sender_role: 'employee',
      message: 'Client visit verification email has been forwarded to info@shazusofttechnologies.org.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: new Date(Date.now() - 3600000 * 18).toISOString()
    });

    console.log('✅ Seeded sample support tickets & conversation messages.');
  }

  // 7. Company Broadcasts
  const existingBroadcasts = await getRows('Broadcasts');
  if (existingBroadcasts.length === 0) {
    await addRow('Broadcasts', {
      id: 'BCAST-SAMPLE-001',
      title: 'Company Operational Guidelines & Working Sunday Schedule Update',
      content: 'All team members are requested to log daily tasks in the Work Log by 6:30 PM. For any issues or clarifications, use the new Issue Resolution & Chat Hub.',
      priority: 'Normal',
      created_by_id: 'EMP-ADMIN-01',
      created_by_name: 'Vimal Raj',
      created_at: new Date().toISOString()
    });
    console.log('✅ Seeded initial company broadcast announcement.');
  }

  console.log('🎉 Full comprehensive business mock data seeding completed successfully!');
  process.exit(0);
}

seedFullBusinessData().catch(err => {
  console.error('❌ Error during data seeding:', err);
  process.exit(1);
});
