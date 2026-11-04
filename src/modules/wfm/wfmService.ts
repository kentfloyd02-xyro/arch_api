import { query } from '../../db/connection.js';

// ------------------------------------------------------------------------------
// SHIFTS & SCHEDULES
// ------------------------------------------------------------------------------

export async function getAllShifts() {
  const result = await query('SELECT * FROM wfm.shifts ORDER BY start_time ASC');
  return result.rows;
}

export async function createShift(name: string, startTime: string, endTime: string, breakMinutes: number = 60) {
  const result = await query(
    `INSERT INTO wfm.shifts (name, start_time, end_time, break_minutes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, startTime, endTime, breakMinutes]
  );
  return result.rows[0];
}

export async function getSchedules(options: { employeeId?: string; fromDate?: string; toDate?: string } = {}) {
  let sql = `
    SELECT s.*, sh.name AS shift_name, sh.start_time, sh.end_time, sh.break_minutes,
           e.employee_no, e.first_name, e.last_name, d.name AS department_name
    FROM wfm.schedules s
    JOIN wfm.shifts sh ON sh.id = s.shift_id
    JOIN hrms.employees e ON e.id = s.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (options.employeeId) {
    params.push(options.employeeId);
    sql += ` AND s.employee_id = $${params.length}`;
  }
  if (options.fromDate) {
    params.push(options.fromDate);
    sql += ` AND s.schedule_date >= $${params.length}`;
  }
  if (options.toDate) {
    params.push(options.toDate);
    sql += ` AND s.schedule_date <= $${params.length}`;
  }
  sql += ` ORDER BY s.schedule_date ASC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function assignSchedule(employeeId: string, shiftId: string, scheduleDate: string) {
  const result = await query(
    `INSERT INTO wfm.schedules (employee_id, shift_id, schedule_date, status)
     VALUES ($1, $2, $3, 'Scheduled')
     ON CONFLICT (employee_id, schedule_date) DO UPDATE
     SET shift_id = EXCLUDED.shift_id, status = 'Scheduled'
     RETURNING *`,
    [employeeId, shiftId, scheduleDate]
  );
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// ATTENDANCE & KIOSK CLOCK-IN / OUT
// ------------------------------------------------------------------------------

export async function clockIn(data: {
  employeeId: string;
  date?: string;
  timeIn?: string;
  verificationMethod?: string;
}) {
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeInStr = data.timeIn || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const method = data.verificationMethod || 'kiosk';

  // 1. Check for scheduled shift on this date
  const schedRes = await query(
    `SELECT s.*, sh.start_time, sh.end_time, sh.break_minutes
     FROM wfm.schedules s
     JOIN wfm.shifts sh ON sh.id = s.shift_id
     WHERE s.employee_id = $1 AND s.schedule_date = $2`,
    [data.employeeId, dateStr]
  );

  let lateMin = 0;
  if (schedRes.rows.length > 0) {
    const shift = schedRes.rows[0];
    const [schedH, schedM] = shift.start_time.split(':').map(Number);
    const [inH, inM] = timeInStr.split(':').map(Number);
    const schedTotal = schedH * 60 + schedM;
    const inTotal = inH * 60 + inM;
    if (inTotal > schedTotal) {
      lateMin = inTotal - schedTotal;
    }
  }

  // 2. Upsert into attendance_logs
  const result = await query(
    `INSERT INTO wfm.attendance_logs (
       employee_id, date, time_in, late_minutes, status, verification_method
     ) VALUES ($1, $2, $3, $4, 'Present', $5)
     ON CONFLICT (employee_id, date) DO UPDATE
     SET time_in = EXCLUDED.time_in, late_minutes = EXCLUDED.late_minutes,
         status = 'Present', verification_method = EXCLUDED.verification_method
     RETURNING *`,
    [data.employeeId, dateStr, timeInStr, lateMin, method]
  );

  return result.rows[0];
}

export async function clockOut(data: {
  employeeId: string;
  date?: string;
  timeOut?: string;
}) {
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeOutStr = data.timeOut || `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. Fetch current attendance record
  const attRes = await query(
    `SELECT a.*, sh.start_time, sh.end_time, sh.break_minutes
     FROM wfm.attendance_logs a
     LEFT JOIN wfm.schedules s ON s.employee_id = a.employee_id AND s.schedule_date = a.date
     LEFT JOIN wfm.shifts sh ON sh.id = s.shift_id
     WHERE a.employee_id = $1 AND a.date = $2`,
    [data.employeeId, dateStr]
  );

  if (attRes.rows.length === 0 || !attRes.rows[0].time_in) {
    throw { statusCode: 400, code: 'NO_CLOCK_IN', message: 'No clock-in record found for today.' };
  }

  const record = attRes.rows[0];
  const [inH, inM] = record.time_in.split(':').map(Number);
  const [outH, outM] = timeOutStr.split(':').map(Number);

  const inTotal = inH * 60 + inM;
  const outTotal = outH * 60 + outM;
  const breakMin = record.break_minutes ? Number(record.break_minutes) : 60;

  const totalMinWorked = Math.max(0, outTotal - inTotal - breakMin);
  const workedHours = Number((totalMinWorked / 60).toFixed(2));

  let otMin = 0;
  let undertimeMin = 0;

  if (record.end_time) {
    const [schedEndH, schedEndM] = record.end_time.split(':').map(Number);
    const schedEndTotal = schedEndH * 60 + schedEndM;

    if (outTotal > schedEndTotal) {
      otMin = outTotal - schedEndTotal;
    } else if (outTotal < schedEndTotal) {
      undertimeMin = schedEndTotal - outTotal;
    }
  }

  const result = await query(
    `UPDATE wfm.attendance_logs
     SET time_out = $1, worked_hours = $2, ot_minutes = $3, undertime_minutes = $4,
         ot_status = CASE WHEN $3 > 0 THEN 'Pending' ELSE NULL END
     WHERE employee_id = $5 AND date = $6
     RETURNING *`,
    [timeOutStr, workedHours, otMin, undertimeMin, data.employeeId, dateStr]
  );

  return result.rows[0];
}

export async function getAttendanceLogs(options: {
  employeeId?: string;
  departmentId?: string;
  fromDate?: string;
  toDate?: string;
} = {}) {
  let sql = `
    SELECT a.*, e.employee_no, e.first_name, e.last_name, e.email,
           d.name AS department_name, p.title AS position_title
    FROM wfm.attendance_logs a
    JOIN hrms.employees e ON e.id = a.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    LEFT JOIN hrms.positions p ON p.id = e.position_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (options.employeeId) {
    params.push(options.employeeId);
    sql += ` AND a.employee_id = $${params.length}`;
  }
  if (options.departmentId) {
    params.push(options.departmentId);
    sql += ` AND e.department_id = $${params.length}`;
  }
  if (options.fromDate) {
    params.push(options.fromDate);
    sql += ` AND a.date >= $${params.length}`;
  }
  if (options.toDate) {
    params.push(options.toDate);
    sql += ` AND a.date <= $${params.length}`;
  }
  sql += ` ORDER BY a.date DESC, e.last_name ASC LIMIT 200`;

  const result = await query(sql, params);
  return result.rows;
}

// ------------------------------------------------------------------------------
// TIMESHEETS & RECONCILIATION
// ------------------------------------------------------------------------------

export async function getTimesheets(periodFrom?: string, periodTo?: string, employeeId?: string) {
  let sql = `
    SELECT t.*, e.employee_no, e.first_name, e.last_name, d.name AS department_name,
           u.full_name AS approver_name
    FROM wfm.timesheets t
    JOIN hrms.employees e ON e.id = t.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    LEFT JOIN auth_core.users u ON u.id = t.approved_by
    WHERE 1=1
  `;
  const params: any[] = [];
  if (periodFrom) {
    params.push(periodFrom);
    sql += ` AND t.period_from = $${params.length}`;
  }
  if (periodTo) {
    params.push(periodTo);
    sql += ` AND t.period_to = $${params.length}`;
  }
  if (employeeId) {
    params.push(employeeId);
    sql += ` AND t.employee_id = $${params.length}`;
  }
  sql += ` ORDER BY t.period_to DESC, e.last_name ASC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function generateTimesheetForCutoff(employeeId: string, periodFrom: string, periodTo: string) {
  // Aggregate attendance logs for this employee in the period
  const aggResult = await query(
    `SELECT 
       COALESCE(SUM(worked_hours), 0.00) AS total_regular,
       COALESCE(SUM(ot_minutes), 0) / 60.0 AS total_ot,
       COALESCE(SUM(late_minutes), 0)::int AS total_late,
       COALESCE(SUM(undertime_minutes), 0)::int AS total_undertime
     FROM wfm.attendance_logs
     WHERE employee_id = $1 AND date >= $2 AND date <= $3`,
    [employeeId, periodFrom, periodTo]
  );

  const agg = aggResult.rows[0];

  const result = await query(
    `INSERT INTO wfm.timesheets (
       employee_id, period_from, period_to, total_regular_hours, total_ot_hours,
       total_late_minutes, total_undertime_minutes, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Submitted')
     ON CONFLICT (employee_id, period_from, period_to) DO UPDATE
     SET total_regular_hours = EXCLUDED.total_regular_hours,
         total_ot_hours = EXCLUDED.total_ot_hours,
         total_late_minutes = EXCLUDED.total_late_minutes,
         total_undertime_minutes = EXCLUDED.total_undertime_minutes,
         status = 'Submitted'
     RETURNING *`,
    [
      employeeId,
      periodFrom,
      periodTo,
      Number(agg.total_regular).toFixed(2),
      Number(agg.total_ot).toFixed(2),
      agg.total_late,
      agg.total_undertime
    ]
  );

  return result.rows[0];
}

export async function updateTimesheetStatus(timesheetId: string, status: string, approverId?: string) {
  const result = await query(
    `UPDATE wfm.timesheets
     SET status = $1, approved_by = $2, approved_at = CASE WHEN $1 = 'Approved' THEN NOW() ELSE NULL END
     WHERE id = $3
     RETURNING *`,
    [status, approverId || null, timesheetId]
  );
  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'TIMESHEET_NOT_FOUND', message: 'Timesheet not found.' };
  }
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// LEAVES & WORKFORCE INTELLIGENCE ALERTS
// ------------------------------------------------------------------------------

export async function getAllLeaves(employeeId?: string, status?: string) {
  let sql = `
    SELECT l.*, e.employee_no, e.first_name, e.last_name, d.name AS department_name
    FROM wfm.leave_requests l
    JOIN hrms.employees e ON e.id = l.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (employeeId) {
    params.push(employeeId);
    sql += ` AND l.employee_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND l.status = $${params.length}`;
  }
  sql += ` ORDER BY l.start_date DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function fileLeave(data: {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
}) {
  const result = await query(
    `INSERT INTO wfm.leave_requests (
       employee_id, leave_type, start_date, end_date, days_count, reason, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
     RETURNING *`,
    [data.employeeId, data.leaveType, data.startDate, data.endDate, data.daysCount, data.reason]
  );
  return result.rows[0];
}

export async function decideLeave(leaveId: string, status: 'Approved' | 'Rejected', approverId: string) {
  const result = await query(
    `UPDATE wfm.leave_requests
     SET status = $1, approved_by = $2, approved_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, approverId, leaveId]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'LEAVE_NOT_FOUND', message: 'Leave request not found.' };
  }

  const leave = result.rows[0];

  // If approved, mark the days in attendance_logs as 'On Leave'
  if (status === 'Approved') {
    const cur = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      await query(
        `INSERT INTO wfm.attendance_logs (employee_id, date, status, worked_hours)
         VALUES ($1, $2, 'On Leave', 8.00)
         ON CONFLICT (employee_id, date) DO UPDATE
         SET status = 'On Leave', worked_hours = 8.00`,
        [leave.employee_id, dateStr]
      );
      cur.setDate(cur.getDate() + 1);
    }
  }

  return leave;
}

export async function getWorkforceAlerts() {
  // 1. Tardiness anomalies: Employees with >= 3 lates in past 30 days
  const lateAlerts = await query(
    `SELECT e.id, e.employee_no, e.first_name, e.last_name, d.name AS department_name,
            COUNT(a.id)::int AS late_occurrences, SUM(a.late_minutes)::int AS total_late_minutes
     FROM wfm.attendance_logs a
     JOIN hrms.employees e ON e.id = a.employee_id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     WHERE a.date >= CURRENT_DATE - INTERVAL '30 days' AND a.late_minutes > 0
     GROUP BY e.id, e.employee_no, e.first_name, e.last_name, d.name
     HAVING COUNT(a.id) >= 3`
  );

  // 2. Pending attendance corrections/unfiled leaves
  const pendingLeaves = await query(
    `SELECT COUNT(*)::int AS pending_count FROM wfm.leave_requests WHERE status = 'Pending'`
  );

  return {
    anomalies: lateAlerts.rows.map((row) => ({
      type: 'FREQUENT_TARDINESS',
      severity: row.late_occurrences >= 5 ? 'CRITICAL' : 'WARNING',
      message: `${row.first_name} ${row.last_name} (${row.employee_no}) has ${row.late_occurrences} tardy records (${row.total_late_minutes} total mins late) in the past 30 days.`,
      employeeId: row.id,
      department: row.department_name
    })),
    pendingLeaveRequests: pendingLeaves.rows[0]?.pending_count || 0,
    generatedAt: new Date().toISOString()
  };
}
