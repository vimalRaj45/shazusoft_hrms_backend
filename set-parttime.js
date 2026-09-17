import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to PostgreSQL database...');
  let client;
  try {
    client = await pool.connect();

    const targetEmail = 'praveenshazusoft@gmail.com';

    // 1. Update praveenshazusoft@gmail.com to part_time
    const updateRes = await client.query(
      `UPDATE employees 
       SET employment_type = 'part_time' 
       WHERE LOWER(email) = LOWER($1) 
       RETURNING id, name, email, role, designation, employment_type`,
      [targetEmail]
    );

    if (updateRes.rows.length > 0) {
      console.log(`✔ Successfully updated ${targetEmail} to Part-Time Staff!`);
      console.table(updateRes.rows);
    } else {
      console.log(`ℹ No employee record found matching "${targetEmail}".`);
      console.log('Current employees in DB:');
      const all = await client.query('SELECT id, name, email, role, employment_type FROM employees');
      console.table(all.rows);
    }
  } catch (err) {
    console.error('❌ Database update error:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

run();
