import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as payrollService from './payrollService.js';

// Payroll Runs
export async function getRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined;
    const data = await payrollService.getAllPayrollRuns(status);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getRun(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await payrollService.getPayrollRunById(req.params.id as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function computeRun(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
      periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
      payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
      runType: z.enum(['regular', 'thirteenth-month']).optional()
    });
    const parsed = schema.parse(req.body);
    const preparedBy = req.user?.full_name || 'HR Admin';
    const data = await payrollService.computePayrollRun({
      ...parsed,
      preparedBy
    });
    res.status(201).json({ success: true, message: 'Payroll run computed successfully.', data });
  } catch (err) {
    next(err);
  }
}

export async function updateRunStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      status: z.enum(['draft', 'pending', 'approved', 'funded', 'paid', 'closed']),
      comment: z.string().optional(),
      fundingReceiptUrl: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const decidedBy = req.user?.full_name;
    const data = await payrollService.updatePayrollRunStatus(req.params.id as string, parsed.status, {
      decidedBy,
      comment: parsed.comment,
      fundingReceiptUrl: parsed.fundingReceiptUrl
    });
    res.json({ success: true, message: `Payroll run status updated to ${parsed.status}.`, data });
  } catch (err) {
    next(err);
  }
}

// Payslips & ESS
export async function getPayslip(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await payrollService.getPayslipById(req.params.id as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeePayslips(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await payrollService.getPayslipsByEmployee(req.params.employeeId as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updatePayslipStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      paymentStatus: z.enum(['Paid', 'Failed'])
    });
    const { paymentStatus } = schema.parse(req.body);
    const data = await payrollService.updatePayslipStatus(req.params.id as string, paymentStatus);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// Claims & Reimbursements
export async function getClaims(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, employee_id } = req.query;
    const data = await payrollService.getAllClaims(status as string, employee_id as string);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function fileClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      employeeId: z.string().uuid(),
      claimType: z.string().min(2),
      amount: z.number().positive(),
      description: z.string().min(3),
      receiptUrl: z.string().optional()
    });
    const parsed = schema.parse(req.body);
    const data = await payrollService.fileClaim(parsed);
    res.status(201).json({ success: true, message: 'Expense claim filed.', data });
  } catch (err) {
    next(err);
  }
}

export async function decideClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      status: z.enum(['Approved', 'Rejected', 'Reimbursed'])
    });
    const { status } = schema.parse(req.body);
    const decidedById = req.user!.id;
    const data = await payrollService.decideClaim(req.params.id as string, status, decidedById);
    res.json({ success: true, message: `Claim marked as ${status}.`, data });
  } catch (err) {
    next(err);
  }
}

// HMO Benefits
export async function getHmo(req: Request, res: Response, next: NextFunction) {
  try {
    const employeeId = req.query.employee_id as string | undefined;
    const data = await payrollService.getAllHmoBenefits(employeeId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function enrollHmo(req: Request, res: Response, next: NextFunction) {
  try {
    const schema = z.object({
      employeeId: z.string().uuid(),
      providerName: z.string().min(2),
      policyNumber: z.string().optional(),
      coverageAmount: z.number().optional()
    });
    const parsed = schema.parse(req.body);
    const data = await payrollService.enrollHmo(parsed);
    res.status(201).json({ success: true, message: 'Employee enrolled in HMO benefit.', data });
  } catch (err) {
    next(err);
  }
}

// Finance Subsystem Integration Endpoint (Read-only API for Finance group)
export async function getFinanceRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const status = (req.query.status as string) || 'funded';
    const data = await payrollService.getAllPayrollRuns(status);
    res.json({
      success: true,
      data: data.map((r) => ({
        id: r.id,
        run_type: r.run_type,
        period_from: r.period_from,
        period_to: r.period_to,
        pay_date: r.pay_date,
        status: r.status,
        employees: r.employee_count,
        totals: {
          gross: Number(r.total_gross),
          deductions: Number(r.total_deductions),
          net: Number(r.total_net)
        },
        prepared_by: r.prepared_by,
        submitted_at: r.submitted_at,
        decided_by: r.decided_by,
        decided_at: r.decided_at,
        funding_receipt_url: r.funding_receipt_url
      }))
    });
  } catch (err) {
    next(err);
  }
}
