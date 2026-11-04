import { query } from '../../db/connection.js';

// ------------------------------------------------------------------------------
// DEPARTMENTS & POSITIONS
// ------------------------------------------------------------------------------

export async function getAllDepartments() {
  const result = await query(
    `SELECT d.*, COUNT(e.id)::int AS employee_count
     FROM hrms.departments d
     LEFT JOIN hrms.employees e ON e.department_id = d.id
     GROUP BY d.id
     ORDER BY d.name ASC`
  );
  return result.rows;
}

export async function createDepartment(code: string, name: string, description?: string) {
  const result = await query(
    `INSERT INTO hrms.departments (code, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [code.toUpperCase(), name, description || null]
  );
  return result.rows[0];
}

export async function getAllPositions(departmentId?: string) {
  let sql = `
    SELECT p.*, d.name AS department_name
    FROM hrms.positions p
    LEFT JOIN hrms.departments d ON d.id = p.department_id
  `;
  const params: any[] = [];
  if (departmentId) {
    sql += ` WHERE p.department_id = $1`;
    params.push(departmentId);
  }
  sql += ` ORDER BY p.title ASC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function createPosition(departmentId: string, title: string, salaryGrade?: string, baseSalary?: number) {
  const result = await query(
    `INSERT INTO hrms.positions (department_id, title, salary_grade, base_salary)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [departmentId, title, salaryGrade || null, baseSalary || 0]
  );
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// EMPLOYEES
// ------------------------------------------------------------------------------

export async function getNextEmployeeNumber() {
  const result = await query(
    `SELECT employee_no FROM hrms.employees
     ORDER BY employee_no DESC LIMIT 1`
  );
  if (result.rows.length === 0) {
    return 'EMP-0001';
  }
  const lastNo = result.rows[0].employee_no;
  const match = lastNo.match(/EMP-(\d+)/);
  if (match) {
    const nextVal = parseInt(match[1], 10) + 1;
    return `EMP-${String(nextVal).padStart(4, '0')}`;
  }
  return `EMP-${Date.now().toString().slice(-4)}`;
}

export async function getAllEmployees(options: { departmentId?: string; status?: string; search?: string } = {}) {
  let sql = `
    SELECT e.*, d.name AS department_name, d.code AS department_code, p.title AS position_title,
           u.global_role, u.avatar_url
    FROM hrms.employees e
    LEFT JOIN hrms.departments d ON d.id = e.department_id
    LEFT JOIN hrms.positions p ON p.id = e.position_id
    LEFT JOIN auth_core.users u ON u.id = e.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (options.departmentId) {
    params.push(options.departmentId);
    sql += ` AND e.department_id = $${params.length}`;
  }
  if (options.status) {
    params.push(options.status);
    sql += ` AND e.employment_status = $${params.length}`;
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    sql += ` AND (e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.employee_no ILIKE $${params.length} OR e.email ILIKE $${params.length})`;
  }

  sql += ` ORDER BY e.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function getEmployeeById(id: string) {
  const result = await query(
    `SELECT e.*, d.name AS department_name, p.title AS position_title, p.base_salary,
            u.global_role, u.avatar_url
     FROM hrms.employees e
     LEFT JOIN hrms.departments d ON d.id = e.department_id
     LEFT JOIN hrms.positions p ON p.id = e.position_id
     LEFT JOIN auth_core.users u ON u.id = e.user_id
     WHERE e.id = $1 OR e.employee_no = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'EMPLOYEE_NOT_FOUND', message: `Employee with ID ${id} not found.` };
  }
  return result.rows[0];
}

export async function createEmployee(data: {
  employeeNo?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  employmentStatus?: string;
  hireDate?: string;
  birthDate?: string;
  address?: string;
  userId?: string;
}) {
  const empNo = data.employeeNo || (await getNextEmployeeNumber());

  const result = await query(
    `INSERT INTO hrms.employees (
       user_id, employee_no, first_name, last_name, email, phone,
       department_id, position_id, employment_status, hire_date, birth_date, address
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      data.userId || null,
      empNo,
      data.firstName,
      data.lastName,
      data.email,
      data.phone || null,
      data.departmentId || null,
      data.positionId || null,
      data.employmentStatus || 'Regular',
      data.hireDate || new Date().toISOString().slice(0, 10),
      data.birthDate || null,
      data.address || null
    ]
  );

  const newEmp = result.rows[0];

  // Create default onboarding tasks
  const defaultTasks = [
    'Submit government forms (SSS, PhilHealth, Pag-IBIG, TIN)',
    'Sign Company Employment Contract & Non-Disclosure Agreement',
    'Set up biometric facial profile / RFID for Kiosk clock-in',
    'Complete Facility & Safety Induction'
  ];
  for (const task of defaultTasks) {
    await query(
      `INSERT INTO hrms.onboarding_tasks (employee_id, title, description)
       VALUES ($1, $2, 'Mandatory new hire onboarding milestone')`,
      [newEmp.id, task]
    );
  }

  return newEmp;
}

export async function updateEmployee(id: string, data: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  departmentId: string;
  positionId: string;
  employmentStatus: string;
  address: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [id];

  const map: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    email: 'email',
    phone: 'phone',
    departmentId: 'department_id',
    positionId: 'position_id',
    employmentStatus: 'employment_status',
    address: 'address'
  };

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && map[key]) {
      params.push(val);
      fields.push(`${map[key]} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    return getEmployeeById(id);
  }

  fields.push('updated_at = NOW()');
  const sql = `UPDATE hrms.employees SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, params);
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// JOB POSTINGS & APPLICANTS
// ------------------------------------------------------------------------------

export async function getAllJobs(status: string = 'Open') {
  const result = await query(
    `SELECT j.*, d.name AS department_name, p.title AS position_title
     FROM hrms.job_postings j
     LEFT JOIN hrms.departments d ON d.id = j.department_id
     LEFT JOIN hrms.positions p ON p.id = j.position_id
     WHERE j.status = $1
     ORDER BY j.created_at DESC`,
    [status]
  );
  return result.rows;
}

export async function createJobPosting(data: {
  departmentId: string;
  positionId?: string;
  title: string;
  jobType?: string;
  location?: string;
  description: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
}) {
  const result = await query(
    `INSERT INTO hrms.job_postings (
       department_id, position_id, title, job_type, location, description, requirements, salary_min, salary_max
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.departmentId,
      data.positionId || null,
      data.title,
      data.jobType || 'Full-Time',
      data.location || 'Cavite Industrial Plant',
      data.description,
      data.requirements || null,
      data.salaryMin || null,
      data.salaryMax || null
    ]
  );
  return result.rows[0];
}

export async function getAllApplicants(jobPostingId?: string, status?: string) {
  let sql = `
    SELECT a.*, j.title AS job_title, d.name AS department_name
    FROM hrms.applicants a
    LEFT JOIN hrms.job_postings j ON j.id = a.job_posting_id
    LEFT JOIN hrms.departments d ON d.id = j.department_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (jobPostingId) {
    params.push(jobPostingId);
    sql += ` AND a.job_posting_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND a.status = $${params.length}`;
  }
  sql += ` ORDER BY a.created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

export async function submitApplication(data: {
  jobPostingId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl?: string;
  aiMatchScore?: number;
  aiSummary?: string;
}) {
  const applicationId = `APP-${Date.now().toString().slice(-6)}`;
  const result = await query(
    `INSERT INTO hrms.applicants (
       job_posting_id, application_id, first_name, last_name, email, phone, resume_url, ai_match_score, ai_summary, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Applied')
     RETURNING *`,
    [
      data.jobPostingId,
      applicationId,
      data.firstName,
      data.lastName,
      data.email,
      data.phone,
      data.resumeUrl || null,
      data.aiMatchScore || null,
      data.aiSummary || null
    ]
  );
  return result.rows[0];
}

export async function updateApplicantStatus(id: string, status: string) {
  const result = await query(
    `UPDATE hrms.applicants SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'APPLICANT_NOT_FOUND', message: 'Applicant not found.' };
  }
  return result.rows[0];
}

export async function hireApplicant(applicantId: string, departmentId?: string, positionId?: string) {
  const appResult = await query('SELECT * FROM hrms.applicants WHERE id = $1', [applicantId]);
  if (appResult.rows.length === 0) {
    throw { statusCode: 404, code: 'APPLICANT_NOT_FOUND', message: 'Applicant not found.' };
  }
  const applicant = appResult.rows[0];

  // Update applicant to Hired
  await query("UPDATE hrms.applicants SET status = 'Hired' WHERE id = $1", [applicantId]);

  // Create new employee
  const newEmployee = await createEmployee({
    firstName: applicant.first_name,
    lastName: applicant.last_name,
    email: applicant.email,
    phone: applicant.phone,
    departmentId: departmentId,
    positionId: positionId,
    employmentStatus: 'Probationary',
    birthDate: applicant.birth_date ? applicant.birth_date.toISOString().slice(0, 10) : undefined
  });

  return newEmployee;
}

export async function getOnboardingTasks(employeeId: string) {
  const result = await query(
    `SELECT * FROM hrms.onboarding_tasks WHERE employee_id = $1 ORDER BY created_at ASC`,
    [employeeId]
  );
  return result.rows;
}

export async function toggleOnboardingTask(taskId: string, isCompleted: boolean) {
  const result = await query(
    `UPDATE hrms.onboarding_tasks
     SET is_completed = $1, completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END
     WHERE id = $2
     RETURNING *`,
    [isCompleted, taskId]
  );
  return result.rows[0];
}
