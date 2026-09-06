import { getRows, addRow, updateRow, deleteRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { format } from 'date-fns';
import { getTodayDateStr } from '../utils/dateTime.js';

export default async function workDoneRoutes(fastify, options) {
  // Create a new work done / task entry
  fastify.post('/', { preHandler: [verifyAuth] }, async (request, reply) => {
    const {
      project_name,
      task_title,
      description = '',
      estimated_hours = '0',
      actual_hours = '0',
      status = 'Completed',
      remarks = '',
      date
    } = request.body || {};

    if (!project_name || !task_title) {
      return reply.status(400).send({ error: 'Project name and Task title are required.' });
    }

    const taskDate = date || getTodayDateStr();

    const newRecord = {
      id: `TASK-${Date.now()}-${request.user.id}`,
      date: taskDate,
      employee_id: request.user.id,
      employee_name: request.user.name,
      project_name,
      task_title,
      description,
      estimated_hours: String(estimated_hours),
      actual_hours: String(actual_hours),
      status,
      remarks,
      created_at: new Date().toISOString()
    };

    const saved = await addRow('WorkDone', newRecord);
    return {
      message: 'Work task logged successfully!',
      task: saved
    };
  });

  // Get current user's tasks
  fastify.get('/my-tasks', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { date } = request.query || {};
    const rows = await getRows('WorkDone');
    let userTasks = rows.filter(t => t.employee_id === request.user.id);

    if (date) {
      userTasks = userTasks.filter(t => t.date === date);
    }

    userTasks.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    return { tasks: userTasks };
  });

  // Get all tasks (Admin only)
  fastify.get('/all', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { date, employee_id } = request.query || {};
    let rows = await getRows('WorkDone');

    if (date) {
      rows = rows.filter(t => t.date === date);
    }
    if (employee_id) {
      rows = rows.filter(t => t.employee_id === employee_id);
    }

    rows.sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime());
    return { tasks: rows };
  });

  // Update a task
  fastify.put('/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const {
      project_name,
      task_title,
      description,
      estimated_hours,
      actual_hours,
      status,
      remarks
    } = request.body || {};

    const rows = await getRows('WorkDone');
    const existing = rows.find(r => r.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Task not found.' });
    }

    // Check ownership unless admin
    if (request.user.role !== 'admin' && existing.employee_id !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden: You can only edit your own tasks.' });
    }

    const updateData = {};
    if (project_name !== undefined) updateData.project_name = project_name;
    if (task_title !== undefined) updateData.task_title = task_title;
    if (description !== undefined) updateData.description = description;
    if (estimated_hours !== undefined) updateData.estimated_hours = String(estimated_hours);
    if (actual_hours !== undefined) updateData.actual_hours = String(actual_hours);
    if (status !== undefined) updateData.status = status;
    if (remarks !== undefined) updateData.remarks = remarks;

    const updated = await updateRow('WorkDone', 'id', id, updateData);
    return { message: 'Task updated successfully', task: updated };
  });

  // Delete a task
  fastify.delete('/:id', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { id } = request.params;
    const rows = await getRows('WorkDone');
    const existing = rows.find(r => r.id === id);

    if (!existing) {
      return reply.status(404).send({ error: 'Task not found.' });
    }

    if (request.user.role !== 'admin' && existing.employee_id !== request.user.id) {
      return reply.status(403).send({ error: 'Forbidden: You can only delete your own tasks.' });
    }

    await deleteRow('WorkDone', 'id', id);
    return { message: 'Task deleted successfully' };
  });
}
