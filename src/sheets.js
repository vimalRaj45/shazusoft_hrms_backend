import fs from 'fs';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const SHEET_HEADERS = {
  Employees: ['id', 'name', 'email', 'password_hash', 'role', 'department', 'designation', 'status', 'created_at'],
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
  Holidays: ['id', 'date', 'name', 'type', 'created_by', 'created_at']
};

let doc = null;
let isConnectedToGoogle = false;

// In-Memory Fallback Storage (active when service.json or spreadsheet ID is not provided)
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
  Holidays: []
};

/**
 * Initializes default root admin in database if empty (vimalraj5207@gmail.com)
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
      status: 'active',
      created_at: new Date().toISOString()
    }
  ];

  const existing = await getRows('Employees');
  if (existing.length === 0) {
    for (const user of initialUsers) {
      await addRow('Employees', user);
    }
    console.log('[Database] Seeded initial root admin (vimalraj5207@gmail.com).');
  }

  // Seed sample assigned tasks if none exist
  const existingTasks = await getRows('Assigned_Tasks');
  if (existingTasks.length === 0) {
    const sampleTasks = [
      {
        id: 'TASK-ASSIGN-001',
        task_title: 'Implement Geofencing & Google Sheets Sync',
        project_name: 'HRMS Portal 2026',
        description: 'Ensure Haversine GPS radius verification and 100% stable sync with Google Sheets API v4.',
        assigned_by_id: 'EMP-001',
        assigned_by_name: 'System Admin',
        assigned_to_id: 'EMP-002',
        assigned_to_name: 'Alex Rivera',
        priority: 'High',
        due_date: '2026-09-10',
        estimated_hours: '12',
        actual_hours: '10',
        progress: '85',
        status: 'In-Progress',
        work_notes: 'Completed GPS calculation and sheets sync; adding cross-browser fallback.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'TASK-ASSIGN-002',
        task_title: 'Design 4px Sharp Clean UI System',
        project_name: 'HRMS Portal 2026',
        description: 'Standardize all buttons, cards, dialogs, chips, and metrics to 4px border radius matching CJMS specifications.',
        assigned_by_id: 'EMP-001',
        assigned_by_name: 'System Admin',
        assigned_to_id: 'EMP-003',
        assigned_to_name: 'Priya Sharma',
        priority: 'Urgent',
        due_date: '2026-09-08',
        estimated_hours: '8',
        actual_hours: '8',
        progress: '100',
        status: 'Completed',
        work_notes: 'Delivered theme token overrides and verified all view components.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    for (const t of sampleTasks) {
      await addRow('Assigned_Tasks', t);
    }
  }
}

/**
 * Initialize connection to Google Sheets
 */
export async function initSheets() {
  try {
    if (!config.googleSpreadsheetId) {
      console.warn('[Google Sheets] GOOGLE_SPREADSHEET_ID is not configured in .env. Running in Memory/Local fallback mode.');
      await seedDefaultUsers();
      return false;
    }

    let serviceAccountJson = null;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccountJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        console.error('[Google Sheets] Error parsing GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
      }
    } else if (fs.existsSync(config.googleServiceAccountFile)) {
      serviceAccountJson = JSON.parse(fs.readFileSync(config.googleServiceAccountFile, 'utf8'));
    }

    if (!serviceAccountJson) {
      console.warn(`[Google Sheets] service.json file not found at ${config.googleServiceAccountFile} and GOOGLE_SERVICE_ACCOUNT_JSON is not set. Running in Memory/Local fallback mode.`);
      await seedDefaultUsers();
      return false;
    }

    const serviceAccountAuth = new JWT({
      email: serviceAccountJson.client_email,
      key: serviceAccountJson.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    doc = new GoogleSpreadsheet(config.googleSpreadsheetId, serviceAccountAuth);
    await doc.loadInfo();
    console.log(`[Google Sheets] Connected successfully to Google Spreadsheet: "${doc.title}"`);

    // Ensure all required sheets exist with correct headers
    for (const [sheetTitle, headers] of Object.entries(SHEET_HEADERS)) {
      let sheet = doc.sheetsByTitle[sheetTitle];
      if (!sheet) {
        try {
          console.log(`[Google Sheets] Creating sheet "${sheetTitle}"...`);
          sheet = await doc.addSheet({ title: sheetTitle, headerValues: headers });
        } catch (addErr) {
          await doc.loadInfo();
          sheet = doc.sheetsByTitle[sheetTitle];
        }
      }
      
      if (sheet) {
        try {
          await sheet.loadHeaderRow();
          const existingHeaders = sheet.headerValues || [];
          const missing = headers.filter(h => !existingHeaders.includes(h));
          if (missing.length > 0 || existingHeaders.length === 0) {
            await sheet.setHeaderRow(headers);
          }
        } catch (hErr) {
          console.warn(`[Google Sheets] Warning checking headers for ${sheetTitle}:`, hErr.message);
        }
      }
    }

    isConnectedToGoogle = true;
    await seedDefaultUsers();
    return true;
  } catch (error) {
    console.error('[Google Sheets] Failed to connect to Google Sheets:', error.message);
    console.warn('[Google Sheets] Operating in In-Memory fallback mode.');
    isConnectedToGoogle = false;
    await seedDefaultUsers();
    return false;
  }
}

export function getStatus() {
  return {
    connectedToGoogle: isConnectedToGoogle,
    spreadsheetId: config.googleSpreadsheetId || 'Not Configured',
    serviceAccountConfigured: fs.existsSync(config.googleServiceAccountFile)
  };
}

/**
 * Get all rows from a sheet
 */
export async function getRows(sheetTitle) {
  if (isConnectedToGoogle && doc) {
    try {
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (!sheet) return [];
      const rows = await sheet.getRows();
      return rows.map(r => r.toObject());
    } catch (err) {
      console.error(`[Google Sheets] Error reading ${sheetTitle}:`, err.message);
      return memoryDB[sheetTitle] || [];
    }
  }
  return memoryDB[sheetTitle] || [];
}

/**
 * Add a row to a sheet
 */
export async function addRow(sheetTitle, rowData) {
  const cleanData = { ...rowData };
  // Ensure every header field exists
  const headers = SHEET_HEADERS[sheetTitle] || Object.keys(cleanData);
  headers.forEach(h => {
    if (cleanData[h] === undefined || cleanData[h] === null) {
      cleanData[h] = '';
    } else if (typeof cleanData[h] === 'object') {
      cleanData[h] = JSON.stringify(cleanData[h]);
    } else {
      cleanData[h] = String(cleanData[h]);
    }
  });

  if (isConnectedToGoogle && doc) {
    try {
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (sheet) {
        const addedRow = await sheet.addRow(cleanData);
        return addedRow.toObject();
      }
    } catch (err) {
      console.error(`[Google Sheets] Error adding row to ${sheetTitle}:`, err.message);
    }
  }

  // Add to in-memory fallback
  if (!memoryDB[sheetTitle]) memoryDB[sheetTitle] = [];
  memoryDB[sheetTitle].push(cleanData);
  return cleanData;
}

/**
 * Update a specific row matching a field value (e.g. id)
 */
export async function updateRow(sheetTitle, matchField, matchValue, updateData) {
  if (isConnectedToGoogle && doc) {
    try {
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (sheet) {
        const rows = await sheet.getRows();
        const targetRow = rows.find(r => r.get(matchField) === String(matchValue));
        if (targetRow) {
          for (const [key, val] of Object.entries(updateData)) {
            const formattedVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
            targetRow.set(key, formattedVal);
          }
          await targetRow.save();
          return targetRow.toObject();
        }
      }
    } catch (err) {
      console.error(`[Google Sheets] Error updating row in ${sheetTitle}:`, err.message);
    }
  }

  // Fallback update
  const list = memoryDB[sheetTitle] || [];
  const idx = list.findIndex(r => r[matchField] === String(matchValue));
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updateData };
    return list[idx];
  }
  return null;
}

/**
 * Delete a specific row matching a field value
 */
export async function deleteRow(sheetTitle, matchField, matchValue) {
  if (isConnectedToGoogle && doc) {
    try {
      const sheet = doc.sheetsByTitle[sheetTitle];
      if (sheet) {
        const rows = await sheet.getRows();
        const targetRow = rows.find(r => r.get(matchField) === String(matchValue));
        if (targetRow) {
          await targetRow.delete();
          return true;
        }
      }
    } catch (err) {
      console.error(`[Google Sheets] Error deleting row in ${sheetTitle}:`, err.message);
    }
  }

  const list = memoryDB[sheetTitle] || [];
  const initialLength = list.length;
  memoryDB[sheetTitle] = list.filter(r => r[matchField] !== String(matchValue));
  return memoryDB[sheetTitle].length < initialLength;
}
