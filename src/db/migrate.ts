import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('--- Starting Database Migration ---');
  let sqlPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(sqlPath)) {
    sqlPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  try {
    await query(sql);
    console.log('✅ All 6 schemas and tables created successfully in PostgreSQL:');
    console.log('   - auth_core (Centralized SSO, Users, Sessions, Audit)');
    console.log('   - hrms (Core Human Capital, Employees, Jobs, Onboarding)');
    console.log('   - wfm (Workforce Management, Attendance, Timesheets, Leaves)');
    console.log('   - payroll (Payroll Runs, Payslips, Claims, Benefits HMO)');
    console.log('   - fleet (Vehicles, Drivers, Dispatches, Trips, Fuel)');
    console.log('   - shop (Categories, Products, Orders, Reviews, Vouchers)');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
