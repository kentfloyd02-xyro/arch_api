import { Router } from 'express';
import * as hrmsController from './hrmsController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// --- Public Endpoints (Career portal & applicants) ---
router.get('/jobs', hrmsController.getJobs);
router.post('/applicants', hrmsController.applyJob);

// --- Authenticated Endpoints ---
router.use(authenticate);

// Department & Position
router.get('/departments', hrmsController.getDepartments);
router.post('/departments', authorize(['superadmin', 'hr_admin']), hrmsController.createDepartment);

router.get('/positions', hrmsController.getPositions);
router.post('/positions', authorize(['superadmin', 'hr_admin']), hrmsController.createPosition);

// Employees
router.get('/employees/next-no', authorize(['superadmin', 'hr_admin']), hrmsController.getNextEmployeeNo);
router.get('/employees', hrmsController.getEmployees);
router.get('/employees/:id', hrmsController.getEmployee);
router.post('/employees', authorize(['superadmin', 'hr_admin']), hrmsController.createEmployee);
router.put('/employees/:id', authorize(['superadmin', 'hr_admin']), hrmsController.updateEmployee);

// Jobs & Recruitment (Admin)
router.post('/jobs', authorize(['superadmin', 'hr_admin']), hrmsController.createJob);
router.get('/applicants', authorize(['superadmin', 'hr_admin']), hrmsController.getApplicants);
router.patch('/applicants/:id/status', authorize(['superadmin', 'hr_admin']), hrmsController.updateApplicantStage);
router.post('/applicants/:id/hire', authorize(['superadmin', 'hr_admin']), hrmsController.hireApplicant);

// Onboarding
router.get('/onboarding/:employeeId', hrmsController.getOnboarding);
router.patch('/onboarding/:taskId', authorize(['superadmin', 'hr_admin']), hrmsController.toggleOnboarding);

export default router;
