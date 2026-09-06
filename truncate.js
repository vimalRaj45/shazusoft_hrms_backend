/**
 * Shazusoft HRMS Database Truncate Utility
 * 
 * Safely wipes all operational and transactional data:
 * - Attendance records
 * - Daily work done entries
 * - Leaves & short permissions
 * - Monthly self-evaluations
 * - Weekly check-in reports
 * - Support tickets & chat messages
 * - Delegated tasks
 * - Regularization requests
 * - Broadcasts & communication logs
 * - Push subscriptions
 * 
 * In the Employees table:
 * - PRESERVES ONLY Administrator account(s) (role = 'admin' or email = 'admin@shazusoft.com').
 * - Deletes all non-admin staff member accounts.
 * 
 * Usage:
 *   node truncate.js
 *   npm run truncate
 */

import pg from 'pg';
import { config } from './src/config.js';
import { invalidateCache } from './src/db.js';

const { Pool } = pg;

async function truncateDatabase() {
  console.log('====================================================');
  console.log('⚠️  SHAZUSOFT HRMS — DATABASE TRUNCATE & PURGE');
  console.log('====================================================');
  console.log('Connecting to database...');

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
    // 1. Locate and protect Admin account(s)
    const adminRes = await client.query(`
      SELECT id, name, email, role, department, designation, status 
      FROM employees 
      WHERE role = 'admin' OR email ILIKE '%admin%' OR email = 'admin@shazusoft.com';
    `);

    if (adminRes.rows.length === 0) {
      console.warn('⚠️ Warning: No explicit admin account found. Searching for first active user to avoid total lockout...');
      const fallbackRes = await client.query(`SELECT id, name, email, role FROM employees ORDER BY id ASC LIMIT 1;`);
      if (fallbackRes.rows.length > 0) {
        // Elevate fallback to admin
        await client.query(`UPDATE employees SET role = 'admin' WHERE id = $1;`, [fallbackRes.rows[0].id]);
        adminRes.rows.push({ ...fallbackRes.rows[0], role: 'admin' });
      }
    }

    const adminIds = adminRes.rows.map(a => a.id);
    console.log(`\n🛡️  PROTECTED ADMINISTRATOR ACCOUNTS (${adminIds.length} found):`);
    console.table(adminRes.rows);

    // 2. Truncate all operational activity tables
    const tablesToTruncate = [
      { name: 'attendance', label: 'Attendance Punches' },
      { name: 'breaks', label: 'Break Logs' },
      { name: 'work_done', label: 'Daily Work Done Tasks' },
      { name: 'leaves', label: 'Leave Applications' },
      { name: 'permissions', label: '2-Hour Permission Passes' },
      { name: 'self_evaluations', label: 'Monthly Self-Evaluations' },
      { name: 'assigned_tasks', label: 'Manager Assigned Tasks' },
      { name: 'regularizations', label: 'Attendance Regularization Requests' },
      { name: 'communications_log', label: 'Communications & Notifications Log' },
      { name: 'weekly_reports', label: 'Weekly Check-in Reports' },
      { name: 'ai_reports', label: 'AI Monthly Performance Reports' },
      { name: 'support_tickets', label: 'Helpdesk Support Tickets' },
      { name: 'ticket_messages', label: 'Ticket Messages & Attachments' },
      { name: 'broadcasts', label: 'Announcement Broadcasts' },
      { name: 'push_subscriptions', label: 'Web Push Subscriptions' }
    ];

    console.log('\n🧹 Purging transactional tables...');
    for (const t of tablesToTruncate) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM ${t.name};`);
        const rowCount = countRes.rows[0]?.count || 0;
        await client.query(`TRUNCATE TABLE ${t.name} RESTART IDENTITY CASCADE;`);
        console.log(`  ✔ ${t.label} (${t.name}): cleared ${rowCount} rows.`);
      } catch (err) {
        // If table doesn't exist or error, fallback to DELETE
        try {
          const delRes = await client.query(`DELETE FROM ${t.name};`);
          console.log(`  ✔ ${t.label} (${t.name}): deleted ${delRes.rowCount || 0} rows.`);
        } catch (innerErr) {
          console.warn(`  ℹ Table ${t.name} skipped: ${innerErr.message}`);
        }
      }
    }

    // 3. Purge non-admin employees
    console.log('\n👤 Purging non-admin employee accounts...');
    let deleteEmpQuery;
    if (adminIds.length > 0) {
      const formattedAdminIds = adminIds.map(id => `'${id}'`).join(',');
      deleteEmpQuery = `DELETE FROM employees WHERE id NOT IN (${formattedAdminIds}) AND role != 'admin' AND email != 'admin@shazusoft.com';`;
    } else {
      deleteEmpQuery = `DELETE FROM employees WHERE role != 'admin' AND email != 'admin@shazusoft.com';`;
    }

    const empDeleteRes = await client.query(deleteEmpQuery);
    console.log(`  ✔ Removed ${empDeleteRes.rowCount || 0} non-admin staff records.`);

    // 4. Verify Remaining Employees
    const remainingRes = await client.query(`SELECT id, name, email, role, status FROM employees ORDER BY id ASC;`);
    console.log('\n✅ REMAINING ACTIVE ACCOUNTS IN SYSTEM:');
    console.table(remainingRes.rows);

    // 5. Invalidate in-memory database cache
    try {
      invalidateCache();
      console.log('\n⚡ In-memory query cache cleared successfully.');
    } catch (e) {}

    console.log('\n====================================================');
    console.log('🎉 TRUNCATE COMPLETE — ONLY ADMIN ACCOUNT PRESERVED');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Error during database truncate:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

truncateDatabase();
