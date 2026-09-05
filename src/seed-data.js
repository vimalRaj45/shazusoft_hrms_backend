import { initDB, addRow, getRows, updateRow } from './db.js';
import bcrypt from 'bcryptjs';

async function seedFullBusinessData() {
  if (process.env.NODE_ENV === 'production' || !process.argv.includes('--allow-dev-seed')) {
    console.error('⛔ REFUSED: Mock data seeding is strictly disabled in production. Run with --allow-dev-seed flag only in local testing.');
    process.exit(1);
  }
  console.log('🚀 Starting Neon PostgreSQL Comprehensive 5-Staff Business Mock Data Seeding (September 2026)...');
  const connected = await initDB();
  if (!connected) {
    console.error('❌ Failed to connect to Neon PostgreSQL database.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. DEFINE 5 COMPLETE STAFF MEMBERS + 1 ADMIN
  const seedStaffMembers = [
    {
      id: 'EMP-ADMIN-01',
      name: 'Vimal Raj',
      email: 'admin@shazusoft.com',
      password_hash: passwordHash,
      role: 'admin',
      department: 'Executive Management',
      designation: 'Managing Director & CEO',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98765 00001',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      documents_frozen: true,
      frozen_at: '2026-08-15T10:30:00.000Z',
      frozen_by: 'EMP-ADMIN-01',
      frozen_by_name: 'Vimal Raj',
      personal_info: JSON.stringify({
        dob: '1990-05-15',
        gender: 'Male',
        blood_group: 'O+',
        marital_status: 'Married',
        personal_email: 'vimal.personal@gmail.com',
        alternate_phone: '+91 98765 00002',
        current_address: '42, Executive Residency, Anna Nagar, Chennai, Tamil Nadu - 600040',
        permanent_address: '42, Executive Residency, Anna Nagar, Chennai, Tamil Nadu - 600040'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'HDFC Bank',
        bank_account_number: '50100234567890',
        ifsc_code: 'HDFC0001234',
        account_holder_name: 'Vimal Raj',
        upi_id: 'vimalraj@okhdfcbank',
        pan_number: 'ABCDE1234F',
        aadhaar_number: '9876-5432-1098',
        uan_pf_number: '100987654321'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Sangeetha Raj',
        relationship: 'Spouse / Partner',
        contact_phone: '+91 98765 00003',
        alternate_phone: '+91 98765 00004'
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Vimal_Aadhaar_Card.pdf',
          size: '1.2 MB',
          uploaded_at: '2026-08-10T09:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Vimal_PAN_Card.jpg',
          size: '650 KB',
          uploaded_at: '2026-08-10T09:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'HDFC_Bank_Passbook.pdf',
          size: '1.8 MB',
          uploaded_at: '2026-08-10T09:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 100
    },

    // STAFF 1: Senior Full Stack Developer (In-Office, Frozen & Verified)
    {
      id: 'EMP-002',
      name: 'Priya Sharma',
      email: 'priya.sharma@shazusoft.com',
      password_hash: passwordHash,
      role: 'employee',
      department: 'Software Engineering',
      designation: 'Senior Full Stack Developer',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98765 11002',
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
      documents_frozen: true,
      frozen_at: '2026-08-20T14:15:00.000Z',
      frozen_by: 'EMP-ADMIN-01',
      frozen_by_name: 'Vimal Raj',
      personal_info: JSON.stringify({
        dob: '1994-08-22',
        gender: 'Female',
        blood_group: 'B+',
        marital_status: 'Single',
        personal_email: 'priya.sharma.dev@gmail.com',
        alternate_phone: '+91 98765 11003',
        current_address: '15, Tech Enclave, Velachery Main Road, Chennai - 600042',
        permanent_address: '88, Civil Lines, Jaipur, Rajasthan - 302006'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'ICICI Bank',
        bank_account_number: '001205001234',
        ifsc_code: 'ICIC0000012',
        account_holder_name: 'Priya Sharma',
        upi_id: 'priya@okhdfcbank',
        pan_number: 'BPRPS9821K',
        aadhaar_number: '6543-2109-8765',
        uan_pf_number: '101234567890'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Ramesh Sharma',
        relationship: 'Parent / Father / Mother',
        contact_phone: '+91 98765 11004',
        alternate_phone: ''
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Priya_Aadhaar_Proof.pdf',
          size: '980 KB',
          uploaded_at: '2026-08-18T11:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Priya_PAN_Copy.jpg',
          size: '520 KB',
          uploaded_at: '2026-08-18T11:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'ICICI_Cancelled_Cheque.pdf',
          size: '1.1 MB',
          uploaded_at: '2026-08-18T11:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'education_cert',
          name: 'BTech_Degree_Certificate.pdf',
          size: '2.4 MB',
          uploaded_at: '2026-08-18T11:15:00.000Z',
          url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'relieving_exp',
          name: 'Infosys_Relieving_Letter.pdf',
          size: '1.5 MB',
          uploaded_at: '2026-08-18T11:20:00.000Z',
          url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 100
    },

    // STAFF 2: Lead UI/UX Designer (Remote / WFH, Unfrozen)
    {
      id: 'EMP-003',
      name: 'Rahul Verma',
      email: 'rahul.verma@shazusoft.com',
      password_hash: passwordHash,
      role: 'employee',
      department: 'Product & Design',
      designation: 'Lead UI/UX Designer',
      work_mode: 'wfh',
      status: 'active',
      phone: '+91 98765 22003',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      documents_frozen: false,
      frozen_at: null,
      frozen_by: null,
      frozen_by_name: null,
      personal_info: JSON.stringify({
        dob: '1995-11-10',
        gender: 'Male',
        blood_group: 'A+',
        marital_status: 'Single',
        personal_email: 'rahul.designs@gmail.com',
        alternate_phone: '+91 98765 22004',
        current_address: '22/B, Indiranagar 100ft Road, Bengaluru, Karnataka - 560038',
        permanent_address: '104, Gomti Nagar, Lucknow, UP - 226010'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'Axis Bank',
        bank_account_number: '918010045678901',
        ifsc_code: 'UTIB0000123',
        account_holder_name: 'Rahul Verma',
        upi_id: 'rahulverma@okaxis',
        pan_number: 'CPRPV4412M',
        aadhaar_number: '4321-8765-2109',
        uan_pf_number: '102345678901'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Sunil Verma',
        relationship: 'Sibling / Brother / Sister',
        contact_phone: '+91 98765 22005',
        alternate_phone: ''
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Rahul_Passport_Copy.pdf',
          size: '1.4 MB',
          uploaded_at: '2026-08-25T16:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Rahul_PAN_Card.png',
          size: '480 KB',
          uploaded_at: '2026-08-25T16:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'Axis_Bank_Statement.pdf',
          size: '890 KB',
          uploaded_at: '2026-08-25T16:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 85
    },

    // STAFF 3: Quality Assurance & Automation Lead (In-Office, Frozen & Verified)
    {
      id: 'EMP-004',
      name: 'Ananya Patel',
      email: 'ananya.patel@shazusoft.com',
      password_hash: passwordHash,
      role: 'employee',
      department: 'Quality Assurance',
      designation: 'QA Automation Lead',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98765 33004',
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
      documents_frozen: true,
      frozen_at: '2026-08-22T12:00:00.000Z',
      frozen_by: 'EMP-ADMIN-01',
      frozen_by_name: 'Vimal Raj',
      personal_info: JSON.stringify({
        dob: '1996-03-14',
        gender: 'Female',
        blood_group: 'AB+',
        marital_status: 'Married',
        personal_email: 'ananya.patel.qa@gmail.com',
        alternate_phone: '+91 98765 33005',
        current_address: '7, Palm Meadows, OMR IT Corridor, Chennai - 600096',
        permanent_address: '52, Navrangpura, Ahmedabad, Gujarat - 380009'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'State Bank of India',
        bank_account_number: '20349811234',
        ifsc_code: 'SBIN0004567',
        account_holder_name: 'Ananya Patel',
        upi_id: 'ananya.patel@icici',
        pan_number: 'DPAPA1198L',
        aadhaar_number: '7890-1234-5678',
        uan_pf_number: '103456789012'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Kunal Patel',
        relationship: 'Spouse / Partner',
        contact_phone: '+91 98765 33006',
        alternate_phone: ''
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Ananya_Voter_ID.pdf',
          size: '850 KB',
          uploaded_at: '2026-08-20T10:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Ananya_PAN.jpg',
          size: '410 KB',
          uploaded_at: '2026-08-20T10:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'SBI_Passbook_Frontpage.pdf',
          size: '1.3 MB',
          uploaded_at: '2026-08-20T10:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'education_cert',
          name: 'Master_Computer_Science_Degree.pdf',
          size: '2.8 MB',
          uploaded_at: '2026-08-20T10:15:00.000Z',
          url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 100
    },

    // STAFF 4: DevOps & Cloud Infrastructure Specialist (Remote / WFH, Frozen & Verified)
    {
      id: 'EMP-005',
      name: 'Karthik Sundaram',
      email: 'karthik.sundaram@shazusoft.com',
      password_hash: passwordHash,
      role: 'employee',
      department: 'Cloud Infrastructure',
      designation: 'DevOps & SRE Specialist',
      work_mode: 'wfh',
      status: 'active',
      phone: '+91 98765 44005',
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      documents_frozen: true,
      frozen_at: '2026-08-24T15:30:00.000Z',
      frozen_by: 'EMP-ADMIN-01',
      frozen_by_name: 'Vimal Raj',
      personal_info: JSON.stringify({
        dob: '1993-07-19',
        gender: 'Male',
        blood_group: 'O-',
        marital_status: 'Married',
        personal_email: 'karthik.cloud@gmail.com',
        alternate_phone: '+91 98765 44006',
        current_address: '18, Kaloor Stadium Link Road, Kochi, Kerala - 682017',
        permanent_address: '18, Kaloor Stadium Link Road, Kochi, Kerala - 682017'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'Kotak Mahindra Bank',
        bank_account_number: '78119023456',
        ifsc_code: 'KKBK0000987',
        account_holder_name: 'Karthik Sundaram',
        upi_id: 'karthik.s@oksbi',
        pan_number: 'EPSPK5521N',
        aadhaar_number: '3456-7890-1234',
        uan_pf_number: '104567890123'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Meera Sundaram',
        relationship: 'Spouse / Partner',
        contact_phone: '+91 98765 44007',
        alternate_phone: ''
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Karthik_Passport.pdf',
          size: '1.6 MB',
          uploaded_at: '2026-08-22T09:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Karthik_PAN_Card.pdf',
          size: '540 KB',
          uploaded_at: '2026-08-22T09:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'Kotak_Passbook.pdf',
          size: '1.2 MB',
          uploaded_at: '2026-08-22T09:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'education_cert',
          name: 'BTech_IT_Degree.pdf',
          size: '2.1 MB',
          uploaded_at: '2026-08-22T09:15:00.000Z',
          url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'relieving_exp',
          name: 'TCS_Relieving_Experience.pdf',
          size: '1.7 MB',
          uploaded_at: '2026-08-22T09:20:00.000Z',
          url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 100
    },

    // STAFF 5: Junior Software Developer (In-Office, Unfrozen)
    {
      id: 'EMP-STAFF-01',
      name: 'VS Groups Staff',
      email: 'staff@shazusoft.com',
      password_hash: passwordHash,
      role: 'employee',
      department: 'Software Engineering',
      designation: 'Junior Software Engineer',
      work_mode: 'office',
      status: 'active',
      phone: '+91 98765 55006',
      avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&auto=format&fit=crop&q=80',
      documents_frozen: false,
      frozen_at: null,
      frozen_by: null,
      frozen_by_name: null,
      personal_info: JSON.stringify({
        dob: '1998-12-05',
        gender: 'Male',
        blood_group: 'B-',
        marital_status: 'Single',
        personal_email: 'vsstaff.engineer@gmail.com',
        alternate_phone: '+91 98765 55007',
        current_address: '10, Shanthi Colony, Anna Nagar, Chennai - 600040',
        permanent_address: '10, Shanthi Colony, Anna Nagar, Chennai - 600040'
      }),
      statutory_info: JSON.stringify({
        bank_name: 'HDFC Bank',
        bank_account_number: '50100987654321',
        ifsc_code: 'HDFC0001234',
        account_holder_name: 'VS Groups Staff',
        upi_id: 'staff@okhdfcbank',
        pan_number: 'FPSPS6632P',
        aadhaar_number: '1234-5678-9012',
        uan_pf_number: '105678901234'
      }),
      emergency_contacts: JSON.stringify({
        contact_name: 'Suresh Kumar',
        relationship: 'Parent / Father / Mother',
        contact_phone: '+91 98765 55008',
        alternate_phone: ''
      }),
      documents_json: JSON.stringify([
        {
          key: 'govt_id',
          name: 'Staff_Aadhaar_Card.pdf',
          size: '1.1 MB',
          uploaded_at: '2026-08-28T14:00:00.000Z',
          url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'pan_card',
          name: 'Staff_PAN_Copy.jpg',
          size: '620 KB',
          uploaded_at: '2026-08-28T14:05:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80'
        },
        {
          key: 'bank_proof',
          name: 'HDFC_Passbook.pdf',
          size: '950 KB',
          uploaded_at: '2026-08-28T14:10:00.000Z',
          url: 'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=800&auto=format&fit=crop&q=80'
        }
      ]),
      profile_completeness: 85
    }
  ];

  // Upsert all 6 staff/admin members
  console.log('📌 Upserting 6 staff & admin members with full statutory & compliance documents...');
  const existingEmployees = await getRows('Employees');

  for (const emp of seedStaffMembers) {
    const existing = existingEmployees.find(e => e.id === emp.id || e.email === emp.email);
    if (existing) {
      await updateRow('Employees', existing.id, emp);
      console.log(`  ✔ Updated employee ${emp.id} (${emp.name})`);
    } else {
      await addRow('Employees', {
        ...emp,
        created_at: new Date().toISOString()
      });
      console.log(`  ✔ Inserted new employee ${emp.id} (${emp.name})`);
    }
  }

  // 2. DAILY ATTENDANCE RECORDS FOR SEPTEMBER 1 to 5, 2026
  console.log('📌 Generating rich multi-day attendance records for all staff...');
  const existingAttendance = await getRows('Attendance');
  const demoDates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];

  const attendanceTemplates = [
    { empId: 'EMP-002', name: 'Priya Sharma', inTime: '09:15', outTime: '18:45', netHrs: '9.5', status: 'Punched Out', geofence: 'TRUE' },
    { empId: 'EMP-003', name: 'Rahul Verma', inTime: '09:30', outTime: '18:30', netHrs: '9.0', status: 'Punched Out', geofence: 'WFH' },
    { empId: 'EMP-004', name: 'Ananya Patel', inTime: '09:20', outTime: '18:35', netHrs: '9.2', status: 'Punched Out', geofence: 'TRUE' },
    { empId: 'EMP-005', name: 'Karthik Sundaram', inTime: '09:00', outTime: '18:15', netHrs: '9.2', status: 'Punched Out', geofence: 'WFH' },
    { empId: 'EMP-STAFF-01', name: 'VS Groups Staff', inTime: '09:25', outTime: '18:40', netHrs: '9.2', status: 'Punched Out', geofence: 'TRUE' }
  ];

  let attCount = 0;
  for (const dt of demoDates) {
    for (const t of attendanceTemplates) {
      const isToday = dt === '2026-09-05';
      const statusToday = isToday ? 'Present & Working' : t.status;
      const logoutToday = isToday ? null : t.outTime;
      const netHoursToday = isToday ? '5.5' : t.netHrs;

      const exists = existingAttendance.find(a => a.employee_id === t.empId && a.date === dt);
      if (!exists) {
        await addRow('Attendance', {
          date: dt,
          employee_id: t.empId,
          employee_name: t.name,
          login_time: t.inTime,
          logout_time: logoutToday,
          total_hours: netHoursToday,
          break_hours: '0.0',
          net_hours: netHoursToday,
          status: statusToday,
          punch_in_lat: 13.0827,
          punch_in_lng: 80.2707,
          punch_out_lat: logoutToday ? 13.0827 : null,
          punch_out_lng: logoutToday ? 80.2707 : null,
          in_geofence: t.geofence,
          created_at: `${dt}T09:15:00.000Z`
        });
        attCount++;
      }
    }
  }
  console.log(`  ✔ Added ${attCount} new Attendance records.`);

  // 3. DAILY WORK DONE TASKS
  console.log('📌 Generating multi-staff daily work done tasks for September 2026...');
  const existingTasks = await getRows('WorkDone');
  const sampleTasks = [
    // Priya Sharma
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-01', project_name: 'Core Engine', task_title: 'PostgreSQL Connection Pooling Optimization', description: 'Tuned connection pool size with SSL retry handlers.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Passed load tests.' },
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-02', project_name: 'HRMS API', task_title: 'Cloudflare R2 Document Upload & Freeze Flow', description: 'Implemented secure S3 client wrapper for document storage and lock verification.', estimated_hours: '5.0', actual_hours: '5.5', status: 'Completed', remarks: 'Validated SHA256 integrity.' },
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-03', project_name: 'HRMS API', task_title: 'Fastify RBAC Middleware Guards', description: 'Protected admin endpoints from unauthorized role escalation.', estimated_hours: '3.5', actual_hours: '3.5', status: 'Completed', remarks: 'Tested edge case tokens.' },
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-04', project_name: 'Payroll Engine', task_title: 'UPI Virtual Payment Address Resolver', description: 'Added regex and validation for UPI handles across major banks.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Supports okaxis, okhdfc, oksbi.' },
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-05', project_name: 'Payroll Engine', task_title: 'Real-time Payout Verification Webhook', description: 'Built webhook listener to confirm instant UPI disbursement.', estimated_hours: '4.0', actual_hours: '3.0', status: 'In-Progress', remarks: 'Testing sandbox endpoints.' },

    // Rahul Verma
    { employee_id: 'EMP-003', employee_name: 'Rahul Verma', date: '2026-09-01', project_name: 'Design System', task_title: 'Emerald Green & Navy Professional Theme', description: 'Configured design tokens and high-contrast accessibility palette.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Reviewed by design committee.' },
    { employee_id: 'EMP-003', employee_name: 'Rahul Verma', date: '2026-09-02', project_name: 'Design System', task_title: 'Staff Compliance Document Viewer UI Specs', description: 'Created Figma prototypes for compliance audit modal and verification status chips.', estimated_hours: '5.0', actual_hours: '4.5', status: 'Completed', remarks: 'Exported SVG icons.' },
    { employee_id: 'EMP-003', employee_name: 'Rahul Verma', date: '2026-09-03', project_name: 'Mobile App', task_title: 'Responsive Bottom Nav & Drawer Component', description: 'Designed bottom navigation bar for mobile staff portal.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Smooth transitions implemented.' },
    { employee_id: 'EMP-003', employee_name: 'Rahul Verma', date: '2026-09-04', project_name: 'Dashboard UI', task_title: 'Live Presence Board & Timesheet Visuals', description: 'Built color-coded presence tags and GPS pin indicators.', estimated_hours: '4.5', actual_hours: '4.5', status: 'Completed', remarks: 'Verified on Retina displays.' },

    // Ananya Patel
    { employee_id: 'EMP-004', employee_name: 'Ananya Patel', date: '2026-09-01', project_name: 'Test Automation', task_title: 'Playwright E2E Test Suite for Attendance Punch', description: 'Automated GPS location spoofing scenarios and geofence boundary tests.', estimated_hours: '4.5', actual_hours: '4.5', status: 'Completed', remarks: '100% test pass rate.' },
    { employee_id: 'EMP-004', employee_name: 'Ananya Patel', date: '2026-09-02', project_name: 'Test Automation', task_title: 'Security Boundary & JWT Expiry Regression Tests', description: 'Executed 40 comprehensive endpoint security checks.', estimated_hours: '5.0', actual_hours: '5.0', status: 'Completed', remarks: 'All 40 assertions passing.' },
    { employee_id: 'EMP-004', employee_name: 'Ananya Patel', date: '2026-09-03', project_name: 'Compliance Audit', task_title: 'Staff Document Freezing RBAC Test Suite', description: 'Verified that non-admin staff cannot delete or modify frozen documents.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: '403 Forbidden verified.' },
    { employee_id: 'EMP-004', employee_name: 'Ananya Patel', date: '2026-09-04', project_name: 'Performance QA', task_title: 'Database Load & Query Benchmarking', description: 'Ran 500 concurrent request simulation against Neon PostgreSQL.', estimated_hours: '4.0', actual_hours: '3.5', status: 'Completed', remarks: 'Average latency under 45ms.' },

    // Karthik Sundaram
    { employee_id: 'EMP-005', employee_name: 'Karthik Sundaram', date: '2026-09-01', project_name: 'Infrastructure', task_title: 'Cloudflare R2 Bucket CORS & IAM Access Policies', description: 'Configured restrictive CORS rules and S3 presigned URL policies.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Zero public read access.' },
    { employee_id: 'EMP-005', employee_name: 'Karthik Sundaram', date: '2026-09-02', project_name: 'DevOps & CI/CD', task_title: 'GitHub Actions Automated Deploy Pipeline', description: 'Created build check and automated lint verification on pull requests.', estimated_hours: '4.5', actual_hours: '4.5', status: 'Completed', remarks: 'Fast pipeline under 90s.' },
    { employee_id: 'EMP-005', employee_name: 'Karthik Sundaram', date: '2026-09-03', project_name: 'Security & Monitoring', task_title: 'Prometheus & Grafana Dashboard Setup', description: 'Set up real-time server health and API response time monitoring.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Health endpoints monitored.' },
    { employee_id: 'EMP-005', employee_name: 'Karthik Sundaram', date: '2026-09-04', project_name: 'Disaster Recovery', task_title: 'Automated Daily Database Snapshot & Encryption', description: 'Configured automated PostgreSQL daily snapshots with AES-256 backup.', estimated_hours: '3.5', actual_hours: '3.5', status: 'Completed', remarks: 'Tested restore procedure.' },

    // VS Groups Staff
    { employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-01', project_name: 'Client Portal', task_title: 'API Authentication & Token Refresh Flow', description: 'Built secure JWT token rotation and session interceptors.', estimated_hours: '4.0', actual_hours: '4.5', status: 'Completed', remarks: 'Validated across reload scenarios.' },
    { employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-02', project_name: 'Mobile App', task_title: 'PWA Service Worker Caching & Offline Fallback', description: 'Configured runtime caching for web application icons and bundles.', estimated_hours: '5.0', actual_hours: '4.5', status: 'Completed', remarks: 'Offline verified.' },
    { employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-03', project_name: 'E-Commerce', task_title: 'Stripe Payment Webhook & Checkout Verification', description: 'Implemented webhook listener for successful order events.', estimated_hours: '4.0', actual_hours: '4.0', status: 'Completed', remarks: 'Zero transaction errors.' },
    { employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-04', project_name: 'Geofence System', task_title: 'Haversine Office Boundary Radius Verification', description: 'Enhanced GPS geolocation punch with real-time distance precision.', estimated_hours: '4.0', actual_hours: '4.5', status: 'Completed', remarks: 'Tested within 150m perimeter.' }
  ];

  let taskAdded = 0;
  for (const t of sampleTasks) {
    const exists = existingTasks.find(x => x.employee_id === t.employee_id && x.date === t.date && x.task_title === t.task_title);
    if (!exists) {
      await addRow('WorkDone', {
        created_at: `${t.date}T18:30:00.000Z`,
        ...t
      });
      taskAdded++;
    }
  }
  console.log(`  ✔ Added ${taskAdded} daily work done tasks.`);

  // 4. LEAVES & PERMISSIONS
  console.log('📌 Generating leave and permission pass records...');
  const existingLeaves = await getRows('Leaves');
  const sampleLeaves = [
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', leave_type: 'Casual Leave', start_date: '2026-09-10', end_date: '2026-09-11', total_days: '2', reason: 'Attending family wedding in hometown.', status: 'Approved', reviewed_by: 'Vimal Raj' },
    { employee_id: 'EMP-003', employee_name: 'Rahul Verma', leave_type: 'Sick Leave', start_date: '2026-09-08', end_date: '2026-09-08', total_days: '1', reason: 'Mild viral fever, advised one day rest.', status: 'Pending', reviewed_by: '' },
    { employee_id: 'EMP-004', employee_name: 'Ananya Patel', leave_type: 'Earned Leave', start_date: '2026-09-22', end_date: '2026-09-25', total_days: '4', reason: 'Annual planned family vacation.', status: 'Approved', reviewed_by: 'Vimal Raj' }
  ];

  let levAdded = 0;
  for (const l of sampleLeaves) {
    const exists = existingLeaves.find(x => x.employee_id === l.employee_id && x.start_date === l.start_date);
    if (!exists) {
      await addRow('Leaves', {
        applied_at: new Date().toISOString(),
        ...l
      });
      levAdded++;
    }
  }
  console.log(`  ✔ Added ${levAdded} leave applications.`);

  // Short 2-Hour Permissions
  const existingPerms = await getRows('Permissions');
  const samplePerms = [
    { employee_id: 'EMP-STAFF-01', employee_name: 'VS Groups Staff', date: '2026-09-03', start_time: '16:00', end_time: '18:00', duration_hours: '2.0', reason: 'Personal bank document verification.', status: 'Approved', reviewed_by: 'Vimal Raj' },
    { employee_id: 'EMP-002', employee_name: 'Priya Sharma', date: '2026-09-05', start_time: '16:30', end_time: '18:30', duration_hours: '2.0', reason: 'Doctor consultation appointment.', status: 'Pending', reviewed_by: '' }
  ];

  for (const p of samplePerms) {
    const exists = existingPerms.find(x => x.employee_id === p.employee_id && x.date === p.date);
    if (!exists) {
      await addRow('Permissions', {
        applied_at: new Date().toISOString(),
        ...p
      });
    }
  }

  // 5. MONTHLY SELF-EVALUATIONS & APPRAISALS
  console.log('📌 Generating staff monthly self-evaluations...');
  const existingEvals = await getRows('Self_Evaluations');
  const sampleEvals = [
    {
      employee_id: 'EMP-002',
      employee_name: 'Priya Sharma',
      designation: 'Senior Full Stack Developer',
      department: 'Software Engineering',
      reporting_person: 'Vimal Raj',
      review_month: 'August 2026',
      review_period: 'Monthly Appraisal',
      submission_date: '2026-08-31',
      monthly_work_summary: 'Delivered Neon PostgreSQL connection pooling, fast Fastify RBAC architecture, and Cloudflare R2 storage integration.',
      targets_tasks_json: JSON.stringify([
        { task_desc: 'Neon PostgreSQL migration & schema optimization', target_output: '100% zero downtime and under 50ms query latency', achieved_output: 'Achieved 42ms average response time across 40 endpoints', status: 'Completed', remarks: 'Exceeded KPI expectations' },
        { task_desc: 'Cloudflare R2 Encrypted Document Vault', target_output: 'Complete S3 file upload, delete, and download service', achieved_output: 'Successfully built with automated client-side compression', status: 'Completed', remarks: 'Production ready' }
      ]),
      ratings_json: JSON.stringify({ technical_skill: 5, communication: 4, punctuality: 5, initiative: 5, team_collaboration: 5 }),
      overall_rating: '4.8',
      key_accomplishments: 'Zero critical security vulnerabilities; 100% test pass on backend API suite.',
      challenges_faced: 'Handling SSL cert connection pool limits during high concurrent load.',
      learning_development: 'Deepened mastery of Fastify v4 streaming multipart upload pipelines.',
      areas_for_improvement: 'Enhance automated unit test mocking for external SMTP email services.',
      support_required: 'Dedicated staging database branch for CI/CD automated pipeline.',
      goals_next_month: 'Complete UPI payroll disbursement and multi-tenant audit logs.',
      employee_comments: 'Thank you management for the continuous engineering support.',
      employee_declaration: 'TRUE',
      signature: 'Priya Sharma',
      manager_feedback: 'Outstanding technical leadership and high delivery velocity.',
      manager_rating: '5.0',
      status: 'Reviewed',
      created_at: '2026-08-31T17:00:00.000Z'
    },
    {
      employee_id: 'EMP-004',
      employee_name: 'Ananya Patel',
      designation: 'QA Automation Lead',
      department: 'Quality Assurance',
      reporting_person: 'Vimal Raj',
      review_month: 'August 2026',
      review_period: 'Monthly Appraisal',
      submission_date: '2026-08-31',
      monthly_work_summary: 'Authored 40 comprehensive API test cases and Playwright end-to-end regression scripts.',
      targets_tasks_json: JSON.stringify([
        { task_desc: 'Full API test suite covering all 10 modules', target_output: '40/40 test assertions passing', achieved_output: '100% pass rate achieved with zero failures', status: 'Completed', remarks: 'Excellent quality metrics' }
      ]),
      ratings_json: JSON.stringify({ technical_skill: 5, communication: 5, punctuality: 5, initiative: 4, team_collaboration: 5 }),
      overall_rating: '4.9',
      key_accomplishments: 'Built robust edge-case coverage for geofence and document freeze RBAC.',
      challenges_faced: 'Simulating complex geolocation edge cases across varying mobile browsers.',
      learning_development: 'Mastered Playwright network interceptors and automated PDF report inspection.',
      areas_for_improvement: 'Conduct team-wide workshops on writing unit tests for frontend hooks.',
      support_required: 'BrowserStack cloud subscription for multi-device regression testing.',
      goals_next_month: 'Implement automated visual regression testing for all dashboard themes.',
      employee_comments: 'Appreciate the positive and collaborative engineering culture.',
      employee_declaration: 'TRUE',
      signature: 'Ananya Patel',
      manager_feedback: 'Exceptional attention to edge cases and rigorous test automation.',
      manager_rating: '5.0',
      status: 'Reviewed',
      created_at: '2026-08-31T17:30:00.000Z'
    }
  ];

  for (const ev of sampleEvals) {
    const exists = existingEvals.find(x => x.employee_id === ev.employee_id && x.review_month === ev.review_month);
    if (!exists) {
      await addRow('Self_Evaluations', ev);
    }
  }

  // 6. SUPPORT TICKETS & REAL-TIME CONVERSATIONS
  console.log('📌 Generating live support tickets and message conversations...');
  const existingTickets = await getRows('Support_Tickets');
  if (existingTickets.length === 0) {
    const sampleTickets = [
      {
        id: 'TKT-SAMPLE-001',
        ticket_number: 'TKT-101',
        category: 'Attendance / Regularization',
        subject: 'Morning client site visit punch regularization for Sep 2nd',
        description: 'Visited the client location in Guindy at 9:00 AM. Need punch-in adjusted to 09:15 AM.',
        priority: 'High',
        status: 'In-Progress',
        creator_id: 'EMP-STAFF-01',
        creator_name: 'VS Groups Staff',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        resolution_notes: '',
        resolved_at: '',
        created_at: '2026-09-02T10:00:00.000Z',
        updated_at: new Date().toISOString()
      },
      {
        id: 'TKT-SAMPLE-002',
        ticket_number: 'TKT-102',
        category: 'Payroll / Salary',
        subject: 'August Salary Slip & Tax Deduction Breakdown Copy',
        description: 'Could HR please provide the signed salary slip PDF with PF and tax breakdown for August?',
        priority: 'Medium',
        status: 'Resolved',
        creator_id: 'EMP-002',
        creator_name: 'Priya Sharma',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        resolution_notes: 'Salary slip PDF generated and dispatched to registered email.',
        resolved_at: '2026-09-03T14:00:00.000Z',
        created_at: '2026-09-03T09:00:00.000Z',
        updated_at: '2026-09-03T14:00:00.000Z'
      },
      {
        id: 'TKT-SAMPLE-003',
        ticket_number: 'TKT-103',
        category: 'Workstation / IT',
        subject: 'Dual Monitor HDMI Cable & Docking Station Request',
        description: 'Requesting a USB-C multi-port adapter for dual 4K monitor setup in office workstation.',
        priority: 'Low',
        status: 'Open',
        creator_id: 'EMP-004',
        creator_name: 'Ananya Patel',
        assigned_to_id: 'EMP-ADMIN-01',
        assigned_to_name: 'Vimal Raj',
        resolution_notes: '',
        resolved_at: '',
        created_at: '2026-09-04T11:00:00.000Z',
        updated_at: new Date().toISOString()
      }
    ];

    for (const t of sampleTickets) {
      await addRow('Support_Tickets', t);
    }

    // Ticket Messages
    await addRow('Ticket_Messages', {
      id: 'MSG-001',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-STAFF-01',
      sender_name: 'VS Groups Staff',
      sender_role: 'employee',
      message: 'Visited the client location in Guindy at 9:00 AM. Need punch-in adjusted to 09:15 AM.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: '2026-09-02T10:00:00.000Z'
    });

    await addRow('Ticket_Messages', {
      id: 'MSG-002',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-ADMIN-01',
      sender_name: 'Vimal Raj',
      sender_role: 'admin',
      message: 'Hi VS Groups Staff, please attach your client visit sign-off email so I can regularize your punch.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: '2026-09-02T11:30:00.000Z'
    });

    await addRow('Ticket_Messages', {
      id: 'MSG-003',
      ticket_id: 'TKT-SAMPLE-001',
      sender_id: 'EMP-STAFF-01',
      sender_name: 'VS Groups Staff',
      sender_role: 'employee',
      message: 'Client visit verification email has been forwarded to info@shazusofttechnologies.org.',
      attachment_url: '',
      is_internal_note: 'FALSE',
      created_at: '2026-09-02T12:00:00.000Z'
    });
  }

  // 7. BROADCAST ANNOUNCEMENTS
  console.log('📌 Generating corporate broadcast announcements...');
  const existingBroadcasts = await getRows('Broadcasts');
  if (existingBroadcasts.length === 0) {
    await addRow('Broadcasts', {
      id: 'BCAST-001',
      title: 'Company Operational Guidelines & Working Sunday Schedule Update',
      content: 'All team members are requested to log daily tasks in the Work Log by 6:30 PM. For any issues or clarifications, use the new Issue Resolution & Chat Hub.',
      priority: 'Normal',
      created_by_id: 'EMP-ADMIN-01',
      created_by_name: 'Vimal Raj',
      created_at: new Date().toISOString()
    });
  }

  console.log('🎉 Full comprehensive 5-staff business mock data seeding completed successfully with 100% database integrity!');
  process.exit(0);
}

seedFullBusinessData().catch(err => {
  console.error('❌ Error during data seeding:', err);
  process.exit(1);
});
