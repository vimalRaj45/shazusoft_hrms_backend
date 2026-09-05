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
  Push_Subscriptions: 'push_subscriptions'
};

const TABLE_HEADERS = {
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
  Push_Subscriptions: []
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
    );`
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
    `ALTER TABLE leaves ADD COLUMN IF NOT EXISTS review_remarks TEXT;`
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
 * Seed initial root admin
 */
async function seedDefaultUsers() {
  const initialUsers = [
    {
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
    }
  ];

  const existing = await getRows('Employees');
  if (existing.length === 0) {
    for (const user of initialUsers) {
      await addRow('Employees', user);
    }
    console.log('[PostgreSQL] Seeded initial root admin (vimalraj5207@gmail.com).');
  }
}

/**
 * Initialize PostgreSQL Database Connection
 */
export async function initDB() {
  if (!config.databaseUrl) {
    console.warn('[PostgreSQL] DATABASE_URL not set in .env. Running in in-memory mode.');
    await seedDefaultUsers();
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
    await seedDefaultUsers();
    return true;
  } catch (err) {
    console.error('[PostgreSQL] Connection error:', err.message);
    isConnected = false;
    await seedDefaultUsers();
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
          clean[k] = v === null || v === undefined ? '' : String(v);
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
            clean[k] = v === null || v === undefined ? '' : String(v);
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
