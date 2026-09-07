import { getRows, addRow, updateRow, deleteRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { dispatchNotification } from '../inAppNotificationService.js';

export default async function memosRoutes(fastify, opts) {
  // Helper: check if a memo applies to an employee
  function isMemoApplicable(memo, user) {
    if (!memo || memo.status === 'Archived' || memo.status === 'Cancelled') return false;
    if (memo.target_type === 'ALL') return true;
    if (memo.target_type === 'DEPARTMENT') {
      const userDept = (user.department || '').trim().toLowerCase();
      const targetDept = (memo.target_department || '').trim().toLowerCase();
      return userDept && targetDept && (userDept === targetDept || targetDept === 'all');
    }
    if (memo.target_type === 'INDIVIDUAL') {
      if (!memo.target_employee_id) return false;
      const targetIds = memo.target_employee_id.split(',').map(s => s.trim());
      return targetIds.includes(user.id);
    }
    return false;
  }

  // GET /api/memos - List memos with acknowledgment statuses
  fastify.get('/', { preHandler: verifyAuth }, async (req, reply) => {
    try {
      const [allMemos, allAcks, allEmployees] = await Promise.all([
        getRows('Memos'),
        getRows('Memo_Acknowledgments'),
        getRows('Employees')
      ]);

      const isAdminOrManager = req.user.role === 'admin' || req.user.role === 'manager';

      if (isAdminOrManager) {
        // Admin gets all memos enriched with recipient and acknowledgment stats
        const enrichedMemos = allMemos.map(memo => {
          const memoAcks = allAcks.filter(a => a.memo_id === memo.id);

          // Calculate target recipients
          let targetEmployees = [];
          if (memo.target_type === 'ALL') {
            targetEmployees = allEmployees.filter(e => e.role !== 'admin');
          } else if (memo.target_type === 'DEPARTMENT') {
            const targetDept = (memo.target_department || '').trim().toLowerCase();
            targetEmployees = allEmployees.filter(
              e => (e.department || '').trim().toLowerCase() === targetDept
            );
          } else if (memo.target_type === 'INDIVIDUAL') {
            const targetIds = (memo.target_employee_id || '').split(',').map(s => s.trim());
            targetEmployees = allEmployees.filter(e => targetIds.includes(e.id));
          }

          const totalTargetCount = targetEmployees.length;
          const acknowledgedCount = memoAcks.length;

          // Recipient status breakdown
          const recipientStatus = targetEmployees.map(emp => {
            const ack = memoAcks.find(a => a.employee_id === emp.id);
            return {
              employee_id: emp.id,
              employee_name: emp.name,
              department: emp.department,
              designation: emp.designation,
              acknowledged: !!ack,
              acknowledged_at: ack ? ack.acknowledged_at : null,
              remarks: ack ? ack.remarks : null
            };
          });

          return {
            ...memo,
            totalTargetCount,
            acknowledgedCount,
            acknowledgments: memoAcks,
            recipientStatus
          };
        });

        // Sort by created_at descending
        enrichedMemos.sort((a, b) => new Date(b.created_at || b.issued_date) - new Date(a.created_at || a.issued_date));
        return { success: true, memos: enrichedMemos };
      }

      // Regular Staff view: only memos targeted to them
      const userMemos = allMemos.filter(m => isMemoApplicable(m, req.user));

      const staffEnriched = userMemos.map(memo => {
        const userAck = allAcks.find(a => a.memo_id === memo.id && a.employee_id === req.user.id);
        return {
          ...memo,
          acknowledged: !!userAck,
          acknowledged_at: userAck ? userAck.acknowledged_at : null,
          userRemarks: userAck ? userAck.remarks : null
        };
      });

      staffEnriched.sort((a, b) => new Date(b.created_at || b.issued_date) - new Date(a.created_at || a.issued_date));
      return { success: true, memos: staffEnriched };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to fetch memos' });
    }
  });

  // GET /api/memos/:id - Get single memo details
  fastify.get('/:id', { preHandler: verifyAuth }, async (req, reply) => {
    try {
      const { id } = req.params;
      const [allMemos, allAcks, allEmployees] = await Promise.all([
        getRows('Memos'),
        getRows('Memo_Acknowledgments'),
        getRows('Employees')
      ]);

      const memo = allMemos.find(m => m.id === id);
      if (!memo) {
        return reply.status(404).send({ success: false, error: 'Memo not found' });
      }

      const isAdmin = req.user.role === 'admin' || req.user.role === 'manager';
      if (!isAdmin && !isMemoApplicable(memo, req.user)) {
        return reply.status(403).send({ success: false, error: 'Unauthorized to view this memo' });
      }

      const memoAcks = allAcks.filter(a => a.memo_id === memo.id);
      const userAck = memoAcks.find(a => a.employee_id === req.user.id);

      let recipientStatus = [];
      if (isAdmin) {
        let targetEmployees = [];
        if (memo.target_type === 'ALL') {
          targetEmployees = allEmployees.filter(e => e.role !== 'admin');
        } else if (memo.target_type === 'DEPARTMENT') {
          const targetDept = (memo.target_department || '').trim().toLowerCase();
          targetEmployees = allEmployees.filter(
            e => (e.department || '').trim().toLowerCase() === targetDept
          );
        } else if (memo.target_type === 'INDIVIDUAL') {
          const targetIds = (memo.target_employee_id || '').split(',').map(s => s.trim());
          targetEmployees = allEmployees.filter(e => targetIds.includes(e.id));
        }

        recipientStatus = targetEmployees.map(emp => {
          const ack = memoAcks.find(a => a.employee_id === emp.id);
          return {
            employee_id: emp.id,
            employee_name: emp.name,
            department: emp.department,
            designation: emp.designation,
            acknowledged: !!ack,
            acknowledged_at: ack ? ack.acknowledged_at : null,
            remarks: ack ? ack.remarks : null
          };
        });
      }

      return {
        success: true,
        memo: {
          ...memo,
          acknowledged: !!userAck,
          acknowledged_at: userAck ? userAck.acknowledged_at : null,
          userRemarks: userAck ? userAck.remarks : null,
          totalTargetCount: recipientStatus.length,
          acknowledgedCount: memoAcks.length,
          acknowledgments: memoAcks,
          recipientStatus
        }
      };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to retrieve memo details' });
    }
  });

  // POST /api/memos - Admin creates and dispatches official memo
  fastify.post('/', { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const {
        title,
        category = 'General',
        priority = 'Normal',
        target_type = 'ALL',
        target_employee_id = null,
        target_employee_name = null,
        target_department = null,
        content,
        effective_date = null,
        requires_acknowledgment = true,
        attachment_url = null
      } = req.body || {};

      if (!title || !title.trim()) {
        return reply.status(400).send({ success: false, error: 'Memo title is required' });
      }
      if (!content || !content.trim()) {
        return reply.status(400).send({ success: false, error: 'Memo content is required' });
      }

      // Validate target type specifics
      if (target_type === 'INDIVIDUAL' && !target_employee_id) {
        return reply.status(400).send({ success: false, error: 'Please select target employee(s)' });
      }
      if (target_type === 'DEPARTMENT' && !target_department) {
        return reply.status(400).send({ success: false, error: 'Please select a target department' });
      }

      const allMemos = await getRows('Memos');
      const year = new Date().getFullYear();
      const countForYear = allMemos.filter(m => (m.memo_number || '').includes(`/${year}/`)).length + 1;
      const memo_number = `SZ/MEMO/${year}/${String(countForYear).padStart(3, '0')}`;

      const memoId = `memo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];

      const newMemo = {
        id: memoId,
        memo_number,
        title: title.trim(),
        category,
        priority,
        target_type,
        target_employee_id: target_employee_id ? String(target_employee_id).trim() : '',
        target_employee_name: target_employee_name ? String(target_employee_name).trim() : '',
        target_department: target_department ? String(target_department).trim() : '',
        content: content.trim(),
        issued_by_id: req.user.id,
        issued_by_name: req.user.name,
        issued_date: todayDate,
        effective_date: effective_date || todayDate,
        requires_acknowledgment: requires_acknowledgment !== false,
        attachment_url: attachment_url || '',
        status: 'Active',
        created_at: nowIso,
        updated_at: nowIso
      };

      await addRow('Memos', newMemo);

      // Notification Dispatching
      const notifTitle = `Official Memo: ${newMemo.memo_number}`;
      const notifMessage = `${newMemo.title} - Priority: ${newMemo.priority}. Please review and acknowledge.`;

      if (target_type === 'ALL') {
        await dispatchNotification({
          recipientId: 'ALL',
          title: notifTitle,
          message: notifMessage,
          type: 'info',
          targetTab: 'memos',
          targetUrl: '/?tab=memos',
          senderRole: 'admin',
          metadata: { memoId: newMemo.id, memoNumber: newMemo.memo_number }
        });
      } else if (target_type === 'DEPARTMENT') {
        const allEmployees = await getRows('Employees');
        const deptEmployees = allEmployees.filter(
          e => (e.department || '').trim().toLowerCase() === target_department.trim().toLowerCase()
        );
        for (const emp of deptEmployees) {
          await dispatchNotification({
            recipientId: emp.id,
            title: notifTitle,
            message: notifMessage,
            type: 'info',
            targetTab: 'memos',
            targetUrl: '/?tab=memos',
            senderRole: 'admin',
            metadata: { memoId: newMemo.id, memoNumber: newMemo.memo_number }
          });
        }
      } else if (target_type === 'INDIVIDUAL') {
        const targetIds = (target_employee_id || '').split(',').map(s => s.trim());
        for (const empId of targetIds) {
          if (empId) {
            await dispatchNotification({
              recipientId: empId,
              title: notifTitle,
              message: notifMessage,
              type: 'info',
              targetTab: 'memos',
              targetUrl: '/?tab=memos',
              senderRole: 'admin',
              metadata: { memoId: newMemo.id, memoNumber: newMemo.memo_number }
            });
          }
        }
      }

      return reply.status(201).send({
        success: true,
        message: 'Official memo issued successfully',
        memo: newMemo
      });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to issue memo' });
    }
  });

  // PUT /api/memos/:id - Admin updates memo details or status
  fastify.put('/:id', { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const { id } = req.params;
      const allMemos = await getRows('Memos');
      const existing = allMemos.find(m => m.id === id);
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Memo not found' });
      }

      const updates = {
        ...existing,
        ...req.body,
        updated_at: new Date().toISOString()
      };
      // Prevent mutating primary identifiers
      updates.id = existing.id;
      updates.memo_number = existing.memo_number;

      await updateRow('Memos', id, updates);
      return { success: true, message: 'Memo updated successfully', memo: updates };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to update memo' });
    }
  });

  // DELETE /api/memos/:id - Admin deletes a memo
  fastify.delete('/:id', { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const { id } = req.params;
      await deleteRow('Memos', id);

      // Clean up any acknowledgment records for this memo
      const acks = await getRows('Memo_Acknowledgments');
      const relatedAcks = acks.filter(a => a.memo_id === id);
      for (const ack of relatedAcks) {
        await deleteRow('Memo_Acknowledgments', ack.id);
      }

      return { success: true, message: 'Memo deleted successfully' };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to delete memo' });
    }
  });

  // POST /api/memos/:id/acknowledge - Employee signs/acknowledges memo
  fastify.post('/:id/acknowledge', { preHandler: verifyAuth }, async (req, reply) => {
    try {
      const { id } = req.params;
      const { remarks = '' } = req.body || {};

      const [allMemos, allAcks] = await Promise.all([
        getRows('Memos'),
        getRows('Memo_Acknowledgments')
      ]);

      const memo = allMemos.find(m => m.id === id);
      if (!memo) {
        return reply.status(404).send({ success: false, error: 'Memo not found' });
      }

      const existingAck = allAcks.find(a => a.memo_id === id && a.employee_id === req.user.id);
      if (existingAck) {
        return reply.status(400).send({
          success: false,
          error: 'You have already acknowledged this memo',
          acknowledged_at: existingAck.acknowledged_at
        });
      }

      const ackId = `ack_${Date.now()}_${req.user.id}`;
      const nowIso = new Date().toISOString();

      const ackRecord = {
        id: ackId,
        memo_id: id,
        employee_id: req.user.id,
        employee_name: req.user.name,
        status: 'Acknowledged',
        acknowledged_at: nowIso,
        remarks: remarks ? String(remarks).trim() : ''
      };

      await addRow('Memo_Acknowledgments', ackRecord);

      // Notify the memo issuer (Admin) about the acknowledgment
      if (memo.issued_by_id) {
        await dispatchNotification({
          recipientId: memo.issued_by_id,
          title: `Memo Acknowledged: ${memo.memo_number}`,
          message: `${req.user.name} has formally reviewed and signed ${memo.memo_number}`,
          type: 'info',
          targetTab: 'admin-memos',
          targetUrl: '/?tab=admin-memos',
          senderRole: 'employee',
          metadata: { memoId: memo.id, employeeId: req.user.id }
        });
      }

      return {
        success: true,
        message: 'Memo acknowledged and digitally signed successfully',
        acknowledgment: ackRecord
      };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to record acknowledgment' });
    }
  });

  // POST /api/memos/:id/remind - Admin sends reminder to unacknowledged staff
  fastify.post('/:id/remind', { preHandler: verifyAdmin }, async (req, reply) => {
    try {
      const { id } = req.params;
      const [allMemos, allAcks, allEmployees] = await Promise.all([
        getRows('Memos'),
        getRows('Memo_Acknowledgments'),
        getRows('Employees')
      ]);

      const memo = allMemos.find(m => m.id === id);
      if (!memo) {
        return reply.status(404).send({ success: false, error: 'Memo not found' });
      }

      const memoAcks = allAcks.filter(a => a.memo_id === id);
      const ackedIds = new Set(memoAcks.map(a => a.employee_id));

      let pendingEmployees = [];
      if (memo.target_type === 'ALL') {
        pendingEmployees = allEmployees.filter(e => e.role !== 'admin' && !ackedIds.has(e.id));
      } else if (memo.target_type === 'DEPARTMENT') {
        const targetDept = (memo.target_department || '').trim().toLowerCase();
        pendingEmployees = allEmployees.filter(
          e => (e.department || '').trim().toLowerCase() === targetDept && !ackedIds.has(e.id)
        );
      } else if (memo.target_type === 'INDIVIDUAL') {
        const targetIds = (memo.target_employee_id || '').split(',').map(s => s.trim());
        pendingEmployees = allEmployees.filter(e => targetIds.includes(e.id) && !ackedIds.has(e.id));
      }

      for (const emp of pendingEmployees) {
        await dispatchNotification({
          recipientId: emp.id,
          title: `Action Required: Memo Reminder (${memo.memo_number})`,
          message: `Official memo "${memo.title}" requires your immediate acknowledgment. Please sign today.`,
          type: 'info',
          targetTab: 'memos',
          targetUrl: '/?tab=memos',
          senderRole: 'admin',
          metadata: { memoId: memo.id, memoNumber: memo.memo_number }
        });
      }

      return {
        success: true,
        message: `Reminder notifications sent to ${pendingEmployees.length} pending employee(s)`,
        remindedCount: pendingEmployees.length
      };
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ success: false, error: 'Failed to send reminders' });
    }
  });
}
