import { getRows, addRow, updateRow } from '../sheets.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { format, startOfWeek, endOfWeek, getWeek, getYear, lastDayOfMonth, getDate } from 'date-fns';

export default async function evaluationRoutes(fastify, options) {
  // GET /api/evaluations/monthly-status (Check if currently in the 5-day review window)
  fastify.get('/monthly-status', { preHandler: [verifyAuth] }, async (request, reply) => {
    const now = new Date();
    const currentDay = getDate(now);
    const lastDate = getDate(lastDayOfMonth(now));
    const daysUntilMonthEnd = lastDate - currentDay;
    const isWindowOpen = daysUntilMonthEnd < 5; // Opens 5 days before month end (e.g. day 26/27 onwards)
    const openDate = format(new Date(now.getFullYear(), now.getMonth(), lastDate - 4), 'yyyy-MM-dd');
    const currentMonthKey = format(now, 'yyyy-MM');
    const currentMonthLabel = format(now, 'MMMM yyyy');

    const evalRows = await getRows('Self_Evaluations');
    const mySubmissions = evalRows.filter(
      e => e.employee_id === request.user.id && (e.review_month?.includes(currentMonthLabel) || e.submission_date?.startsWith(currentMonthKey))
    );

    return {
      currentDate: format(now, 'yyyy-MM-dd'),
      currentMonthLabel,
      currentMonthKey,
      isWindowOpen,
      daysUntilMonthEnd,
      openDate,
      hasSubmittedThisMonth: mySubmissions.length > 0,
      latestSubmission: mySubmissions[0] || null
    };
  });

  // GET /api/evaluations/prefill-tasks (Auto-pull employee's logged tasks for the month)
  fastify.get('/prefill-tasks', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { month_year } = request.query || {};
    const targetMonth = month_year || format(new Date(), 'yyyy-MM');

    const workDoneRows = await getRows('WorkDone');
    const userTasks = workDoneRows.filter(
      w => w.employee_id === request.user.id && w.date?.startsWith(targetMonth)
    );

    const prefilledTargets = userTasks.map(t => ({
      task: `[${t.project_name}] ${t.task_title}`,
      description: t.description || '',
      progress: t.status === 'Completed' ? '100%' : t.status === 'In-Progress' ? '70%' : '30%',
      status: t.status || 'Completed',
      remarks: t.remarks || `${t.actual_hours}h spent (${t.estimated_hours}h est)`
    }));

    return {
      monthYear: targetMonth,
      employee: request.user,
      tasksCount: userTasks.length,
      prefilledTargets
    };
  });

  // GET /api/evaluations/prefill-weekly-tasks (Auto-pull employee's logged tasks for the current week)
  fastify.get('/prefill-weekly-tasks', { preHandler: [verifyAuth] }, async (request, reply) => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekNum = getWeek(now);
    const year = getYear(now);

    const [workDoneRows, assignedTasks] = await Promise.all([
      getRows('WorkDone'),
      getRows('Assigned_Tasks')
    ]);

    const weeklyDone = workDoneRows.filter(
      w => w.employee_id === request.user.id && w.date >= weekStart && w.date <= weekEnd
    );

    const weeklyAssigned = assignedTasks.filter(
      t => t.assigned_to_id === request.user.id
    );

    const bullets = weeklyDone.map(
      (t, idx) => `${idx + 1}. [${t.project_name}] ${t.task_title} (${t.status || 'Completed'} - ${t.actual_hours}h)`
    );

    return {
      weekNumber: weekNum,
      year,
      weekLabel: `Week ${weekNum} (${weekStart} to ${weekEnd})`,
      startDate: weekStart,
      endDate: weekEnd,
      tasksCount: weeklyDone.length,
      summaryText: bullets.length > 0 ? bullets.join('\n') : '',
      weeklyTasks: weeklyDone,
      assignedTasks: weeklyAssigned
    };
  });

  // POST /api/evaluations/weekly-submit (Submit Lightweight 4-Pillar Weekly Check-in)
  fastify.post('/weekly-submit', { preHandler: [verifyAuth] }, async (request, reply) => {
    // Admin is exempt from submitting reports
    if (request.user.role === 'admin') {
      return reply.status(403).send({ error: 'Admin users do not submit weekly reports.' });
    }

    const {
      week_number,
      year = getYear(new Date()),
      week_label,
      accomplishments = '',
      challenges_blockers = '',
      learnings_skills = '',
      next_week_goals = ''
    } = request.body || {};

    if (!accomplishments.trim() || !challenges_blockers.trim() || !next_week_goals.trim()) {
      return reply.status(400).send({
        error: 'Please fill in Key Accomplishments, Challenges / Blockers, and Next Week Goals.'
      });
    }

    const currentWeekNum = week_number || getWeek(new Date());
    const label = week_label || `Week ${currentWeekNum} (${format(new Date(), 'MMM yyyy')})`;

    const newWeeklyReport = {
      id: `WEEK-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      department: request.user.department || 'Operations',
      week_number: String(currentWeekNum),
      year: String(year),
      week_label: label,
      submission_date: format(new Date(), 'yyyy-MM-dd'),
      accomplishments,
      challenges_blockers,
      learnings_skills,
      next_week_goals,
      status: 'Submitted',
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Weekly_Reports', newWeeklyReport);
    return {
      message: 'Weekly Check-in report submitted successfully to Google Sheets!',
      report: saved
    };
  });

  // GET /api/evaluations/my-weekly (Get user's weekly check-in submissions)
  fastify.get('/my-weekly', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Weekly_Reports');
    const myReports = rows.filter(r => r.employee_id === request.user.id);
    myReports.sort((a, b) => new Date(b.created_at || b.submission_date).getTime() - new Date(a.created_at || a.submission_date).getTime());
    return { reports: myReports };
  });

  // GET /api/evaluations/all-weekly (Admin only)
  fastify.get('/all-weekly', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Weekly_Reports');
    rows.sort((a, b) => new Date(b.created_at || b.submission_date).getTime() - new Date(a.created_at || a.submission_date).getTime());
    return { reports: rows };
  });

  // POST /api/evaluations/submit (Submit 13-Section Monthly Self-Evaluation)
  fastify.post('/submit', { preHandler: [verifyAuth] }, async (request, reply) => {
    // Admin is exempt from submitting reports
    if (request.user.role === 'admin') {
      return reply.status(403).send({ error: 'Admin users do not submit monthly evaluations.' });
    }

    const {
      reporting_person = 'Operations Manager',
      review_month = format(new Date(), 'MMMM yyyy'),
      review_period = '',
      submission_date = format(new Date(), 'yyyy-MM-dd'),
      monthly_work_summary = '',
      targets_tasks = [],
      ratings = {},
      key_accomplishments = '',
      challenges_faced = '',
      learning_development = '',
      areas_for_improvement = '',
      support_required = '',
      goals_next_month = '',
      employee_comments = '',
      employee_declaration = true,
      signature = ''
    } = request.body || {};

    if (!monthly_work_summary || !key_accomplishments || !goals_next_month) {
      return reply.status(400).send({
        error: 'Please fill out all required core sections (Monthly Work Summary, Key Accomplishments, Goals for Next Month).'
      });
    }

    // Calculate overall average rating (1 to 5 scale)
    const ratingValues = Object.values(ratings).map(v => parseFloat(v) || 0).filter(v => v > 0);
    const overallRating = ratingValues.length > 0
      ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(1)
      : '4.5';

    const evaluationRecord = {
      id: `EVAL-${Date.now()}-${request.user.id}`,
      employee_id: request.user.id,
      employee_name: request.user.name,
      designation: request.user.designation || 'Software Engineer',
      department: request.user.department || 'Engineering',
      reporting_person,
      review_month,
      review_period: review_period || `01-${format(new Date(), 'MMM-yyyy')} to ${format(lastDayOfMonth(new Date()), 'dd-MMM-yyyy')}`,
      submission_date,
      monthly_work_summary,
      targets_tasks_json: JSON.stringify(targets_tasks),
      ratings_json: JSON.stringify(ratings),
      overall_rating: String(overallRating),
      key_accomplishments,
      challenges_faced,
      learning_development,
      areas_for_improvement,
      support_required,
      goals_next_month,
      employee_comments,
      employee_declaration: employee_declaration ? 'TRUE' : 'FALSE',
      signature: signature || request.user.name,
      manager_feedback: '',
      manager_rating: '',
      status: 'Submitted',
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Self_Evaluations', evaluationRecord);
    return {
      message: 'Monthly Self-Evaluation Performance Appraisal submitted successfully to Google Sheets!',
      evaluation: {
        ...saved,
        targets_tasks,
        ratings
      }
    };
  });

  // GET /api/evaluations/my-evaluations
  fastify.get('/my-evaluations', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Self_Evaluations');
    const userEvals = rows.filter(e => e.employee_id === request.user.id);
    
    const parsed = userEvals.map(e => {
      let targets = [];
      let ratings = {};
      try { targets = JSON.parse(e.targets_tasks_json); } catch (err) {}
      try { ratings = JSON.parse(e.ratings_json); } catch (err) {}
      return {
        ...e,
        targets_tasks: targets,
        ratings
      };
    });

    parsed.sort((a, b) => new Date(b.created_at || b.submission_date).getTime() - new Date(a.created_at || a.submission_date).getTime());
    return { evaluations: parsed };
  });

  // GET /api/evaluations/all (Admin only)
  fastify.get('/all', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('Self_Evaluations');
    const parsed = rows.map(e => {
      let targets = [];
      let ratings = {};
      try { targets = JSON.parse(e.targets_tasks_json); } catch (err) {}
      try { ratings = JSON.parse(e.ratings_json); } catch (err) {}
      return {
        ...e,
        targets_tasks: targets,
        ratings
      };
    });

    parsed.sort((a, b) => new Date(b.created_at || b.submission_date).getTime() - new Date(a.created_at || a.submission_date).getTime());
    return { evaluations: parsed };
  });

  // PUT /api/evaluations/:id/manager-review (Admin only)
  fastify.put('/:id/manager-review', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { manager_feedback = '', manager_rating = '5' } = request.body || {};

    const updated = await updateRow('Self_Evaluations', 'id', id, {
      manager_feedback,
      manager_rating: String(manager_rating),
      status: 'Reviewed'
    });

    if (!updated) {
      return reply.status(404).send({ error: 'Evaluation not found.' });
    }

    return {
      message: 'Manager performance review recorded successfully in Google Sheets!',
      evaluation: updated
    };
  });
}
