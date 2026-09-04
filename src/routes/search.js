import { getRows } from '../sheets.js';
import { verifyAuth } from '../auth.js';

export default async function searchRoutes(fastify, options) {
  // GET /api/search?q=query (Universal Global Search)
  fastify.get('/', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { q = '' } = request.query || {};
    const query = q.trim().toLowerCase();

    if (!query || query.length < 1) {
      return {
        query: '',
        counts: { total: 0, employees: 0, tasks: 0, leaves: 0, weeklyReports: 0, evaluations: 0 },
        results: {
          employees: [],
          tasks: [],
          leaves: [],
          weeklyReports: [],
          evaluations: []
        }
      };
    }

    // Parallel fetch across Google Sheets tabs
    const [
      employees,
      assignedTasks,
      workDone,
      leaves,
      permissions,
      weeklyReports,
      evaluations
    ] = await Promise.all([
      getRows('Employees').catch(() => []),
      getRows('Assigned_Tasks').catch(() => []),
      getRows('Work_Done').catch(() => []),
      getRows('Leaves').catch(() => []),
      getRows('Permissions').catch(() => []),
      getRows('Weekly_Reports').catch(() => []),
      getRows('Evaluations').catch(() => [])
    ]);

    // 1. Match Employees
    const matchedEmployees = employees
      .filter(e =>
        e.name?.toLowerCase().includes(query) ||
        e.email?.toLowerCase().includes(query) ||
        e.id?.toLowerCase().includes(query) ||
        e.department?.toLowerCase().includes(query) ||
        e.designation?.toLowerCase().includes(query)
      )
      .slice(0, 8)
      .map(e => ({
        id: e.id,
        title: e.name,
        subtitle: `${e.designation || 'Staff'} • ${e.department || 'Operations'} (${e.id})`,
        email: e.email,
        role: e.role,
        type: 'employee',
        targetTab: request.user.role === 'admin' ? 'admin-timesheets' : 'profile',
        payload: { employeeId: e.id, email: e.email }
      }));

    // 2. Match Tasks
    const matchedTasks = assignedTasks
      .filter(t =>
        t.task_title?.toLowerCase().includes(query) ||
        t.project_name?.toLowerCase().includes(query) ||
        t.task_id?.toLowerCase().includes(query) ||
        t.assigned_to_name?.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      )
      .slice(0, 8)
      .map(t => ({
        id: t.task_id || t.id,
        title: t.task_title,
        subtitle: `[${t.project_name || 'General'}] Assigned to: ${t.assigned_to_name || 'Team'} • ${t.status || 'Pending'}`,
        status: t.status,
        priority: t.priority,
        type: 'task',
        targetTab: 'task-tracker',
        payload: { taskId: t.task_id || t.id }
      }));

    // 3. Match Leaves & Short Permissions
    const matchedLeaves = [
      ...leaves.map(l => ({ ...l, itemType: 'Leave' })),
      ...permissions.map(p => ({ ...p, itemType: 'Permission', leave_type: p.permission_type || 'Short Pass' }))
    ]
      .filter(l =>
        l.employee_name?.toLowerCase().includes(query) ||
        l.leave_type?.toLowerCase().includes(query) ||
        l.reason?.toLowerCase().includes(query) ||
        l.status?.toLowerCase().includes(query)
      )
      .slice(0, 6)
      .map(l => ({
        id: l.id,
        title: `${l.itemType}: ${l.leave_type} (${l.status || 'Pending'})`,
        subtitle: `${l.employee_name} • ${l.start_date || l.date || ''} ${l.end_date ? `to ${l.end_date}` : ''} • Reason: ${l.reason || '--'}`,
        status: l.status,
        type: 'leave',
        targetTab: 'leaves',
        payload: { leaveId: l.id }
      }));

    // 4. Match Weekly Reports
    const matchedWeekly = weeklyReports
      .filter(w =>
        w.employee_name?.toLowerCase().includes(query) ||
        w.week_label?.toLowerCase().includes(query) ||
        w.accomplishments?.toLowerCase().includes(query) ||
        w.challenges_blockers?.toLowerCase().includes(query) ||
        w.next_week_goals?.toLowerCase().includes(query)
      )
      .slice(0, 6)
      .map(w => ({
        id: w.id,
        title: `Weekly Check-in: ${w.week_label || `Week ${w.week_number}`}`,
        subtitle: `${w.employee_name} (${w.submission_date}) • Goals: ${w.next_week_goals ? w.next_week_goals.substring(0, 60) + '...' : ''}`,
        type: 'weeklyReport',
        targetTab: request.user.role === 'admin' ? 'admin-weekly' : 'weekly-report',
        payload: { reportId: w.id }
      }));

    // 5. Match Monthly Appraisals
    const matchedEvals = evaluations
      .filter(ev =>
        ev.employee_name?.toLowerCase().includes(query) ||
        ev.review_month?.toLowerCase().includes(query) ||
        ev.key_achievements?.toLowerCase().includes(query) ||
        ev.overall_rating?.toString().includes(query)
      )
      .slice(0, 6)
      .map(ev => ({
        id: ev.id,
        title: `Monthly Appraisal: ${ev.review_month}`,
        subtitle: `${ev.employee_name} • Rating: ${ev.overall_rating || '--'} / 5.0 ⭐ • Submitted: ${ev.submission_date}`,
        type: 'evaluation',
        targetTab: request.user.role === 'admin' ? 'admin-evals' : 'self-eval',
        payload: { evalId: ev.id }
      }));

    const totalCount =
      matchedEmployees.length +
      matchedTasks.length +
      matchedLeaves.length +
      matchedWeekly.length +
      matchedEvals.length;

    return {
      query,
      counts: {
        total: totalCount,
        employees: matchedEmployees.length,
        tasks: matchedTasks.length,
        leaves: matchedLeaves.length,
        weeklyReports: matchedWeekly.length,
        evaluations: matchedEvals.length
      },
      results: {
        employees: matchedEmployees,
        tasks: matchedTasks,
        leaves: matchedLeaves,
        weeklyReports: matchedWeekly,
        evaluations: matchedEvals
      }
    };
  });
}
