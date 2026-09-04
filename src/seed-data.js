import { initSheets, addRows, getRows } from './sheets.js';

async function seedFullBusinessData() {
  console.log('🚀 Starting Google Sheets Comprehensive Business Mock Data Seeding...');
  const connected = await initSheets();
  if (!connected) {
    console.error('❌ Failed to connect to Google Sheets. Check service.json & GOOGLE_SPREADSHEET_ID.');
    process.exit(1);
  }

  const existingEmployees = await getRows('Employees');
  console.log(`Current employees in DB: ${existingEmployees.length}`);

  const staffEmployees = existingEmployees.filter(e => e.role !== 'admin');
  const targetStaffIds = staffEmployees.length > 0 
    ? staffEmployees.map(e => ({ id: e.id, name: e.name }))
    : [
        { id: 'EMP-002', name: 'Alex Rivera' },
        { id: 'EMP-003', name: 'Priya Sharma' },
        { id: 'EMP-STAFF-01', name: 'VS Groups Staff' }
      ];

  console.log(`Seeding demo data for staff members:`, targetStaffIds);

  // ==========================================
  // 1. WORK DONE TASKS (September 2026 Active Month + August)
  // ==========================================
  const existingWorkDone = await getRows('WorkDone');
  const existingWorkDoneKeys = new Set(existingWorkDone.map(w => `${w.employee_id}_${w.date}_${w.task_title}`));

  const workDoneRecords = [];
  const addWork = (t) => {
    const key = `${t.employee_id}_${t.date}_${t.task_title}`;
    if (!existingWorkDoneKeys.has(key)) {
      workDoneRecords.push({
        id: `WD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        created_at: new Date().toISOString(),
        ...t
      });
      existingWorkDoneKeys.add(key);
    }
  };

  targetStaffIds.forEach(emp => {
    // 2026-09-01 (Tuesday)
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-01',
      project_name: 'HRMS Portal 2026',
      task_title: 'API Authentication & Token Refresh Flow',
      description: 'Implemented Axios request/response interceptors to automatically renew expired JWT tokens.',
      estimated_hours: '4.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Tested on multi-tab sessions. No session drops detected.'
    });
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-01',
      project_name: 'E-Commerce Platform',
      task_title: 'Checkout Cart Item Price Calculation Unit Tests',
      description: 'Wrote unit tests for tiered bulk quantity discounts and coupon code validation logic.',
      estimated_hours: '3.5',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'All 24 test cases passing with 100% assertion coverage.'
    });

    // 2026-09-02 (Wednesday)
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-02',
      project_name: 'HRMS Portal 2026',
      task_title: 'Haversine Office Geofence GPS Verification Engine',
      description: 'Created backend coordinate calculation to verify employee mobile GPS against office lat/long boundary.',
      estimated_hours: '4.5',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Verified accuracy within 15 meters radius.'
    });
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-02',
      project_name: 'Mobile App v2',
      task_title: 'Push Notification Token Registration API',
      description: 'Created backend endpoint to register Firebase FCM device tokens for real-time announcements.',
      estimated_hours: '3.0',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Integrated with Hostinger transaction email fallback.'
    });

    // 2026-09-03 (Thursday)
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-03',
      project_name: 'HRMS Portal 2026',
      task_title: 'Monthly Timesheet & Work Done Daily Dialog',
      description: 'Built interactive modal showing detailed task breakdown for each calendar day in staff history.',
      estimated_hours: '5.0',
      actual_hours: '5.5',
      status: 'Completed',
      remarks: 'Added project chips, actual hours sum, and management remarks.'
    });
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-03',
      project_name: 'Client Billing System',
      task_title: 'Timesheet CSV & PDF Export Utility',
      description: 'Exported day-by-day attendance and tasks report formatted for client invoicing.',
      estimated_hours: '3.0',
      actual_hours: '2.5',
      status: 'Completed',
      remarks: 'Verified CSV opening smoothly in Excel.'
    });

    // 2026-09-04 (Friday - Today)
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-04',
      project_name: 'HRMS Portal 2026',
      task_title: 'PWA Mobile Installation & Offline Cache Strategy',
      description: 'Configured progressive web app service worker, manifest shortcuts, and first-time bottom-sheet banner.',
      estimated_hours: '4.5',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Tested installation banner on Chrome Mobile and Desktop.'
    });
    addWork({
      employee_id: emp.id,
      employee_name: emp.name,
      date: '2026-09-04',
      project_name: 'HRMS Portal 2026',
      task_title: 'Global Search Palette (Ctrl+K) Indexing',
      description: 'Implemented quick multi-sheet fuzzy search for finding employees, tasks, reports, and attendance records.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'In-Progress',
      remarks: 'Keyboard navigation arrows and enter shortcut working.'
    });
  });

  if (workDoneRecords.length > 0) {
    console.log(`Writing ${workDoneRecords.length} WorkDone records in batch...`);
    await addRows('WorkDone', workDoneRecords);
  } else {
    console.log('WorkDone records already up to date.');
  }

  // ==========================================
  // 2. ATTENDANCE RECORDS (September 1 - September 4, 2026)
  // ==========================================
  const existingAttendance = await getRows('Attendance');
  const existingAttKeys = new Set(existingAttendance.map(a => `${a.employee_id}_${a.date}`));

  const attendanceRecords = [];
  targetStaffIds.forEach(emp => {
    const dates = [
      { date: '2026-09-01', in: '09:12:00', out: '18:15:00', tot: '9.05', brk: '0.80', net: '8.25', status: 'Present' },
      { date: '2026-09-02', in: '09:20:00', out: '18:25:00', tot: '9.08', brk: '0.75', net: '8.33', status: 'Present' },
      { date: '2026-09-03', in: '09:42:00', out: '18:30:00', tot: '8.80', brk: '0.70', net: '8.10', status: 'Late' },
      { date: '2026-09-04', in: '09:15:00', out: '18:15:00', tot: '9.00', brk: '1.00', net: '8.00', status: 'Present' }
    ];

    dates.forEach(d => {
      const key = `${emp.id}_${d.date}`;
      if (!existingAttKeys.has(key)) {
        attendanceRecords.push({
          id: `ATT-${d.date.replace(/-/g, '')}-${emp.id}`,
          date: d.date,
          employee_id: emp.id,
          employee_name: emp.name,
          login_time: d.in,
          logout_time: d.out,
          total_hours: d.tot,
          break_hours: d.brk,
          net_hours: d.net,
          status: d.status,
          punch_in_lat: '11.656910',
          punch_in_lng: '78.163598',
          punch_out_lat: '11.656910',
          punch_out_lng: '78.163598',
          in_geofence: 'TRUE',
          created_at: new Date().toISOString()
        });
        existingAttKeys.add(key);
      }
    });
  });

  if (attendanceRecords.length > 0) {
    console.log(`Writing ${attendanceRecords.length} Attendance records in batch...`);
    await addRows('Attendance', attendanceRecords);
  } else {
    console.log('Attendance records already up to date.');
  }

  // ==========================================
  // 3. BREAKS
  // ==========================================
  const existingBreaks = await getRows('Breaks');
  if (existingBreaks.length < 5) {
    const breakRecords = [];
    targetStaffIds.forEach(emp => {
      breakRecords.push({
        id: `BRK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        attendance_id: `ATT-20260904-${emp.id}`,
        employee_id: emp.id,
        employee_name: emp.name,
        date: '2026-09-04',
        break_type: 'Morning Tea',
        start_time: '11:15:00',
        end_time: '11:30:00',
        duration_minutes: '15',
        status: 'completed',
        created_at: new Date().toISOString()
      });
      breakRecords.push({
        id: `BRK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        attendance_id: `ATT-20260904-${emp.id}`,
        employee_id: emp.id,
        employee_name: emp.name,
        date: '2026-09-04',
        break_type: 'Lunch Break',
        start_time: '13:30:00',
        end_time: '14:15:00',
        duration_minutes: '45',
        status: 'completed',
        created_at: new Date().toISOString()
      });
    });
    console.log(`Writing ${breakRecords.length} Break records in batch...`);
    await addRows('Breaks', breakRecords);
  }

  // ==========================================
  // 4. LEAVES
  // ==========================================
  const existingLeaves = await getRows('Leaves');
  if (existingLeaves.length < 3) {
    const leaveRecords = [
      {
        id: `LEV-202609-001`,
        employee_id: targetStaffIds[0].id,
        employee_name: targetStaffIds[0].name,
        leave_type: 'Casual Leave',
        start_date: '2026-09-15',
        end_date: '2026-09-16',
        total_days: '2',
        reason: 'Attending family wedding ceremony out of town.',
        status: 'Approved',
        reviewed_by: 'Vimal Raj (System Admin)',
        applied_at: new Date().toISOString()
      },
      {
        id: `LEV-202609-002`,
        employee_id: targetStaffIds[1] ? targetStaffIds[1].id : targetStaffIds[0].id,
        employee_name: targetStaffIds[1] ? targetStaffIds[1].name : targetStaffIds[0].name,
        leave_type: 'Sick Leave',
        start_date: '2026-09-22',
        end_date: '2026-09-22',
        total_days: '1',
        reason: 'Scheduled health dental checkup.',
        status: 'Pending',
        reviewed_by: '',
        applied_at: new Date().toISOString()
      }
    ];
    console.log(`Writing ${leaveRecords.length} Leave records...`);
    await addRows('Leaves', leaveRecords);
  }

  // ==========================================
  // 5. REGULARIZATIONS
  // ==========================================
  const existingRegs = await getRows('Regularizations');
  if (existingRegs.length < 2) {
    const regRecords = [
      {
        id: `REG-202609-001`,
        employee_id: targetStaffIds[0].id,
        employee_name: targetStaffIds[0].name,
        date: '2026-09-03',
        requested_login_time: '09:15',
        requested_logout_time: '18:15',
        reason: 'Network connectivity delay at reception biometric punch.',
        status: 'Approved',
        reviewed_by_id: 'EMP-ADMIN-01',
        reviewed_by_name: 'Vimal Raj',
        review_remarks: 'Verified presence on office CCTV.',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `REG-202609-002`,
        employee_id: targetStaffIds[1] ? targetStaffIds[1].id : targetStaffIds[0].id,
        employee_name: targetStaffIds[1] ? targetStaffIds[1].name : targetStaffIds[0].name,
        date: '2026-09-02',
        requested_login_time: '09:20',
        requested_logout_time: '18:20',
        reason: 'Client production deployment call started before portal punch.',
        status: 'Pending',
        reviewed_by_id: '',
        reviewed_by_name: '',
        review_remarks: '',
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    console.log(`Writing ${regRecords.length} Regularization records...`);
    await addRows('Regularizations', regRecords);
  }

  // ==========================================
  // 6. WEEKLY REPORTS
  // ==========================================
  const existingReports = await getRows('Weekly_Reports');
  if (existingReports.length < 2) {
    const weeklyRecords = [
      {
        id: `WREP-2026-W36-${targetStaffIds[0].id}`,
        employee_id: targetStaffIds[0].id,
        employee_name: targetStaffIds[0].name,
        department: 'Software Engineering',
        week_number: '36',
        year: '2026',
        week_label: 'Week 36 (Aug 31 - Sep 04, 2026)',
        submission_date: '2026-09-04',
        accomplishments: 'Delivered PWA Service Worker caching, Geofence GPS verification, and Staff Timesheet View.',
        challenges_blockers: 'Resolved cross-origin session cookie handling on staging reverse proxy.',
        learnings_skills: 'Mastered Google Sheets API v4 batching and rate limiting architectures.',
        next_week_goals: 'Implement real-time push notifications and automated monthly payroll summary export.',
        status: 'Submitted',
        created_at: new Date().toISOString()
      }
    ];
    console.log(`Writing ${weeklyRecords.length} Weekly Report records...`);
    await addRows('Weekly_Reports', weeklyRecords);
  }

  // ==========================================
  // 7. SELF EVALUATIONS
  // ==========================================
  const existingEvals = await getRows('Self_Evaluations');
  if (existingEvals.length < 2) {
    const evalRecords = [
      {
        id: `EVAL-202608-${targetStaffIds[0].id}`,
        employee_id: targetStaffIds[0].id,
        employee_name: targetStaffIds[0].name,
        designation: 'Senior Full Stack Engineer',
        department: 'Engineering',
        reporting_person: 'Vimal Raj',
        review_month: '2026-08',
        review_period: 'August 2026',
        submission_date: '2026-08-31',
        monthly_work_summary: 'Successfully developed and deployed core modules for Shazusoft HRMS Enterprise Portal.',
        targets_tasks_json: JSON.stringify([
          { task: 'GPS Geofencing Integration', target: '100% stable', achieved: 'Achieved with Haversine math' },
          { task: 'Fastify Backend Routes', target: '11 route controllers', achieved: 'Completed and verified' }
        ]),
        ratings_json: JSON.stringify({
          quality_of_work: 5,
          job_knowledge: 5,
          productivity: 4,
          teamwork: 5,
          initiative: 5
        }),
        overall_rating: '4.8',
        key_accomplishments: 'Zero critical bugs reported in production. Reduced API response latency by 40%.',
        challenges_faced: 'Managing Google Spreadsheet API rate quotas during simultaneous team testing.',
        learning_development: 'Deepened expertise in Progressive Web Apps and Service Worker caching strategies.',
        areas_for_improvement: 'Increase automated end-to-end Cypress test coverage.',
        support_required: 'Cloud sandbox environment for staging CI/CD pipeline.',
        goals_next_month: 'Deliver Mobile App v2 release and automated payroll calculation.',
        employee_comments: 'Excited about the strong team velocity this month.',
        employee_declaration: 'I hereby declare that the information provided in this self-evaluation is true and accurate.',
        signature: targetStaffIds[0].name,
        manager_feedback: 'Outstanding technical leadership and rapid execution. Well done!',
        manager_rating: '5.0',
        status: 'Reviewed',
        created_at: new Date().toISOString()
      }
    ];
    console.log(`Writing ${evalRecords.length} Self Evaluation records...`);
    await addRows('Self_Evaluations', evalRecords);
  }

  // ==========================================
  // 8. ASSIGNED TASKS (Kanban Board)
  // ==========================================
  const existingAssigned = await getRows('Assigned_Tasks');
  if (existingAssigned.length < 4) {
    const sampleAssigned = [
      {
        id: `TASK-KANBAN-001`,
        task_title: 'Implement Geofencing & Google Sheets Sync',
        project_name: 'HRMS Portal 2026',
        description: 'Ensure Haversine GPS radius verification and 100% stable sync with Google Sheets API v4.',
        assigned_by_id: 'EMP-ADMIN-01',
        assigned_by_name: 'Vimal Raj',
        assigned_to_id: targetStaffIds[0].id,
        assigned_to_name: targetStaffIds[0].name,
        priority: 'High',
        due_date: '2026-09-08',
        estimated_hours: '12',
        actual_hours: '10',
        progress: '85',
        status: 'In-Progress',
        work_notes: 'Completed GPS calculation and sheets sync; adding cross-browser fallback.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `TASK-KANBAN-002`,
        task_title: 'PWA Offline Storage and Manifest Icons',
        project_name: 'HRMS Portal 2026',
        description: 'Create responsive home screen app download experience on iOS and Android.',
        assigned_by_id: 'EMP-ADMIN-01',
        assigned_by_name: 'Vimal Raj',
        assigned_to_id: targetStaffIds[0].id,
        assigned_to_name: targetStaffIds[0].name,
        priority: 'High',
        due_date: '2026-09-05',
        estimated_hours: '8',
        actual_hours: '8',
        progress: '100',
        status: 'Completed',
        work_notes: 'Service worker registered and bottom sheet banner active.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `TASK-KANBAN-003`,
        task_title: 'Global Search Keyboard Shortcuts (Ctrl+K)',
        project_name: 'HRMS Portal 2026',
        description: 'Search across staff timesheets, evaluations, and weekly reports instantly.',
        assigned_by_id: 'EMP-ADMIN-01',
        assigned_by_name: 'Vimal Raj',
        assigned_to_id: targetStaffIds[1] ? targetStaffIds[1].id : targetStaffIds[0].id,
        assigned_to_name: targetStaffIds[1] ? targetStaffIds[1].name : targetStaffIds[0].name,
        priority: 'Medium',
        due_date: '2026-09-10',
        estimated_hours: '6',
        actual_hours: '4',
        progress: '70',
        status: 'Review',
        work_notes: 'PR submitted for review.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `TASK-KANBAN-004`,
        task_title: 'Automated Monthly Payroll Calculation',
        project_name: 'HRMS Portal 2026',
        description: 'Compute total payable days deducting unpaid leaves and excessive break overages.',
        assigned_by_id: 'EMP-ADMIN-01',
        assigned_by_name: 'Vimal Raj',
        assigned_to_id: targetStaffIds[0].id,
        assigned_to_name: targetStaffIds[0].name,
        priority: 'High',
        due_date: '2026-09-25',
        estimated_hours: '16',
        actual_hours: '0',
        progress: '0',
        status: 'Pending',
        work_notes: 'Sprint planning item for next week.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    console.log(`Writing ${sampleAssigned.length} Assigned Tasks records...`);
    await addRows('Assigned_Tasks', sampleAssigned);
  }

  console.log('🎉 Google Sheets successfully populated with rich, comprehensive business demo data for all modules!');
  process.exit(0);
}

seedFullBusinessData().catch(err => {
  console.error('❌ Error during seeding:', err);
  process.exit(1);
});
