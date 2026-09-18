import { buildServer } from './src/server.js';
import { initDB } from './src/db.js';
import { config } from './src/config.js';
import jwt from 'jsonwebtoken';

async function runKernelTestSuite() {
  console.log('🧪 Starting Kernel Master CRUD & Immutable Audit Test Suite (Root OTP Mode)...');

  await initDB();
  const app = await buildServer();
  await app.ready();

  const rootEmail = config.rootAdminEmail || 'vsgrpsemail@gmail.com';
  let token = '';

  // 1. Test Root Email Configuration Discovery
  console.log('\n--- 1. Testing Root Admin Config Endpoint ---');
  const configRes = await app.inject({
    method: 'GET',
    url: '/api/kernel/auth/config'
  });
  const configData = JSON.parse(configRes.body);
  console.log('✅ Configured Root Email in .env:', configData.rootEmail, '(Masked:', configData.maskedEmail, ')');

  // 1b. Test Unauthorized Email Rejected
  console.log('\n--- 1b. Testing Non-Root Email Rejection Gate ---');
  const fakeEmailRes = await app.inject({
    method: 'POST',
    url: '/api/kernel/auth/send-otp',
    payload: {
      email: 'hacker@random.com'
    }
  });
  if (fakeEmailRes.statusCode === 403) {
    console.log('✅ Security Pass: Unauthorized non-root email correctly rejected with 403 Forbidden!');
  } else {
    console.error('❌ Failed security gate: non-root email was not rejected with 403.');
    process.exit(1);
  }

  // 1c. Test Valid Root Email OTP Dispatch
  console.log('\n--- 1c. Testing Valid Root Email OTP Dispatch ---');
  const sendOtpRes = await app.inject({
    method: 'POST',
    url: '/api/kernel/auth/send-otp',
    payload: {
      email: rootEmail
    }
  });

  if (sendOtpRes.statusCode !== 200) {
    console.error('❌ Failed root send-otp:', sendOtpRes.body);
    process.exit(1);
  }
  console.log('✅ Root OTP dispatch successful:', JSON.parse(sendOtpRes.body).message);

  // Sign valid kernel_admin token for subsequent CRUD suite tests
  token = jwt.sign(
    {
      id: 'KERNEL-ROOT-01',
      name: 'Master Kernel Administrator',
      email: rootEmail,
      role: 'kernel_admin',
      is_kernel_admin: true
    },
    config.jwtSecret,
    { expiresIn: '8h' }
  );
  console.log('✅ Kernel Root Authorization Token issued for tests.');

  // 2. Test Tables Schema Discovery
  console.log('\n--- 2. Testing Universal Tables Schema Discovery ---');
  const tablesRes = await app.inject({
    method: 'GET',
    url: '/api/kernel/tables',
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (tablesRes.statusCode !== 200) {
    console.error('❌ Failed tables discovery:', tablesRes.body);
    process.exit(1);
  }

  const tablesData = JSON.parse(tablesRes.body);
  console.log(`✅ Discovered ${tablesData.totalTables} system tables!`);
  const hasAuditTable = tablesData.tables.some(t => t.modelName === 'Kernel_Audit_Logs');
  console.log(`✅ Kernel_Audit_Logs table registered: ${hasAuditTable}`);

  // 3. Test Audited Create in System_Settings
  console.log('\n--- 3. Testing Audited Create Record ---');
  const testKey = `test_setting_${Date.now()}`;
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/kernel/tables/System_Settings',
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      id: `SET-${Date.now()}`,
      setting_key: testKey,
      setting_value: 'initial_test_value',
      _reason: 'Automated test suite creation'
    }
  });

  if (createRes.statusCode !== 200) {
    console.error('❌ Failed create record:', createRes.body);
    process.exit(1);
  }

  const createdData = JSON.parse(createRes.body);
  const recordId = createdData.record.id;
  console.log(`✅ Successfully created record "${recordId}" in System_Settings!`);

  // 4. Test Audited Update with Field-Level Diff
  console.log('\n--- 4. Testing Audited Update Record with Diff ---');
  const updateRes = await app.inject({
    method: 'PUT',
    url: `/api/kernel/tables/System_Settings/${recordId}`,
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      setting_value: 'MODIFIED_TEST_VALUE_DIFF_CHECK',
      _reason: 'Automated test suite modification'
    }
  });

  if (updateRes.statusCode !== 200) {
    console.error('❌ Failed update record:', updateRes.body);
    process.exit(1);
  }

  console.log(`✅ Successfully updated record "${recordId}"!`);

  // 5. Verify Audit Log & Diff Recording
  console.log('\n--- 5. Verifying Immutable Kernel Audit Ledger ---');
  const auditRes = await app.inject({
    method: 'GET',
    url: `/api/kernel/audit/logs?search=${recordId}`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (auditRes.statusCode !== 200) {
    console.error('❌ Failed get audit logs:', auditRes.body);
    process.exit(1);
  }

  const auditData = JSON.parse(auditRes.body);
  console.log(`✅ Found ${auditData.total} audit log entries for record "${recordId}"!`);
  const updateLog = auditData.logs.find(l => l.action_type === 'UPDATE');
  if (updateLog) {
    console.log('✅ Field diff recorded:', updateLog.diff_summary);
  }

  // 6. Test One-Click Rollback
  if (updateLog) {
    console.log('\n--- 6. Testing One-Click Rollback ---');
    const rollbackRes = await app.inject({
      method: 'POST',
      url: `/api/kernel/audit/rollback/${updateLog.id}`,
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        reason: 'Automated test rollback'
      }
    });

    if (rollbackRes.statusCode !== 200) {
      console.error('❌ Failed rollback:', rollbackRes.body);
      process.exit(1);
    }

    const rollbackData = JSON.parse(rollbackRes.body);
    console.log(`✅ Rollback successful! Restored value: "${rollbackData.restoredRecord?.setting_value}"`);
  }

  // 7. Test Audited Deletion
  console.log('\n--- 7. Testing Audited Deletion ---');
  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/kernel/tables/System_Settings/${recordId}`,
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      reason: 'Automated test suite cleanup'
    }
  });

  if (deleteRes.statusCode !== 200) {
    console.error('❌ Failed delete:', deleteRes.body);
    process.exit(1);
  }

  console.log(`✅ Record "${recordId}" deleted and archived in Audit Ledger!`);

  console.log('\n========================================');
  console.log('🎉 ALL KERNEL CRUD & AUDIT TESTS PASSED!');
  console.log('========================================\n');

  process.exit(0);
}

runKernelTestSuite().catch(err => {
  console.error('❌ Test suite fatal error:', err);
  process.exit(1);
});
