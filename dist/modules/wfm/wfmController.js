import { z } from 'zod';
import * as wfmService from './wfmService.js';
// Shifts & Schedules
export async function getShifts(req, res, next) {
    try {
        const data = await wfmService.getAllShifts();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createShift(req, res, next) {
    try {
        const schema = z.object({
            name: z.string().min(2),
            startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
            endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be in HH:MM format'),
            breakMinutes: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await wfmService.createShift(parsed.name, parsed.startTime, parsed.endTime, parsed.breakMinutes);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getSchedules(req, res, next) {
    try {
        const { employee_id, from, to } = req.query;
        const data = await wfmService.getSchedules({
            employeeId: employee_id,
            fromDate: from,
            toDate: to
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function assignSchedule(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            shiftId: z.string().uuid(),
            scheduleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
        });
        const { employeeId, shiftId, scheduleDate } = schema.parse(req.body);
        const data = await wfmService.assignSchedule(employeeId, shiftId, scheduleDate);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Attendance & Kiosk
export async function clockIn(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            date: z.string().optional(),
            timeIn: z.string().optional(),
            verificationMethod: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await wfmService.clockIn(parsed);
        res.json({ success: true, message: 'Clock-in recorded successfully.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function clockOut(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            date: z.string().optional(),
            timeOut: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await wfmService.clockOut(parsed);
        res.json({ success: true, message: 'Clock-out recorded successfully.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function getAttendance(req, res, next) {
    try {
        const { employee_id, department_id, from, to } = req.query;
        const data = await wfmService.getAttendanceLogs({
            employeeId: employee_id,
            departmentId: department_id,
            fromDate: from,
            toDate: to
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Timesheets
export async function getTimesheets(req, res, next) {
    try {
        const { from, to, employee_id } = req.query;
        const data = await wfmService.getTimesheets(from, to, employee_id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function generateTimesheet(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            periodFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            periodTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
        });
        const { employeeId, periodFrom, periodTo } = schema.parse(req.body);
        const data = await wfmService.generateTimesheetForCutoff(employeeId, periodFrom, periodTo);
        res.status(201).json({ success: true, message: 'Timesheet calculated and submitted.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateTimesheetStatus(req, res, next) {
    try {
        const schema = z.object({
            status: z.enum(['Draft', 'Submitted', 'Approved', 'Locked'])
        });
        const { status } = schema.parse(req.body);
        const approverId = req.user?.id;
        const data = await wfmService.updateTimesheetStatus(req.params.id, status, approverId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Leaves
export async function getLeaves(req, res, next) {
    try {
        const { employee_id, status } = req.query;
        const data = await wfmService.getAllLeaves(employee_id, status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function fileLeave(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            leaveType: z.string().min(2),
            startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            daysCount: z.number().positive(),
            reason: z.string().min(3)
        });
        const parsed = schema.parse(req.body);
        const data = await wfmService.fileLeave(parsed);
        res.status(201).json({ success: true, message: 'Leave request filed.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function decideLeave(req, res, next) {
    try {
        const schema = z.object({
            status: z.enum(['Approved', 'Rejected'])
        });
        const { status } = schema.parse(req.body);
        const approverId = req.user.id;
        const data = await wfmService.decideLeave(req.params.id, status, approverId);
        res.json({ success: true, message: `Leave request ${status.toLowerCase()}.`, data });
    }
    catch (err) {
        next(err);
    }
}
// AI Intelligence & Anomaly Alerts
export async function getAlerts(req, res, next) {
    try {
        const data = await wfmService.getWorkforceAlerts();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
