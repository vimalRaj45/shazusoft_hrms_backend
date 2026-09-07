import jwt from 'jsonwebtoken';
import { config } from './src/config.js';
import { buildServer } from './src/server.js';
import { initDB, getRows, addRow, deleteRow } from './src/db.js';

async function runMemoTests() {
  console.log('🧪 Starting Official Memos System Verification Tests...');

  await initDB();
  const fastify = await buildServer();
  await fastify.ready();

  // Ensure test employees exist with active status
  const existingEmps = await getRows('Employees');
  if (!existingEmps.some(e => e.id === 'EMP-ADMIN-01')) {
    await addRow('Employees', { id: 'EMP-ADMIN-01', name: 'System Admin', email: 'admin@shazusoft.com', role: 'admin', status: 'active', department: 'Executive' });
  }
  if (!existingEmps.some(e => e.id === 'EMP-STAFF-01')) {
    await addRow('Employees', { id: 'EMP-STAFF-01', name: 'Priya Sharma', email: 'priya@shazusoft.com', role: 'employee', status: 'active', department: 'Engineering' });
  }
  if (!existingEmps.some(e => e.id === 'EMP-STAFF-02')) {
    await addRow('Employees', { id: 'EMP-STAFF-02', name: 'Rahul Varma', email: 'rahul@shazusoft.com', role: 'employee', status: 'active', department: 'Marketing' });
  }

  const adminToken = jwt.sign(
    {
      id: 'EMP-ADMIN-01',
      email: 'admin@shazusoft.com',
      role: 'admin',
      name: 'System Admin',
      department: 'Executive'
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const staffToken = jwt.sign(
    {
      id: 'EMP-STAFF-01',
      email: 'priya@shazusoft.com',
      role: 'employee',
      name: 'Priya Sharma',
      department: 'Engineering'
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const otherStaffToken = jwt.sign(
    {
      id: 'EMP-STAFF-02',
      email: 'rahul@shazusoft.com',
      role: 'employee',
      name: 'Rahul Varma',
      department: 'Marketing'
    },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  let createdMemoId = null;

  try {
    // TEST 1: Admin creates individual memo set directly to staff ("admin set to staff")
    console.log('\n--- TEST 1: Issue Memo Directly to Specific Staff ---');
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/api/memos',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json'
      },
      payload: {
        title: 'Confidential Performance Benchmark Directive',
        category: 'Appraisal / Performance',
        priority: 'High',
        target_type: 'INDIVIDUAL',
        target_employee_id: 'EMP-STAFF-01',
        target_employee_name: 'Priya Sharma',
        content: 'Please ensure that your sprint milestone documentation is updated by end of week.',
        requires_acknowledgment: true
      }
    });

    const createBody = JSON.parse(createRes.body);
    console.log('Create Memo Response Status:', createRes.statusCode);
    console.log('Created Memo Number:', createBody.memo?.memo_number);
    console.log('Target Type:', createBody.memo?.target_type);
    console.log('Target Employee ID:', createBody.memo?.target_employee_id);

    if (createRes.statusCode !== 201 || !createBody.success) {
      throw new Error(`Failed to create memo: ${createRes.body}`);
    }
    createdMemoId = createBody.memo.id;
    console.log('✅ TEST 1 PASSED: Official memo issued and targeted to staff member.');

    // TEST 2: Targeted staff can see this memo, other staff cannot
    console.log('\n--- TEST 2: Verify Access Control & Visibility ---');
    const staffMemosRes = await fastify.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { authorization: `Bearer ${staffToken}` }
    });
    const staffMemosBody = JSON.parse(staffMemosRes.body);
    const hasTargetedMemo = (staffMemosBody.memos || []).some(m => m.id === createdMemoId);
    console.log('Targeted staff (Priya) sees memo:', hasTargetedMemo);
    if (!hasTargetedMemo) throw new Error('Targeted employee should be able to see their direct memo');

    const otherMemosRes = await fastify.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { authorization: `Bearer ${otherStaffToken}` }
    });
    const otherMemosBody = JSON.parse(otherMemosRes.body);
    const otherSeesMemo = (otherMemosBody.memos || []).some(m => m.id === createdMemoId);
    console.log('Other staff (Rahul) sees memo:', otherSeesMemo);
    if (otherSeesMemo) throw new Error('Untargeted employee should NOT see individual memo');
    console.log('✅ TEST 2 PASSED: Strict role and target employee isolation verified.');

    // TEST 3: Staff submits formal digital acknowledgment
    console.log('\n--- TEST 3: Employee Submits Digital Acknowledgment ---');
    const ackRes = await fastify.inject({
      method: 'POST',
      url: `/api/memos/${createdMemoId}/acknowledge`,
      headers: {
        authorization: `Bearer ${staffToken}`,
        'content-type': 'application/json'
      },
      payload: {
        remarks: 'Confirmed and reviewed. Documentation will be submitted on Friday.'
      }
    });

    const ackBody = JSON.parse(ackRes.body);
    console.log('Ack Response Status:', ackRes.statusCode);
    console.log('Ack Status:', ackBody.acknowledgment?.status);
    console.log('Ack Timestamp:', ackBody.acknowledgment?.acknowledged_at);
    if (ackRes.statusCode !== 200 || !ackBody.success) {
      throw new Error(`Failed to acknowledge memo: ${ackRes.body}`);
    }
    console.log('✅ TEST 3 PASSED: Digital signature recorded successfully.');

    // TEST 4: Prevent duplicate acknowledgment
    console.log('\n--- TEST 4: Prevent Duplicate Acknowledgment ---');
    const dupAckRes = await fastify.inject({
      method: 'POST',
      url: `/api/memos/${createdMemoId}/acknowledge`,
      headers: {
        authorization: `Bearer ${staffToken}`,
        'content-type': 'application/json'
      },
      payload: { remarks: 'Trying again' }
    });
    console.log('Duplicate Ack Status:', dupAckRes.statusCode);
    if (dupAckRes.statusCode !== 400) {
      throw new Error('Duplicate acknowledgment was not prevented');
    }
    console.log('✅ TEST 4 PASSED: Duplicate signature attempt correctly blocked.');

    // TEST 5: Admin retrieves memos and sees 1/1 Signed status
    console.log('\n--- TEST 5: Admin Signature Tracking & Compliance ---');
    const adminGetRes = await fastify.inject({
      method: 'GET',
      url: '/api/memos',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    const adminGetBody = JSON.parse(adminGetRes.body);
    const memoUnderReview = (adminGetBody.memos || []).find(m => m.id === createdMemoId);
    console.log('Admin saw memo:', !!memoUnderReview);
    console.log('Target Count:', memoUnderReview?.totalTargetCount);
    console.log('Acknowledged Count:', memoUnderReview?.acknowledgedCount);
    if (!memoUnderReview || memoUnderReview.acknowledgedCount < 1) {
      throw new Error('Admin stats do not reflect recorded acknowledgment');
    }
    console.log('✅ TEST 5 PASSED: Admin live signature compliance tracking verified.');

    // Cleanup test record
    await fastify.inject({
      method: 'DELETE',
      url: `/api/memos/${createdMemoId}`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    console.log('\n🧹 Test memo cleaned up successfully.');

    console.log('\n🎉 ALL 5 OFFICIAL MEMO TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runMemoTests();
