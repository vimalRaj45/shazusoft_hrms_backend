import { getRows, addRow, updateRow } from '../sheets.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { verifyGeofence } from '../geofence.js';
import { format, differenceInMinutes, parseISO } from 'date-fns';

export default async function attendanceRoutes(fastify, options) {
  // Check geofence status for given coords
  fastify.post('/check-geofence', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { lat, lng } = request.body || {};
    const result = verifyGeofence(parseFloat(lat), parseFloat(lng));
    return result;
  });

  // GET /api/attendance/today (Current user's status today)
  fastify.get('/today', { preHandler: [verifyAuth] }, async (request, reply) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const attendanceRows = await getRows('Attendance');
    const todayRecord = attendanceRows.find(
      r => r.employee_id === request.user.id && r.date === todayStr
    );

    return {
      date: todayStr,
      attendance: todayRecord || null,
      isPunchedIn: !!todayRecord && !todayRecord.logout_time,
      isPunchedOut: !!todayRecord && !!todayRecord.logout_time
    };
  });

  // POST /api/attendance/punch-in
  fastify.post('/punch-in', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { lat, lng } = request.body || {};
    const geo = verifyGeofence(parseFloat(lat), parseFloat(lng));

    if (!geo.inside) {
      return reply.status(403).send({
        error: `Punch In rejected: ${geo.message}`,
        geofence: geo
      });
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowTimeStr = format(new Date(), 'HH:mm:ss');
    const now = new Date();

    const attendanceRows = await getRows('Attendance');
    const existing = attendanceRows.find(
      r => r.employee_id === request.user.id && r.date === todayStr
    );

    if (existing) {
      return reply.status(400).send({
        error: 'You have already punched in for today.',
        attendance: existing
      });
    }

    // Determine if late (after 09:45 AM)
    const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 45);
    const status = isLate ? 'Late' : 'Present';

    const newRecord = {
      id: `ATT-${Date.now()}-${request.user.id}`,
      date: todayStr,
      employee_id: request.user.id,
      employee_name: request.user.name,
      login_time: nowTimeStr,
      logout_time: '',
      total_hours: '0',
      break_hours: '0',
      net_hours: '0',
      status,
      punch_in_lat: String(lat),
      punch_in_lng: String(lng),
      punch_out_lat: '',
      punch_out_lng: '',
      in_geofence: 'TRUE',
      created_at: new Date().toISOString()
    };

    const saved = await addRow('Attendance', newRecord);
    return {
      message: `Punch In successful (${status})!`,
      attendance: saved,
      geofence: geo
    };
  });

  // POST /api/attendance/punch-out
  fastify.post('/punch-out', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { lat, lng } = request.body || {};
    const geo = verifyGeofence(parseFloat(lat), parseFloat(lng));

    if (!geo.inside) {
      return reply.status(403).send({
        error: `Punch Out rejected: ${geo.message}`,
        geofence: geo
      });
    }

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const nowTimeStr = format(new Date(), 'HH:mm:ss');

    const attendanceRows = await getRows('Attendance');
    const existing = attendanceRows.find(
      r => r.employee_id === request.user.id && r.date === todayStr
    );

    if (!existing) {
      return reply.status(400).send({ error: 'No punch-in record found for today.' });
    }

    if (existing.logout_time) {
      return reply.status(400).send({ error: 'You have already punched out for today.' });
    }

    // Calculate duration from login to logout
    const loginDateTime = parseISO(`${todayStr}T${existing.login_time}`);
    const logoutDateTime = new Date();
    const diffMinutes = Math.max(0, differenceInMinutes(logoutDateTime, loginDateTime));
    const totalHours = (diffMinutes / 60).toFixed(2);
    const netHours = totalHours;

    const updated = await updateRow('Attendance', 'id', existing.id, {
      logout_time: nowTimeStr,
      total_hours: totalHours,
      break_hours: '0.00',
      net_hours: netHours,
      punch_out_lat: String(lat),
      punch_out_lng: String(lng)
    });

    return {
      message: 'Punch Out successful! Have a great evening.',
      attendance: updated,
      summary: {
        totalHours: `${totalHours} hrs`,
        netHours: `${netHours} hrs`
      },
      geofence: geo
    };
  });

  // GET /api/attendance/holidays — Public list of admin-defined holidays (accessible to all staff)
  fastify.get('/holidays', { preHandler: [verifyAuth] }, async (request, reply) => {
    const rows = await getRows('Holidays');
    rows.sort((a, b) => (a.date > b.date ? 1 : -1));
    return { holidays: rows };
  });

  // GET /api/attendance/my-history
  fastify.get('/my-history', { preHandler: [verifyAuth] }, async (request, reply) => {
    const attendanceRows = await getRows('Attendance');
    const userRows = attendanceRows
      .filter(r => r.employee_id === request.user.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { records: userRows };
  });

  // GET /api/attendance/my-monthly-history (Full month history, past days populated, future days locked)
  fastify.get('/my-monthly-history', { preHandler: [verifyAuth] }, async (request, reply) => {
    const { month } = request.query || {};
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    const targetMonthStr = (month && /^\d{4}-\d{2}$/.test(month)) ? month : format(now, 'yyyy-MM');
    const [targetYear, targetMonthNum] = targetMonthStr.split('-').map(Number);

    const startDate = new Date(targetYear, targetMonthNum - 1, 1);
    const lastDayOfMonth = new Date(targetYear, targetMonthNum, 0).getDate();

    const [attendanceRows, leaveRows, holidayRows, workDoneRows] = await Promise.all([
      getRows('Attendance'),
      getRows('Leaves'),
      getRows('Holidays'),
      getRows('WorkDone')
    ]);

    // Build a quick lookup set of holiday dates in this month
    const holidayMap = {};
    holidayRows.forEach(h => {
      if (h.date) holidayMap[h.date] = h;
    });

    const userAttendance = attendanceRows.filter(
      r => r.employee_id === request.user.id && r.date && r.date.startsWith(targetMonthStr)
    );

    const userLeaves = leaveRows.filter(
      l => l.employee_id === request.user.id && (l.status === 'Approved' || l.status === 'approved')
    );

    const userWorkDone = workDoneRows.filter(
      w => w.employee_id === request.user.id && w.date && w.date.startsWith(targetMonthStr)
    );

    const days = [];
    let presentDaysCount = 0;
    let lateCount = 0;
    let totalWorkingHoursNum = 0;
    let leaveDaysCount = 0;
    let pastDaysCount = 0;
    let sundaysCount = 0;
    let holidaysCount = 0;

    for (let day = 1; day <= lastDayOfMonth; day++) {
      const dayDate = new Date(targetYear, targetMonthNum - 1, day);
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dayName = format(dayDate, 'EEE');
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const isSunday = dayDate.getDay() === 0;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      if (isSunday) sundaysCount++;

      // Find tasks logged for this day
      const dayTasks = userWorkDone.filter(t => t.date === dateStr);
      const dayTaskHours = dayTasks.reduce((acc, t) => acc + (parseFloat(t.actual_hours || t.estimated_hours || 0) || 0), 0);

      const baseDayMeta = {
        tasks: dayTasks.map(t => ({
          id: t.id,
          project_name: t.project_name,
          task_title: t.task_title,
          description: t.description,
          estimated_hours: t.estimated_hours,
          actual_hours: t.actual_hours,
          status: t.status,
          remarks: t.remarks
        })),
        task_count: dayTasks.length,
        task_hours: dayTaskHours.toFixed(1)
      };

      if (isFuture) {
        days.push({
          date: dateStr,
          day_number: day,
          day_name: dayName,
          is_weekend: isWeekend,
          is_sunday: isSunday,
          is_future: true,
          is_today: false,
          status: isSunday ? 'Sunday' : (isWeekend ? 'Weekend' : 'Upcoming'),
          login_time: null,
          logout_time: null,
          total_hours: null,
          net_hours: null,
          ...baseDayMeta
        });
      } else {
        const holidayInfo = holidayMap[dateStr];

        // Sundays and Holidays are non-working — do NOT count toward pastDaysCount
        if (isSunday) {
          days.push({
            date: dateStr,
            day_number: day,
            day_name: dayName,
            is_weekend: true,
            is_sunday: true,
            is_future: false,
            is_today: isToday,
            status: 'Sunday',
            login_time: null,
            logout_time: null,
            total_hours: '0',
            net_hours: '0',
            ...baseDayMeta
          });
        } else if (holidayInfo) {
          holidaysCount++;
          days.push({
            date: dateStr,
            day_number: day,
            day_name: dayName,
            is_weekend: false,
            is_sunday: false,
            is_holiday: true,
            is_future: false,
            is_today: isToday,
            status: 'Holiday',
            holiday_name: holidayInfo.name,
            holiday_type: holidayInfo.type,
            login_time: null,
            logout_time: null,
            total_hours: '0',
            net_hours: '0',
            ...baseDayMeta
          });
        } else {
          pastDaysCount++;
          const record = userAttendance.find(r => r.date === dateStr);
          const leave = userLeaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

          if (record) {
            const hours = parseFloat(record.net_hours || record.total_hours || '0');
            totalWorkingHoursNum += isNaN(hours) ? 0 : hours;
            presentDaysCount++;
            if (record.status === 'Late') lateCount++;

            days.push({
              id: record.id,
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: isWeekend,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: record.status || 'Present',
              login_time: record.login_time || '--',
              logout_time: record.logout_time || (isToday ? 'In Progress' : '--'),
              total_hours: record.total_hours || '0',
              net_hours: record.net_hours || record.total_hours || '0',
              in_geofence: record.in_geofence || 'TRUE',
              ...baseDayMeta
            });
          } else if (leave) {
            leaveDaysCount++;
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: isWeekend,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: 'Approved Leave',
              leave_type: leave.leave_type,
              leave_reason: leave.reason || '',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          } else if (isWeekend) {
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: true,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: 'Weekend',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          } else {
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: false,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: isToday ? 'Not Punched Yet' : 'Absent',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          }
        }
      }
    }

    const avgDailyHours = presentDaysCount > 0 ? (totalWorkingHoursNum / presentDaysCount).toFixed(1) : '0.0';
    const onTimePercent = presentDaysCount > 0 ? Math.round(((presentDaysCount - lateCount) / presentDaysCount) * 100) : 100;
    const totalTasksLogged = userWorkDone.length;
    const totalTaskHours = userWorkDone.reduce((acc, t) => acc + (parseFloat(t.actual_hours || t.estimated_hours || 0) || 0), 0).toFixed(1);

    return {
      month: targetMonthStr,
      month_label: format(startDate, 'MMMM yyyy'),
      total_days: lastDayOfMonth,
      past_days_count: pastDaysCount,
      present_days: presentDaysCount,
      late_days: lateCount,
      on_time_percent: onTimePercent,
      leave_days: leaveDaysCount,
      sundays_count: sundaysCount,
      holidays_count: holidaysCount,
      total_hours: totalWorkingHoursNum.toFixed(1),
      avg_hours_per_day: avgDailyHours,
      total_tasks_completed: totalTasksLogged,
      total_task_logged_hours: totalTaskHours,
      days
    };
  });

  // GET /api/attendance/staff-monthly-history (Admin only: view any staff member's full month day-wise timesheet)
  fastify.get('/staff-monthly-history', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { employee_id, month } = request.query || {};
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    const targetMonthStr = (month && /^\d{4}-\d{2}$/.test(month)) ? month : format(now, 'yyyy-MM');
    const [targetYear, targetMonthNum] = targetMonthStr.split('-').map(Number);

    const startDate = new Date(targetYear, targetMonthNum - 1, 1);
    const lastDayOfMonth = new Date(targetYear, targetMonthNum, 0).getDate();

    const [attendanceRows, leaveRows, holidayRows, employeeRows, workDoneRows] = await Promise.all([
      getRows('Attendance'),
      getRows('Leaves'),
      getRows('Holidays'),
      getRows('Employees'),
      getRows('WorkDone')
    ]);

    // Find target employee
    const targetEmpId = employee_id || employeeRows.find(e => e.role !== 'admin')?.id || employeeRows[0]?.id;
    const targetEmp = employeeRows.find(e => e.id === targetEmpId) || null;

    if (!targetEmp) {
      return reply.status(404).send({ error: 'Employee not found.' });
    }

    // Build holiday lookup map
    const holidayMap = {};
    holidayRows.forEach(h => {
      if (h.date) holidayMap[h.date] = h;
    });

    const userAttendance = attendanceRows.filter(
      r => r.employee_id === targetEmpId && r.date && r.date.startsWith(targetMonthStr)
    );

    const userLeaves = leaveRows.filter(
      l => l.employee_id === targetEmpId && (l.status === 'Approved' || l.status === 'approved')
    );

    const userWorkDone = workDoneRows.filter(
      w => w.employee_id === targetEmpId && w.date && w.date.startsWith(targetMonthStr)
    );

    const days = [];
    let presentDaysCount = 0;
    let lateCount = 0;
    let totalWorkingHoursNum = 0;
    let leaveDaysCount = 0;
    let pastDaysCount = 0;
    let sundaysCount = 0;
    let holidaysCount = 0;

    for (let day = 1; day <= lastDayOfMonth; day++) {
      const dayDate = new Date(targetYear, targetMonthNum - 1, day);
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const dayName = format(dayDate, 'EEE');
      const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
      const isSunday = dayDate.getDay() === 0;
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;

      if (isSunday) sundaysCount++;

      // Find tasks logged for this day
      const dayTasks = userWorkDone.filter(t => t.date === dateStr);
      const dayTaskHours = dayTasks.reduce((acc, t) => acc + (parseFloat(t.actual_hours || t.estimated_hours || 0) || 0), 0);

      const baseDayMeta = {
        tasks: dayTasks.map(t => ({
          id: t.id,
          project_name: t.project_name,
          task_title: t.task_title,
          description: t.description,
          estimated_hours: t.estimated_hours,
          actual_hours: t.actual_hours,
          status: t.status,
          remarks: t.remarks
        })),
        task_count: dayTasks.length,
        task_hours: dayTaskHours.toFixed(1)
      };

      if (isFuture) {
        days.push({
          date: dateStr,
          day_number: day,
          day_name: dayName,
          is_weekend: isWeekend,
          is_sunday: isSunday,
          is_future: true,
          is_today: false,
          status: isSunday ? 'Sunday' : (isWeekend ? 'Weekend' : 'Upcoming'),
          login_time: null,
          logout_time: null,
          total_hours: null,
          net_hours: null,
          ...baseDayMeta
        });
      } else {
        const holidayInfo = holidayMap[dateStr];

        if (isSunday) {
          days.push({
            date: dateStr,
            day_number: day,
            day_name: dayName,
            is_weekend: true,
            is_sunday: true,
            is_future: false,
            is_today: isToday,
            status: 'Sunday',
            login_time: null,
            logout_time: null,
            total_hours: '0',
            net_hours: '0',
            ...baseDayMeta
          });
        } else if (holidayInfo) {
          holidaysCount++;
          days.push({
            date: dateStr,
            day_number: day,
            day_name: dayName,
            is_weekend: isWeekend,
            is_sunday: false,
            is_holiday: true,
            is_future: false,
            is_today: isToday,
            status: 'Holiday',
            holiday_name: holidayInfo.name,
            holiday_type: holidayInfo.type,
            login_time: null,
            logout_time: null,
            total_hours: '0',
            net_hours: '0',
            ...baseDayMeta
          });
        } else {
          pastDaysCount++;
          const record = userAttendance.find(r => r.date === dateStr);
          const leave = userLeaves.find(l => dateStr >= l.start_date && dateStr <= l.end_date);

          if (record) {
            const hours = parseFloat(record.net_hours || record.total_hours || '0');
            totalWorkingHoursNum += isNaN(hours) ? 0 : hours;
            presentDaysCount++;
            if (record.status === 'Late') lateCount++;

            days.push({
              id: record.id,
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: isWeekend,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: record.status || 'Present',
              login_time: record.login_time || '--',
              logout_time: record.logout_time || (isToday ? 'In Progress' : '--'),
              total_hours: record.total_hours || '0',
              net_hours: record.net_hours || record.total_hours || '0',
              in_geofence: record.in_geofence || 'TRUE',
              ...baseDayMeta
            });
          } else if (leave) {
            leaveDaysCount++;
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: isWeekend,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: 'Approved Leave',
              leave_type: leave.leave_type,
              leave_reason: leave.reason || '',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          } else if (isWeekend) {
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: true,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: 'Weekend',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          } else {
            days.push({
              date: dateStr,
              day_number: day,
              day_name: dayName,
              is_weekend: false,
              is_sunday: false,
              is_future: false,
              is_today: isToday,
              status: isToday ? 'Not Punched Yet' : 'Absent',
              login_time: null,
              logout_time: null,
              total_hours: '0',
              net_hours: '0',
              ...baseDayMeta
            });
          }
        }
      }
    }

    const avgDailyHours = presentDaysCount > 0 ? (totalWorkingHoursNum / presentDaysCount).toFixed(1) : '0.0';
    const onTimePercent = presentDaysCount > 0 ? Math.round(((presentDaysCount - lateCount) / presentDaysCount) * 100) : 100;
    const totalTasksLogged = userWorkDone.length;
    const totalTaskHours = userWorkDone.reduce((acc, t) => acc + (parseFloat(t.actual_hours || t.estimated_hours || 0) || 0), 0).toFixed(1);

    return {
      employee: {
        id: targetEmp.id,
        name: targetEmp.name,
        email: targetEmp.email,
        department: targetEmp.department,
        designation: targetEmp.designation,
        role: targetEmp.role
      },
      month: targetMonthStr,
      month_label: format(startDate, 'MMMM yyyy'),
      total_days: lastDayOfMonth,
      past_days_count: pastDaysCount,
      present_days: presentDaysCount,
      late_days: lateCount,
      on_time_percent: onTimePercent,
      leave_days: leaveDaysCount,
      sundays_count: sundaysCount,
      holidays_count: holidaysCount,
      total_hours: totalWorkingHoursNum.toFixed(1),
      avg_hours_per_day: avgDailyHours,
      total_tasks_completed: totalTasksLogged,
      total_task_logged_hours: totalTaskHours,
      days
    };
  });

  // GET /api/attendance/all (Admin only)
  fastify.get('/all', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const attendanceRows = await getRows('Attendance');
    const sorted = attendanceRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { records: sorted };
  });

  // POST /api/attendance/admin-override (Admin manual entry/override)
  fastify.post('/admin-override', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const {
      employee_id,
      date,
      login_time,
      logout_time,
      status = 'Present',
      reason
    } = request.body || {};

    if (!employee_id || !date || !login_time || !reason) {
      return reply.status(400).send({
        error: 'Employee ID, Date, Login Time, and Management Reason are mandatory.'
      });
    }

    // Lookup employee name
    const employees = await getRows('Employees');
    const emp = employees.find(e => e.id === employee_id);
    const employee_name = emp ? emp.name : employee_id;

    // Calculate hours
    let totalHours = '0.00';
    let netHours = '0.00';
    let breakHours = '0.00';

    if (logout_time) {
      const loginDateTime = new Date(`${date}T${login_time.length === 5 ? login_time + ':00' : login_time}`);
      const logoutDateTime = new Date(`${date}T${logout_time.length === 5 ? logout_time + ':00' : logout_time}`);
      const diffMin = Math.max(0, differenceInMinutes(logoutDateTime, loginDateTime));
      totalHours = (diffMin / 60).toFixed(2);
      netHours = totalHours;
    }

    const attendanceRows = await getRows('Attendance');
    const existing = attendanceRows.find(
      r => r.employee_id === employee_id && r.date === date
    );

    let savedAttendance;
    if (existing) {
      savedAttendance = await updateRow('Attendance', 'id', existing.id, {
        login_time,
        logout_time: logout_time || existing.logout_time || '',
        total_hours: totalHours !== '0.00' ? totalHours : existing.total_hours,
        break_hours: existing.break_hours || '0.00',
        net_hours: netHours !== '0.00' ? netHours : existing.net_hours,
        status,
        in_geofence: 'OVERRIDE'
      });
    } else {
      savedAttendance = await addRow('Attendance', {
        id: `ATT-MANUAL-${Date.now()}-${employee_id}`,
        date,
        employee_id,
        employee_name,
        login_time,
        logout_time: logout_time || '',
        total_hours: totalHours,
        break_hours: breakHours,
        net_hours: netHours,
        status,
        punch_in_lat: 'MANUAL',
        punch_in_lng: 'MANUAL',
        punch_out_lat: logout_time ? 'MANUAL' : '',
        punch_out_lng: logout_time ? 'MANUAL' : '',
        in_geofence: 'OVERRIDE',
        created_at: new Date().toISOString()
      });
    }

    // Append to Communications / Audit Log
    try {
      await addRow('Communications_Log', {
        id: `LOG-${Date.now()}`,
        type: 'ATTENDANCE_OVERRIDE',
        sender_id: request.user.id,
        sender_name: request.user.name,
        recipient_id: employee_id,
        recipient_name: employee_name,
        subject: `Attendance Override Logged (${date})`,
        message: `Admin ${request.user.name} logged/updated attendance for ${employee_name} on ${date} as ${status}. Note: ${reason}`,
        metadata_json: JSON.stringify({ date, login_time, logout_time, status, reason }),
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.error('Audit log error:', logErr);
    }

    return {
      message: `Manual attendance recorded for ${employee_name} successfully.`,
      attendance: savedAttendance
    };
  });
}
