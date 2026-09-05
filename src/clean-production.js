import { initDB, getRows, deleteRow, invalidateCache } from './db.js';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

async function cleanProduction() {
  console.log('----------------------------------------------------');
  console.log('🧹 Starting Shazusoft HRMS Production Database Cleanup...');
  console.log('----------------------------------------------------');

  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // 1. Identify autotest employee IDs
    const empRes = await client.query(`
      SELECT id, name, email FROM employees 
      WHERE email ILIKE '%autotest%' 
         OR email ILIKE '%test%' 
         OR name = 'Auto-Test Engineer'
    `);
    
    const autotestIds = empRes.rows.map(r => r.id);
    console.log(`Found ${autotestIds.length} autotest accounts to remove:`, empRes.rows.map(r => `${r.id} (${r.email})`));

    if (autotestIds.length > 0) {
      const idList = autotestIds.map(id => `'${id}'`).join(',');
      
      // Remove all cascading references to autotest accounts
      await client.query(`DELETE FROM attendance WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM breaks WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM work_done WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM leaves WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM permissions WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM self_evaluations WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM assigned_tasks WHERE assigned_to_id IN (${idList}) OR assigned_by_id IN (${idList});`);
      await client.query(`DELETE FROM regularizations WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM weekly_reports WHERE employee_id IN (${idList});`);
      await client.query(`DELETE FROM support_tickets WHERE creator_id IN (${idList});`);
      await client.query(`DELETE FROM ticket_messages WHERE sender_id IN (${idList});`);
      await client.query(`DELETE FROM communications_log WHERE recipient_id IN (${idList}) OR sender_id IN (${idList});`);
      await client.query(`DELETE FROM push_subscriptions WHERE employee_id IN (${idList});`);
      
      // Delete employee rows
      await client.query(`DELETE FROM employees WHERE id IN (${idList});`);
      console.log(`✔ Successfully removed ${autotestIds.length} autotest employee accounts and all related child records.`);
    }

    // 2. Clean any test support tickets with "test" subject
    const ticketRes = await client.query(`DELETE FROM support_tickets WHERE subject ILIKE '%test%' OR description ILIKE '%test%';`);
    console.log(`✔ Cleaned test support tickets.`);

    // 3. Verify real employees remaining
    const remainingEmps = await client.query(`SELECT id, name, email, role, status FROM employees ORDER BY id ASC;`);
    console.log('\n✅ ACTIVE PRODUCTION EMPLOYEES:');
    console.table(remainingEmps.rows);

    // 4. Invalidate in-memory cache
    invalidateCache();

    console.log('\n🎉 Production database cleanup finished successfully!');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ Error during production cleanup:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanProduction();
