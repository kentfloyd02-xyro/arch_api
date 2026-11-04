import { z } from 'zod';
import * as hrmsService from './hrmsService.js';
// Department & Position
export async function getDepartments(req, res, next) {
    try {
        const data = await hrmsService.getAllDepartments();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createDepartment(req, res, next) {
    try {
        const schema = z.object({
            code: z.string().min(2),
            name: z.string().min(2),
            description: z.string().optional()
        });
        const { code, name, description } = schema.parse(req.body);
        const data = await hrmsService.createDepartment(code, name, description);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getPositions(req, res, next) {
    try {
        const departmentId = req.query.department_id;
        const data = await hrmsService.getAllPositions(departmentId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createPosition(req, res, next) {
    try {
        const schema = z.object({
            departmentId: z.string().uuid(),
            title: z.string().min(2),
            salaryGrade: z.string().optional(),
            baseSalary: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await hrmsService.createPosition(parsed.departmentId, parsed.title, parsed.salaryGrade, parsed.baseSalary);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Employees
export async function getEmployees(req, res, next) {
    try {
        const { department_id, status, search } = req.query;
        const data = await hrmsService.getAllEmployees({
            departmentId: department_id,
            status: status,
            search: search
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getNextEmployeeNo(req, res, next) {
    try {
        const nextNo = await hrmsService.getNextEmployeeNumber();
        res.json({ success: true, data: { nextEmployeeNo: nextNo } });
    }
    catch (err) {
        next(err);
    }
}
export async function getEmployee(req, res, next) {
    try {
        const data = await hrmsService.getEmployeeById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createEmployee(req, res, next) {
    try {
        const schema = z.object({
            employeeNo: z.string().optional(),
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            email: z.string().email(),
            phone: z.string().optional(),
            departmentId: z.string().uuid().optional(),
            positionId: z.string().uuid().optional(),
            employmentStatus: z.string().optional(),
            hireDate: z.string().optional(),
            birthDate: z.string().optional(),
            address: z.string().optional(),
            userId: z.string().uuid().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await hrmsService.createEmployee(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateEmployee(req, res, next) {
    try {
        const data = await hrmsService.updateEmployee(req.params.id, req.body);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Job Postings & Applicants
export async function getJobs(req, res, next) {
    try {
        const status = req.query.status || 'Open';
        const data = await hrmsService.getAllJobs(status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createJob(req, res, next) {
    try {
        const schema = z.object({
            departmentId: z.string().uuid(),
            positionId: z.string().uuid().optional(),
            title: z.string().min(2),
            jobType: z.string().optional(),
            location: z.string().optional(),
            description: z.string().min(10),
            requirements: z.string().optional(),
            salaryMin: z.number().optional(),
            salaryMax: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await hrmsService.createJobPosting(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getApplicants(req, res, next) {
    try {
        const { job_id, status } = req.query;
        const data = await hrmsService.getAllApplicants(job_id, status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function applyJob(req, res, next) {
    try {
        const schema = z.object({
            jobPostingId: z.string().uuid(),
            firstName: z.string().min(1),
            lastName: z.string().min(1),
            email: z.string().email(),
            phone: z.string().min(7),
            resumeUrl: z.string().optional(),
            aiMatchScore: z.number().optional(),
            aiSummary: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await hrmsService.submitApplication(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateApplicantStage(req, res, next) {
    try {
        const schema = z.object({
            status: z.enum(['Applied', 'Screening', 'Pre-Interview', 'Final Interview', 'Hired', 'Rejected'])
        });
        const { status } = schema.parse(req.body);
        const data = await hrmsService.updateApplicantStatus(req.params.id, status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function hireApplicant(req, res, next) {
    try {
        const { departmentId, positionId } = req.body;
        const data = await hrmsService.hireApplicant(req.params.id, departmentId, positionId);
        res.status(201).json({ success: true, message: 'Applicant successfully hired and converted to employee.', data });
    }
    catch (err) {
        next(err);
    }
}
// Onboarding
export async function getOnboarding(req, res, next) {
    try {
        const data = await hrmsService.getOnboardingTasks(req.params.employeeId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function toggleOnboarding(req, res, next) {
    try {
        const { isCompleted } = z.object({ isCompleted: z.boolean() }).parse(req.body);
        const data = await hrmsService.toggleOnboardingTask(req.params.taskId, isCompleted);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
