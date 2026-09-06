import { getRows, addRow, updateRow, deleteRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { format } from 'date-fns';
import { sendPushNotification, broadcastPushNotification } from '../pushService.js';
import { getTodayDateStr } from '../utils/dateTime.js';

export default async function tasksRoutes(fastify, options) {
  // 1. Assign a new task to one or multiple staff members (Manager / Admin only)
  fastify.post('/assign', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const {
      task_title,
      project_name,
      description = '',
      assigned_to_id,
      assigned_to_ids,
      priority = 'Medium',
      due_date = '',
      estimated_hours = '4'
    } = request.body || {};

    // Normalize multiple assignee IDs
    let assigneeIdList = [];
    if (Array.isArray(assigned_to_ids) && assigned_to_ids.length > 0) {
      assigneeIdList = assigned_to_ids.filter(Boolean);
    } else if (assigned_to_id) {
      assigneeIdList = typeof assigned_to_id === 'string' && assigned_to_id.includes(',')
        ? assigned_to_id.split(',').map(s => s.trim()).filter(Boolean)
        : [assigned_to_id];
    }

    if (!task_title || !project_name || assigneeIdList.length === 0) {
      return reply.status(400).send({ error: 'Task title, Project name, and at least one Assignee are required.' });
    }

    // Lookup assignee names
    const employees = await getRows('Employees');
    const assignees = assigneeIdList.map(id => {
      const found = employees.find(e => e.id === id);
      return {
        id,
        name: found ? found.name : id
      };
    });

    const assigned_to_id_str = assignees.map(a => a.id).join(',');
    const assigned_to_name_str = assignees.map(a => a.name).join(', ');

    const newTask = {
      id: `TASK-ASSIGN-${Date.now()}-${assigneeIdList[0]}`,
      task_title: task_title.trim(),
      project_name: project_name.trim(),
      description: description.trim(),
      assigned_by_id: request.user.id,
      assigned_by_name: request.user.name,
      assigned_to_id: assigned_to_id_str,
      assigned_to_name: assigned_to_name_str,
      priority,
      due_date: due_date || format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      estimated_hours: String(estimated_hours),
      actual_hours: '0',
      progress: '0',
      status: 'Assigned',
      work_notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const saved = await addRow('Assigned_Tasks', newTask);

    // 🔔 Push notification to all assigned staff members
    for (const assignee of assignees) {
      sendPushNotification(assignee.id, {
        title: 'New Task Assigned',
        body: `"${task_title}" on ${project_name} — due ${newTask.due_date}. Assigned by ${request.user.name}.`,
        url: '/?tab=task-tracker',
        tab: 'task-tracker',
        tag: `task-assigned-${saved.id}`
      }).catch(() => {});
    }

    return {
      message: `Task successfully assigned to ${assigned_to_name_str}!`,
      task: saved
    };
  });

  // 2. Get tasks assigned to logged-in employee (supports shared multi-staff tasks)
  fastify.get('/my-assigned', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Assigned_Tasks');
    const myTasks = rows.filter(t => {
      if (!t.assigned_to_id) return false;
      const ids = t.assigned_to_id.split(',').map(s => s.trim());
      return ids.includes(request.user.id);
    });
    myTasks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { tasks: myTasks };
  });

  // 3. Employee updates progress, status, actual hours, or notes
  fastify.put('/:id/progress', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const { progress, status, actual_hours, work_notes } = request.body || {};

    const rows = await getRows('Assigned_Tasks');
    const existing = rows.find(r => r.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Assigned task not found.' });
    }

    // Check if user is among the assignees or admin
    const assigneeIds = (existing.assigned_to_id || '').split(',').map(s => s.trim()).filter(Boolean);
    const isAssignee = assigneeIds.includes(request.user.id);

    if (request.user.role !== 'admin' && !isAssignee) {
      return reply.status(403).send({ error: 'Forbidden: You can only update tasks assigned to you.' });
    }

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (progress !== undefined) {
      updateData.progress = String(progress);
      if (Number(progress) >= 100 && (!status || status === 'In-Progress')) {
        updateData.status = 'Completed';
      }
    }
    if (status !== undefined) updateData.status = status;
    if (actual_hours !== undefined) updateData.actual_hours = String(actual_hours);
    if (work_notes !== undefined) updateData.work_notes = work_notes;

    const updated = await updateRow('Assigned_Tasks', 'id', id, updateData);

    // If marked completed, record into WorkDone sheet for assignees if not already logged
    if (updated.status === 'Completed') {
      const workDoneRows = await getRows('WorkDone');
      const employeeRows = await getRows('Employees');

      for (const empId of assigneeIds) {
        const emp = employeeRows.find(e => e.id === empId);
        const empName = emp ? emp.name : empId;
        const alreadyLogged = workDoneRows.find(w => w.task_title === existing.task_title && w.employee_id === empId);

        if (!alreadyLogged) {
          await addRow('WorkDone', {
            id: `TASK-DONE-${Date.now()}-${empId}`,
            date: getTodayDateStr(),
            employee_id: empId,
            employee_name: empName,
            project_name: existing.project_name,
            task_title: existing.task_title,
            description: existing.description,
            estimated_hours: existing.estimated_hours,
            actual_hours: updateData.actual_hours || existing.actual_hours || existing.estimated_hours,
            status: 'Completed',
            remarks: updateData.work_notes || existing.work_notes || 'Team task completed.',
            created_at: new Date().toISOString()
          });
        }
      }

      // 🔔 Push notification to admin: task completed
      sendPushNotification('EMP-ADMIN-01', {
        title: 'Task Completed',
        body: `${request.user.name} completed "${existing.task_title}" on ${existing.project_name}.`,
        url: '/?tab=admin-tasks',
        tab: 'admin-tasks',
        tag: `task-completed-${id}`
      }).catch(() => {});
    }

    return {
      message: 'Task progress updated successfully!',
      task: updated
    };
  });

  // 4. Get all assigned tasks across team (Manager / Admin view)
  fastify.get('/all', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { employee_id, project_name, status, priority } = request.query || {};
    let rows = await getRows('Assigned_Tasks');

    if (employee_id) {
      rows = rows.filter(t => {
        if (!t.assigned_to_id) return false;
        const ids = t.assigned_to_id.split(',').map(s => s.trim());
        return ids.includes(employee_id);
      });
    }
    if (project_name) rows = rows.filter(t => t.project_name?.toLowerCase().includes(project_name.toLowerCase()));
    if (status) rows = rows.filter(t => t.status === status);
    if (priority) rows = rows.filter(t => t.priority === priority);

    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { tasks: rows };
  });

  // 5. Delete an assigned task (Manager / Admin only)
  fastify.delete('/:id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const rows = await getRows('Assigned_Tasks');
    const existing = rows.find(r => r.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Assigned task not found.' });
    }

    await deleteRow('Assigned_Tasks', 'id', id);
    return { message: 'Task assignment deleted successfully' };
  });
}
