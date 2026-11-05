-- ==============================================================================
-- ARCHON NELL INCORPORATED - CENTRALIZED DATABASE SCHEMA (PostgreSQL)
-- Six Unified Schemas: auth_core, hrms, wfm, payroll, fleet, shop
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. SCHEMAS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS auth_core;
CREATE SCHEMA IF NOT EXISTS hrms;
CREATE SCHEMA IF NOT EXISTS wfm;
CREATE SCHEMA IF NOT EXISTS payroll;
CREATE SCHEMA IF NOT EXISTS fleet;
CREATE SCHEMA IF NOT EXISTS shop;

-- ------------------------------------------------------------------------------
-- 2. AUTH_CORE SCHEMA (Centralized SSO & User Identity)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    global_role VARCHAR(50) NOT NULL DEFAULT 'customer', -- 'superadmin', 'hr_admin', 'payroll_officer', 'fleet_manager', 'driver', 'employee', 'customer'
    avatar_url TEXT,
    phone_number VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_core.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_core.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. HRMS SCHEMA (Core Human Capital & Recruitment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hrms.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    salary_grade VARCHAR(50),
    base_salary NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth_core.users(id) ON DELETE SET NULL,
    employee_no VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES hrms.positions(id) ON DELETE SET NULL,
    employment_status VARCHAR(50) DEFAULT 'Regular', -- 'Probationary', 'Regular', 'Contractual', 'Resigned'
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    birth_date DATE,
    address TEXT,
    emergency_contact JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.job_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES hrms.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES hrms.positions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) DEFAULT 'Full-Time',
    location VARCHAR(100) DEFAULT 'Main Warehouse / Plant',
    description TEXT NOT NULL,
    requirements TEXT,
    salary_min NUMERIC(12, 2),
    salary_max NUMERIC(12, 2),
    status VARCHAR(50) DEFAULT 'Open', -- 'Open', 'Closed', 'Draft'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.applicants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID REFERENCES hrms.job_postings(id) ON DELETE SET NULL,
    application_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    birth_date DATE,
    resume_url TEXT,
    ai_match_score NUMERIC(5, 2),
    ai_summary TEXT,
    status VARCHAR(50) DEFAULT 'Applied', -- 'Applied', 'Screening', 'Pre-Interview', 'Final Interview', 'Hired', 'Rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hrms.onboarding_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hrms.employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. WFM SCHEMA (Workforce Management: Time, Shifts & Leaves)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wfm.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INT DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wfm.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES wfm.shifts(id) ON DELETE SET NULL,
    schedule_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, schedule_date)
);

CREATE TABLE IF NOT EXISTS wfm.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    worked_hours NUMERIC(5, 2) DEFAULT 0.00,
    late_minutes INT DEFAULT 0,
    undertime_minutes INT DEFAULT 0,
    ot_minutes INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Present', -- 'Present', 'Absent', 'On Leave', 'Day Off'
    ot_status VARCHAR(50) DEFAULT 'Pending', -- 'Approved', 'Pending', 'Rejected'
    verification_method VARCHAR(50) DEFAULT 'kiosk', -- 'kiosk', 'rfid', 'web', 'manual'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS wfm.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    total_regular_hours NUMERIC(6, 2) DEFAULT 0.00,
    total_ot_hours NUMERIC(6, 2) DEFAULT 0.00,
    total_late_minutes INT DEFAULT 0,
    total_undertime_minutes INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Submitted', 'Approved', 'Locked'
    approved_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, period_from, period_to)
);

CREATE TABLE IF NOT EXISTS wfm.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    leave_type VARCHAR(100) NOT NULL, -- 'Vacation', 'Sick', 'Emergency', 'Maternity', 'Paternity'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(4, 1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    approved_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. PAYROLL SCHEMA (Payroll & Benefits Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type VARCHAR(50) NOT NULL DEFAULT 'regular', -- 'regular', 'thirteenth-month'
    period_from DATE NOT NULL,
    period_to DATE NOT NULL,
    pay_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'funded', 'paid', 'closed'
    total_gross NUMERIC(14, 2) DEFAULT 0.00,
    total_deductions NUMERIC(14, 2) DEFAULT 0.00,
    total_net NUMERIC(14, 2) DEFAULT 0.00,
    prepared_by VARCHAR(255),
    submitted_at TIMESTAMP WITH TIME ZONE,
    decided_by VARCHAR(255),
    decided_at TIMESTAMP WITH TIME ZONE,
    decision_comment TEXT,
    funded_at TIMESTAMP WITH TIME ZONE,
    funding_receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.payslips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID NOT NULL REFERENCES payroll.payroll_runs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    employee_no VARCHAR(50) NOT NULL,
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Exported', 'Paid', 'Failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.payslip_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payslip_id UUID NOT NULL REFERENCES payroll.payslips(id) ON DELETE CASCADE,
    line_type VARCHAR(50) NOT NULL, -- 'earning', 'deduction', 'tax'
    line_name VARCHAR(150) NOT NULL, -- 'Basic Pay', 'Overtime', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Withholding Tax'
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    claim_type VARCHAR(100) NOT NULL, -- 'Travel', 'Medical', 'Equipment', 'Meal'
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    receipt_url TEXT,
    status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected', 'Reimbursed'
    decided_by UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    decided_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll.benefits_hmo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    provider_name VARCHAR(150) NOT NULL,
    policy_number VARCHAR(100),
    coverage_amount NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. FLEET SCHEMA (Fleet & Logistics Management)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fleet.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(150) NOT NULL,
    vehicle_type VARCHAR(100) NOT NULL DEFAULT 'Truck', -- 'Van', 'Truck', 'Motorcycle'
    capacity_kg NUMERIC(10, 2) DEFAULT 1000.00,
    fuel_capacity_liters NUMERIC(8, 2) DEFAULT 80.00,
    current_odometer NUMERIC(10, 2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Available', -- 'Available', 'On Trip', 'Maintenance'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES hrms.employees(id) ON DELETE CASCADE,
    license_number VARCHAR(100) NOT NULL,
    license_expiry DATE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID, -- References shop.orders(id)
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE SET NULL,
    pickup_address TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'Scheduled', -- 'Scheduled', 'Assigned', 'In Transit', 'Completed', 'Cancelled'
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    proof_of_delivery_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.trip_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_id UUID REFERENCES fleet.dispatches(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    start_odometer NUMERIC(10, 2),
    end_odometer NUMERIC(10, 2),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.fuel_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    liters NUMERIC(8, 2) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL,
    odometer NUMERIC(10, 2),
    receipt_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fleet.location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES fleet.vehicles(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES fleet.drivers(id) ON DELETE SET NULL,
    dispatch_id UUID REFERENCES fleet.dispatches(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
    speed NUMERIC(5, 2) DEFAULT 0.00,
    heading NUMERIC(5, 2) DEFAULT 0.00,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. SHOP SCHEMA (E-Commerce Store & Core Operations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES shop.categories(id) ON DELETE SET NULL,
    custom_id VARCHAR(50) UNIQUE, -- e.g. 'prod-1'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    sku VARCHAR(100),
    images JSONB DEFAULT '[]',
    specs JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'PERCENTAGE', -- 'PERCENTAGE', 'FIXED'
    discount_value NUMERIC(10, 2) NOT NULL,
    min_spend NUMERIC(10, 2) DEFAULT 0.00,
    max_discount NUMERIC(10, 2),
    usage_limit INT DEFAULT 100,
    used_count INT DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    payment_method VARCHAR(50) NOT NULL, -- 'GCash', 'Maya', 'Bank', 'COD'
    payment_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed', 'Refunded'
    gcash_ref_number VARCHAR(100),
    proof_image TEXT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    delivery_status VARCHAR(50) DEFAULT 'Pending', -- 'Pending', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'
    current_tracking_step VARCHAR(100) DEFAULT 'Order Placed',
    tracking_steps JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES shop.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES shop.products(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    total NUMERIC(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS shop.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES shop.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    ai_sentiment VARCHAR(50),
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7.1 SUPPORT & CUSTOMER INQUIRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop.support_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID REFERENCES auth_core.users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    question TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    guest_access_token VARCHAR(255),
    reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_inquiries_status ON shop.support_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_support_inquiries_created_at ON shop.support_inquiries(created_at DESC);

-- ------------------------------------------------------------------------------
-- 8. INDEXES FOR PERFORMANCE
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_core.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_role ON auth_core.users(global_role);
CREATE INDEX IF NOT EXISTS idx_hrms_employees_no ON hrms.employees(employee_no);
CREATE INDEX IF NOT EXISTS idx_wfm_attendance_emp_date ON wfm.attendance_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_payslips_run ON payroll.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_fleet_dispatches_order ON fleet.dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_num ON shop.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_shop_orders_user ON shop.orders(user_id);


-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MIGRATION GUARDS (Ensure new columns exist if tables already created)
-- ------------------------------------------------------------------------------
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS company VARCHAR(255);
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS default_address TEXT;
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS privacy_consent JSONB DEFAULT '{"granted": true}';

ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS sold INT DEFAULT 0;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.0;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS discount VARCHAR(50);
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS badge VARCHAR(100);
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS shipping_weight_kg NUMERIC(6, 2) DEFAULT 20.0;

CREATE TABLE IF NOT EXISTS shop.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_id VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    date VARCHAR(100),
    contractor VARCHAR(255),
    region VARCHAR(100),
    summary TEXT,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50);
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DELIVERED';
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS rating INT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS refund_details JSONB;

-- ==============================================================================

-- ------------------------------------------------------------------------------
-- MIGRATION GUARDS (Ensure new columns exist if tables already created)
-- ------------------------------------------------------------------------------
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS company VARCHAR(255);
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS default_address TEXT;
ALTER TABLE auth_core.users ADD COLUMN IF NOT EXISTS privacy_consent JSONB DEFAULT '{"granted": true}';
ALTER TABLE auth_core.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS sold INT DEFAULT 0;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.0;
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS discount VARCHAR(50);
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS badge VARCHAR(100);
ALTER TABLE shop.products ADD COLUMN IF NOT EXISTS shipping_weight_kg NUMERIC(6, 2) DEFAULT 20.0;

CREATE TABLE IF NOT EXISTS shop.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_id VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    date VARCHAR(100),
    contractor VARCHAR(255),
    region VARCHAR(100),
    summary TEXT,
    image TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50);
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'DELIVERED';
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS rating INT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE shop.orders ADD COLUMN IF NOT EXISTS refund_details JSONB;

-- ==============================================================================
-- INITIAL SHOP & USER SEED DATA FOR ARCH_API
-- Converted from initial seeder dataset to PostgreSQL schemas
-- ==============================================================================

-- ==============================================================================
-- 1. SHOP CATEGORIES
-- ==============================================================================
INSERT INTO shop.categories (name, slug, description)
VALUES
  ('Self-Leveling Mortar', 'mortar', 'High-strength cementitious floor rehabilitation and repair systems'),
  ('Structural Epoxy', 'epoxy', 'Low-viscosity structural crack injection and bonding polymers'),
  ('Admixtures & Plasticizers', 'admixture', 'High-range water reducers, superplasticizers, and concrete accelerators'),
  ('Waterproofing Membranes', 'waterproof', 'Elastomeric polymer-modified waterproofing barrier sealants')
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- 2. SHOP PRODUCTS (6 Industrial Products with complete catalog metrics)
-- ==============================================================================
INSERT INTO shop.products (custom_id, category_id, title, description, price, original_price, stock, sold, rating, discount, badge, shipping_weight_kg, sku, images, specs, is_active)
VALUES
(
  'prod-1',
  (SELECT id FROM shop.categories WHERE slug = 'mortar' LIMIT 1),
  'High-Strength Self-Leveling Mortar Repair System (25kg)',
  'High-performance cementitious self-leveling mortar engineered for rapid industrial floor rehabilitation and heavy vehicular traffic.',
  2450.00,
  3200.00,
  50,
  1420,
  4.90,
  '23% OFF',
  'STORE PREFERRED',
  25.00,
  'SKU-PROD-1',
  '["/assets/images/leveling_mortar_1785519746126.png"]'::jsonb,
  '["Highway & Bridge Certified","Fast 24h Cure","Ultra High Durability"]'::jsonb,
  TRUE
),
(
  'prod-2',
  (SELECT id FROM shop.categories WHERE slug = 'epoxy' LIMIT 1),
  'Epoxy Crack Injection Resin System (Complete Kit)',
  'Ultra-low viscosity structural epoxy injection polymer formulated to seal deep hairline to structural cracks in bridge decks and building columns.',
  3800.00,
  4500.00,
  35,
  890,
  5.00,
  '15% OFF',
  'TOP SELLER',
  20.00,
  'SKU-PROD-2',
  '["/assets/images/epoxy_crack_injection_1785519729415.png"]'::jsonb,
  '["Structural Repair","Low Viscosity","Bridge & Highway Approved"]'::jsonb,
  TRUE
),
(
  'prod-3',
  (SELECT id FROM shop.categories WHERE slug = 'admixture' LIMIT 1),
  'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
  'Third-generation high-range water reducer producing flowing concrete with superior compressive strength and long workability windows.',
  4950.00,
  6000.00,
  25,
  650,
  4.90,
  '17% OFF',
  'CONMIX LICENSE',
  20.00,
  'SKU-PROD-3',
  '["/assets/images/concrete_admixture_1785519590894.png"]'::jsonb,
  '["High Slump Retention","Metro Manila Infrastructure Approved","20L Drum"]'::jsonb,
  TRUE
),
(
  'prod-4',
  (SELECT id FROM shop.categories WHERE slug = 'waterproof' LIMIT 1),
  'Polymer Waterproofing Membrane Coating Sealant (10L)',
  'Flexible two-component polymer-modified elastomeric waterproof barrier against hydrostatic water pressure and chemical degradation.',
  1850.00,
  2300.00,
  40,
  2100,
  4.80,
  '20% OFF',
  'PROMO DEAL',
  10.00,
  'SKU-PROD-4',
  '["/assets/images/waterproofing_system_1785519712135.png"]'::jsonb,
  '["Swimming Pool Approved","Elastic Seal","10L Bucket"]'::jsonb,
  TRUE
),
(
  'prod-5',
  (SELECT id FROM shop.categories WHERE slug = 'mortar' LIMIT 1),
  'MF3000 Concrete Pavement Road Additive (25kg Bag)',
  'Polymer fiber reinforcement compound delivering exceptional flexural strength under severe tollway wheel friction.',
  3100.00,
  3800.00,
  30,
  430,
  4.90,
  '18% OFF',
  'HIGH STRENGTH',
  25.00,
  'SKU-PROD-5',
  '["/assets/images/mf3000_concrete_pavement_road_additive.png"]'::jsonb,
  '["San Simon Project Spec","Heavy Axle Load","25kg Bag"]'::jsonb,
  TRUE
),
(
  'prod-6',
  (SELECT id FROM shop.categories WHERE slug = 'admixture' LIMIT 1),
  'Rapid 24-Hour Concrete Accelerator Compound (15L)',
  'Chloride-free rapid setting hardening agent accelerating early compressive strength gain for critical rush road projects.',
  5200.00,
  6500.00,
  20,
  510,
  5.00,
  '20% OFF',
  'HIGHWAY SPEC',
  15.00,
  'SKU-PROD-6',
  '["/assets/images/rapid_24h_concrete_accelerator_compound.png"]'::jsonb,
  '["Candaba Pampanga Pilot Run","1-Day Heavy Traffic Load"]'::jsonb,
  TRUE
)
ON CONFLICT (custom_id) DO UPDATE SET
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  stock = EXCLUDED.stock,
  sold = EXCLUDED.sold,
  rating = EXCLUDED.rating,
  discount = EXCLUDED.discount,
  badge = EXCLUDED.badge,
  shipping_weight_kg = EXCLUDED.shipping_weight_kg,
  images = EXCLUDED.images,
  specs = EXCLUDED.specs;

-- ==============================================================================
-- 3. SHOP PROJECTS (Engineering Case Studies)
-- ==============================================================================
INSERT INTO shop.projects (custom_id, title, location, date, contractor, region, summary, image)
VALUES
(
  'proj-1',
  'High-Strength Self Leveling Mortar Road Repair',
  'C-5 Highway Corridor, Pasig (Metro Manila)',
  'Jan 31 – Feb 2, 2020',
  'Applied by RF Flores Construction',
  'Metro Manila',
  'Pavement rehabilitation of national road sections using Archon Nell high-strength self-leveling repair system.',
  '/assets/images/High-Strength Self Leveling Mortar Road Repair.jpg'
),
(
  'proj-2',
  'National Pavement Pilot Run for "One-Day Concrete"',
  'EDSA Balintawak Section, Quezon City (Metro Manila)',
  'January 10, 2020',
  'Poured by Eddmari Construction & Trading Corp.',
  'Metro Manila',
  'Official demonstration of rapid strength concrete technology allowing traffic opening in 24 hours.',
  '/assets/images/National Pavement Pilot Run for One-Day Concrete.jpg'
),
(
  'proj-3',
  'San Simon Pavement Road Repair Project',
  'Roxas Boulevard & Port Access, Manila (Metro Manila)',
  'November 14, 2019',
  'Archon Nell Engineering Team',
  'Metro Manila',
  'Concrete pavement repair utilizing Megaflow, SP402 & MF3000 high-durability admixtures.',
  '/assets/images/San Simon Pavement Road Repair Project.jpg'
),
(
  'proj-4',
  'Major Waterworks & Dam Infrastructure Supply',
  'La Mesa Reservoir Corridor, Quezon City (Metro Manila)',
  '2019 – 2023 (4-Year Project)',
  'National Waterways Authority',
  'Metro Manila',
  'Continuous 4-year bulk supply of specialized high-slump concrete admixtures for major infrastructure.',
  '/assets/images/Major Metro Manila Infrastructure Admixture Supply.jpg'
)
ON CONFLICT (custom_id) DO UPDATE SET
  title = EXCLUDED.title,
  location = EXCLUDED.location,
  summary = EXCLUDED.summary,
  image = EXCLUDED.image;

-- ==============================================================================
-- 4. SHOP VOUCHERS
-- ==============================================================================
INSERT INTO shop.vouchers (code, discount_type, discount_value, min_spend, is_active)
VALUES
  ('ARCHON20', 'PERCENTAGE', 20.00, 1000.00, TRUE),
  ('ARCHON500', 'FIXED', 500.00, 5000.00, TRUE),
  ('FREESHIP', 'FIXED', 150.00, 0.00, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- 5. USERS (1 Admin + 15 Customer Engineers)
-- ==============================================================================
INSERT INTO auth_core.users (email, password_hash, full_name, global_role, phone_number, company, default_address, privacy_consent, is_active)
VALUES
  ('jimmyontiveros01@gmail.com', crypt('Admin@123', gen_salt('bf')), 'Archon Nell Administrator', 'superadmin', '09171234567', 'Archon Nell Engineering Operations', 'Felix Ave. Cainta, Rizal / Metro Manila Site', '{"granted":true,"consentedAt":"2026-09-01T08:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('michaelbascon04@gmail.com', crypt('Customer@123', gen_salt('bf')), 'Engr. Kent Tagle', 'customer', '09289876543', 'Mega Infrastructure & Builders Corp.', 'Lot 14 Blk 3 Mega Highway Depot, C-5 Corridor, Pasig City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-15T09:30:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('carlos.mendoza@dmci.com.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Carlos Mendoza', 'customer', '09185551201', 'DMCI Project Operations', 'DMCI Compound, Pasong Tamo Ext., Makati City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-18T11:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('maricel.reyes@megawide.com.ph', crypt('Customer@123', gen_salt('bf')), 'Arch. Maricel Reyes', 'customer', '09224443312', 'Megawide Construction Corp.', '20 N. Domingo St., Quezon City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-20T14:15:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('eduardo.santos@eei.com.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Eduardo Santos', 'customer', '09178889923', 'EEI Heavy Engineering Corporation', 'EEI Main Office, Ortigas Ave., Pasig City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-22T10:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('ramon.bautista@makati-dev.ph', crypt('Customer@123', gen_salt('bf')), 'Ramon Bautista', 'customer', '09193338871', 'Makati Development Corporation', 'Ayala Triangle Tower, Ayala Ave., Makati City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-25T16:20:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('teresa.garcia@sta-clara.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Teresa Garcia', 'customer', '09276662244', 'Sta. Clara International Builders', 'Highway Depot, West Service Rd., Muntinlupa City, Metro Manila', '{"granted":true,"consentedAt":"2026-09-28T09:45:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('antonio.aquino@firstbalfour.com', crypt('Customer@123', gen_salt('bf')), 'Engr. Antonio Aquino', 'customer', '09151239876', 'First Balfour Inc. Infrastructure', 'KM 19 West Service Rd., Sucat, Paranaque City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-01T13:30:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('patricia.lim@alvey-builders.ph', crypt('Customer@123', gen_salt('bf')), 'Patricia Lim', 'customer', '09207775511', 'Alvey Builders & Civil Works', 'Bonifacio Global City, Taguig City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-03T11:10:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('francis.villanueva@sanmiguel.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Francis Villanueva', 'customer', '09172228833', 'San Miguel Infrastructure Operations', 'SMC Head Office Complex, Ortigas Center, Mandaluyong City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-05T15:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('rowena.delacruz@monark.ph', crypt('Customer@123', gen_salt('bf')), 'Rowena Dela Cruz', 'customer', '09284449900', 'Monark Highway Equipment & Works', 'Monark Heavy Yard, E. Rodriguez Jr. Ave., Quezon City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-08T08:30:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('joseph.tan@metro-pacific.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Joseph Tan', 'customer', '09181116677', 'Metro Pacific Tollways Corp.', 'NLEX Balintawak Operations Center, Caloocan City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-10T12:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('maria.castro@cebu-infra.ph', crypt('Customer@123', gen_salt('bf')), 'Arch. Maria Castro', 'customer', '09223331188', 'Metro Infrastructure Consortium', 'Roxas Boulevard Coastal Bay, Manila, Metro Manila', '{"granted":true,"consentedAt":"2026-10-12T14:40:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('albert.soriano@davao-builders.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Albert Soriano', 'customer', '09195554422', 'Prime Engineering Group', 'Shaw Boulevard Industrial Center, Mandaluyong City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-14T17:15:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('grace.navarro@bataan-co.ph', crypt('Customer@123', gen_salt('bf')), 'Grace Navarro', 'customer', '09278883344', 'Metro Heavy Industrial Corp.', 'Manila North Harbor Logistics Yard, Tondo, Manila, Metro Manila', '{"granted":false,"consentedAt":"2026-10-18T10:00:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE),
  ('richard.mercado@cavite-express.ph', crypt('Customer@123', gen_salt('bf')), 'Engr. Richard Mercado', 'customer', '09156667788', 'Expressway Consortium', 'Macapagal Blvd., Aseana City, Paranaque City, Metro Manila', '{"granted":true,"consentedAt":"2026-10-19T09:10:00Z","policyVersion":"RA10173-2026.1"}'::jsonb, TRUE)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  global_role = EXCLUDED.global_role,
  phone_number = EXCLUDED.phone_number,
  company = EXCLUDED.company,
  default_address = EXCLUDED.default_address,
  privacy_consent = EXCLUDED.privacy_consent;

-- ==============================================================================
-- 6. PRODUCT REVIEWS (24 Verified Reviews)
-- ==============================================================================
DELETE FROM shop.reviews WHERE customer_name IS NOT NULL;
INSERT INTO shop.reviews (product_id, customer_name, rating, comment, is_verified_purchase, created_at)
VALUES
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1), 'Engr. Kent Tagle', 5, 'Super fast curing! Reopened the tollway in under 24 hours.', TRUE, '2026-10-14 10:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1), 'Engr. Carlos Mendoza', 5, 'Testing lab approved core drill results with 5500 psi.', TRUE, '2026-10-10 11:30:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1), 'Arch. Maricel Reyes', 5, 'Leveling mortar flowed smoothly into 15mm floor dips.', TRUE, '2026-09-28 14:15:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1), 'Engr. Eduardo Santos', 5, 'High early compressive strength, zero micro-cracks on slab.', TRUE, '2026-09-18 09:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1), 'Engr. Eduardo Santos', 5, 'Deep penetration even on 0.2mm hairline fissure cracks.', TRUE, '2026-10-12 16:20:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1), 'Ramon Bautista', 5, 'Sealed all structural basement cracks without leakage.', TRUE, '2026-10-04 13:10:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1), 'Engr. Teresa Garcia', 4, 'Complete kit with nozzles made bridge pier repair simple.', TRUE, '2026-09-22 15:45:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1), 'Engr. Antonio Aquino', 5, 'Low viscosity resin fully bonded the cracked retaining wall.', TRUE, '2026-09-14 11:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1), 'Engr. Antonio Aquino', 5, 'Maintains 200mm slump for over 90 mins in Metro Manila.', TRUE, '2026-10-15 08:30:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1), 'Patricia Lim', 5, 'Reduced water demand by 25% while increasing cube strength.', TRUE, '2026-10-06 17:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1), 'Engr. Francis Villanueva', 5, 'Excellent pumpability for 40-storey continuous concrete pour.', TRUE, '2026-09-25 10:15:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1), 'Rowena Dela Cruz', 5, 'Superb slump retention under extreme midday heat in Pasig.', TRUE, '2026-09-12 14:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1), 'Rowena Dela Cruz', 5, 'Zero seepage in water retaining tank after 72-hour test.', TRUE, '2026-10-11 12:45:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1), 'Engr. Joseph Tan', 4, 'Flexible polymer membrane bridged hairline substrate cracks.', TRUE, '2026-10-01 09:30:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1), 'Arch. Maria Castro', 5, 'Elastic waterproof barrier held perfectly against rainwater.', TRUE, '2026-09-18 16:20:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1), 'Engr. Albert Soriano', 5, 'Two-coat application fully waterproofed our roof deck.', TRUE, '2026-09-08 11:10:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1), 'Engr. Albert Soriano', 5, 'Heavy axle friction showed zero raveling after 6 months.', TRUE, '2026-10-13 15:30:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1), 'Grace Navarro', 5, 'Polymer fibers blended evenly in transit mixer without balling.', TRUE, '2026-10-05 13:40:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1), 'Engr. Kent Tagle', 5, 'Exceeded flexural design target for San Simon bypass road.', TRUE, '2026-09-20 10:50:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1), 'Engr. Richard Mercado', 5, 'Drastically reduced pavement rutting under heavy truck lanes.', TRUE, '2026-09-10 14:25:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1), 'Engr. Richard Mercado', 5, 'Candaba Pampanga pilot run hit 3200 psi within 24 hours.', TRUE, '2026-10-16 09:15:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1), 'Engr. Carlos Mendoza', 5, 'Allowed asphalt overlay paving the very next morning on EDSA.', TRUE, '2026-10-08 11:00:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1), 'Engr. Eduardo Santos', 5, 'Rush highway intersection opened on schedule with high strength.', TRUE, '2026-09-15 17:35:00+08'),
  ((SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1), 'Arch. Maricel Reyes', 5, 'Accelerated initial set time from 6 hours down to 90 minutes.', TRUE, '2026-09-02 08:45:00+08');

-- ==============================================================================
-- 7. SHOP ORDERS (40 Complete Orders from initial seeder dataset)
-- ==============================================================================
DELETE FROM shop.order_items;
DELETE FROM shop.orders;

INSERT INTO shop.orders (
  order_number, user_id, customer_name, customer_email, customer_phone,
  delivery_address, delivery_notes, payment_method, payment_status, gcash_ref_number,
  subtotal, shipping_fee, discount, discount_amount, discount_type, total, total_amount,
  status, delivery_status, current_tracking_step, tracking_steps, items,
  rating, notes, rated_at, cancel_reason, cancelled_at, refund_details, created_at
)
VALUES
(
  'AN-ORD-2026-88412',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('michaelbascon04@gmail.com') LIMIT 1),
  'Engr. Kent Tagle',
  'michaelbascon04@gmail.com',
  '09289876543',
  'Lot 14 Blk 3 Mega Highway Depot, C-5 Corridor, Pasig City, Metro Manila',
  'Gate 1 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321000',
  9800.00,
  0.00,
  500.00,
  500.00,
  'ARCHON500',
  9300.00,
  9300.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 1, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 1, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 2, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 2, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":4,"total":9800}]'::jsonb,
  4,
  'Superb curing speed and zero hairline cracks on our slab.',
  '2026-10-02 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-01 10:00:00+08'
),
(
  'AN-ORD-2026-88413',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('carlos.mendoza@dmci.com.ph') LIMIT 1),
  'Engr. Carlos Mendoza',
  'carlos.mendoza@dmci.com.ph',
  '09185551201',
  'DMCI Compound, Pasong Tamo Ext., Makati City, Metro Manila',
  'Gate 2 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221101',
  29700.00,
  300.00,
  0.00,
  0.00,
  '',
  30000.00,
  30000.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 2, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 2, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 3, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 3, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":6,"total":29700}]'::jsonb,
  5,
  'High early strength, road opened in 24 hours on time.',
  '2026-10-03 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-02 10:00:00+08'
),
(
  'AN-ORD-2026-88414',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('maricel.reyes@megawide.com.ph') LIMIT 1),
  'Arch. Maricel Reyes',
  'maricel.reyes@megawide.com.ph',
  '09224443312',
  '20 N. Domingo St., Quezon City, Metro Manila',
  'Gate 3 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112235',
  11400.00,
  300.00,
  0.00,
  0.00,
  '',
  11700.00,
  11700.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 3, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 3, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 4, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 4, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":3,"total":11400}]'::jsonb,
  5,
  'Good slump flow and easy pumping through the hose line.',
  '2026-10-04 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-03 10:00:00+08'
),
(
  'AN-ORD-2026-88415',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('eduardo.santos@eei.com.ph') LIMIT 1),
  'Engr. Eduardo Santos',
  'eduardo.santos@eei.com.ph',
  '09178889923',
  'EEI Main Office, Ortigas Ave., Pasig City, Metro Manila',
  'Gate 4 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  14800.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  14800.00,
  14800.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 4, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 4, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 5, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 5, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":8,"total":14800}]'::jsonb,
  4,
  'Sealed all deep pier cracks completely with zero leaks.',
  '2026-10-05 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-04 10:00:00+08'
),
(
  'AN-ORD-2026-88416',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('ramon.bautista@makati-dev.ph') LIMIT 1),
  'Ramon Bautista',
  'ramon.bautista@makati-dev.ph',
  '09193338871',
  'Ayala Triangle Tower, Ayala Ave., Makati City, Metro Manila',
  'Gate 5 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321004',
  31000.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  30800.00,
  30800.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 5, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 5, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 6, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 6, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":10,"total":31000}]'::jsonb,
  5,
  'Excellent bond strength on wet concrete bridge footing.',
  '2026-10-06 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-05 10:00:00+08'
),
(
  'AN-ORD-2026-88417',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('teresa.garcia@sta-clara.ph') LIMIT 1),
  'Engr. Teresa Garcia',
  'teresa.garcia@sta-clara.ph',
  '09276662244',
  'Highway Depot, West Service Rd., Muntinlupa City, Metro Manila',
  'Gate 6 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221105',
  26000.00,
  300.00,
  0.00,
  0.00,
  '',
  26300.00,
  26300.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 6, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 6, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 7, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 7, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":5,"total":26000}]'::jsonb,
  5,
  'Rapid compressive strength reached 3500 psi overnight.',
  '2026-10-07 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-06 10:00:00+08'
),
(
  'AN-ORD-2026-88418',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('antonio.aquino@firstbalfour.com') LIMIT 1),
  'Engr. Antonio Aquino',
  'antonio.aquino@firstbalfour.com',
  '09151239876',
  'KM 19 West Service Rd., Sucat, Paranaque City, Metro Manila',
  'Gate 7 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112239',
  19750.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  19750.00,
  19750.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 7, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 7, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 8, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 8, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":2,"total":4900},{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":3,"total":14850}]'::jsonb,
  4,
  'Maintained 180mm slump retention under heavy summer heat.',
  '2026-10-08 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-07 10:00:00+08'
),
(
  'AN-ORD-2026-88419',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('patricia.lim@alvey-builders.ph') LIMIT 1),
  'Patricia Lim',
  'patricia.lim@alvey-builders.ph',
  '09207775511',
  'Bonifacio Global City, Taguig City, Metro Manila',
  'Gate 8 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  22800.00,
  300.00,
  0.00,
  0.00,
  '',
  23100.00,
  23100.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 8, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 8, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 9, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 9, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":4,"total":12400},{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":2,"total":10400}]'::jsonb,
  5,
  'Fast initial set; works perfectly for rush repair lanes.',
  '2026-10-09 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-08 10:00:00+08'
),
(
  'AN-ORD-2026-88420',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('francis.villanueva@sanmiguel.ph') LIMIT 1),
  'Engr. Francis Villanueva',
  'francis.villanueva@sanmiguel.ph',
  '09172228833',
  'SMC Head Office Complex, Ortigas Center, Mandaluyong City, Metro Manila',
  'Gate 9 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321008',
  15000.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  14800.00,
  14800.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 9, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 9, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 10, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 10, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":2,"total":7600},{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":4,"total":7400}]'::jsonb,
  5,
  'Solid flexural strength, withstands high axle friction.',
  '2026-10-10 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-09 10:00:00+08'
),
(
  'AN-ORD-2026-88421',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('rowena.delacruz@monark.ph') LIMIT 1),
  'Rowena Dela Cruz',
  'rowena.delacruz@monark.ph',
  '09284449900',
  'Monark Heavy Yard, E. Rodriguez Jr. Ave., Quezon City, Metro Manila',
  'Gate 10 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221109',
  38400.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  38400.00,
  38400.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 10, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 10, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 11, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 11, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":4,"total":19800},{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":6,"total":18600}]'::jsonb,
  4,
  'Elastic coating sealed our roof deck water leaks fast.',
  '2026-10-11 17:00:00+08',
  NULL,
  NULL,
  NULL,
  '2026-10-10 10:00:00+08'
),
(
  'AN-ORD-2026-88422',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('joseph.tan@metro-pacific.ph') LIMIT 1),
  'Engr. Joseph Tan',
  'joseph.tan@metro-pacific.ph',
  '09181116677',
  'NLEX Balintawak Operations Center, Caloocan City, Metro Manila',
  'Gate 11 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112243',
  9800.00,
  300.00,
  0.00,
  0.00,
  '',
  10100.00,
  10100.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 11, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 11, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 12, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 12, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":4,"total":9800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-11 10:00:00+08'
),
(
  'AN-ORD-2026-88423',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('maria.castro@cebu-infra.ph') LIMIT 1),
  'Arch. Maria Castro',
  'maria.castro@cebu-infra.ph',
  '09223331188',
  'Roxas Boulevard Coastal Bay, Manila, Metro Manila',
  'Gate 12 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  29700.00,
  300.00,
  0.00,
  0.00,
  '',
  30000.00,
  30000.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 12, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 12, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 13, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 13, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":6,"total":29700}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-12 10:00:00+08'
),
(
  'AN-ORD-2026-88424',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('albert.soriano@davao-builders.ph') LIMIT 1),
  'Engr. Albert Soriano',
  'albert.soriano@davao-builders.ph',
  '09195554422',
  'Shaw Boulevard Industrial Center, Mandaluyong City, Metro Manila',
  'Gate 13 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321012',
  11400.00,
  0.00,
  500.00,
  500.00,
  'ARCHON500',
  10900.00,
  10900.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 13, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 13, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 14, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 14, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":3,"total":11400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-13 10:00:00+08'
),
(
  'AN-ORD-2026-88425',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('grace.navarro@bataan-co.ph') LIMIT 1),
  'Grace Navarro',
  'grace.navarro@bataan-co.ph',
  '09278883344',
  'Manila North Harbor Logistics Yard, Tondo, Manila, Metro Manila',
  'Gate 14 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221113',
  14800.00,
  300.00,
  0.00,
  0.00,
  '',
  15100.00,
  15100.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 14, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 14, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 15, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 15, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":8,"total":14800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-14 10:00:00+08'
),
(
  'AN-ORD-2026-88426',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('richard.mercado@cavite-express.ph') LIMIT 1),
  'Engr. Richard Mercado',
  'richard.mercado@cavite-express.ph',
  '09156667788',
  'Macapagal Blvd., Aseana City, Paranaque City, Metro Manila',
  'Gate 15 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112247',
  31000.00,
  300.00,
  0.00,
  0.00,
  '',
  31300.00,
  31300.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 15, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 15, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 16, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 16, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":10,"total":31000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-15 10:00:00+08'
),
(
  'AN-ORD-2026-88427',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('michaelbascon04@gmail.com') LIMIT 1),
  'Engr. Kent Tagle',
  'michaelbascon04@gmail.com',
  '09289876543',
  'Lot 14 Blk 3 Mega Highway Depot, C-5 Corridor, Pasig City, Metro Manila',
  'Gate 16 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  26000.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  26000.00,
  26000.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 16, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 16, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 17, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 17, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":5,"total":26000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-16 10:00:00+08'
),
(
  'AN-ORD-2026-88428',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('carlos.mendoza@dmci.com.ph') LIMIT 1),
  'Engr. Carlos Mendoza',
  'carlos.mendoza@dmci.com.ph',
  '09185551201',
  'DMCI Compound, Pasong Tamo Ext., Makati City, Metro Manila',
  'Gate 17 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321016',
  19750.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  19550.00,
  19550.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 17, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 17, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 18, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 18, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":2,"total":4900},{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":3,"total":14850}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-17 10:00:00+08'
),
(
  'AN-ORD-2026-88429',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('maricel.reyes@megawide.com.ph') LIMIT 1),
  'Arch. Maricel Reyes',
  'maricel.reyes@megawide.com.ph',
  '09224443312',
  '20 N. Domingo St., Quezon City, Metro Manila',
  'Gate 18 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221117',
  22800.00,
  300.00,
  0.00,
  0.00,
  '',
  23100.00,
  23100.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 18, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 18, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 19, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 19, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":4,"total":12400},{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":2,"total":10400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-18 10:00:00+08'
),
(
  'AN-ORD-2026-88430',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('eduardo.santos@eei.com.ph') LIMIT 1),
  'Engr. Eduardo Santos',
  'eduardo.santos@eei.com.ph',
  '09178889923',
  'EEI Main Office, Ortigas Ave., Pasig City, Metro Manila',
  'Gate 19 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112251',
  15000.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  15000.00,
  15000.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 19, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 19, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 20, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 20, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":2,"total":7600},{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":4,"total":7400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-19 10:00:00+08'
),
(
  'AN-ORD-2026-88431',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('ramon.bautista@makati-dev.ph') LIMIT 1),
  'Ramon Bautista',
  'ramon.bautista@makati-dev.ph',
  '09193338871',
  'Ayala Triangle Tower, Ayala Ave., Makati City, Metro Manila',
  'Gate 20 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  38400.00,
  300.00,
  0.00,
  0.00,
  '',
  38700.00,
  38700.00,
  'DELIVERED',
  'DELIVERED',
  'Delivered',
  '[{"step":"Order Placed","time":"Oct 20, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 20, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 21, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Oct 21, 2026 - 04:15 PM","done":true,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":4,"total":19800},{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":6,"total":18600}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-20 10:00:00+08'
),
(
  'AN-ORD-2026-88432',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('teresa.garcia@sta-clara.ph') LIMIT 1),
  'Engr. Teresa Garcia',
  'teresa.garcia@sta-clara.ph',
  '09276662244',
  'Highway Depot, West Service Rd., Muntinlupa City, Metro Manila',
  'Gate 21 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321020',
  9800.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  9600.00,
  9600.00,
  'IN_TRANSIT',
  'IN_TRANSIT',
  'Out for Delivery',
  '[{"step":"Order Placed","time":"Oct 21, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 21, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 22, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":4,"total":9800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-21 10:00:00+08'
),
(
  'AN-ORD-2026-88433',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('antonio.aquino@firstbalfour.com') LIMIT 1),
  'Engr. Antonio Aquino',
  'antonio.aquino@firstbalfour.com',
  '09151239876',
  'KM 19 West Service Rd., Sucat, Paranaque City, Metro Manila',
  'Gate 22 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221121',
  29700.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  29700.00,
  29700.00,
  'IN_TRANSIT',
  'IN_TRANSIT',
  'Out for Delivery',
  '[{"step":"Order Placed","time":"Oct 22, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 22, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 23, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":6,"total":29700}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-22 10:00:00+08'
),
(
  'AN-ORD-2026-88434',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('patricia.lim@alvey-builders.ph') LIMIT 1),
  'Patricia Lim',
  'patricia.lim@alvey-builders.ph',
  '09207775511',
  'Bonifacio Global City, Taguig City, Metro Manila',
  'Gate 23 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112255',
  11400.00,
  300.00,
  0.00,
  0.00,
  '',
  11700.00,
  11700.00,
  'IN_TRANSIT',
  'IN_TRANSIT',
  'Out for Delivery',
  '[{"step":"Order Placed","time":"Oct 23, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 23, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 24, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":3,"total":11400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-23 10:00:00+08'
),
(
  'AN-ORD-2026-88435',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('francis.villanueva@sanmiguel.ph') LIMIT 1),
  'Engr. Francis Villanueva',
  'francis.villanueva@sanmiguel.ph',
  '09172228833',
  'SMC Head Office Complex, Ortigas Center, Mandaluyong City, Metro Manila',
  'Gate 24 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  14800.00,
  300.00,
  0.00,
  0.00,
  '',
  15100.00,
  15100.00,
  'IN_TRANSIT',
  'IN_TRANSIT',
  'Out for Delivery',
  '[{"step":"Order Placed","time":"Oct 24, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 24, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 25, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":8,"total":14800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-24 10:00:00+08'
),
(
  'AN-ORD-2026-88436',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('rowena.delacruz@monark.ph') LIMIT 1),
  'Rowena Dela Cruz',
  'rowena.delacruz@monark.ph',
  '09284449900',
  'Monark Heavy Yard, E. Rodriguez Jr. Ave., Quezon City, Metro Manila',
  'Gate 25 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321024',
  31000.00,
  0.00,
  500.00,
  500.00,
  'ARCHON500',
  30500.00,
  30500.00,
  'IN_TRANSIT',
  'IN_TRANSIT',
  'Out for Delivery',
  '[{"step":"Order Placed","time":"Oct 25, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Oct 25, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Oct 26, 2026 - 08:30 AM","done":true,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":10,"total":31000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-10-25 10:00:00+08'
),
(
  'AN-ORD-2026-88437',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('joseph.tan@metro-pacific.ph') LIMIT 1),
  'Engr. Joseph Tan',
  'joseph.tan@metro-pacific.ph',
  '09181116677',
  'NLEX Balintawak Operations Center, Caloocan City, Metro Manila',
  'Gate 26 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221125',
  26000.00,
  300.00,
  0.00,
  0.00,
  '',
  26300.00,
  26300.00,
  'PREPARING',
  'PREPARING',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 1, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 1, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 2, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":5,"total":26000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-01 10:00:00+08'
),
(
  'AN-ORD-2026-88438',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('maria.castro@cebu-infra.ph') LIMIT 1),
  'Arch. Maria Castro',
  'maria.castro@cebu-infra.ph',
  '09223331188',
  'Roxas Boulevard Coastal Bay, Manila, Metro Manila',
  'Gate 27 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112259',
  19750.00,
  300.00,
  0.00,
  0.00,
  '',
  20050.00,
  20050.00,
  'PREPARING',
  'PREPARING',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 2, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 2, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 3, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":2,"total":4900},{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":3,"total":14850}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-02 10:00:00+08'
),
(
  'AN-ORD-2026-88439',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('albert.soriano@davao-builders.ph') LIMIT 1),
  'Engr. Albert Soriano',
  'albert.soriano@davao-builders.ph',
  '09195554422',
  'Shaw Boulevard Industrial Center, Mandaluyong City, Metro Manila',
  'Gate 28 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  22800.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  22800.00,
  22800.00,
  'PREPARING',
  'PREPARING',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 3, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 3, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 4, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":4,"total":12400},{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":2,"total":10400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-03 10:00:00+08'
),
(
  'AN-ORD-2026-88440',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('grace.navarro@bataan-co.ph') LIMIT 1),
  'Grace Navarro',
  'grace.navarro@bataan-co.ph',
  '09278883344',
  'Manila North Harbor Logistics Yard, Tondo, Manila, Metro Manila',
  'Gate 29 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321028',
  15000.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  14800.00,
  14800.00,
  'PREPARING',
  'PREPARING',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 4, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 4, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 5, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":2,"total":7600},{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":4,"total":7400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-04 10:00:00+08'
),
(
  'AN-ORD-2026-88441',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('richard.mercado@cavite-express.ph') LIMIT 1),
  'Engr. Richard Mercado',
  'richard.mercado@cavite-express.ph',
  '09156667788',
  'Macapagal Blvd., Aseana City, Paranaque City, Metro Manila',
  'Gate 30 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221129',
  38400.00,
  300.00,
  0.00,
  0.00,
  '',
  38700.00,
  38700.00,
  'CONFIRMED',
  'CONFIRMED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 5, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 5, 2026 - 02:30 PM","done":false,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 6, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":4,"total":19800},{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":6,"total":18600}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-05 10:00:00+08'
),
(
  'AN-ORD-2026-88442',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('michaelbascon04@gmail.com') LIMIT 1),
  'Engr. Kent Tagle',
  'michaelbascon04@gmail.com',
  '09289876543',
  'Lot 14 Blk 3 Mega Highway Depot, C-5 Corridor, Pasig City, Metro Manila',
  'Gate 31 Industrial Staging Area',
  'Bank',
  'Paid',
  'BDO-TRX-112263',
  9800.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  9800.00,
  9800.00,
  'CONFIRMED',
  'CONFIRMED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 6, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 6, 2026 - 02:30 PM","done":false,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 7, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":4,"total":9800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-06 10:00:00+08'
),
(
  'AN-ORD-2026-88443',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('carlos.mendoza@dmci.com.ph') LIMIT 1),
  'Engr. Carlos Mendoza',
  'carlos.mendoza@dmci.com.ph',
  '09185551201',
  'DMCI Compound, Pasong Tamo Ext., Makati City, Metro Manila',
  'Gate 32 Industrial Staging Area',
  'COD',
  'Paid',
  '',
  29700.00,
  300.00,
  0.00,
  0.00,
  '',
  30000.00,
  30000.00,
  'CONFIRMED',
  'CONFIRMED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 7, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 7, 2026 - 02:30 PM","done":false,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 8, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":6,"total":29700}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-07 10:00:00+08'
),
(
  'AN-ORD-2026-88444',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('maricel.reyes@megawide.com.ph') LIMIT 1),
  'Arch. Maricel Reyes',
  'maricel.reyes@megawide.com.ph',
  '09224443312',
  '20 N. Domingo St., Quezon City, Metro Manila',
  'Gate 33 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321032',
  11400.00,
  300.00,
  500.00,
  500.00,
  'ARCHON500',
  11200.00,
  11200.00,
  'CONFIRMED',
  'CONFIRMED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 8, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 8, 2026 - 02:30 PM","done":false,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 9, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":3,"total":11400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '2026-09-08 10:00:00+08'
),
(
  'AN-ORD-2026-88445',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('eduardo.santos@eei.com.ph') LIMIT 1),
  'Engr. Eduardo Santos',
  'eduardo.santos@eei.com.ph',
  '09178889923',
  'EEI Main Office, Ortigas Ave., Pasig City, Metro Manila',
  'Gate 34 Industrial Staging Area',
  'Maya',
  'Failed',
  'MYA-554433221133',
  14800.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  14800.00,
  14800.00,
  'CANCELLED',
  'CANCELLED',
  'Cancelled',
  '[{"step":"Order Placed","time":"Sep 9, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 9, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 10, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false},{"step":"Cancelled: Customer request - Wrong size","time":"Sep 9, 2026 - 11:30 AM","done":true,"isCancelled":true}]'::jsonb,
  '[{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":8,"total":14800}]'::jsonb,
  NULL,
  NULL,
  NULL,
  'Customer request - Change of project plans',
  '2026-09-09 12:00:00+08',
  NULL,
  '2026-09-09 10:00:00+08'
),
(
  'AN-ORD-2026-88446',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('ramon.bautista@makati-dev.ph') LIMIT 1),
  'Ramon Bautista',
  'ramon.bautista@makati-dev.ph',
  '09193338871',
  'Ayala Triangle Tower, Ayala Ave., Makati City, Metro Manila',
  'Gate 35 Industrial Staging Area',
  'Bank',
  'Failed',
  'BDO-TRX-112267',
  31000.00,
  300.00,
  0.00,
  0.00,
  '',
  31300.00,
  31300.00,
  'CANCELLED',
  'CANCELLED',
  'Cancelled',
  '[{"step":"Order Placed","time":"Sep 10, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 10, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 11, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false},{"step":"Cancelled: Customer request - Wrong size","time":"Sep 10, 2026 - 11:30 AM","done":true,"isCancelled":true}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":10,"total":31000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  'Customer request - Change of project plans',
  '2026-09-10 12:00:00+08',
  NULL,
  '2026-09-10 10:00:00+08'
),
(
  'AN-ORD-2026-88447',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('teresa.garcia@sta-clara.ph') LIMIT 1),
  'Engr. Teresa Garcia',
  'teresa.garcia@sta-clara.ph',
  '09276662244',
  'Highway Depot, West Service Rd., Muntinlupa City, Metro Manila',
  'Gate 36 Industrial Staging Area',
  'COD',
  'Failed',
  '',
  26000.00,
  300.00,
  0.00,
  0.00,
  '',
  26300.00,
  26300.00,
  'CANCELLED',
  'CANCELLED',
  'Cancelled',
  '[{"step":"Order Placed","time":"Sep 11, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 11, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 12, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false},{"step":"Cancelled: Customer request - Wrong size","time":"Sep 11, 2026 - 11:30 AM","done":true,"isCancelled":true}]'::jsonb,
  '[{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":5,"total":26000}]'::jsonb,
  NULL,
  NULL,
  NULL,
  'Customer request - Change of project plans',
  '2026-09-11 12:00:00+08',
  NULL,
  '2026-09-11 10:00:00+08'
),
(
  'AN-ORD-2026-88448',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('antonio.aquino@firstbalfour.com') LIMIT 1),
  'Engr. Antonio Aquino',
  'antonio.aquino@firstbalfour.com',
  '09151239876',
  'KM 19 West Service Rd., Sucat, Paranaque City, Metro Manila',
  'Gate 37 Industrial Staging Area',
  'GCash',
  'Paid',
  'GC-987654321036',
  19750.00,
  0.00,
  500.00,
  500.00,
  'ARCHON500',
  19250.00,
  19250.00,
  'REFUND_REQUESTED',
  'REFUND_REQUESTED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 12, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 12, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 13, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-1","customId":"prod-1","title":"High-Strength Self-Leveling Mortar Repair System (25kg)","price":2450,"quantity":2,"total":4900},{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":3,"total":14850}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"reason":"DAMAGED_ITEM","details":"One bucket punctured during forklift unloading at site.","damagePhoto":"/assets/images/waterproofing_system_1785519712135.png","refundStatus":"PENDING_REVIEW","requestedAt":"2026-09-12T14:00:00Z"}'::jsonb,
  '2026-09-12 10:00:00+08'
),
(
  'AN-ORD-2026-88449',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('patricia.lim@alvey-builders.ph') LIMIT 1),
  'Patricia Lim',
  'patricia.lim@alvey-builders.ph',
  '09207775511',
  'Bonifacio Global City, Taguig City, Metro Manila',
  'Gate 38 Industrial Staging Area',
  'Maya',
  'Paid',
  'MYA-554433221137',
  22800.00,
  300.00,
  0.00,
  0.00,
  '',
  23100.00,
  23100.00,
  'REFUND_REQUESTED',
  'REFUND_REQUESTED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 13, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 13, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 14, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":4,"total":12400},{"id":"prod-6","customId":"prod-6","title":"Rapid 24-Hour Concrete Accelerator Compound (15L)","price":5200,"quantity":2,"total":10400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"reason":"DAMAGED_ITEM","details":"One bucket punctured during forklift unloading at site.","damagePhoto":"/assets/images/waterproofing_system_1785519712135.png","refundStatus":"PENDING_REVIEW","requestedAt":"2026-09-13T14:00:00Z"}'::jsonb,
  '2026-09-13 10:00:00+08'
),
(
  'AN-ORD-2026-88450',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('francis.villanueva@sanmiguel.ph') LIMIT 1),
  'Engr. Francis Villanueva',
  'francis.villanueva@sanmiguel.ph',
  '09172228833',
  'SMC Head Office Complex, Ortigas Center, Mandaluyong City, Metro Manila',
  'Gate 39 Industrial Staging Area',
  'Bank',
  'Refunded',
  'BDO-TRX-112271',
  15000.00,
  300.00,
  0.00,
  0.00,
  '',
  15300.00,
  15300.00,
  'REFUNDED',
  'REFUNDED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 14, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 14, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 15, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-2","customId":"prod-2","title":"Epoxy Crack Injection Resin System (Complete Kit)","price":3800,"quantity":2,"total":7600},{"id":"prod-4","customId":"prod-4","title":"Polymer Waterproofing Membrane Coating Sealant (10L)","price":1850,"quantity":4,"total":7400}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"reason":"WRONG_ITEM","details":"Incorrect admixture formulation shipped; refund approved by QA.","damagePhoto":null,"refundStatus":"APPROVED","requestedAt":"2026-09-14T14:00:00Z","approvedAt":"2026-09-14T16:30:00Z"}'::jsonb,
  '2026-09-14 10:00:00+08'
),
(
  'AN-ORD-2026-88451',
  (SELECT id FROM auth_core.users WHERE LOWER(email) = LOWER('rowena.delacruz@monark.ph') LIMIT 1),
  'Rowena Dela Cruz',
  'rowena.delacruz@monark.ph',
  '09284449900',
  'Monark Heavy Yard, E. Rodriguez Jr. Ave., Quezon City, Metro Manila',
  'Gate 40 Industrial Staging Area',
  'COD',
  'Refunded',
  '',
  38400.00,
  0.00,
  0.00,
  0.00,
  'FREESHIP',
  38400.00,
  38400.00,
  'REFUNDED',
  'REFUNDED',
  'Processing',
  '[{"step":"Order Placed","time":"Sep 15, 2026 - 10:00 AM","done":true,"isCancelled":false},{"step":"Payment Review","time":"Payment Verified","done":true,"isCancelled":false},{"step":"Factory Packed","time":"Sep 15, 2026 - 02:30 PM","done":true,"isCancelled":false},{"step":"Out for Delivery","time":"Sep 16, 2026 - 08:30 AM","done":false,"isCancelled":false},{"step":"Delivered","time":"Pending confirmation","done":false,"isCancelled":false}]'::jsonb,
  '[{"id":"prod-3","customId":"prod-3","title":"MegaFlow SP402 Concrete Superplasticizer Admixture (20L)","price":4950,"quantity":4,"total":19800},{"id":"prod-5","customId":"prod-5","title":"MF3000 Concrete Pavement Road Additive (25kg Bag)","price":3100,"quantity":6,"total":18600}]'::jsonb,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  '{"reason":"WRONG_ITEM","details":"Incorrect admixture formulation shipped; refund approved by QA.","damagePhoto":null,"refundStatus":"APPROVED","requestedAt":"2026-09-15T14:00:00Z","approvedAt":"2026-09-15T16:30:00Z"}'::jsonb,
  '2026-09-15 10:00:00+08'
);

-- ==============================================================================
-- 8. SHOP ORDER ITEMS (Relational normalization for every order)
-- ==============================================================================
INSERT INTO shop.order_items (order_id, product_id, title, price, quantity, total)
VALUES
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88412' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    4,
    9800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88413' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    6,
    29700.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88414' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    3,
    11400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88415' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    8,
    14800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88416' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    10,
    31000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88417' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    5,
    26000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88418' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    2,
    4900.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88418' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    3,
    14850.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88419' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    4,
    12400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88419' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    2,
    10400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88420' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    2,
    7600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88420' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    4,
    7400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88421' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    4,
    19800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88421' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    6,
    18600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88422' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    4,
    9800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88423' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    6,
    29700.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88424' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    3,
    11400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88425' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    8,
    14800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88426' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    10,
    31000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88427' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    5,
    26000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88428' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    2,
    4900.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88428' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    3,
    14850.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88429' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    4,
    12400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88429' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    2,
    10400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88430' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    2,
    7600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88430' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    4,
    7400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88431' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    4,
    19800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88431' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    6,
    18600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88432' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    4,
    9800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88433' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    6,
    29700.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88434' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    3,
    11400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88435' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    8,
    14800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88436' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    10,
    31000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88437' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    5,
    26000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88438' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    2,
    4900.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88438' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    3,
    14850.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88439' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    4,
    12400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88439' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    2,
    10400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88440' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    2,
    7600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88440' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    4,
    7400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88441' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    4,
    19800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88441' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    6,
    18600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88442' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    4,
    9800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88443' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    6,
    29700.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88444' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    3,
    11400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88445' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    8,
    14800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88446' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    10,
    31000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88447' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    5,
    26000.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88448' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-1' LIMIT 1),
    'High-Strength Self-Leveling Mortar Repair System (25kg)',
    2450.00,
    2,
    4900.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88448' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    3,
    14850.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88449' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    4,
    12400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88449' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-6' LIMIT 1),
    'Rapid 24-Hour Concrete Accelerator Compound (15L)',
    5200.00,
    2,
    10400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88450' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-2' LIMIT 1),
    'Epoxy Crack Injection Resin System (Complete Kit)',
    3800.00,
    2,
    7600.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88450' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-4' LIMIT 1),
    'Polymer Waterproofing Membrane Coating Sealant (10L)',
    1850.00,
    4,
    7400.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88451' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-3' LIMIT 1),
    'MegaFlow SP402 Concrete Superplasticizer Admixture (20L)',
    4950.00,
    4,
    19800.00
  ),
  (
    (SELECT id FROM shop.orders WHERE order_number = 'AN-ORD-2026-88451' LIMIT 1),
    (SELECT id FROM shop.products WHERE custom_id = 'prod-5' LIMIT 1),
    'MF3000 Concrete Pavement Road Additive (25kg Bag)',
    3100.00,
    6,
    18600.00
  );

-- ==============================================================================
-- 9. AUDIT LOGS
-- ==============================================================================
INSERT INTO auth_core.audit_logs (user_id, module, action, details, ip_address, user_agent, created_at)
VALUES
  (
    (SELECT id FROM auth_core.users WHERE email = 'jimmyontiveros01@gmail.com' LIMIT 1),
    'system',
    'SYSTEM_SEED_INITIALIZED',
    '{"details": "Initial database seeding executed with 6 products, 40 orders, and 16 user accounts."}'::jsonb,
    '127.0.0.1',
    'Archon Nell Seeder v2.0',
    '2026-10-21 07:00:00+08'
  ),
  (
    (SELECT id FROM auth_core.users WHERE email = 'jimmyontiveros01@gmail.com' LIMIT 1),
    'auth',
    'LOGIN_2FA_SUCCESS',
    '{"details": "Successful 2FA OTP verification for role: ADMIN"}'::jsonb,
    '127.0.0.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0',
    '2026-10-21 07:15:00+08'
  ),
  (
    (SELECT id FROM auth_core.users WHERE email = 'jimmyontiveros01@gmail.com' LIMIT 1),
    'shop',
    'DELIVERY_STATUS_UPDATED',
    '{"target": "AN-ORD-2026-88412", "details": "Delivery status confirmed as DELIVERED to Metro Manila site"}'::jsonb,
    '127.0.0.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    '2026-10-21 07:30:00+08'
  );
