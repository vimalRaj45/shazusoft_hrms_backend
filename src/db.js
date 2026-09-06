import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

// Map Application Model names to PostgreSQL table names
const TABLE_MAP = {
  Employees: 'employees',
  Attendance: 'attendance',
  Breaks: 'breaks',
  WorkDone: 'work_done',
  Leaves: 'leaves',
  Permissions: 'permissions',
  Self_Evaluations: 'self_evaluations',
  Assigned_Tasks: 'assigned_tasks',
  Regularizations: 'regularizations',
  Communications_Log: 'communications_log',
  Weekly_Reports: 'weekly_reports',
  AI_Reports: 'ai_reports',
  Holidays: 'holidays',
  Support_Tickets: 'support_tickets',
  Ticket_Messages: 'ticket_messages',
  Broadcasts: 'broadcasts',
  Push_Subscriptions: 'push_subscriptions',
  Leave_Policies: 'leave_policies',
  Salary_Structures: 'salary_structures',
  Monthly_Payrolls: 'monthly_payrolls',
  In_App_Notifications: 'in_app_notifications'
};

const TABLE_HEADERS = {
  In_App_Notifications: [
    'id', 'user_id', 'title', 'message', 'type', 'target_tab', 'target_url', 'is_read', 'created_at'
  ],
  Leave_Policies: [
    'id', 'policy_key', 'monthly_casual_leave', 'monthly_sick_leave', 'monthly_paid_leave',
    'monthly_permission_limit', 'max_permission_hours', 'updated_at', 'updated_by'
  ],
  Salary_Structures: [
    'id', 'employee_id', 'employee_name', 'department', 'designation',
    'monthly_salary', 'bank_name', 'account_number', 'ifsc_code', 'upi_id', 'pan_number',
    'updated_at', 'updated_by'
  ],
  Monthly_Payrolls: [
    'id', 'payroll_month', 'employee_id', 'employee_name', 'department', 'designation',
    'monthly_salary', 'daily_rate', 'total_working_days', 'present_days', 'paid_leaves',
    'lop_days', 'lop_deduction', 'net_payable', 'status', 'payment_mode', 'payment_date',
    'payment_reference', 'remarks', 'generated_at', 'generated_by', 'paid_at', 'paid_by'
  ],
  Employees: [
    'id', 'name', 'email', 'password_hash', 'role', 'department', 'designation', 'work_mode', 'status',
    'phone', 'avatar_url', 'personal_info', 'statutory_info', 'emergency_contacts', 'documents_json', 'profile_completeness',
    'documents_frozen', 'frozen_at', 'frozen_by', 'frozen_by_name',
    'created_at'
  ],
  Attendance: ['id', 'date', 'employee_id', 'employee_name', 'login_time', 'logout_time', 'total_hours', 'break_hours', 'net_hours', 'status', 'punch_in_lat', 'punch_in_lng', 'punch_out_lat', 'punch_out_lng', 'in_geofence', 'created_at'],
  Breaks: ['id', 'attendance_id', 'employee_id', 'employee_name', 'date', 'break_type', 'start_time', 'end_time', 'duration_minutes', 'status', 'created_at'],
  WorkDone: ['id', 'date', 'employee_id', 'employee_name', 'project_name', 'task_title', 'description', 'estimated_hours', 'actual_hours', 'status', 'remarks', 'created_at'],
  Leaves: ['id', 'employee_id', 'employee_name', 'leave_type', 'start_date', 'end_date', 'total_days', 'reason', 'status', 'reviewed_by', 'applied_at'],
  Permissions: ['id', 'employee_id', 'employee_name', 'date', 'start_time', 'end_time', 'duration_hours', 'reason', 'status', 'reviewed_by', 'applied_at'],
  Self_Evaluations: [
    'id', 'employee_id', 'employee_name', 'designation', 'department', 'reporting_person', 'review_month', 'review_period', 'submission_date',
    'monthly_work_summary', 'targets_tasks_json', 'ratings_json', 'overall_rating', 'key_accomplishments', 'challenges_faced',
    'learning_development', 'areas_for_improvement', 'support_required', 'goals_next_month', 'employee_comments',
    'employee_declaration', 'signature', 'manager_feedback', 'manager_rating', 'status', 'created_at'
  ],
  Assigned_Tasks: [
    'id', 'task_title', 'project_name', 'description', 'assigned_by_id', 'assigned_by_name',
    'assigned_to_id', 'assigned_to_name', 'priority', 'due_date', 'estimated_hours',
    'actual_hours', 'progress', 'status', 'work_notes', 'created_at', 'updated_at'
  ],
  Regularizations: [
    'id', 'employee_id', 'employee_name', 'date', 'requested_login_time', 'requested_logout_time',
    'reason', 'status', 'reviewed_by_id', 'reviewed_by_name', 'review_remarks', 'applied_at', 'updated_at'
  ],
  Communications_Log: [
    'id', 'type', 'sender_id', 'sender_name', 'recipient_id', 'recipient_name', 'subject', 'message', 'metadata_json', 'created_at'
  ],
  Weekly_Reports: [
    'id', 'employee_id', 'employee_name', 'department', 'week_number', 'year', 'week_label',
    'submission_date', 'accomplishments', 'challenges_blockers', 'learnings_skills', 'next_week_goals',
    'status', 'created_at'
  ],
  AI_Reports: ['id', 'month_year', 'target', 'attendance_rate', 'task_completion_rate', 'avg_daily_hours', 'summary', 'productivity_score', 'key_insights', 'generated_at'],
  Holidays: ['id', 'date', 'name', 'type', 'created_by', 'created_at'],
  Support_Tickets: ['id', 'ticket_number', 'category', 'subject', 'description', 'priority', 'status', 'creator_id', 'creator_name', 'assigned_to_id', 'assigned_to_name', 'resolution_notes', 'resolved_at', 'created_at', 'updated_at'],
  Ticket_Messages: ['id', 'ticket_id', 'sender_id', 'sender_name', 'sender_role', 'message', 'attachment_url', 'is_internal_note', 'created_at'],
  Broadcasts: ['id', 'title', 'content', 'priority', 'created_by_id', 'created_by_name', 'created_at'],
  Push_Subscriptions: ['id', 'employee_id', 'endpoint', 'p256dh', 'auth', 'user_agent', 'created_at']
};

let pgPool = null;
let isConnected = false;

// In-Memory Fallback if database is temporarily offline
const memoryDB = {
  Employees: [],
  Attendance: [],
  Breaks: [],
  WorkDone: [],
  Leaves: [],
  Permissions: [],
  Self_Evaluations: [],
  Assigned_Tasks: [],
  Regularizations: [],
  Communications_Log: [],
  Weekly_Reports: [],
  AI_Reports: [],
  Holidays: [],
  Support_Tickets: [],
  Ticket_Messages: [],
  Broadcasts: [],
  Push_Subscriptions: [],
  Leave_Policies: [],
  Salary_Structures: [],
  Monthly_Payrolls: [],
  In_App_Notifications: []
};

// 15-second cache for high-speed read operations
const CACHE_TTL_MS = 15000;
const readCache = {};

function getCachedData(tableName) {
  const cached = readCache[tableName];
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }
  return null;
}

function setCachedData(tableName, data) {
  readCache[tableName] = {
    data: [...data],
    timestamp: Date.now()
  };
  memoryDB[tableName] = [...data];
}

export function invalidateCache(tableName) {
  if (tableName) {
    delete readCache[tableName];
  } else {
    for (const key of Object.keys(readCache)) {
      delete readCache[key];
    }
  }
}

/**
 * Auto-create all 13 PostgreSQL tables
 */
async function initTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'employee',
      department VARCHAR(100),
      designation VARCHAR(100),
      work_mode VARCHAR(50) DEFAULT 'office',
      status VARCHAR(50) DEFAULT 'active',
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id VARCHAR(100) PRIMARY KEY,
      date TEXT NOT NULL,
      employee_id VARCHAR(50) NOT NULL,
      employee_name VARCHAR(150),
      login_time TEXT,
      logout_time TEXT,
      total_hours TEXT,
      break_hours TEXT,
      net_hours TEXT,
      status TEXT,
      punch_in_lat TEXT,
      punch_in_lng TEXT,
      punch_out_lat TEXT,
      punch_out_lng TEXT,
      in_geofence TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS breaks (
      id VARCHAR(100) PRIMARY KEY,
      attendance_id VARCHAR(100),
      employee_id VARCHAR(50),
      employee_name VARCHAR(150),
      date TEXT,
      break_type TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_minutes TEXT,
      status TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS work_done (
      id VARCHAR(100) PRIMARY KEY,
      date TEXT,
      employee_id VARCHAR(50),
      employee_name VARCHAR(150),
      project_name TEXT,
      task_title TEXT,
      description TEXT,
      estimated_hours TEXT,
      actual_hours TEXT,
      status TEXT,
      remarks TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS leaves (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name VARCHAR(150),
      leave_type TEXT,
      start_date TEXT,
      end_date TEXT,
      total_days TEXT,
      reason TEXT,
      status TEXT,
      reviewed_by TEXT,
      applied_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name VARCHAR(150),
      date TEXT,
      start_time TEXT,
      end_time TEXT,
      duration_hours TEXT,
      reason TEXT,
      status TEXT,
      reviewed_by TEXT,
      applied_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS self_evaluations (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name VARCHAR(150),
      designation TEXT,
      department TEXT,
      reporting_person TEXT,
      review_month TEXT,
      review_period TEXT,
      submission_date TEXT,
      monthly_work_summary TEXT,
      targets_tasks_json TEXT,
      ratings_json TEXT,
      overall_rating TEXT,
      key_accomplishments TEXT,
      challenges_faced TEXT,
      learning_development TEXT,
      areas_for_improvement TEXT,
      support_required TEXT,
      goals_next_month TEXT,
      employee_comments TEXT,
      employee_declaration TEXT,
      signature TEXT,
      manager_feedback TEXT,
      manager_rating TEXT,
      status TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS assigned_tasks (
      id VARCHAR(100) PRIMARY KEY,
      task_title TEXT,
      project_name TEXT,
      description TEXT,
      assigned_by_id VARCHAR(50),
      assigned_by_name TEXT,
      assigned_to_id VARCHAR(50),
      assigned_to_name TEXT,
      priority TEXT,
      due_date TEXT,
      estimated_hours TEXT,
      actual_hours TEXT,
      progress TEXT,
      status TEXT,
      work_notes TEXT,
      created_at TEXT,
      updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS regularizations (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name TEXT,
      date TEXT,
      requested_login_time TEXT,
      requested_logout_time TEXT,
      reason TEXT,
      status TEXT,
      reviewed_by_id TEXT,
      reviewed_by_name TEXT,
      review_remarks TEXT,
      applied_at TEXT,
      updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS communications_log (
      id VARCHAR(100) PRIMARY KEY,
      type TEXT,
      sender_id TEXT,
      sender_name TEXT,
      recipient_id TEXT,
      recipient_name TEXT,
      subject TEXT,
      message TEXT,
      metadata_json TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS weekly_reports (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50),
      employee_name TEXT,
      department TEXT,
      week_number TEXT,
      year TEXT,
      week_label TEXT,
      submission_date TEXT,
      accomplishments TEXT,
      challenges_blockers TEXT,
      learnings_skills TEXT,
      next_week_goals TEXT,
      status TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS ai_reports (
      id VARCHAR(100) PRIMARY KEY,
      month_year TEXT,
      target TEXT,
      attendance_rate TEXT,
      task_completion_rate TEXT,
      avg_daily_hours TEXT,
      summary TEXT,
      productivity_score TEXT,
      key_insights TEXT,
      performance_gaps TEXT,
      strategic_suggestions TEXT,
      next_month_roadmap TEXT,
      generated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS holidays (
      id VARCHAR(100) PRIMARY KEY,
      date TEXT UNIQUE,
      name TEXT,
      type TEXT,
      created_by TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id VARCHAR(100) PRIMARY KEY,
      ticket_number TEXT UNIQUE,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Open',
      creator_id VARCHAR(50) NOT NULL,
      creator_name TEXT NOT NULL,
      assigned_to_id VARCHAR(50),
      assigned_to_name TEXT,
      resolution_notes TEXT,
      resolved_at TEXT,
      created_at TEXT,
      updated_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS ticket_messages (
      id VARCHAR(100) PRIMARY KEY,
      ticket_id VARCHAR(100) NOT NULL,
      sender_id VARCHAR(50) NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      attachment_url TEXT,
      is_internal_note TEXT DEFAULT 'FALSE',
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS broadcasts (
      id VARCHAR(100) PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      priority TEXT DEFAULT 'Normal',
      created_by_id VARCHAR(50) NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50) NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS leave_policies (
      id VARCHAR(100) PRIMARY KEY,
      policy_key VARCHAR(100) UNIQUE NOT NULL,
      monthly_casual_leave NUMERIC DEFAULT 1,
      monthly_sick_leave NUMERIC DEFAULT 1,
      monthly_paid_leave NUMERIC DEFAULT 1,
      monthly_permission_limit INT DEFAULT 2,
      max_permission_hours INT DEFAULT 2,
      updated_at TEXT,
      updated_by TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS salary_structures (
      id VARCHAR(100) PRIMARY KEY,
      employee_id VARCHAR(50) UNIQUE NOT NULL,
      employee_name TEXT,
      department TEXT,
      designation TEXT,
      monthly_salary NUMERIC DEFAULT 0,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      upi_id TEXT,
      pan_number TEXT,
      updated_at TEXT,
      updated_by TEXT
    );`,
    `CREATE TABLE IF NOT EXISTS monthly_payrolls (
      id VARCHAR(100) PRIMARY KEY,
      payroll_month VARCHAR(7) NOT NULL,
      employee_id VARCHAR(50) NOT NULL,
      employee_name TEXT,
      department TEXT,
      designation TEXT,
      monthly_salary NUMERIC DEFAULT 0,
      daily_rate NUMERIC DEFAULT 0,
      total_working_days NUMERIC DEFAULT 0,
      present_days NUMERIC DEFAULT 0,
      paid_leaves NUMERIC DEFAULT 0,
      lop_days NUMERIC DEFAULT 0,
      lop_deduction NUMERIC DEFAULT 0,
      net_payable NUMERIC DEFAULT 0,
      status VARCHAR(20) DEFAULT 'Pending',
      payment_mode TEXT,
      payment_date TEXT,
      payment_reference TEXT,
      remarks TEXT,
      generated_at TEXT,
      generated_by TEXT,
      paid_at TEXT,
      paid_by TEXT,
      UNIQUE(payroll_month, employee_id)
    );`,
    `CREATE TABLE IF NOT EXISTS in_app_notifications (
      id VARCHAR(100) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      target_tab VARCHAR(50),
      target_url TEXT,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TEXT
    );`,
    `CREATE INDEX IF NOT EXISTS idx_in_app_notif_user ON in_app_notifications (user_id, is_read);`
  ];

  for (const q of queries) {
    await pgPool.query(q);
  }

  const migrations = [
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_info TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS statutory_info TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contacts TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS documents_json TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS profile_completeness INT DEFAULT 0;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS documents_frozen BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS frozen_at TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS frozen_by TEXT;`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS frozen_by_name TEXT;`,
    `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS review_remarks TEXT;`,
    `ALTER TABLE ai_reports ADD COLUMN IF NOT EXISTS performance_gaps TEXT;`,
    `ALTER TABLE ai_reports ADD COLUMN IF NOT EXISTS strategic_suggestions TEXT;`,
    `ALTER TABLE ai_reports ADD COLUMN IF NOT EXISTS next_month_roadmap TEXT;`
  ];

  for (const m of migrations) {
    try {
      await pgPool.query(m);
    } catch (e) {
      // Column may already exist
    }
  }
}

/**
 * Ensure root administrator account exists if database is newly initialized
 * Strictly NO mock data or test users are seeded on server startup.
 */
async function ensureRootAdminExists() {
  const rootAdmin = {
    id: 'EMP-ADMIN-01',
    name: 'Vimal Raj',
    email: 'vimalraj5207@gmail.com',
    password_hash: 'OTP_AUTH_ENABLED',
    role: 'admin',
    department: 'Executive Management',
    designation: 'Managing Director & Administrator',
    work_mode: 'office',
    status: 'active',
    created_at: new Date().toISOString()
  };

  const existing = await getRows('Employees');
  if (existing.length === 0) {
    await addRow('Employees', rootAdmin);
    console.log('[PostgreSQL] Initialized root administrator account (vimalraj5207@gmail.com).');
  } else {
    console.log(`[PostgreSQL] Ready in production mode (${existing.length} registered employee accounts). Automated mock seeding: DISABLED.`);
  }
}

/**
 * Initialize PostgreSQL Database Connection
 */
export async function initDB() {
  if (!config.databaseUrl) {
    console.warn('[PostgreSQL] DATABASE_URL not set in .env. Running in in-memory mode.');
    await ensureRootAdminExists();
    return false;
  }

  try {
    pgPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false }
    });

    const client = await pgPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    console.log('[PostgreSQL] Connected successfully to Neon PostgreSQL database.');
    await initTables();
    isConnected = true;
    await ensureRootAdminExists();
    return true;
  } catch (err) {
    console.error('[PostgreSQL] Connection error:', err.message);
    isConnected = false;
    await ensureRootAdminExists();
    return false;
  }
}

export function getStatus() {
  return {
    database: isConnected ? 'Neon PostgreSQL (Connected)' : 'In-Memory Fallback',
    connectedToPostgres: isConnected
  };
}

function getTableName(name) {
  return TABLE_MAP[name] || name.toLowerCase();
}

/**
 * Get all rows from a table
 */
export async function getRows(tableName) {
  // 1. Check TTL cache
  const cached = getCachedData(tableName);
  if (cached) return cached;

  // 2. Query Neon PostgreSQL
  if (isConnected && pgPool) {
    try {
      const sqlTable = getTableName(tableName);
      const res = await pgPool.query(`SELECT * FROM ${sqlTable}`);
      const rows = res.rows.map(r => {
        const clean = {};
        for (const [k, v] of Object.entries(r)) {
          if (tableName === 'Employees' && k === 'documents_frozen') {
            clean[k] = Boolean(v === true || v === 'true' || v === 't');
          } else if (tableName === 'In_App_Notifications' && k === 'is_read') {
            clean[k] = Boolean(v === true || v === 'true' || v === 't');
          } else {
            clean[k] = v === null || v === undefined ? '' : String(v);
          }
        }
        return clean;
      });
      setCachedData(tableName, rows);
      return rows;
    } catch (err) {
      console.error(`[PostgreSQL] Error reading ${tableName}:`, err.message);
    }
  }

  return memoryDB[tableName] || [];
}

/**
 * Add a row to a table
 */
export async function addRow(tableName, rowData) {
  const cleanData = { ...rowData };
  const headers = TABLE_HEADERS[tableName] || Object.keys(cleanData);
  headers.forEach(h => {
    if (tableName === 'Employees' && h === 'profile_completeness') {
      cleanData[h] = parseInt(cleanData[h], 10) || 0;
    } else if (tableName === 'Employees' && h === 'documents_frozen') {
      cleanData[h] = Boolean(cleanData[h] === true || cleanData[h] === 'true' || cleanData[h] === 't');
    } else if (tableName === 'In_App_Notifications' && h === 'is_read') {
      cleanData[h] = Boolean(cleanData[h] === true || cleanData[h] === 'true' || cleanData[h] === 't');
    } else if (cleanData[h] === undefined || cleanData[h] === null) {
      cleanData[h] = '';
    } else if (typeof cleanData[h] === 'object') {
      cleanData[h] = JSON.stringify(cleanData[h]);
    } else {
      cleanData[h] = String(cleanData[h]);
    }
  });

  // 1. PostgreSQL Insert
  if (isConnected && pgPool) {
    try {
      const sqlTable = getTableName(tableName);
      const cols = headers.filter(h => cleanData[h] !== undefined);
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = cols.map(c => cleanData[c]);

      const query = `
        INSERT INTO ${sqlTable} (${cols.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET
        ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}
        RETURNING *
      `;

      const res = await pgPool.query(query, values);
      const saved = res.rows[0] ? { ...cleanData, ...res.rows[0] } : cleanData;
      
      if (!memoryDB[tableName]) memoryDB[tableName] = [];
      memoryDB[tableName].push(saved);
      invalidateCache(tableName);
      return saved;
    } catch (err) {
      console.error(`[PostgreSQL] Error adding to ${tableName}:`, err.message);
      throw err;
    }
  }

  // 2. Memory Fallback
  if (!memoryDB[tableName]) memoryDB[tableName] = [];
  memoryDB[tableName].push(cleanData);
  setCachedData(tableName, memoryDB[tableName]);
  return cleanData;
}

/**
 * Update a specific row matching a field value (e.g. id)
 */
export async function updateRow(tableName, matchField, matchValue, updateData) {
  // 1. PostgreSQL Update
  if (isConnected && pgPool) {
    try {
      const sqlTable = getTableName(tableName);
      const keys = Object.keys(updateData);
      if (keys.length > 0) {
        const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const values = keys.map(k => {
          const val = updateData[k];
          if (tableName === 'Employees' && k === 'profile_completeness') return parseInt(val, 10) || 0;
          if (tableName === 'Employees' && k === 'documents_frozen') return Boolean(val === true || val === 'true' || val === 't');
          if (tableName === 'In_App_Notifications' && k === 'is_read') return Boolean(val === true || val === 'true' || val === 't');
          if (typeof val === 'object' && val !== null) return JSON.stringify(val);
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val;
          return String(val ?? '');
        });
        values.push(String(matchValue));

        const query = `
          UPDATE ${sqlTable}
          SET ${setClauses}
          WHERE ${matchField} = $${values.length}
          RETURNING *
        `;

        const res = await pgPool.query(query, values);
        if (res.rows.length > 0) {
          const updated = res.rows[0];
          const clean = {};
          for (const [k, v] of Object.entries(updated)) {
            if (tableName === 'Employees' && k === 'documents_frozen') {
              clean[k] = Boolean(v === true || v === 'true' || v === 't');
            } else if (tableName === 'In_App_Notifications' && k === 'is_read') {
              clean[k] = Boolean(v === true || v === 'true' || v === 't');
            } else {
              clean[k] = v === null || v === undefined ? '' : String(v);
            }
          }
          invalidateCache(tableName);
          return clean;
        }
      }
    } catch (err) {
      console.error(`[PostgreSQL] Error updating ${tableName}:`, err.message);
      throw err;
    }
  }

  // 2. Memory Fallback
  let updatedRecord = null;
  const list = memoryDB[tableName] || [];
  const idx = list.findIndex(r => String(r[matchField]) === String(matchValue));
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updateData };
    updatedRecord = list[idx];
    setCachedData(tableName, list);
  }

  return updatedRecord;
}

/**
 * Delete a specific row matching a field value
 */
export async function deleteRow(tableName, matchField, matchValue) {
  // 1. PostgreSQL Delete
  if (isConnected && pgPool) {
    try {
      const sqlTable = getTableName(tableName);
      const res = await pgPool.query(
        `DELETE FROM ${sqlTable} WHERE ${matchField} = $1 RETURNING *`,
        [String(matchValue)]
      );
      invalidateCache(tableName);
      return (res.rowCount || 0) > 0;
    } catch (err) {
      console.error(`[PostgreSQL] Error deleting from ${tableName}:`, err.message);
    }
  }

  // 2. Memory Fallback
  const list = memoryDB[tableName] || [];
  const initialLength = list.length;
  memoryDB[tableName] = list.filter(r => String(r[matchField]) !== String(matchValue));
  setCachedData(tableName, memoryDB[tableName]);
  return memoryDB[tableName].length < initialLength;
}

/**
 * Get the active Monthly Leave Quotas and Permission limits
 */
export async function getLeavePolicy() {
  const policies = await getRows('Leave_Policies');
  const defaultPolicy = policies.find(p => p.policy_key === 'default');
  if (defaultPolicy) {
    return {
      casual_leave: parseFloat(defaultPolicy.monthly_casual_leave) || 1,
      sick_leave: parseFloat(defaultPolicy.monthly_sick_leave) || 1,
      paid_leave: parseFloat(defaultPolicy.monthly_paid_leave) || 1,
      monthly_permission_limit: parseInt(defaultPolicy.monthly_permission_limit, 10) || 2,
      max_permission_hours: parseInt(defaultPolicy.max_permission_hours, 10) || 2,
      updated_at: defaultPolicy.updated_at || null,
      updated_by: defaultPolicy.updated_by || 'System Default'
    };
  }
  return {
    casual_leave: 1,
    sick_leave: 1,
    paid_leave: 1,
    monthly_permission_limit: 2,
    max_permission_hours: 2,
    updated_at: null,
    updated_by: 'System Default'
  };
}

/**
 * Admin update for Monthly Leave Quotas and Permission limits
 */
export async function updateLeavePolicy(policyData, adminUser = 'Admin') {
  const existing = await getRows('Leave_Policies');
  const found = existing.find(p => p.policy_key === 'default');
  const now = new Date().toISOString();
  const record = {
    policy_key: 'default',
    monthly_casual_leave: parseFloat(policyData.casual_leave ?? policyData.monthly_casual_leave) || 1,
    monthly_sick_leave: parseFloat(policyData.sick_leave ?? policyData.monthly_sick_leave) || 1,
    monthly_paid_leave: parseFloat(policyData.paid_leave ?? policyData.monthly_paid_leave) || 1,
    monthly_permission_limit: parseInt(policyData.monthly_permission_limit, 10) || 2,
    max_permission_hours: parseInt(policyData.max_permission_hours, 10) || 2,
    updated_at: now,
    updated_by: adminUser
  };

  if (found) {
    await updateRow('Leave_Policies', 'policy_key', 'default', record);
  } else {
    record.id = `POLICY-${Date.now()}`;
    await addRow('Leave_Policies', record);
  }

  return getLeavePolicy();
}

