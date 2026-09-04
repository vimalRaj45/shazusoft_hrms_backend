import { initSheets, addRow, getRows } from './sheets.js';
import bcrypt from 'bcryptjs';

async function seedFullBusinessData() {
  console.log('🚀 Starting Google Sheets Comprehensive Business Mock Data Seeding...');
  const connected = await initSheets();
  if (!connected) {
    console.error('❌ Failed to connect to Google Sheets. Check service.json & GOOGLE_SPREADSHEET_ID.');
    process.exit(1);
  }

  // 1. Ensure Employees Exist
  const existingEmployees = await getRows('Employees');
  console.log(`Current employees in DB: ${existingEmployees.length}`);

  const targetMonth = '2026-08';

  // 2. Comprehensive Work Done Tasks (Realistic Business Projects & Activities)
  const mockTasks = [
    // Alex Rivera (Senior Full Stack Developer - EMP-002)
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-01',
      project_name: 'E-Commerce Portal',
      task_title: 'Stripe Payment Gateway Webhook Integration',
      description: 'Implemented automated webhook listener for successful checkouts, invoice generation, and failure retries.',
      estimated_hours: '4.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Encountered TLS timeout on test sandbox; resolved with keep-alive socket config.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-01',
      project_name: 'E-Commerce Portal',
      task_title: 'Checkout Cart State Persistence',
      description: 'Built Redux toolkit slice for syncing cart items across desktop and mobile browsers.',
      estimated_hours: '3.0',
      actual_hours: '3.0',
      status: 'Completed',
      remarks: 'Tested on Safari, Chrome, and Firefox.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-02',
      project_name: 'HRMS Portal',
      task_title: 'GPS Geofencing Distance Calculation Module',
      description: 'Created backend Haversine formula calculation to verify employee coordinates against office boundary.',
      estimated_hours: '3.5',
      actual_hours: '3.0',
      status: 'Completed',
      remarks: 'Delivered 30 mins ahead of schedule.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-02',
      project_name: 'HRMS Portal',
      task_title: 'Google Sheets API Rate Limiter & Batching',
      description: 'Implemented in-memory queue to batch write requests and prevent 429 quota exceed errors.',
      estimated_hours: '4.0',
      actual_hours: '5.0',
      status: 'Completed',
      remarks: 'Required additional retry logic for concurrent burst traffic.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-03',
      project_name: 'Mobile App v2',
      task_title: 'Push Notification Service for Order Updates',
      description: 'Integrated Firebase Cloud Messaging (FCM) for real-time order tracking notifications.',
      estimated_hours: '5.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Tested background notifications on Android 14 and iOS 17.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-03',
      project_name: 'Mobile App v2',
      task_title: 'Biometric FaceID / Fingerprint Login',
      description: 'Added React Native biometric authentication library with keychain secure token storage.',
      estimated_hours: '3.0',
      actual_hours: '3.0',
      status: 'Completed',
      remarks: 'All security standards validated.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-04',
      project_name: 'Client Billing System',
      task_title: 'Automated Invoice PDF Generation Engine',
      description: 'Developed Puppeteer HTML-to-PDF template generator for monthly client timesheet summaries.',
      estimated_hours: '6.0',
      actual_hours: '7.5',
      status: 'Completed',
      remarks: 'Custom CSS print formatting took longer than expected.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-05',
      project_name: 'E-Commerce Portal',
      task_title: 'Product Catalog Elasticsearch Indexing',
      description: 'Configured fuzzy search filters for auto-complete product queries with category ranking.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Search query latency reduced by 65%.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-05',
      project_name: 'DevOps & Infrastructure',
      task_title: 'Docker Multi-Stage Build & CI Pipeline Optimization',
      description: 'Refactored backend container Dockerfiles reducing production image size from 850MB to 140MB.',
      estimated_hours: '3.5',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Deployment speed doubled.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-06',
      project_name: 'HRMS Portal',
      task_title: 'End-of-Month Analytics Aggregator',
      description: 'Wrote aggregation queries to compute attendance percentage, break time deductions, and task throughput.',
      estimated_hours: '4.5',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Ready for management dashboard review.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-07',
      project_name: 'E-Commerce Portal',
      task_title: 'Redis Caching for Trending Products API',
      description: 'Configured Redis cache with 15-minute TTL to reduce database query load during peak traffic.',
      estimated_hours: '3.0',
      actual_hours: '2.5',
      status: 'Completed',
      remarks: 'Response time dropped from 180ms to 12ms.'
    },
    {
      employee_id: 'EMP-002',
      employee_name: 'Alex Rivera',
      date: '2026-08-08',
      project_name: 'Mobile App v2',
      task_title: 'Offline Sync & SQLite Database Caching',
      description: 'Enabled offline mode where user actions queue locally and sync automatically when internet restores.',
      estimated_hours: '6.0',
      actual_hours: '7.0',
      status: 'In-Progress',
      remarks: 'Resolving conflict resolution edge cases when online status switches.'
    },

    // Priya Sharma (UI/UX Product Designer - EMP-003)
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-01',
      project_name: 'HRMS Portal',
      task_title: 'Executive Dashboard UI/UX Wireframes & Component Specs',
      description: 'Created high-fidelity Figma designs for Live Presence board, KPI cards, and Geofence status pills.',
      estimated_hours: '5.0',
      actual_hours: '5.0',
      status: 'Completed',
      remarks: 'Handed design tokens over to frontend dev team.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-01',
      project_name: 'HRMS Portal',
      task_title: 'Mobile View Responsiveness & Dark Mode Tokens',
      description: 'Designed mobile drawer navigation and dark mode color contrast ratios for WCAG AA compliance.',
      estimated_hours: '3.0',
      actual_hours: '2.5',
      status: 'Completed',
      remarks: 'Delivered ahead of schedule.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-02',
      project_name: 'E-Commerce Portal',
      task_title: 'Checkout Flow Redesign & Usability Testing',
      description: 'Conducted 5 user interviews on multi-step checkout; reduced form fields to streamline user drop-off.',
      estimated_hours: '6.0',
      actual_hours: '6.5',
      status: 'Completed',
      remarks: 'Identified payment gateway UX confusion; added visual card security badges.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-03',
      project_name: 'Mobile App v2',
      task_title: 'Onboarding Flow Animation & Micro-interactions',
      description: 'Designed interactive Lottie onboarding animations for welcome screen and push notification permissions.',
      estimated_hours: '4.5',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Exported JSON assets ready for mobile dev integration.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-04',
      project_name: 'Client Billing System',
      task_title: 'Invoice PDF Design Template & Print Stylesheet',
      description: 'Created corporate branded layout for downloadable timesheets and invoices.',
      estimated_hours: '3.5',
      actual_hours: '3.5',
      status: 'Completed',
      remarks: 'Aligned with Shazusoft brand guidelines.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-05',
      project_name: 'E-Commerce Portal',
      task_title: 'Product Reviews & Ratings Interactive Modal',
      description: 'Designed photo upload preview, verified buyer badge, and star rating interactions.',
      estimated_hours: '4.0',
      actual_hours: '4.0',
      status: 'Completed',
      remarks: 'Approved by product manager.'
    },
    {
      employee_id: 'EMP-003',
      employee_name: 'Priya Sharma',
      date: '2026-08-06',
      project_name: 'Mobile App v2',
      task_title: 'User Profile & Order Tracking Timeline Component',
      description: 'Designed live tracking stepper showing Ordered -> Processed -> Dispatched -> Delivered.',
      estimated_hours: '4.0',
      actual_hours: '4.5',
      status: 'Completed',
      remarks: 'Added courier live map mockup.'
    }
  ];

  // 3. Comprehensive Attendance Records
  const mockAttendance = [
    // Alex Rivera
    { id: 'ATT-20260801-EMP002', date: '2026-08-01', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:12:00', logout_time: '18:15:00', total_hours: '9.05', break_hours: '1.00', net_hours: '8.05', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260802-EMP002', date: '2026-08-02', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:05:00', logout_time: '18:00:00', total_hours: '8.92', break_hours: '0.75', net_hours: '8.17', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260803-EMP002', date: '2026-08-03', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:48:00', logout_time: '18:30:00', total_hours: '8.70', break_hours: '0.80', net_hours: '7.90', status: 'Late', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260804-EMP002', date: '2026-08-04', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:15:00', logout_time: '18:45:00', total_hours: '9.50', break_hours: '1.00', net_hours: '8.50', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260805-EMP002', date: '2026-08-05', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:10:00', logout_time: '18:00:00', total_hours: '8.83', break_hours: '0.75', net_hours: '8.08', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260806-EMP002', date: '2026-08-06', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:08:00', logout_time: '18:10:00', total_hours: '9.03', break_hours: '0.85', net_hours: '8.18', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260807-EMP002', date: '2026-08-07', employee_id: 'EMP-002', employee_name: 'Alex Rivera', login_time: '09:20:00', logout_time: '18:00:00', total_hours: '8.67', break_hours: '0.70', net_hours: '7.97', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },

    // Priya Sharma
    { id: 'ATT-20260801-EMP003', date: '2026-08-01', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:15:00', logout_time: '18:00:00', total_hours: '8.75', break_hours: '0.80', net_hours: '7.95', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260802-EMP003', date: '2026-08-02', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:10:00', logout_time: '18:20:00', total_hours: '9.17', break_hours: '0.75', net_hours: '8.42', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260803-EMP003', date: '2026-08-03', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:05:00', logout_time: '18:00:00', total_hours: '8.92', break_hours: '0.70', net_hours: '8.22', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260804-EMP003', date: '2026-08-04', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:18:00', logout_time: '18:00:00', total_hours: '8.70', break_hours: '0.75', net_hours: '7.95', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260805-EMP003', date: '2026-08-05', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:12:00', logout_time: '18:15:00', total_hours: '9.05', break_hours: '0.80', net_hours: '8.25', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' },
    { id: 'ATT-20260806-EMP003', date: '2026-08-06', employee_id: 'EMP-003', employee_name: 'Priya Sharma', login_time: '09:15:00', logout_time: '18:00:00', total_hours: '8.75', break_hours: '0.75', net_hours: '8.00', status: 'Present', punch_in_lat: '12.9716', punch_in_lng: '77.5945', punch_out_lat: '12.9716', punch_out_lng: '77.5945', in_geofence: 'TRUE' }
  ];

  // 4. Breaks Taken
  const mockBreaks = [
    { id: 'BRK-001', attendance_id: 'ATT-20260801-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-01', break_type: 'Tea Break', start_time: '11:15:00', end_time: '11:30:00', duration_minutes: '15', status: 'completed' },
    { id: 'BRK-002', attendance_id: 'ATT-20260801-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-01', break_type: 'Lunch Break', start_time: '13:30:00', end_time: '14:15:00', duration_minutes: '45', status: 'completed' },
    { id: 'BRK-003', attendance_id: 'ATT-20260802-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-02', break_type: 'Tea Break', start_time: '11:00:00', end_time: '11:15:00', duration_minutes: '15', status: 'completed' },
    { id: 'BRK-004', attendance_id: 'ATT-20260802-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-02', break_type: 'Lunch Break', start_time: '13:15:00', end_time: '13:45:00', duration_minutes: '30', status: 'completed' },
    { id: 'BRK-005', attendance_id: 'ATT-20260803-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-03', break_type: 'Tea Break', start_time: '11:30:00', end_time: '11:48:00', duration_minutes: '18', status: 'completed' },
    { id: 'BRK-006', attendance_id: 'ATT-20260803-EMP002', employee_id: 'EMP-002', employee_name: 'Alex Rivera', date: '2026-08-03', break_type: 'Lunch Break', start_time: '13:30:00', end_time: '14:00:00', duration_minutes: '30', status: 'completed' }
  ];

  // 5. Leaves Records
  const mockLeaves = [
    { id: 'LEV-001', employee_id: 'EMP-002', employee_name: 'Alex Rivera', leave_type: 'Casual Leave', start_date: '2026-08-14', end_date: '2026-08-15', total_days: '2', reason: 'Personal family commitment', status: 'Approved', reviewed_by: 'System Admin' },
    { id: 'LEV-002', employee_id: 'EMP-003', employee_name: 'Priya Sharma', leave_type: 'Sick Leave', start_date: '2026-08-20', end_date: '2026-08-20', total_days: '1', reason: 'Fever and doctor visit', status: 'Approved', reviewed_by: 'System Admin' },
    { id: 'LEV-003', employee_id: 'EMP-002', employee_name: 'Alex Rivera', leave_type: 'Paid Leave', start_date: '2026-09-10', end_date: '2026-09-12', total_days: '3', reason: 'Annual vacation trip', status: 'Pending', reviewed_by: '' }
  ];

  // Insert WorkDone Tasks
  console.log(`Writing ${mockTasks.length} WorkDone tasks to Google Sheets...`);
  for (const t of mockTasks) {
    await addRow('WorkDone', { id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, created_at: new Date().toISOString(), ...t });
  }

  // Insert Attendance Records
  console.log(`Writing ${mockAttendance.length} Attendance records to Google Sheets...`);
  for (const a of mockAttendance) {
    await addRow('Attendance', { created_at: new Date().toISOString(), ...a });
  }

  // Insert Break Records
  console.log(`Writing ${mockBreaks.length} Break records to Google Sheets...`);
  for (const b of mockBreaks) {
    await addRow('Breaks', { created_at: new Date().toISOString(), ...b });
  }

  // Insert Leaves
  console.log(`Writing ${mockLeaves.length} Leave records to Google Sheets...`);
  for (const l of mockLeaves) {
    await addRow('Leaves', { applied_at: new Date().toISOString(), ...l });
  }

  console.log('✅ Google Sheets successfully populated with comprehensive business mock data!');
  process.exit(0);
}

seedFullBusinessData().catch(err => {
  console.error('Error seeding mock data:', err);
  process.exit(1);
});
