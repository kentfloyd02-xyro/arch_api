# Archon Nell Centralized Backend API & Gateway

Centralized backend API, Single Sign-On (SSO) gateway, and unified PostgreSQL database engine for the **Archon Nell Incorporated** multi-module capstone platform.

---

## Architecture Overview

```
                                +---------------------------------------------+
                                |             Browsers / Clients              |
                                +----------------------+----------------------+
                                                       |
        +-------------------------+--------------------+--------------------+-------------------------+
        |                         |                    |                    |                         |
        v                         v                    v                    v                         v
[shop.archonnell.com]   [hrms.archonnell.com]  [wfm.archonnell.com] [payroll.archonnell.com]  [fleet.archonnell.com]
  Shop Frontend (Vite)   HRMS Frontend (Vite)  WFM Frontend (Vite)   Payroll Frontend (Vite)   Fleet Frontend (Vite)
        |                         |                    |                    |                         |
        +-------------------------+--------------------+--------------------+-------------------------+
                                                       |
                                                       v
                                     +-----------------------------------+
                                     |    CENTRALIZED BACKEND API        |
                                     |     [api.archonnell.com]          |
                                     |  Node.js + Express + TypeScript   |
                                     |     (archonnel-backend)           |
                                     +-----------------+-----------------+
                                                       |
                                                       v
                                     +-----------------------------------+
                                     |   UNIFIED POSTGRESQL DATABASE     |
                                     |  Primary: VPS Local (0ms latency) |
                                     |  Secondary: Supabase Cloud Mirror |
                                     +-----------------+-----------------+
                                                       |
                  +-----------------+------------------+------------------+-----------------+
                  |                 |                  |                  |                 |
                  v                 v                  v                  v                 v
            [Schema: shop]    [Schema: hrms]     [Schema: wfm]     [Schema: payroll]  [Schema: fleet]
            Orders, Products  Employees, Depts,  Attendance, Shift, Runs, Payslips,    Vehicles, Driver,
            Reviews, Vouchers Applicants, Jobs   Timesheet, Leaves  Claims, Benefits   Dispatches, Fuel
```

---

## Features Implemented

1. **Interactive Swagger UI API Documentation (`/api/docs` or `/docs`)**:
   - Complete OpenAPI 3.0 interactive dashboard documenting all endpoints across all 6 domains.
   - Live testing console with JWT Bearer Token authorization (`Authorize` button).
   - Filter bar and execution duration monitoring.

2. **Central API Gateway & Routing (`/api/v1`)**:
   - `/api/v1/auth` — Central SSO (JWT token generation, login, register, profile, cookies).
   - `/api/v1/hrms` — Core HR, departments, positions, employees, jobs.
   - `/api/v1/wfm` — Workforce shifts, schedules, attendance, timesheets, leaves.
   - `/api/v1/payroll` — Payroll runs, payslip lines, employee claims, benefits HMO.
   - `/api/v1/fleet` — Vehicles, drivers, dispatches, trip logs, fuel tracking.
   - `/api/v1/shop` — E-commerce categories, products, orders, reviews, vouchers.
   - `/api/v1/stubs` — Finance (GL/AP/AR/Disbursements) and Supply Chain mock APIs.

2. **Dual-Database Engine (VPS Local + Supabase Failover)**:
   - Primary: High-speed local PostgreSQL (`127.0.0.1:5432`) with `<1ms` latency.
   - Secondary / Hot Standby: Supabase cloud replica with automatic failover query routing.
   - Diagnostic `/health` endpoint returning real-time health and latency of both database pools.

3. **Subdomain CORS & Security Middleware**:
   - Whitelists wildcard subdomains `*.archonnell.com` and development ports.
   - Cross-domain cookie authentication (`domain: .archonnell.com`).
   - Role-Based Access Control (`authorize(['superadmin', 'hr_admin', ...])`).

4. **Unified SQL Database Schema (`src/db/schema.sql`)**:
   - 6 isolated PostgreSQL schemas (`auth_core`, `hrms`, `wfm`, `payroll`, `fleet`, `shop`).
   - Automated TypeScript migration runner (`npm run db:migrate`).
   - Default seeder (`npm run db:seed`) creating initial Superadmin, HR Director, Payroll Lead, Fleet Manager, and sample data.

---

## Setup & Running

### 1. Configuration
Copy `.env.example` to `.env` and fill in your database credentials:
```bash
cp .env.example .env
```

### 2. Run Database Migrations
Creates all 6 schemas and database tables:
```bash
npm run db:migrate
```

### 3. Seed Default Records
Populates initial superadmin, departments, vehicles, and categories:
```bash
npm run db:seed
```

Default credentials:
- **Email:** `admin@archonnell.com`
- **Password:** `Admin123!`

### 4. Start Development Server
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
npm start
```
