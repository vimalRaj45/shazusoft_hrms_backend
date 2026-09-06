import { getRows, addRow, updateRow } from '../db.js';
import { verifyAuth, verifyAdmin } from '../auth.js';
import { dispatchNotification } from '../inAppNotificationService.js';

/**
 * Calculates working days in a given month (YYYY-MM)
 * Startup-friendly rule:
 * - Sundays are off by default, UNLESS registered as 'Working Sunday' in Holidays table.
 * - Public holidays / company off-days from Holidays table are non-working (paid off).
 * - Monday - Saturday are working days by default.
 */
export function calculateMonthWorkingDays(yearMonth, holidays = []) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error('Invalid month format. Expected YYYY-MM');
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  let totalWorkingDays = 0;
  let workingSundaysCount = 0;
  let regularWorkingDaysCount = 0;
  let holidaysCount = 0;
  let sundaysOffCount = 0;
  const daysDetail = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Check if date has an entry in holidays table
    const holiday = holidays.find(h => h.date === dateStr);
    let isWorking = false;
    let type = 'regular_working';
    let label = 'Working Day';

    if (holiday) {
      const hType = (holiday.type || '').trim().toLowerCase();
      if (hType === 'working sunday' || hType.includes('working sunday')) {
        isWorking = true;
        type = 'working_sunday';
        label = holiday.name || 'Working Sunday';
        workingSundaysCount++;
        totalWorkingDays++;
      } else {
        isWorking = false;
        type = 'holiday';
        label = holiday.name || 'Public Holiday';
        holidaysCount++;
      }
    } else {
      if (dayOfWeek === 0) {
        isWorking = false;
        type = 'sunday_off';
        label = 'Sunday Off';
        sundaysOffCount++;
      } else {
        isWorking = true;
        type = 'regular_working';
        label = 'Working Day';
        regularWorkingDaysCount++;
        totalWorkingDays++;
      }
    }

    daysDetail.push({
      date: dateStr,
      dayOfWeek,
      isWorking,
      type,
      label
    });
  }

  return {
    yearMonth,
    daysInMonth,
    totalWorkingDays,
    workingSundaysCount,
    regularWorkingDaysCount,
    holidaysCount,
    sundaysOffCount,
    daysDetail
  };
}

/**
 * Calculates payroll line-items for all active employees for a given month
 */
export async function calculatePayrollForMonth(yearMonth) {
  const employees = await getRows('Employees');
  const holidays = await getRows('Holidays');
  const attendance = await getRows('Attendance');
  const leaves = await getRows('Leaves');
  const salaryStructures = await getRows('Salary_Structures');

  const activeEmployees = employees.filter(e => e.status !== 'inactive' && e.status !== 'resigned');
  const workingDaysMeta = calculateMonthWorkingDays(yearMonth, holidays);
  const { totalWorkingDays, daysDetail } = workingDaysMeta;

  // Map salary structures by employee_id
  const salaryMap = new Map();
  salaryStructures.forEach(s => salaryMap.set(s.employee_id, s));

  const records = activeEmployees.map(emp => {
    const structure = salaryMap.get(emp.id) || {};
    const monthlySalary = parseFloat(structure.monthly_salary) || 0;

    // Filter attendance records for this employee in this month
    const empAttendance = attendance.filter(a => a.employee_id === emp.id && a.date && a.date.startsWith(yearMonth));
    const attMap = new Map();
    empAttendance.forEach(a => attMap.set(a.date, a));

    // Filter approved leaves
    const empLeaves = leaves.filter(l => l.employee_id === emp.id && l.status === 'approved');

    let presentDays = 0;
    let paidLeaves = 0;

    // Evaluate each working day in the month
    daysDetail.filter(d => d.isWorking).forEach(d => {
      const att = attMap.get(d.date);
      if (att) {
        const attStatus = (att.status || '').toLowerCase();
        if (attStatus === 'present') {
          presentDays += 1;
        } else if (attStatus === 'half-day') {
          presentDays += 0.5;
        }
      } else {
        // Check if covered by an approved leave
        const isCoveredByLeave = empLeaves.some(l => {
          if (!l.start_date || !l.end_date) return false;
          return d.date >= l.start_date && d.date <= l.end_date;
        });
        if (isCoveredByLeave) {
          paidLeaves += 1;
        }
      }
    });

    // Startup Loss of Pay (LOP) formula:
    // LOP Days = max(0, totalWorkingDays - presentDays - paidLeaves)
    const rawLopDays = Math.max(0, totalWorkingDays - presentDays - paidLeaves);
    const lopDays = Math.round(rawLopDays * 10) / 10;

    // Daily Rate = Monthly Base Salary / Total Working Days (including Working Sundays)
    const dailyRate = totalWorkingDays > 0 ? Math.round((monthlySalary / totalWorkingDays) * 100) / 100 : 0;

    // LOP Deduction = round(Daily Rate * LOP Days)
    const lopDeduction = Math.min(monthlySalary, Math.round(dailyRate * lopDays));

    // Net Payable = Monthly Base Salary - LOP Deduction
    const netPayable = Math.max(0, monthlySalary - lopDeduction);

    return {
      payroll_month: yearMonth,
      employee_id: emp.id,
      employee_name: emp.name,
      department: emp.department || 'General',
      designation: emp.designation || 'Staff',
      monthly_salary: monthlySalary,
      daily_rate: dailyRate,
      total_working_days: totalWorkingDays,
      present_days: presentDays,
      paid_leaves: paidLeaves,
      lop_days: lopDays,
      lop_deduction: lopDeduction,
      net_payable: netPayable,
      bank_name: structure.bank_name || '',
      account_number: structure.account_number || '',
      ifsc_code: structure.ifsc_code || '',
      upi_id: structure.upi_id || '',
      pan_number: structure.pan_number || '',
      status: 'Pending'
    };
  });

  return {
    workingDaysMeta,
    records
  };
}

export default async function payrollRoutes(fastify, options) {
  // 1. GET Working Days & Calendar breakdown for a month
  fastify.get('/working-days-preview', { preHandler: [verifyAuth] }, async (request, reply) => {
    const month = request.query.month || new Date().toISOString().slice(0, 7);
    const holidays = await getRows('Holidays');
    try {
      const breakdown = calculateMonthWorkingDays(month, holidays);
      return reply.send(breakdown);
    } catch (err) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 2. GET Salary Structures (Admin only)
  fastify.get('/salary-structures', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const employees = await getRows('Employees');
    const structures = await getRows('Salary_Structures');

    const activeEmployees = employees.filter(e => e.status !== 'inactive' && e.status !== 'resigned');
    const structMap = new Map();
    structures.forEach(s => structMap.set(s.employee_id, s));

    const result = activeEmployees.map(emp => {
      const s = structMap.get(emp.id) || {};
      return {
        id: s.id || `SAL-${emp.id}`,
        employee_id: emp.id,
        employee_name: emp.name,
        department: emp.department || '',
        designation: emp.designation || '',
        monthly_salary: parseFloat(s.monthly_salary) || 0,
        bank_name: s.bank_name || '',
        account_number: s.account_number || '',
        ifsc_code: s.ifsc_code || '',
        upi_id: s.upi_id || '',
        pan_number: s.pan_number || '',
        updated_at: s.updated_at || null,
        updated_by: s.updated_by || null
      };
    });

    return reply.send({ salary_structures: result });
  });

  // 3. PUT Update Salary Structure for an Employee (Admin only)
  fastify.put('/salary-structures/:employee_id', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { employee_id } = request.params;
    const body = request.body || {};
    const employees = await getRows('Employees');
    const emp = employees.find(e => e.id === employee_id);

    if (!emp) {
      return reply.status(404).send({ error: 'Employee not found' });
    }

    const structures = await getRows('Salary_Structures');
    const existing = structures.find(s => s.employee_id === employee_id);

    const now = new Date().toISOString();
    const updatedData = {
      id: existing ? existing.id : `SAL-${employee_id}`,
      employee_id: emp.id,
      employee_name: emp.name,
      department: emp.department || '',
      designation: emp.designation || '',
      monthly_salary: parseFloat(body.monthly_salary) || 0,
      bank_name: body.bank_name || '',
      account_number: body.account_number || '',
      ifsc_code: body.ifsc_code || '',
      upi_id: body.upi_id || '',
      pan_number: body.pan_number || '',
      updated_at: now,
      updated_by: request.user?.name || 'Admin'
    };

    if (existing) {
      await updateRow('Salary_Structures', 'employee_id', employee_id, updatedData);
    } else {
      await addRow('Salary_Structures', updatedData);
    }

    return reply.send({ success: true, salary_structure: updatedData });
  });

  // 4. POST Calculate Month (Preview before committing) (Admin only)
  fastify.post('/calculate-month', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const month = request.body?.month || new Date().toISOString().slice(0, 7);
    try {
      const calculation = await calculatePayrollForMonth(month);
      return reply.send(calculation);
    } catch (err) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // 5. POST Generate / Commit Month Payroll Records (Admin only)
  fastify.post('/generate-month', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const month = request.body?.month || new Date().toISOString().slice(0, 7);
    try {
      const calculation = await calculatePayrollForMonth(month);
      const existingPayrolls = await getRows('Monthly_Payrolls');
      const now = new Date().toISOString();

      const savedRecords = [];
      for (const rec of calculation.records) {
        const recordId = `PAY-${month}-${rec.employee_id}`;
        const existing = existingPayrolls.find(p => p.payroll_month === month && p.employee_id === rec.employee_id);

        const payload = {
          id: recordId,
          payroll_month: month,
          employee_id: rec.employee_id,
          employee_name: rec.employee_name,
          department: rec.department,
          designation: rec.designation,
          monthly_salary: rec.monthly_salary,
          daily_rate: rec.daily_rate,
          total_working_days: rec.total_working_days,
          present_days: rec.present_days,
          paid_leaves: rec.paid_leaves,
          lop_days: rec.lop_days,
          lop_deduction: rec.lop_deduction,
          net_payable: rec.net_payable,
          status: existing ? (existing.status || 'Pending') : 'Pending',
          payment_mode: existing?.payment_mode || '',
          payment_date: existing?.payment_date || '',
          payment_reference: existing?.payment_reference || '',
          remarks: existing?.remarks || '',
          generated_at: now,
          generated_by: request.user?.name || 'Admin',
          paid_at: existing?.paid_at || '',
          paid_by: existing?.paid_by || ''
        };

        if (existing) {
          await updateRow('Monthly_Payrolls', 'id', recordId, payload);
        } else {
          await addRow('Monthly_Payrolls', payload);
        }
        savedRecords.push(payload);
      }

      return reply.send({
        success: true,
        message: `Payroll for ${month} committed successfully with ${savedRecords.length} records.`,
        workingDaysMeta: calculation.workingDaysMeta,
        records: savedRecords
      });
    } catch (err) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 6. GET Month Records from committed Monthly_Payrolls (Admin only)
  fastify.get('/month-records', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const month = request.query.month || new Date().toISOString().slice(0, 7);
    const payrolls = await getRows('Monthly_Payrolls');
    const salaryStructures = await getRows('Salary_Structures');
    const holidays = await getRows('Holidays');

    const structMap = new Map();
    salaryStructures.forEach(s => structMap.set(s.employee_id, s));

    const monthRecords = payrolls
      .filter(p => p.payroll_month === month)
      .map(p => {
        const s = structMap.get(p.employee_id) || {};
        return {
          ...p,
          monthly_salary: parseFloat(p.monthly_salary) || 0,
          daily_rate: parseFloat(p.daily_rate) || 0,
          total_working_days: parseFloat(p.total_working_days) || 0,
          present_days: parseFloat(p.present_days) || 0,
          paid_leaves: parseFloat(p.paid_leaves) || 0,
          lop_days: parseFloat(p.lop_days) || 0,
          lop_deduction: parseFloat(p.lop_deduction) || 0,
          net_payable: parseFloat(p.net_payable) || 0,
          bank_name: s.bank_name || '',
          account_number: s.account_number || '',
          ifsc_code: s.ifsc_code || '',
          upi_id: s.upi_id || '',
          pan_number: s.pan_number || ''
        };
      });

    let workingDaysMeta = null;
    try {
      workingDaysMeta = calculateMonthWorkingDays(month, holidays);
    } catch (e) {}

    return reply.send({
      month,
      count: monthRecords.length,
      workingDaysMeta,
      records: monthRecords
    });
  });

  // 7. PATCH Update Payroll Record Status (Admin only - e.g. mark Paid)
  fastify.patch('/records/:id/status', { preHandler: [verifyAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body || {};
    const payrolls = await getRows('Monthly_Payrolls');
    const record = payrolls.find(p => p.id === id);

    if (!record) {
      return reply.status(404).send({ error: 'Payroll record not found' });
    }

    const now = new Date().toISOString();
    const isPaid = body.status === 'Paid';

    const updatePayload = {
      status: body.status || record.status,
      payment_mode: body.payment_mode !== undefined ? body.payment_mode : record.payment_mode,
      payment_date: body.payment_date !== undefined ? body.payment_date : (isPaid ? new Date().toISOString().slice(0, 10) : record.payment_date),
      payment_reference: body.payment_reference !== undefined ? body.payment_reference : record.payment_reference,
      remarks: body.remarks !== undefined ? body.remarks : record.remarks,
      paid_at: isPaid ? (record.paid_at || now) : '',
      paid_by: isPaid ? (record.paid_by || request.user?.name || 'Admin') : ''
    };

    await updateRow('Monthly_Payrolls', 'id', id, updatePayload);

    if (isPaid && record.employee_id) {
      const netAmount = parseFloat(record.net_payable || 0).toLocaleString('en-IN');
      dispatchNotification({
        recipientId: record.employee_id,
        title: 'Salary Disbursed 💰',
        message: `Your salary for ${record.payroll_month} (₹${netAmount}) has been disbursed and marked as Paid.`,
        type: 'payroll',
        targetTab: 'payroll',
        targetUrl: '/?tab=payroll',
        metadata: { payrollId: id, month: record.payroll_month, netPayable: record.net_payable }
      }).catch(() => {});
    }

    return reply.send({ success: true, record: { ...record, ...updatePayload } });
  });

  // 8. GET My Payslips (Employee view)
  fastify.get('/my-payslips', { preHandler: [verifyAuth] }, async (request, reply) => {
    const userId = request.user.id;
    const payrolls = await getRows('Monthly_Payrolls');
    const salaryStructures = await getRows('Salary_Structures');

    const s = salaryStructures.find(struct => struct.employee_id === userId) || {};

    const myRecords = payrolls
      .filter(p => p.employee_id === userId)
      .map(p => ({
        ...p,
        monthly_salary: parseFloat(p.monthly_salary) || 0,
        daily_rate: parseFloat(p.daily_rate) || 0,
        total_working_days: parseFloat(p.total_working_days) || 0,
        present_days: parseFloat(p.present_days) || 0,
        paid_leaves: parseFloat(p.paid_leaves) || 0,
        lop_days: parseFloat(p.lop_days) || 0,
        lop_deduction: parseFloat(p.lop_deduction) || 0,
        net_payable: parseFloat(p.net_payable) || 0,
        bank_name: s.bank_name || '',
        account_number: s.account_number || '',
        ifsc_code: s.ifsc_code || '',
        upi_id: s.upi_id || '',
        pan_number: s.pan_number || ''
      }))
      .sort((a, b) => b.payroll_month.localeCompare(a.payroll_month));

    return reply.send({ payslips: myRecords });
  });
}
