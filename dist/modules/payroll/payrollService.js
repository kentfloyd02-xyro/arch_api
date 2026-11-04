import { query } from '../../db/connection.js';
// ------------------------------------------------------------------------------
// PAYROLL RUN COMPUTATION ENGINE
// ------------------------------------------------------------------------------
export async function getAllPayrollRuns(status) {
    let sql = `
    SELECT pr.*, COUNT(ps.id)::int AS employee_count
    FROM payroll.payroll_runs pr
    LEFT JOIN payroll.payslips ps ON ps.payroll_run_id = pr.id
    WHERE 1=1
  `;
    const params = [];
    if (status) {
        params.push(status);
        sql += ` AND pr.status = $${params.length}`;
    }
    sql += ` GROUP BY pr.id ORDER BY pr.period_to DESC`;
    const result = await query(sql, params);
    return result.rows;
}
export async function getPayrollRunById(id) {
    const runResult = await query('SELECT * FROM payroll.payroll_runs WHERE id = $1', [id]);
    if (runResult.rows.length === 0) {
        throw { statusCode: 404, code: 'PAYROLL_RUN_NOT_FOUND', message: 'Payroll run not found.' };
    }
    const run = runResult.rows[0];
    // Fetch payslips for this run
    const payslipsResult = await query(`SELECT ps.*, e.first_name, e.last_name, e.email, d.name AS department_name, p.title AS position_title
     FROM payroll.payslips ps
     JOIN hrms.employees e ON e.id = ps.employee_id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE ps.payroll_run_id = $1
     ORDER BY e.last_name ASC`, [id]);
    return {
        ...run,
        payslips: payslipsResult.rows
    };
}
export async function computePayrollRun(data) {
    const runType = data.runType || 'regular';
    // 1. Create or retrieve the payroll run record
    const runRes = await query(`INSERT INTO payroll.payroll_runs (
       run_type, period_from, period_to, pay_date, status, prepared_by, submitted_at
     ) VALUES ($1, $2, $3, $4, 'draft', $5, NOW())
     RETURNING *`, [runType, data.periodFrom, data.periodTo, data.payDate, data.preparedBy || 'HR Admin']);
    const payrollRun = runRes.rows[0];
    // 2. Fetch all regular/probationary employees with positions
    const empRes = await query(`SELECT e.id, e.employee_no, e.first_name, e.last_name,
            COALESCE(p.base_salary, 25000.00)::numeric AS base_salary
     FROM hrms.employees e
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE e.employment_status IN ('Regular', 'Probationary')`);
    let grandGross = 0;
    let grandDeductions = 0;
    let grandNet = 0;
    // 3. Compute for each employee
    for (const emp of empRes.rows) {
        const monthlySalary = Number(emp.base_salary) || 25000;
        const semiMonthlyBasic = Number((monthlySalary / 2).toFixed(2));
        const hourlyRate = monthlySalary / 22 / 8;
        const minuteRate = hourlyRate / 60;
        // Check WFM timesheet for this employee & period
        const tsRes = await query(`SELECT * FROM wfm.timesheets
       WHERE employee_id = $1 AND period_from >= $2 AND period_to <= $3`, [emp.id, data.periodFrom, data.periodTo]);
        const otHours = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_ot_hours) || 0 : 0;
        const lateMinutes = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_late_minutes) || 0 : 0;
        const undertimeMinutes = tsRes.rows.length > 0 ? Number(tsRes.rows[0].total_undertime_minutes) || 0 : 0;
        // Calculate Earnings
        const otPay = Number((otHours * hourlyRate * 1.25).toFixed(2));
        const grossPay = Number((semiMonthlyBasic + otPay).toFixed(2));
        // Calculate Deductions
        const tardinessDeduction = Number(((lateMinutes + undertimeMinutes) * minuteRate).toFixed(2));
        const sssDeduction = Number((Math.min(1350, monthlySalary * 0.045) / 2).toFixed(2));
        const philhealthDeduction = Number(((monthlySalary * 0.05) / 4).toFixed(2));
        const pagibigDeduction = 100.00;
        // Withholding Tax (TRAIN Law semi-monthly approximation)
        const taxableIncome = Math.max(0, grossPay - sssDeduction - philhealthDeduction - pagibigDeduction);
        let taxDeduction = 0;
        if (taxableIncome > 10417) {
            taxDeduction = Number(((taxableIncome - 10417) * 0.15).toFixed(2));
        }
        const totalDeductions = Number((tardinessDeduction + sssDeduction + philhealthDeduction + pagibigDeduction + taxDeduction).toFixed(2));
        const netPay = Number((grossPay - totalDeductions).toFixed(2));
        grandGross += grossPay;
        grandDeductions += totalDeductions;
        grandNet += netPay;
        // Insert Payslip
        const psRes = await query(`INSERT INTO payroll.payslips (
         payroll_run_id, employee_id, employee_no, basic_salary, gross_pay,
         total_deductions, net_pay, payment_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
       RETURNING id`, [payrollRun.id, emp.id, emp.employee_no, semiMonthlyBasic, grossPay, totalDeductions, netPay]);
        const payslipId = psRes.rows[0].id;
        // Insert Payslip Breakdown Lines
        const lines = [
            { type: 'earning', name: 'Basic Pay (Semi-Monthly)', amount: semiMonthlyBasic, taxable: true },
            ...(otPay > 0 ? [{ type: 'earning', name: `Overtime Pay (${otHours} hrs)`, amount: otPay, taxable: true }] : []),
            ...(tardinessDeduction > 0 ? [{ type: 'deduction', name: `Tardiness/Undertime (${lateMinutes + undertimeMinutes}m)`, amount: tardinessDeduction, taxable: false }] : []),
            { type: 'deduction', name: 'SSS Employee Contribution', amount: sssDeduction, taxable: false },
            { type: 'deduction', name: 'PhilHealth Contribution', amount: philhealthDeduction, taxable: false },
            { type: 'deduction', name: 'Pag-IBIG Fund', amount: pagibigDeduction, taxable: false },
            ...(taxDeduction > 0 ? [{ type: 'tax', name: 'Withholding Tax (TRAIN)', amount: taxDeduction, taxable: false }] : [])
        ];
        for (const line of lines) {
            await query(`INSERT INTO payroll.payslip_lines (payslip_id, line_type, line_name, amount)
         VALUES ($1, $2, $3, $4)`, [payslipId, line.type, line.name, line.amount]);
        }
    }
    // 4. Update grand totals in payroll_runs
    const updatedRun = await query(`UPDATE payroll.payroll_runs
     SET total_gross = $1, total_deductions = $2, total_net = $3, status = 'pending'
     WHERE id = $4
     RETURNING *`, [grandGross.toFixed(2), grandDeductions.toFixed(2), grandNet.toFixed(2), payrollRun.id]);
    return updatedRun.rows[0];
}
export async function updatePayrollRunStatus(id, status, options = {}) {
    const fields = ['status = $1'];
    const params = [status, id];
    if (options.decidedBy) {
        params.push(options.decidedBy);
        fields.push(`decided_by = $${params.length}`, `decided_at = NOW()`);
    }
    if (options.comment) {
        params.push(options.comment);
        fields.push(`decision_comment = $${params.length}`);
    }
    if (options.fundingReceiptUrl) {
        params.push(options.fundingReceiptUrl);
        fields.push(`funding_receipt_url = $${params.length}`, `funded_at = NOW()`);
    }
    const sql = `UPDATE payroll.payroll_runs SET ${fields.join(', ')} WHERE id = $2 RETURNING *`;
    const result = await query(sql, params);
    if (result.rows.length === 0) {
        throw { statusCode: 404, code: 'PAYROLL_RUN_NOT_FOUND', message: 'Payroll run not found.' };
    }
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// PAYSLIPS & ESS (Employee Self-Service)
// ------------------------------------------------------------------------------
export async function getPayslipById(payslipId) {
    const psRes = await query(`SELECT ps.*, pr.period_from, pr.period_to, pr.pay_date, pr.status AS run_status,
            e.first_name, e.last_name, e.email, d.name AS department_name, p.title AS position_title
     FROM payroll.payslips ps
     JOIN payroll.payroll_runs pr ON pr.id = ps.payroll_run_id
     JOIN hrms.employees e ON e.id = ps.employee_id
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     WHERE ps.id = $1`, [payslipId]);
    if (psRes.rows.length === 0) {
        throw { statusCode: 404, code: 'PAYSLIP_NOT_FOUND', message: 'Payslip not found.' };
    }
    const linesRes = await query(`SELECT * FROM payroll.payslip_lines WHERE payslip_id = $1 ORDER BY line_type ASC, amount DESC`, [payslipId]);
    return {
        ...psRes.rows[0],
        lines: linesRes.rows
    };
}
export async function getPayslipsByEmployee(employeeId) {
    const result = await query(`SELECT ps.*, pr.period_from, pr.period_to, pr.pay_date, pr.status AS run_status
     FROM payroll.payslips ps
     JOIN payroll.payroll_runs pr ON pr.id = ps.payroll_run_id
     WHERE ps.employee_id = $1 AND pr.status IN ('funded', 'paid', 'closed')
     ORDER BY pr.pay_date DESC`, [employeeId]);
    return result.rows;
}
export async function updatePayslipStatus(payslipId, paymentStatus) {
    const result = await query(`UPDATE payroll.payslips SET payment_status = $1 WHERE id = $2 RETURNING *`, [paymentStatus, payslipId]);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// CLAIMS & REIMBURSEMENTS
// ------------------------------------------------------------------------------
export async function getAllClaims(status, employeeId) {
    let sql = `
    SELECT c.*, e.employee_no, e.first_name, e.last_name, d.name AS department_name,
           u.full_name AS approver_name
    FROM payroll.claims c
    JOIN hrms.employees e ON e.id = c.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    LEFT JOIN auth_core.users u ON u.id = c.decided_by
    WHERE 1=1
  `;
    const params = [];
    if (status) {
        params.push(status);
        sql += ` AND c.status = $${params.length}`;
    }
    if (employeeId) {
        params.push(employeeId);
        sql += ` AND c.employee_id = $${params.length}`;
    }
    sql += ` ORDER BY c.created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
}
export async function fileClaim(data) {
    const result = await query(`INSERT INTO payroll.claims (
       employee_id, claim_type, amount, description, receipt_url, status
     ) VALUES ($1, $2, $3, $4, $5, 'Pending')
     RETURNING *`, [data.employeeId, data.claimType, data.amount, data.description, data.receiptUrl || null]);
    return result.rows[0];
}
export async function decideClaim(claimId, status, decidedById) {
    const result = await query(`UPDATE payroll.claims
     SET status = $1, decided_by = $2, decided_at = NOW()
     WHERE id = $3
     RETURNING *`, [status, decidedById, claimId]);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// HMO & HEALTH BENEFITS
// ------------------------------------------------------------------------------
export async function getAllHmoBenefits(employeeId) {
    let sql = `
    SELECT h.*, e.employee_no, e.first_name, e.last_name, d.name AS department_name
    FROM payroll.benefits_hmo h
    JOIN hrms.employees e ON e.id = h.employee_id
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    WHERE 1=1
  `;
    const params = [];
    if (employeeId) {
        params.push(employeeId);
        sql += ` AND h.employee_id = $${params.length}`;
    }
    sql += ` ORDER BY h.created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
}
export async function enrollHmo(data) {
    const result = await query(`INSERT INTO payroll.benefits_hmo (
       employee_id, provider_name, policy_number, coverage_amount, status
     ) VALUES ($1, $2, $3, $4, 'Active')
     RETURNING *`, [data.employeeId, data.providerName, data.policyNumber || null, data.coverageAmount || 150000.00]);
    return result.rows[0];
}
