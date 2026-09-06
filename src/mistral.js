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
 * Generate AI Monthly Performance & Productivity Analytics with Deep Business Context (RAG)
 */
export async function generateMonthlyAIReport({
  monthYear,
  targetEmployee,
  attendanceRecords = [],
  workDoneRecords = [],
  breakRecords = [],
  assignedTasksRecords = [],
  weeklyReportsRecords = [],
  leaveRecords = [],
  permissionRecords = [],
  selfEvaluationRecords = []
}) {
  // 1. Numerical aggregations across core data tables
  const totalDaysLogged = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(a => a.status === 'Present' || a.status === 'Verified Office Present').length;
  const lateDays = attendanceRecords.filter(a => a.status === 'Late').length;
  const halfDays = attendanceRecords.filter(a => a.status === 'Half-Day').length;

  const totalNetHours = attendanceRecords.reduce((acc, curr) => acc + (parseFloat(curr.net_hours) || parseFloat(curr.total_hours) || 0), 0);
  const totalBreakHours = attendanceRecords.reduce((acc, curr) => acc + (parseFloat(curr.break_hours) || 0), 0);
  const avgDailyHours = totalDaysLogged > 0 ? (totalNetHours / totalDaysLogged).toFixed(2) : 0;

  // Expected standard shift is 9.0 hours (09:30 AM to 06:30 PM)
  const expectedTotalHours = totalDaysLogged * 9.0;
  const hoursDeficit = Math.max(0, expectedTotalHours - totalNetHours);

  // 2. WorkDone tasks and effort estimation variance
  const totalTasks = workDoneRecords.length;
  const completedTasks = workDoneRecords.filter(w => w.status === 'Completed').length;
  const inProgressTasks = workDoneRecords.filter(w => w.status === 'In-Progress').length;
  const pendingTasks = workDoneRecords.filter(w => w.status === 'Pending/Blocked' || w.status === 'Pending').length;

  const totalEstimatedHours = workDoneRecords.reduce((acc, curr) => acc + (parseFloat(curr.estimated_hours) || 0), 0);
  const totalActualHours = workDoneRecords.reduce((acc, curr) => acc + (parseFloat(curr.actual_hours) || 0), 0);
  const timeDiff = parseFloat((totalActualHours - totalEstimatedHours).toFixed(1));

  const attendanceRate = totalDaysLogged > 0 ? Math.round(((presentDays + lateDays * 0.8) / Math.max(totalDaysLogged, 22)) * 100) : 0;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 3. Manager-assigned tasks
  const totalAssigned = assignedTasksRecords.length;
  const completedAssigned = assignedTasksRecords.filter(t => t.status === 'Completed').length;
  const pendingAssigned = assignedTasksRecords.filter(t => t.status !== 'Completed').length;

  // 4. Weekly check-in blockers & challenges
  const reportedBlockers = weeklyReportsRecords
    .map(w => w.challenges_blockers)
    .filter(b => b && b.trim() && b.toLowerCase() !== 'none' && b.toLowerCase() !== 'no blockers');

  // 5. Leaves & Permissions
  const approvedLeavesCount = leaveRecords.filter(l => l.status === 'Approved').length;
  const totalLeaveDays = leaveRecords.filter(l => l.status === 'Approved').reduce((s, l) => s + (parseFloat(l.total_days) || 0), 0);
  const permissionsCount = permissionRecords.length;
  const permissionHours = permissionRecords.reduce((s, p) => s + (parseFloat(p.duration_hours) || 0), 0);

  // 6. Build RAG Data Context for LLM
  const promptContext = {
    monthYear,
    scope: targetEmployee ? `Employee: ${targetEmployee.name} (${targetEmployee.id}, ${targetEmployee.designation || 'Staff'} - ${targetEmployee.department || 'General'})` : 'Entire Organization',
    attendance: {
      totalDaysLogged,
      presentDays,
      lateDays,
      halfDays,
      totalNetHours: totalNetHours.toFixed(1),
      avgDailyHours,
      expectedTotalHours: expectedTotalHours.toFixed(1),
      hoursDeficit: hoursDeficit.toFixed(1),
      totalBreakHours: totalBreakHours.toFixed(1)
    },
    tasks: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      totalEstimatedHours: totalEstimatedHours.toFixed(1),
      totalActualHours: totalActualHours.toFixed(1),
      timeVarianceHours: timeDiff,
      completionRate: `${taskCompletionRate}%`
    },
    assignedTasks: {
      totalAssigned,
      completedAssigned,
      pendingAssigned
    },
    weeklyBlockers: reportedBlockers.slice(0, 5),
    leavesAndPermissions: {
      approvedLeavesCount,
      totalLeaveDays,
      permissionsCount,
      permissionHours: permissionHours.toFixed(1)
    },
    selfEvaluationGoals: selfEvaluationRecords.slice(0, 2).map(e => ({
      goals: e.goals_next_month,
      improvements: e.areas_for_improvement,
      rating: e.overall_rating
    }))
  };

  const mistral = getMistralClient();
  if (mistral) {
    try {
      const prompt = `
You are an executive HR and Operations Analytics Director writing an official leadership review for ${monthYear}.
Analyze the following multi-source business data context (attendance punctuality, shift hours, logged deliverables, estimation variance, manager-assigned tasks, self-reported blockers, and leaves):

DATA CONTEXT:
${JSON.stringify(promptContext, null, 2)}

Provide an insightful, natural, and humanized executive management report in JSON format with EXACTLY these keys:
1. "summary": A polished, 2-3 paragraph executive review written in natural, fluent corporate English. Discuss attendance discipline, deliverable velocity, team workload balance, and estimation accuracy. Do NOT use raw markdown headers (no "###"), do NOT use asterisks for bolding (no "**"), and avoid robotic templated phrases.
2. "productivityScore": Integer from 0 to 100 based on completion rate, hours worked, and variance.
3. "attendanceScore": Integer from 0 to 100 based on punctuality and presence.
4. "keyInsights": Array of 3-5 concise, actionable observations for senior leadership.
5. "performanceGaps": Array of 2-4 structured objects identifying concrete operational/performance gaps:
   - "area": Category (e.g. "Punctuality & Shift Hours", "Effort Estimation Variance", "Operational Blockers", "Task Delegation & Carry-over")
   - "severity": "High" | "Medium" | "Opportunity"
   - "gapDescription": Clear explanation citing exact numbers/facts from data
   - "impact": Business impact on delivery or team workflow
6. "strategicSuggestions": Array of 2-4 structured objects with targeted advice:
   - "targetArea": Specific operational area to address
   - "recommendation": Actionable recommendation for the employee or management
   - "expectedBenefit": Anticipated operational improvement
7. "nextMonthRoadmap": Array of 2-4 structured objects outlining next month commitments:
   - "goal": Strategic milestone for the upcoming month
   - "targetMetric": Quantifiable KPI (e.g. ">= 95% On-Time Check-in Rate", "< 10% Estimation Variance")
   - "actionItem": Immediate concrete step to execute

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
          performanceGaps: Array.isArray(parsed.performanceGaps) ? parsed.performanceGaps : [],
          strategicSuggestions: Array.isArray(parsed.strategicSuggestions) ? parsed.strategicSuggestions : [],
          nextMonthRoadmap: Array.isArray(parsed.nextMonthRoadmap) ? parsed.nextMonthRoadmap : [],
          generatedAt: new Date().toISOString()
        };
      }
    } catch (err) {
      console.error('[Mistral AI] Error calling Mistral API:', err.message);
    }
  }

  // ==========================================
  // SMART HUMANIZED ANALYTICAL FALLBACK ENGINE
  // ==========================================
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
      ? `Time variance analysis shows an overrun of ${timeDiff.toFixed(1)} hours; recommended to review estimation benchmarks.`
      : `Delivery efficiency is on track with task durations aligning closely with original estimates.`,
    lateDays > 2 
      ? `Recorded ${lateDays} late arrivals; recommend checking commute patterns or adjusting start-time flexibility.`
      : `Punctuality index remains high with minimal late punch-ins.`
  ];

  // Dynamic Rule-Based Gap Analysis
  const performanceGaps = [];

  if (lateDays > 0 || hoursDeficit > 2) {
    performanceGaps.push({
      area: 'Punctuality & Shift Hours',
      severity: lateDays >= 3 ? 'High' : 'Medium',
      gapDescription: `Recorded ${lateDays} late arrival(s) past the 09:45 AM grace threshold, contributing to a net shortfall of ${hoursDeficit.toFixed(1)} hours against the standard 9.0-hour daily shift requirement.`,
      impact: 'Disrupts morning standup collaboration and extends project handoffs past regular working hours.'
    });
  }

  if (timeDiff > 2) {
    const overrunPercent = totalEstimatedHours > 0 ? Math.round((timeDiff / totalEstimatedHours) * 100) : 0;
    performanceGaps.push({
      area: 'Effort Estimation Variance',
      severity: overrunPercent > 15 ? 'High' : 'Medium',
      gapDescription: `Actual execution time (${totalActualHours.toFixed(1)} hrs) exceeded initial planned scope (${totalEstimatedHours.toFixed(1)} hrs) by ${timeDiff.toFixed(1)} hours (${overrunPercent}% variance).`,
      impact: 'Compresses downstream sprint buffers and necessitates unplanned overtime.'
    });
  }

  if (pendingTasks > 0 || pendingAssigned > 0) {
    performanceGaps.push({
      area: 'Task Velocity & Carry-over',
      severity: pendingTasks > 3 ? 'High' : 'Medium',
      gapDescription: `${pendingTasks} logged task(s) remained pending or blocked, along with ${pendingAssigned} incomplete manager-assigned task(s) at month-end.`,
      impact: 'Creates deliverable dependencies for cross-functional collaborators.'
    });
  }

  if (reportedBlockers.length > 0) {
    performanceGaps.push({
      area: 'Self-Reported Operational Blockers',
      severity: 'Medium',
      gapDescription: `Weekly check-in logs highlighted recurring hurdles: "${reportedBlockers[0]}".`,
      impact: 'Temporarily impeded development momentum and required manual troubleshooting.'
    });
  }

  if (performanceGaps.length === 0) {
    performanceGaps.push({
      area: 'Workflow & Deep Work Optimization',
      severity: 'Opportunity',
      gapDescription: 'Core attendance and delivery metrics consistently met baseline standards throughout the month.',
      impact: 'Provides an opportunity to delegate higher-complexity initiatives and reduce context-switching.'
    });
  }

  // Dynamic Rule-Based Strategic Suggestions
  const strategicSuggestions = [
    {
      targetArea: 'Sprint Scoping & Task Sizing',
      recommendation: 'Decompose complex deliverables into modular sub-tasks of 4 hours or less prior to execution.',
      expectedBenefit: 'Reduces time variance to under 10% and improves daily burndown predictability.'
    },
    {
      targetArea: 'Punctuality & Shift Regularization',
      recommendation: 'Target clock-in before 09:45 AM daily and submit short permission passes 24 hours in advance for anticipated travel delays.',
      expectedBenefit: 'Ensures uninterrupted coverage during core operational hours (09:30 AM - 06:30 PM).'
    },
    {
      targetArea: 'Rapid Blocker Escalation',
      recommendation: 'Utilize the weekly check-in or Support Ticket Hub within 24 hours when technical dependencies stall progress.',
      expectedBenefit: 'Prevents blocked tasks from rolling over into subsequent review periods.'
    }
  ];

  // Dynamic Rule-Based Next-Month Improvement Roadmap
  const nextMonthRoadmap = [
    {
      goal: 'Punctuality Excellence & Zero Grace Breaches',
      targetMetric: '>= 95% On-Time Punch Rate',
      actionItem: 'Consistently clock in before 09:45 AM and ensure net daily shift hours reach 9.0 hours.'
    },
    {
      goal: 'Effort Estimation Calibration',
      targetMetric: 'Estimation variance within ±10%',
      actionItem: 'Calibrate initial hourly estimates with technical leads before commencing multi-day features.'
    },
    {
      goal: 'Zero Carry-Over Task Clearance',
      targetMetric: '100% resolution of in-progress tasks',
      actionItem: 'Prioritize and close all carry-over tasks during the initial sprint of the coming month.'
    }
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
    performanceGaps,
    strategicSuggestions,
    nextMonthRoadmap,
    generatedAt: new Date().toISOString()
  };
}
