import bcrypt from 'bcryptjs';
import { query } from './connection.js';

async function runSeed() {
  console.log('--- Starting Database Seeder ---');
  const defaultPassword = await bcrypt.hash('Admin123!', 10);

  try {
    // 1. Seed Core Users
    const users = [
      { email: 'admin@archonnell.com', name: 'System Superadmin', role: 'superadmin' },
      { email: 'hr@archonnell.com', name: 'HR Director', role: 'hr_admin' },
      { email: 'payroll@archonnell.com', name: 'Payroll Lead', role: 'payroll_officer' },
      { email: 'fleet@archonnell.com', name: 'Fleet Coordinator', role: 'fleet_manager' },
      { email: 'driver1@archonnell.com', name: 'Reynaldo Driver', role: 'driver' },
      { email: 'customer@gmail.com', name: 'Juan Customer', role: 'customer' }
    ];

    const userMap: Record<string, string> = {};
    for (const u of users) {
      const res = await query(
        `INSERT INTO auth_core.users (email, password_hash, full_name, global_role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE 
         SET full_name = EXCLUDED.full_name, global_role = EXCLUDED.global_role
         RETURNING id, email`,
        [u.email, defaultPassword, u.name, u.role]
      );
      userMap[u.email] = res.rows[0].id;
    }
    console.log('✅ Seeded 6 universal users (Password: Admin123!)');

    // 2. Seed Departments
    const departments = [
      { code: 'EXEC', name: 'Executive Management', description: 'C-Level & Strategic Directors' },
      { code: 'HR', name: 'Human Resources', description: 'Talent Acquisition, Core HR & People Operations' },
      { code: 'WFM', name: 'Workforce Operations', description: 'Time & Attendance, Shift Planning' },
      { code: 'FIN', name: 'Finance & Payroll', description: 'Payroll, Benefits, Accounting & Tax' },
      { code: 'LOG', name: 'Fleet & Logistics', description: 'Transportation, Dispatch & Warehousing' },
      { code: 'PROD', name: 'Production & Plant', description: 'Chemical mixing, laboratory and batching' }
    ];

    const deptMap: Record<string, string> = {};
    for (const d of departments) {
      const res = await query(
        `INSERT INTO hrms.departments (code, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, code`,
        [d.code, d.name, d.description]
      );
      deptMap[d.code] = res.rows[0].id;
    }
    console.log('✅ Seeded core organizational departments');

    // 3. Seed Positions
    const positions = [
      { dept: 'HR', title: 'HR Director', grade: 'M1', salary: 75000 },
      { dept: 'HR', title: 'Recruitment Specialist', grade: 'P2', salary: 32000 },
      { dept: 'WFM', title: 'Workforce Scheduler', grade: 'P2', salary: 30000 },
      { dept: 'FIN', title: 'Payroll Officer', grade: 'P3', salary: 38000 },
      { dept: 'LOG', title: 'Fleet Supervisor', grade: 'P3', salary: 42000 },
      { dept: 'LOG', title: 'Senior Delivery Driver', grade: 'O1', salary: 26000 },
      { dept: 'PROD', title: 'Chemical Mixing Technician', grade: 'O2', salary: 28000 }
    ];

    const posMap: Record<string, string> = {};
    for (const p of positions) {
      const res = await query(
        `INSERT INTO hrms.positions (department_id, title, salary_grade, base_salary)
         VALUES ($1, $2, $3, $4)
         RETURNING id, title`,
        [deptMap[p.dept], p.title, p.grade, p.salary]
      );
      posMap[p.title] = res.rows[0].id;
    }
    console.log('✅ Seeded organizational positions');

    // 4. Seed Core Employees linked to Users
    const employees = [
      {
        userEmail: 'hr@archonnell.com',
        empNo: 'EMP-0001',
        first: 'Maria',
        last: 'Santos',
        dept: 'HR',
        pos: 'HR Director',
        phone: '0917-123-4567'
      },
      {
        userEmail: 'payroll@archonnell.com',
        empNo: 'EMP-0002',
        first: 'Arlene',
        last: 'Reyes',
        dept: 'FIN',
        pos: 'Payroll Officer',
        phone: '0918-234-5678'
      },
      {
        userEmail: 'fleet@archonnell.com',
        empNo: 'EMP-0003',
        first: 'Carlos',
        last: 'Mendoza',
        dept: 'LOG',
        pos: 'Fleet Supervisor',
        phone: '0919-345-6789'
      },
      {
        userEmail: 'driver1@archonnell.com',
        empNo: 'EMP-0004',
        first: 'Reynaldo',
        last: 'Bautista',
        dept: 'LOG',
        pos: 'Senior Delivery Driver',
        phone: '0920-456-7890'
      }
    ];

    for (const e of employees) {
      await query(
        `INSERT INTO hrms.employees (
           user_id, employee_no, first_name, last_name, email, phone,
           department_id, position_id, employment_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Regular')
         ON CONFLICT (employee_no) DO UPDATE
         SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
        [
          userMap[e.userEmail],
          e.empNo,
          e.first,
          e.last,
          e.userEmail,
          e.phone,
          deptMap[e.dept],
          posMap[e.pos]
        ]
      );
    }
    console.log('✅ Seeded initial employees linked to user logins');

    // 5. Seed Shifts in WFM
    const shifts = [
      { name: 'Standard Day Shift', start: '08:00', end: '17:00', breakMin: 60 },
      { name: 'Morning Plant Shift', start: '06:00', end: '15:00', breakMin: 60 },
      { name: 'Afternoon Logistics Shift', start: '13:00', end: '22:00', breakMin: 60 }
    ];

    for (const s of shifts) {
      await query(
        `INSERT INTO wfm.shifts (name, start_time, end_time, break_minutes)
         VALUES ($1, $2, $3, $4)`,
        [s.name, s.start, s.end, s.breakMin]
      );
    }
    console.log('✅ Seeded workforce shifts');

    // 6. Seed Sample Job Postings
    await query(
      `INSERT INTO hrms.job_postings (
         department_id, position_id, title, job_type, location, description, requirements, salary_min, salary_max
       ) VALUES ($1, $2, 'Heavy Truck Logistics Driver', 'Full-Time', 'Cavite Plant / Metro Manila',
         'Responsible for delivery of construction chemicals, epoxy coatings, and sealants to job sites across Greater Manila.',
         'Valid Professional Driver License (Code 3/CE). Minimum 2 years commercial driving experience.',
         25000, 32000)`,
      [deptMap['LOG'], posMap['Senior Delivery Driver']]
    );
    console.log('✅ Seeded sample career posting');

    // 7. Seed Sample Categories & Vehicles
    const categories = [
      { name: 'Waterproofing & Sealants', slug: 'waterproofing', description: 'High-performance elastomeric and crystalline coatings' },
      { name: 'Concrete Admixtures', slug: 'concrete-admixtures', description: 'Accelerators, retarders, plasticizers and superplasticizers' },
      { name: 'Epoxy & Flooring', slug: 'epoxy-flooring', description: 'Industrial resin, self-leveling compounds and mortars' },
      { name: 'Repair Mortars & Grouts', slug: 'mortars-grouts', description: 'Non-shrink structural grouts and patching mortars' }
    ];

    for (const c of categories) {
      await query(
        `INSERT INTO shop.categories (name, slug, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [c.name, c.slug, c.description]
      );
    }

    const vehicles = [
      { plate: 'NDG-1024', model: 'Isuzu Elf 6-Wheeler Closed Van', type: 'Truck', capacity: 4000 },
      { plate: 'NBR-3580', model: 'Fuso Canter Flatbed', type: 'Truck', capacity: 3500 },
      { plate: 'NEB-7892', model: 'Toyota HiAce Delivery Van', type: 'Van', capacity: 1200 }
    ];

    for (const v of vehicles) {
      await query(
        `INSERT INTO fleet.vehicles (plate_number, model, vehicle_type, capacity_kg)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (plate_number) DO NOTHING`,
        [v.plate, v.model, v.type, v.capacity]
      );
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error: any) {
    console.error('❌ Seeder error:', error.message);
    process.exit(1);
  }
}

runSeed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed script error:', err);
    process.exit(1);
  });
