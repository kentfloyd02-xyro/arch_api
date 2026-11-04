import { Router } from 'express';
import * as wfmController from './wfmController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
// Kiosk / Quick Clock In/Out (open or authenticated)
router.post('/attendance/clock-in', wfmController.clockIn);
router.post('/attendance/clock-out', wfmController.clockOut);
// All subsequent routes require authentication
router.use(authenticate);
// Shifts & Schedules
router.get('/shifts', wfmController.getShifts);
router.post('/shifts', authorize(['superadmin', 'hr_admin']), wfmController.createShift);
router.get('/schedules', wfmController.getSchedules);
router.post('/schedules', authorize(['superadmin', 'hr_admin']), wfmController.assignSchedule);
// Attendance Queries
router.get('/attendance', wfmController.getAttendance);
// Timesheets
router.get('/timesheets', wfmController.getTimesheets);
router.post('/timesheets/generate', authorize(['superadmin', 'hr_admin']), wfmController.generateTimesheet);
router.patch('/timesheets/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.updateTimesheetStatus);
// Leaves
router.get('/leaves', wfmController.getLeaves);
router.post('/leaves', wfmController.fileLeave);
router.patch('/leaves/:id/status', authorize(['superadmin', 'hr_admin']), wfmController.decideLeave);
// AI Decision Support & Alerts
router.get('/intelligence/alerts', authorize(['superadmin', 'hr_admin']), wfmController.getAlerts);
export default router;
