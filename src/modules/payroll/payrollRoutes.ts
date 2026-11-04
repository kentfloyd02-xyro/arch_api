import { Router } from 'express';
import * as payrollController from './payrollController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// Finance Integration endpoint (can be called with Bearer token or API key)
router.get('/integrations/finance/payroll-runs', payrollController.getFinanceRuns);

// Authenticated Endpoints
router.use(authenticate);

// Payroll Runs & Calculation
router.get('/runs', payrollController.getRuns);
router.get('/runs/:id', payrollController.getRun);
router.post('/runs/compute', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.computeRun);
router.patch('/runs/:id/status', authorize(['superadmin', 'payroll_officer']), payrollController.updateRunStatus);

// Payslips & Employee Self-Service (ESS)
router.get('/payslips/:id', payrollController.getPayslip);
router.get('/payslips/employee/:employeeId', payrollController.getEmployeePayslips);
router.patch('/payslips/:id/status', authorize(['superadmin', 'payroll_officer']), payrollController.updatePayslipStatus);

// Claims & Reimbursements
router.get('/claims', payrollController.getClaims);
router.post('/claims', payrollController.fileClaim);
router.patch('/claims/:id/decide', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.decideClaim);

// HMO Benefits
router.get('/benefits/hmo', payrollController.getHmo);
router.post('/benefits/hmo', authorize(['superadmin', 'payroll_officer', 'hr_admin']), payrollController.enrollHmo);

export default router;
