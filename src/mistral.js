import { Mistral } from '@mistralai/mistralai';
import { config } from './config.js';

function getMistralClient() {
  if (config.mistralApiKey) {
    try {
      return new Mistral({ apiKey: config.mistralApiKey });
    } catch (err) {
      console.warn('[Mistral AI] Failed to initialize Mistral client:', err.message);
    }
  }
  return null;
}

/**
 * Generate AI Monthly Performance & Productivity Analytics
 */
export async function generateMonthlyAIReport({ monthYear, targetEmployee, attendanceRecords, workDoneRecords, breakRecords }) {
  // Aggregate basic numerical metrics
  const totalDaysLogged = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(a => a.status === 'Present' || a.status === 'Verified Office Present').length;
  const lateDays = attendanceRecords.filter(a => a.status === 'Late').length;
  const halfDays = attendanceRecords.filter(a => a.status === 'Half-Day').length;

  const totalNetHours = attendanceRecords.reduce((acc, curr) => acc + (parseFloat(curr.net_hours) || 0), 0);
  const totalBreakHours = attendanceRecords.reduce((acc, curr) => acc + (parseFloat(curr.break_hours) || 0), 0);
  const avgDailyHours = totalDaysLogged > 0 ? (totalNetHours / totalDaysLogged).toFixed(2) : 0;

  const totalTasks = workDoneRecords.length;
  const completedTasks = workDoneRecords.filter(w => w.status === 'Completed').length;
  const inProgressTasks = workDoneRecords.filter(w => w.status === 'In-Progress').length;
  const pendingTasks = workDoneRecords.filter(w => w.status === 'Pending/Blocked' || w.status === 'Pending').length;

  const totalEstimatedHours = workDoneRecords.reduce((acc, curr) => acc + (parseFloat(curr.estimated_hours) || 0), 0);
  const totalActualHours = workDoneRecords.reduce((acc, curr) => acc + (parseFloat(curr.actual_hours) || 0), 0);

  const attendanceRate = totalDaysLogged > 0 ? Math.round(((presentDays + lateDays * 0.8) / Math.max(totalDaysLogged, 22)) * 100) : 0;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const promptContext = {
    monthYear,
    scope: targetEmployee ? `Employee: ${targetEmployee.name} (${targetEmployee.id})` : 'Entire Organization',
    attendance: {
      totalDaysLogged,
      presentDays,
      lateDays,
      halfDays,
      totalNetHours: totalNetHours.toFixed(1),
      totalBreakHours: totalBreakHours.toFixed(1),
      avgDailyHours
    },
    tasks: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      totalEstimatedHours: totalEstimatedHours.toFixed(1),
      totalActualHours: totalActualHours.toFixed(1),
      timeVariance: (totalActualHours - totalEstimatedHours).toFixed(1)
    },
    sampleTasks: workDoneRecords.slice(0, 10).map(t => ({
      title: t.task_title,
      project: t.project_name,
      est: t.estimated_hours,
      act: t.actual_hours,
      status: t.status,
      remarks: t.remarks
    }))
  };

  const mistral = getMistralClient();
  if (mistral) {
    try {
      const prompt = `
You are an executive HR and Operations Analytics Director writing an official leadership review for ${monthYear}.
Analyze the following monthly attendance, punctuality, and task delivery metrics:

DATA CONTEXT:
${JSON.stringify(promptContext, null, 2)}

Provide a thoughtful, natural, and humanized executive management report in JSON format with the following keys:
1. "summary": A polished, 2-3 paragraph executive review written in natural, fluent corporate English. Discuss attendance discipline, deliverable velocity, team workload balance, and estimation accuracy. Do NOT use raw markdown headers (no "###"), do NOT use asterisks for bolding (no "**"), and avoid robotic templated phrases.
2. "productivityScore": Integer from 0 to 100 based on completion rate, hours worked, and variance.
3. "attendanceScore": Integer from 0 to 100 based on punctuality and presence.
4. "keyInsights": Array of 3-5 concise, actionable observations for senior leadership.

Respond ONLY with valid JSON.
`;

      const response = await mistral.chat.complete({
        model: config.mistralModel || 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        responseFormat: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          monthYear,
          target: targetEmployee ? targetEmployee.id : 'ALL',
          attendanceRate: `${attendanceRate}%`,
          taskCompletionRate: `${taskCompletionRate}%`,
          avgDailyHours: `${avgDailyHours} hrs`,
          productivityScore: parsed.productivityScore || Math.min(100, Math.round((taskCompletionRate + attendanceRate) / 2)),
          attendanceScore: parsed.attendanceScore || attendanceRate,
          summary: parsed.summary,
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [parsed.keyInsights],
          generatedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('[Mistral AI] Error calling Mistral API:', err.message);
    }
  }

  // Smart Humanized Analytical Fallback Generator
  const timeDiff = totalActualHours - totalEstimatedHours;
  const timeVarianceHuman = timeDiff > 0 
    ? `Tasks required ${timeDiff.toFixed(1)} additional hours over initial estimates, primarily driven by project scope adjustments.`
    : `Delivery remained on target, with task execution completing within scheduled parameters (${Math.abs(timeDiff).toFixed(1)} hours saved).`;

  const daysLabel = totalDaysLogged === 1 ? '1 working day' : `${totalDaysLogged} working days`;
  const presentLabel = presentDays === 1 ? '1 on-time session' : `${presentDays} on-time sessions`;
  const lateLabel = lateDays === 1 ? '1 late entry' : `${lateDays} late entries`;
  const completedLabel = completedTasks === 1 ? '1 task was' : `${completedTasks} tasks were`;
  const totalTasksLabel = totalTasks === 1 ? '1 task' : `${totalTasks} tasks`;

  const humanizedSummary = `During ${monthYear}, scheduled operations progressed steadily with ${daysLabel} recorded across active shifts, averaging ${avgDailyHours} productive hours per day. Attendance reliability reached ${attendanceRate}%, with ${presentLabel}, ${lateLabel}, and ${halfDays} half-day sessions logged.

On deliverable execution, team members managed ${totalTasksLabel} across active project pipelines. ${completedLabel} successfully completed (${taskCompletionRate}% completion rate), with ${inProgressTasks} currently in progress and ${pendingTasks} pending review.

${timeVarianceHuman} Total effort recorded was ${totalActualHours.toFixed(1)} hours against an estimated commitment of ${totalEstimatedHours.toFixed(1)} hours. Overall workload management shows stable engagement with clear opportunities for workflow optimization.`;

  const fallbackInsights = [
    `Task completion rate reached ${taskCompletionRate}% with ${completedTasks} completed out of ${totalTasks} logged items.`,
    `Average daily working time maintained at ${avgDailyHours} hours with ${totalBreakHours.toFixed(1)} total break hours recorded.`,
    timeDiff > 0 
      ? `Time variance analysis shows a slight overrun of ${timeDiff.toFixed(1)} hours; recommended to review estimation benchmarks.`
      : `Delivery efficiency is on track with task durations aligning closely with original estimates.`,
    lateDays > 2 
      ? `Recorded ${lateDays} late arrivals; recommend checking commute patterns or adjusting start-time flexibility.`
      : `Punctuality index remains high with minimal late punch-ins.`
  ];

  return {
    monthYear,
    target: targetEmployee ? targetEmployee.id : 'ALL',
    attendanceRate: `${attendanceRate}%`,
    taskCompletionRate: `${taskCompletionRate}%`,
    avgDailyHours: `${avgDailyHours} hrs`,
    productivityScore: Math.min(100, Math.max(40, Math.round((taskCompletionRate * 0.6) + (Math.min(avgDailyHours / 8, 1) * 40)))),
    attendanceScore: Math.min(100, Math.max(30, attendanceRate)),
    summary: humanizedSummary,
    keyInsights: fallbackInsights,
    generatedAt: new Date().toISOString()
  };
}
