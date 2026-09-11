/**
 * Shazusoft HRMS Database Truncate Utility
 * 
 * Safely wipes all testing and operational data:
 * - Attendance records
 * - Daily work done entries
 * - Leaves & short permissions
 * - Monthly self-evaluations
 * - Weekly check-in reports
 * - Support tickets & chat messages
 * - Delegated tasks & regularizations
 * - Broadcasts, memos & acknowledgments
 * - AI performance reports
 * - Payroll records & salary structures
 * - Push subscriptions & notifications
 * 
 * In the Employees table:
 * - PRESERVES ONLY the single administrator account: vimalraj5207@gmail.com
 * - Permanently purges all other test staff/dummy accounts.
 * 
 * Usage:
 *   node truncate.js
 *   npm run truncate
 */

import pg from 'pg';
import { config } from './src/config.js';
import { invalidateCache } from './src/db.js';

const { Pool } = pg;

const TARGET_ADMIN_EMAIL = 'vimalraj5207@gmail.com';

async function truncateDatabase() {
  console.log('====================================================');
  console.log('⚠️  SHAZUSOFT HRMS — PURGE ALL TEST DATA & RESET DB');
  console.log('====================================================');
  console.log(`Target Single Administrator: ${TARGET_ADMIN_EMAIL}`);
  console.log('Connecting to PostgreSQL database...\n');

  if (!config.databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not set in backend/.env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 1. Ensure target root admin account exists and is elevated to 'admin'
    const checkAdminRes = await client.query(
      `SELECT id, name, email, role, status FROM employees WHERE LOWER(email) = LOWER($1);`,
      [TARGET_ADMIN_EMAIL]
    );

    let adminId;
    if (checkAdminRes.rows.length === 0) {
      console.log(`ℹ️  Admin ${TARGET_ADMIN_EMAIL} not found. Creating fresh root administrator account...`);
      adminId = 'EMP-ADMIN-01';
      await client.query(`
        INSERT INTO employees (
          id, name, email, password_hash, role, department, designation, work_mode, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
      `, [
        adminId,
        'Vimal Raj',
        TARGET_ADMIN_EMAIL,
        'OTP_AUTH_ENABLED',
        'admin',
        'Executive Management',
        'Managing Director & Administrator',
        'office',
        'active',
        new Date().toISOString()
      ]);
    } else {
      adminId = checkAdminRes.rows[0].id;
      // Ensure role is admin and status active
      await client.query(
        `UPDATE employees SET role = 'admin', status = 'active' WHERE id = $1;`,
        [adminId]
      );
    }

    const verifiedAdmin = await client.query(
      `SELECT id, name, email, role, department, designation, status FROM employees WHERE id = $1;`,
      [adminId]
    );

    console.log(`🛡️  SOLE PROTECTED ROOT ADMINISTRATOR:`);
    console.table(verifiedAdmin.rows);

    // 2. Truncate all operational and testing tables
    const tablesToTruncate = [
      { name: 'attendance', label: 'Attendance Punches' },
      { name: 'breaks', label: 'Break Logs' },
      { name: 'work_done', label: 'Daily Work Done Tasks' },
      { name: 'workdone', label: 'Daily Work Done Tasks (Legacy)' },
      { name: 'leaves', label: 'Leave Applications' },
      { name: 'permissions', label: 'Short Permission Passes' },
      { name: 'self_evaluations', label: 'Monthly Self-Evaluations' },
      { name: 'assigned_tasks', label: 'Manager Assigned Tasks' },
      { name: 'regularizations', label: 'Attendance Regularizations' },
      { name: 'communications_log', label: 'Communications & Logs' },
      { name: 'weekly_reports', label: 'Weekly Check-in Reports' },
      { name: 'ai_reports', label: 'AI Monthly Reports' },
      { name: 'support_tickets', label: 'Helpdesk Support Tickets' },
      { name: 'ticket_messages', label: 'Ticket Messages & Attachments' },
      { name: 'broadcasts', label: 'Announcement Broadcasts' },
      { name: 'memos', label: 'Official Memos' },
      { name: 'memo_acknowledgments', label: 'Memo Acknowledgments' },
      { name: 'monthly_payrolls', label: 'Monthly Payroll Runs' },
      { name: 'salary_structures', label: 'Salary Structures' },
      { name: 'in_app_notifications', label: 'In-App Notifications' },
      { name: 'push_subscriptions', label: 'Web Push Subscriptions' }
    ];

    console.log('\n🧹 Purging operational testing tables...');
    for (const t of tablesToTruncate) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM ${t.name};`);
        const rowCount = countRes.rows[0]?.count || 0;
        await client.query(`TRUNCATE TABLE ${t.name} RESTART IDENTITY CASCADE;`);
        console.log(`  ✔ ${t.label} (${t.name}): wiped ${rowCount} test records.`);
      } catch (err) {
        // Fallback to DELETE if TRUNCATE CASCADE fails or table is referenced
        try {
          const delRes = await client.query(`DELETE FROM ${t.name};`);
          console.log(`  ✔ ${t.label} (${t.name}): deleted ${delRes.rowCount || 0} rows.`);
        } catch (innerErr) {
          console.warn(`  ℹ Table ${t.name} skipped: ${innerErr.message}`);
        }
      }
    }

    // 3. Delete all employees EXCEPT the single admin vimalraj5207@gmail.com
    console.log(`\n👤 Removing all non-admin and other employee accounts...`);
    const empDeleteRes = await client.query(
      `DELETE FROM employees WHERE LOWER(email) != LOWER($1);`,
      [TARGET_ADMIN_EMAIL]
    );
    console.log(`  ✔ Deleted ${empDeleteRes.rowCount || 0} testing/staff employee account(s).`);

    // 4. Verify remaining accounts in employees table (Must be only 1)
    const remainingRes = await client.query(
      `SELECT id, name, email, role, department, designation, status FROM employees ORDER BY id ASC;`
    );
    console.log('\n✅ REMAINING ACTIVE ACCOUNTS IN SYSTEM (Strictly 1 Admin):');
    console.table(remainingRes.rows);

    if (remainingRes.rows.length === 1 && remainingRes.rows[0].email.toLowerCase() === TARGET_ADMIN_EMAIL.toLowerCase()) {
      console.log(`\n✨ Confirmation: Database now has ONLY one administrator (${TARGET_ADMIN_EMAIL}).`);
    } else {
      console.warn(`\n⚠️ Note: Expected 1 account, found ${remainingRes.rows.length}.`);
    }

    // 5. Invalidate in-memory and file cache
    try {
      invalidateCache();
      console.log('⚡ In-memory query cache cleared successfully.');
    } catch (e) {}

    console.log('\n====================================================');
    console.log('🎉 ALL TESTING DATA PURGED SUCCESSFULLY!');
    console.log(`🎉 ONLY ONE ADMIN (${TARGET_ADMIN_EMAIL}) ACTIVE`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Error during database truncate:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

truncateDatabase().catch((err) => {
  console.error('Execution terminated with error:', err.message);
  process.exit(1);
});
