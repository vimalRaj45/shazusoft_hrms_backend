import { getRows, addRow, updateRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { sendProfessionalRejectionEmail } from '../mailer.js';
import { differenceInMinutes } from 'date-fns';

export default async function communicationsRoutes(fastify, options) {
  // GET /api/communications/requests - List regularization requests
  fastify.get('/requests', { preHandler: [verifyAuth] }, async (request, reply) => {
    const allRequests = await getRows('Regularizations');
    const isAdmin = request.user.role === 'admin';

    let filtered = allRequests;
    if (!isAdmin) {
      filtered = allRequests.filter(r => r.employee_id === request.user.id);
    }

    // Sort descending by applied_at
    const sorted = filtered.sort((a, b) => new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime());
    return { requests: sorted };
  });

  // POST /api/communications/request-regularization - Staff submits correction
  fastify.post('/request-regularization', { preHandler: [verifyAuth] }, async (request, reply) => {
    const {
      date,
      requested_login_time,
      requested_logout_time,
      reason
    } = request.body || {};

    if (!date || !requested_login_time || !reason) {
      return reply.status(400).send({
        error: 'Date, requested punch-in time, and explanation reason are required.'
      });
    }

    const newRequest = {
      id: `REG-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      date,
      requested_login_time,
      requested_logout_time: requested_logout_time || '',
      reason,
      status: 'Pending',
      reviewed_by_id: '',
      reviewed_by_name: '',
      review_remarks: '',
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const saved = await addRow('Regularizations', newRequest);

    // Audit log
    await addRow('Communications_Log', {
      id: `LOG-${Date.now()}`,
      type: 'REGULARIZATION_REQUESTED',
      sender_id: request.user.id,
      sender_name: request.user.name,
      recipient_id: 'ADMIN',
      recipient_name: 'Management',
      subject: `Attendance Regularization Requested (${date})`,
      message: `${request.user.name} submitted a punch correction for ${date}. Reason: ${reason}`,
      metadata_json: JSON.stringify({ date, requested_login_time, requested_logout_time, reason }),
      created_at: new Date().toISOString()
    });

    return {
      message: 'Regularization request submitted for Management review.',
      request: saved
    };
  });

  // POST /api/communications/resolve-request - Admin approves or rejects
  fastify.post('/resolve-request', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { request_id, action, review_remarks = '' } = request.body || {};

    if (!request_id || !['Approved', 'Rejected'].includes(action)) {
      return reply.status(400).send({
        error: 'Request ID and action (Approved/Rejected) are required.'
      });
    }

    const allRequests = await getRows('Regularizations');
    const target = allRequests.find(r => r.id === request_id);

    if (!target) {
      return reply.status(404).send({ error: 'Regularization request not found.' });
    }

    const updated = await updateRow('Regularizations', 'id', request_id, {
      status: action,
      reviewed_by_id: request.user.id,
      reviewed_by_name: request.user.name,
      review_remarks,
      updated_at: new Date().toISOString()
    });

    // If Approved, update or insert into Attendance sheet
    if (action === 'Approved') {
      const attendanceRows = await getRows('Attendance');
      const existing = attendanceRows.find(
        r => r.employee_id === target.employee_id && r.date === target.date
      );

      let totalHours = '0.00';
      let netHours = '0.00';

      if (target.requested_logout_time) {
        const loginDateTime = new Date(`${target.date}T${target.requested_login_time.length === 5 ? target.requested_login_time + ':00' : target.requested_login_time}`);
        const logoutDateTime = new Date(`${target.date}T${target.requested_logout_time.length === 5 ? target.requested_logout_time + ':00' : target.requested_logout_time}`);
        const diffMin = Math.max(0, differenceInMinutes(logoutDateTime, loginDateTime));
        totalHours = (diffMin / 60).toFixed(2);
        netHours = totalHours;
      }

      if (existing) {
        await updateRow('Attendance', 'id', existing.id, {
          login_time: target.requested_login_time,
          logout_time: target.requested_logout_time || existing.logout_time || '',
          total_hours: totalHours !== '0.00' ? totalHours : existing.total_hours,
          net_hours: netHours !== '0.00' ? netHours : existing.net_hours,
          status: 'Regularized',
          in_geofence: 'OVERRIDE'
        });
      } else {
        await addRow('Attendance', {
          id: `ATT-REG-${Date.now()}-${target.employee_id}`,
          date: target.date,
          employee_id: target.employee_id,
          employee_name: target.employee_name,
          login_time: target.requested_login_time,
          logout_time: target.requested_logout_time || '',
          total_hours: totalHours,
          break_hours: '0.00',
          net_hours: netHours,
          status: 'Regularized',
          punch_in_lat: 'REGULARIZED',
          punch_in_lng: 'REGULARIZED',
          punch_out_lat: target.requested_logout_time ? 'REGULARIZED' : '',
          punch_out_lng: target.requested_logout_time ? 'REGULARIZED' : '',
          in_geofence: 'OVERRIDE',
          created_at: new Date().toISOString()
        });
      }
    }

    // If Rejected, dispatch professional notification email
    if (action === 'Rejected') {
      try {
        const employees = await getRows('Employees');
        const emp = employees.find(e => e.id === target.employee_id);
        const empEmail = emp?.email;

        if (empEmail) {
          await sendProfessionalRejectionEmail({
            toEmail: empEmail,
            employeeName: target.employee_name || emp.name,
            requestType: 'Attendance Regularization Request',
            rejectionReason: review_remarks || 'Punch correction could not be verified with operational records',
            details: {
              date: target.date,
              requested_times: `In: ${target.requested_login_time}${target.requested_logout_time ? ` | Out: ${target.requested_logout_time}` : ''}`
            },
            adminName: request.user.name
          });
        }
      } catch (mailErr) {
        console.error('Error sending regularization rejection email:', mailErr);
      }
    }

    // Log resolution to Communications
    await addRow('Communications_Log', {
      id: `LOG-${Date.now()}`,
      type: `REGULARIZATION_${action.toUpperCase()}`,
      sender_id: request.user.id,
      sender_name: request.user.name,
      recipient_id: target.employee_id,
      recipient_name: target.employee_name,
      subject: `Attendance Regularization ${action} (${target.date})`,
      message: `Admin ${request.user.name} ${action.toLowerCase()} regularization for ${target.employee_name} on ${target.date}. Remarks: ${review_remarks || 'None'}`,
      metadata_json: JSON.stringify({ request_id, action, review_remarks }),
      created_at: new Date().toISOString()
    });

    return {
      message: `Request ${action.toLowerCase()} successfully.`,
      request: updated
    };
  });

  // GET /api/communications/logs - Audit and communication trail
  fastify.get('/logs', { preHandler: [verifyAuth] }, async (request, reply) => {
    const logs = await getRows('Communications_Log');
    const isAdmin = request.user.role === 'admin';

    let filtered = logs;
    if (!isAdmin) {
      filtered = logs.filter(
        l => l.recipient_id === request.user.id || l.sender_id === request.user.id || l.recipient_id === 'ALL'
      );
    }

    const sorted = filtered.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return { logs: sorted };
  });
}
