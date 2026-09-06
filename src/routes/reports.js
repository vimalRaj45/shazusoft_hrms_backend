import { getRows, addRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { generateMonthlyAIReport } from '../mistral.js';
import { format } from 'date-fns';
import { getCurrentMonthStr } from '../utils/dateTime.js';

const normalizeDateStr = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
};

export default async function reportsRoutes(fastify, options) {
  // GET /api/reports/employee-full-report (Comprehensive Business Analysis Without AI)
  fastify.get('/employee-full-report', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { employee_id, month_year } = request.query || {};
    const targetEmpId = request.user.role === 'admin' && employee_id ? employee_id : request.user.id;
    const targetMonth = month_year || getCurrentMonthStr();

    // Fetch all related data
    const [employees, attendance, workDone, leaves, permissions] = await Promise.all([
      getRows('Employees'),
      getRows('Attendance'),
      getRows('WorkDone'),
      getRows('Leaves'),
      getRows('Permissions')
    ]);

    const employee = employees.find(e => e.id === targetEmpId || e.email === targetEmpId);
    if (!employee) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    // Filter data for target month
    const empAttendance = attendance
      .filter(a => (a.employee_id === employee.id || a.employee_id === employee.email || a.employee_name === employee.name) && normalizeDateStr(a.date).startsWith(targetMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const empWorkDone = workDone
      .filter(w => (w.employee_id === employee.id || w.employee_id === employee.email || w.employee_name === employee.name) && normalizeDateStr(w.date).startsWith(targetMonth))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const empLeaves = leaves
      .filter(l => (l.employee_id === employee.id || l.employee_id === employee.email) && (normalizeDateStr(l.start_date).startsWith(targetMonth) || normalizeDateStr(l.applied_at).startsWith(targetMonth)));

    const empPermissions = permissions
      .filter(p => (p.employee_id === employee.id || p.employee_id === employee.email) && normalizeDateStr(p.date).startsWith(targetMonth));

    // Numerical Metrics
    const totalDaysLogged = empAttendance.length;
    const presentDays = empAttendance.filter(a => ['Present', 'Verified Office Present', 'Present & Working', 'Punched Out', 'Regularized', 'Late', 'Half-Day'].includes(a.status) || a.in_geofence === 'TRUE' || a.in_geofence === 'WFH').length;
    const lateDays = empAttendance.filter(a => a.status === 'Late').length;
    const halfDays = empAttendance.filter(a => a.status === 'Half-Day').length;

    const totalHoursGross = empAttendance.reduce((acc, a) => acc + (parseFloat(a.total_hours) || parseFloat(a.net_hours) || 0), 0);
    const totalNetHours = empAttendance.reduce((acc, a) => acc + (parseFloat(a.net_hours) || parseFloat(a.total_hours) || 0), 0);
    const avgDailyNetHours = totalDaysLogged > 0 ? (totalNetHours / totalDaysLogged).toFixed(2) : '0';

    const totalTasks = empWorkDone.length;
    const completedTasks = empWorkDone.filter(w => w.status === 'Completed').length;
    const inProgressTasks = empWorkDone.filter(w => w.status === 'In-Progress').length;
    const pendingTasks = empWorkDone.filter(w => w.status === 'Pending/Blocked' || w.status === 'Pending').length;

    const totalEstimatedHours = empWorkDone.reduce((acc, w) => acc + (parseFloat(w.estimated_hours) || 0), 0);
    const totalActualHours = empWorkDone.reduce((acc, w) => acc + (parseFloat(w.actual_hours) || 0), 0);
    const timeVarianceHours = (totalActualHours - totalEstimatedHours).toFixed(1);

    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const attendancePercentage = totalDaysLogged > 0 ? Math.min(100, Math.round(((presentDays + lateDays * 0.8) / Math.max(totalDaysLogged, 20)) * 100)) : 0;

    // 1. DEEP PROJECT-WISE TIME & TASK DISTRIBUTION
    const projectBreakdownMap = {};
    empWorkDone.forEach(task => {
      const proj = task.project_name || 'General Operations';
      if (!projectBreakdownMap[proj]) {
        projectBreakdownMap[proj] = {
          projectName: proj,
          totalTasks: 0,
          completedTasks: 0,
          estimatedHours: 0,
          actualHours: 0,
          tasks: []
        };
      }
      projectBreakdownMap[proj].totalTasks += 1;
      if (task.status === 'Completed') projectBreakdownMap[proj].completedTasks += 1;
      projectBreakdownMap[proj].estimatedHours += parseFloat(task.estimated_hours) || 0;
      projectBreakdownMap[proj].actualHours += parseFloat(task.actual_hours) || 0;
      projectBreakdownMap[proj].tasks.push(task);
    });

    const projectBreakdown = Object.values(projectBreakdownMap).map(p => ({
      ...p,
      estimatedHours: p.estimatedHours.toFixed(1),
      actualHours: p.actualHours.toFixed(1),
      percentageShare: totalActualHours > 0 ? Math.round((p.actualHours / totalActualHours) * 100) : 0,
      completionRate: p.totalTasks > 0 ? Math.round((p.completedTasks / p.totalTasks) * 100) : 0
    })).sort((a, b) => b.actualHours - a.actualHours);

    // 2. TIME ESTIMATION ACCURACY ANALYSIS (Overrun vs Efficient tasks)
    const taskVariances = empWorkDone.map(t => {
      const est = parseFloat(t.estimated_hours) || 0;
      const act = parseFloat(t.actual_hours) || 0;
      const diff = parseFloat((act - est).toFixed(1));
      return {
        id: t.id,
        date: t.date,
        project: t.project_name,
        title: t.task_title,
        estimated: est,
        actual: act,
        difference: diff,
        isOverrun: diff > 0,
        isAheadOfTime: diff < 0,
        isOnTarget: diff === 0,
        remarks: t.remarks
      };
    });

    const overrunTasks = taskVariances.filter(t => t.isOverrun);
    const aheadTasks = taskVariances.filter(t => t.isAheadOfTime);
    const onTargetTasks = taskVariances.filter(t => t.isOnTarget);

    // 3. DAY-BY-DAY CHRONOLOGICAL TIMELINE (Punch + Tasks)
    // Collect all unique dates in the month
    const allDates = [...new Set([
      ...empAttendance.map(a => normalizeDateStr(a.date)),
      ...empWorkDone.map(w => normalizeDateStr(w.date))
    ])].filter(Boolean).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    const dailyActivityTimeline = allDates.map(d => {
      const att = empAttendance.find(a => normalizeDateStr(a.date) === d);
      const dayTasks = empWorkDone.filter(w => normalizeDateStr(w.date) === d);

      return {
        date: d,
        attendanceStatus: att ? att.status : 'Absent',
        loginTime: att ? att.login_time : null,
        logoutTime: att ? att.logout_time : null,
        grossHours: att ? att.total_hours : '0',
        netHours: att ? (att.net_hours || att.total_hours) : '0',
        workMode: att?.in_geofence === 'WFH' ? 'WFH' : 'Office',
        tasksCount: dayTasks.length,
        tasks: dayTasks.map(t => ({
          title: t.task_title,
          project: t.project_name,
          est: t.estimated_hours,
          act: t.actual_hours,
          status: t.status,
          remarks: t.remarks
        }))
      };
    });

    // 4. LEAVE & PERMISSION AUDIT
    const leaveSummary = {
      totalApprovedDays: empLeaves.filter(l => l.status === 'Approved').reduce((s, l) => s + (parseFloat(l.total_days) || 0), 0),
      totalPendingDays: empLeaves.filter(l => l.status === 'Pending').reduce((s, l) => s + (parseFloat(l.total_days) || 0), 0),
      leavesList: empLeaves,
      permissionsTakenCount: empPermissions.length,
      permissionsApprovedCount: empPermissions.filter(p => p.status === 'Approved').length,
      permissionsList: empPermissions
    };

    return {
      reportType: 'DEEP_BUSINESS_PERFORMANCE_REPORT',
      monthYear: targetMonth,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        designation: employee.designation
      },
      summaryMetrics: {
        totalDaysLogged,
        presentDays,
        lateDays,
        halfDays,
        totalHoursGross: totalHoursGross.toFixed(2),
        totalNetHours: totalNetHours.toFixed(2),
        avgDailyNetHours,
        attendancePercentage: `${attendancePercentage}%`,
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        taskCompletionRate: `${taskCompletionRate}%`,
        totalEstimatedHours: totalEstimatedHours.toFixed(1),
        totalActualHours: totalActualHours.toFixed(1),
        timeVarianceHours,
        projectsCount: projectBreakdown.length
      },
      projectBreakdown,
      estimationAnalysis: {
        totalOverrunHours: overrunTasks.reduce((s, t) => s + t.difference, 0).toFixed(1),
        totalSavedHours: Math.abs(aheadTasks.reduce((s, t) => s + t.difference, 0)).toFixed(1),
        overrunCount: overrunTasks.length,
        aheadCount: aheadTasks.length,
        onTargetCount: onTargetTasks.length,
        overrunTasks,
        aheadTasks
      },
      dailyActivityTimeline,
      leaveSummary,
      details: {
        attendanceLogs: empAttendance,
        workDoneLogs: empWorkDone,
        leaves: empLeaves,
        permissions: empPermissions
      },
      generatedAt: new Date().toISOString()
    };
  });

  // POST /api/reports/generate (Mistral AI Monthly Report)
  fastify.post('/generate', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { month_year, employee_id = 'ALL' } = request.body || {};
    const targetMonth = month_year || getCurrentMonthStr();

    // Fetch all related rows
    const attendanceRows = await getRows('Attendance');
    const workDoneRows = await getRows('WorkDone');
    const breakRows = await getRows('Breaks');
    const employeeRows = await getRows('Employees');

    let filteredAttendance = attendanceRows.filter(a => normalizeDateStr(a.date).startsWith(targetMonth));
    let filteredWorkDone = workDoneRows.filter(w => normalizeDateStr(w.date).startsWith(targetMonth));
    let filteredBreaks = breakRows.filter(b => normalizeDateStr(b.date).startsWith(targetMonth));

    let targetEmployee = null;
    if (employee_id && employee_id !== 'ALL') {
      targetEmployee = employeeRows.find(e => e.id === employee_id || e.email === employee_id) || null;
      if (targetEmployee) {
        filteredAttendance = filteredAttendance.filter(a => a.employee_id === targetEmployee.id || a.employee_id === targetEmployee.email || a.employee_name === targetEmployee.name);
        filteredWorkDone = filteredWorkDone.filter(w => w.employee_id === targetEmployee.id || w.employee_id === targetEmployee.email || w.employee_name === targetEmployee.name);
        filteredBreaks = filteredBreaks.filter(b => b.employee_id === targetEmployee.id || b.employee_id === targetEmployee.email);
      }
    }

    const reportResult = await generateMonthlyAIReport({
      monthYear: targetMonth,
      targetEmployee,
      attendanceRecords: filteredAttendance,
      workDoneRecords: filteredWorkDone,
      breakRecords: filteredBreaks
    });

    const reportRecord = {
      id: `REP-${Date.now()}`,
      month_year: targetMonth,
      target: targetEmployee ? `${targetEmployee.name} (${targetEmployee.id})` : 'ALL Employees',
      attendance_rate: reportResult.attendanceRate,
      task_completion_rate: reportResult.taskCompletionRate,
      avg_daily_hours: reportResult.avgDailyHours,
      summary: reportResult.summary,
      productivity_score: String(reportResult.productivityScore),
      key_insights: JSON.stringify(reportResult.keyInsights),
      generated_at: reportResult.generatedAt
    };

    await addRow('AI_Reports', reportRecord);

    return {
      message: `Mistral AI Monthly Report for ${targetMonth} generated successfully!`,
      report: {
        ...reportRecord,
        key_insights: reportResult.keyInsights
      }
    };
  });

  // GET /api/reports/history
  fastify.get('/history', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const rows = await getRows('AI_Reports');
    const parsed = rows.map(r => {
      let insights = [];
      try {
        insights = typeof r.key_insights === 'string' ? JSON.parse(r.key_insights) : r.key_insights;
      } catch (e) {
        insights = [r.key_insights];
      }
      return {
        ...r,
        key_insights: insights
      };
    });

    parsed.sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
    return { reports: parsed };
  });
}
