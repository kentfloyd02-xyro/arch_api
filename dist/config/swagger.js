export const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Archon Nell Incorporated - Centralized Backend API',
        version: '1.0.0',
        description: `
**Archon Nell Integrated E-Commerce & Enterprise Management Gateway**

This centralized API integrates all capstone subsystems into a unified platform:
- **Auth & SSO**: Centralized Single Sign-On and Role-Based Access Control
- **HRMS**: Core Human Capital, Employee Records, Job Postings, and Applicant Hiring
- **WFM**: Workforce Scheduling, Kiosk Clock-in/out, Attendance, and Cutoff Timesheets
- **Payroll**: Automated Calculation Engine, Payslips, Claims, and HMO Benefits
- **Shop**: E-Commerce Storefront, Products, Vouchers, Cart Checkout, and Tracking
- **Fleet**: Logistics Fleet Management, Vehicles, Drivers, Dispatches, and GPS Tracking
- **Stubs**: Finance Ledger and Supply Chain Warehousing integration endpoints
    `,
        contact: {
            name: 'Archon Nell Engineering Team',
            email: 'admin@archonnell.com'
        }
    },
    servers: [
        {
            url: '/api/v1',
            description: 'Central Gateway API v1'
        },
        {
            url: 'https://api.archonnell.com/api/v1',
            description: 'Production Subdomain Gateway'
        }
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token obtained from `/auth/login` or `/auth/register`'
            }
        }
    },
    tags: [
        { name: 'Auth', description: 'Centralized SSO, Login, Registration, and Session Profile' },
        { name: 'HRMS', description: 'Core Human Capital, Departments, Positions, Employees, Jobs & Applicants' },
        { name: 'WFM', description: 'Workforce Shifts, Schedules, Kiosk Attendance, Timesheets & Leaves' },
        { name: 'Payroll', description: 'Payroll Runs, Automatic Calculation Engine, Payslips & HMO' },
        { name: 'Shop', description: 'E-Commerce Catalog, Vouchers, Checkout, Order Tracking & Reviews' },
        { name: 'Fleet', description: 'Vehicles, Drivers, Delivery Dispatches, Fuel Logs & GPS Tracking' },
        { name: 'Stubs', description: 'Mock Endpoints for External Capstone Subsystems (Finance & SCM)' }
    ],
    paths: {
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Authenticate user and issue JWT token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', example: 'admin@archonnell.com' },
                                    password: { type: 'string', example: 'Admin123!' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Login successful. Returns token and user profile.' },
                    401: { description: 'Invalid credentials.' }
                }
            }
        },
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register new customer account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password', 'fullName'],
                                properties: {
                                    email: { type: 'string', example: 'customer@gmail.com' },
                                    password: { type: 'string', example: 'SecurePassword123!' },
                                    fullName: { type: 'string', example: 'Juan Dela Cruz' },
                                    role: { type: 'string', default: 'customer' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'User account created.' },
                    409: { description: 'Email already exists.' }
                }
            }
        },
        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Retrieve authenticated user session profile and linked employee data',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Profile details returned.' },
                    401: { description: 'Unauthorized.' }
                }
            }
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Clear authentication cookie and terminate session',
                responses: {
                    200: { description: 'Logged out successfully.' }
                }
            }
        },
        // HRMS
        '/hrms/departments': {
            get: {
                tags: ['HRMS'],
                summary: 'List all company departments with employee counts',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Department list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Create a new organizational department (Admin)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code', 'name'],
                                properties: {
                                    code: { type: 'string', example: 'TECH' },
                                    name: { type: 'string', example: 'Technology & Systems' },
                                    description: { type: 'string', example: 'Software development & IT' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Department created.' } }
            }
        },
        '/hrms/positions': {
            get: {
                tags: ['HRMS'],
                summary: 'List job positions',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'department_id', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Positions list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Create job position with salary grade',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['departmentId', 'title'],
                                properties: {
                                    departmentId: { type: 'string', format: 'uuid' },
                                    title: { type: 'string', example: 'Full Stack Engineer' },
                                    salaryGrade: { type: 'string', example: 'P3' },
                                    baseSalary: { type: 'number', example: 45000.00 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Position created.' } }
            }
        },
        '/hrms/employees': {
            get: {
                tags: ['HRMS'],
                summary: 'Search & list employees in directory',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'department_id', in: 'query', schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Employee directory.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Add employee to company registry',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['firstName', 'lastName', 'email'],
                                properties: {
                                    firstName: { type: 'string', example: 'Ana' },
                                    lastName: { type: 'string', example: 'Lim' },
                                    email: { type: 'string', example: 'ana.lim@archonnell.com' },
                                    departmentId: { type: 'string', format: 'uuid' },
                                    positionId: { type: 'string', format: 'uuid' },
                                    employmentStatus: { type: 'string', default: 'Regular' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Employee record created with onboarding checklist.' } }
            }
        },
        '/hrms/employees/next-no': {
            get: {
                tags: ['HRMS'],
                summary: 'Get next auto-incremented employee number (e.g. EMP-0005)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Next employee number.' } }
            }
        },
        '/hrms/jobs': {
            get: {
                tags: ['HRMS'],
                summary: 'Public list of open careers/job postings',
                responses: { 200: { description: 'List of active job vacancies.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Publish a new job vacancy (Admin)',
                security: [{ BearerAuth: [] }],
                responses: { 201: { description: 'Job posted.' } }
            }
        },
        '/hrms/applicants': {
            get: {
                tags: ['HRMS'],
                summary: 'List recruitment applicants (Admin)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Applicant list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Submit candidate job application from career portal',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['jobPostingId', 'firstName', 'lastName', 'email', 'phone'],
                                properties: {
                                    jobPostingId: { type: 'string', format: 'uuid' },
                                    firstName: { type: 'string', example: 'Mark' },
                                    lastName: { type: 'string', example: 'Rivera' },
                                    email: { type: 'string', example: 'mark.rivera@gmail.com' },
                                    phone: { type: 'string', example: '0922-333-4444' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Application submitted.' } }
            }
        },
        '/hrms/applicants/{id}/hire': {
            post: {
                tags: ['HRMS'],
                summary: 'One-click convert hired candidate into full employee record',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 201: { description: 'Candidate hired and converted to employee.' } }
            }
        },
        // WFM
        '/wfm/shifts': {
            get: {
                tags: ['WFM'],
                summary: 'List configured work shifts',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Shifts list.' } }
            },
            post: {
                tags: ['WFM'],
                summary: 'Create a new shift schedule (Admin)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'startTime', 'endTime'],
                                properties: {
                                    name: { type: 'string', example: 'Day Logistics Shift' },
                                    startTime: { type: 'string', example: '08:00' },
                                    endTime: { type: 'string', example: '17:00' },
                                    breakMinutes: { type: 'number', default: 60 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Shift created.' } }
            }
        },
        '/wfm/attendance/clock-in': {
            post: {
                tags: ['WFM'],
                summary: 'Kiosk / Web Clock-in endpoint with automated tardiness computation',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' },
                                    verificationMethod: { type: 'string', default: 'kiosk' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Clock-in recorded.' } }
            }
        },
        '/wfm/attendance/clock-out': {
            post: {
                tags: ['WFM'],
                summary: 'Kiosk / Web Clock-out endpoint computing worked hours, overtime, and undertime',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Clock-out recorded.' } }
            }
        },
        '/wfm/timesheets': {
            get: {
                tags: ['WFM'],
                summary: 'List cutoff timesheets for payroll reconciliation',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Timesheets list.' } }
            }
        },
        '/wfm/timesheets/generate': {
            post: {
                tags: ['WFM'],
                summary: 'Auto-aggregate attendance logs into submitted timesheet for a cutoff',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId', 'periodFrom', 'periodTo'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' },
                                    periodFrom: { type: 'string', example: '2026-10-01' },
                                    periodTo: { type: 'string', example: '2026-10-15' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Timesheet generated.' } }
            }
        },
        '/wfm/intelligence/alerts': {
            get: {
                tags: ['WFM'],
                summary: 'AI Decision Support: Anomaly alerts for frequent tardiness and pending items',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Anomaly detection alerts.' } }
            }
        },
        // PAYROLL
        '/payroll/runs': {
            get: {
                tags: ['Payroll'],
                summary: 'List payroll runs with totals and statuses',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Payroll runs.' } }
            }
        },
        '/payroll/runs/compute': {
            post: {
                tags: ['Payroll'],
                summary: 'Execute Automated Payroll Computation Engine reading WFM timesheets & HR salaries',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['periodFrom', 'periodTo', 'payDate'],
                                properties: {
                                    periodFrom: { type: 'string', example: '2026-10-01' },
                                    periodTo: { type: 'string', example: '2026-10-15' },
                                    payDate: { type: 'string', example: '2026-10-15' },
                                    runType: { type: 'string', enum: ['regular', 'thirteenth-month'], default: 'regular' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Payroll calculated and payslips generated.' } }
            }
        },
        '/payroll/runs/{id}': {
            get: {
                tags: ['Payroll'],
                summary: 'Get payroll run details with itemized payslips list',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Run details with employee payslips.' } }
            }
        },
        '/payroll/payslips/{id}': {
            get: {
                tags: ['Payroll'],
                summary: 'Get single payslip with itemized breakdown lines (SSS, PhilHealth, Tax, OT)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Payslip breakdown.' } }
            }
        },
        '/payroll/integrations/finance/payroll-runs': {
            get: {
                tags: ['Payroll'],
                summary: 'Finance Subsystem Integration: Read funded payroll amounts and funding receipts',
                responses: { 200: { description: 'Finance ledger payroll export.' } }
            }
        },
        // SHOP
        '/shop/categories': {
            get: {
                tags: ['Shop'],
                summary: 'Public list of chemical product categories',
                responses: { 200: { description: 'Categories list.' } }
            }
        },
        '/shop/products': {
            get: {
                tags: ['Shop'],
                summary: 'Public product catalog with search, filter, and ratings',
                parameters: [
                    { name: 'category', in: 'query', schema: { type: 'string' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Product list.' } }
            }
        },
        '/shop/vouchers/validate': {
            post: {
                tags: ['Shop'],
                summary: 'Validate coupon/voucher discount against cart total',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code', 'subtotal'],
                                properties: {
                                    code: { type: 'string', example: 'ARCHON10' },
                                    subtotal: { type: 'number', example: 5000.00 }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Voucher valid.' } }
            }
        },
        '/shop/orders': {
            post: {
                tags: ['Shop'],
                summary: 'Cart checkout: Creates order and triggers automated Fleetops delivery dispatch',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['customerName', 'customerEmail', 'customerPhone', 'deliveryAddress', 'paymentMethod', 'subtotal', 'total', 'items'],
                                properties: {
                                    customerName: { type: 'string', example: 'Megaworld Construction' },
                                    customerEmail: { type: 'string', example: 'purchasing@megaworld.com' },
                                    customerPhone: { type: 'string', example: '0917-888-9999' },
                                    deliveryAddress: { type: 'string', example: 'BGC Tower 4 Site, Taguig City' },
                                    paymentMethod: { type: 'string', enum: ['GCash', 'Maya', 'Bank', 'COD'] },
                                    subtotal: { type: 'number', example: 12500.00 },
                                    total: { type: 'number', example: 12500.00 },
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                title: { type: 'string', example: 'Waterproofing Membrane 20L' },
                                                price: { type: 'number', example: 2500.00 },
                                                quantity: { type: 'number', example: 5 },
                                                total: { type: 'number', example: 12500.00 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Order created and logistics dispatch scheduled.' } }
            }
        },
        '/shop/orders/track/{identifier}': {
            get: {
                tags: ['Shop'],
                summary: 'Public order tracking returning live 5-stage shipment progression',
                parameters: [{ name: 'identifier', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Live tracking steps.' } }
            }
        },
        // FLEET
        '/fleet/vehicles': {
            get: {
                tags: ['Fleet'],
                summary: 'List fleet logistics vehicles and statuses (Available, On Trip)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Vehicle inventory.' } }
            }
        },
        '/fleet/drivers': {
            get: {
                tags: ['Fleet'],
                summary: 'List drivers joined with HR employee data',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Driver list.' } }
            }
        },
        '/fleet/dispatches': {
            get: {
                tags: ['Fleet'],
                summary: 'Delivery dispatch board linking orders, vehicles, and assigned drivers',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Dispatch list.' } }
            }
        },
        '/fleet/dispatches/{id}/assign': {
            patch: {
                tags: ['Fleet'],
                summary: 'Assign vehicle & driver. Cascades status to E-Commerce store tracking (Factory Packed)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['vehicleId', 'driverId'],
                                properties: {
                                    vehicleId: { type: 'string', format: 'uuid' },
                                    driverId: { type: 'string', format: 'uuid' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Dispatch assigned.' } }
            }
        },
        '/fleet/dispatches/{id}/start': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver departs. Cascades status to E-Commerce store tracking (Out for Delivery)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Delivery in transit.' } }
            }
        },
        '/fleet/dispatches/{id}/complete': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver completes delivery with proof image. Cascades status to E-Commerce (Delivered)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    proofOfDeliveryUrl: { type: 'string' },
                                    endOdometer: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Delivery completed.' } }
            }
        },
        '/fleet/location': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver mobile app transmits live GPS coordinates and speed',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['vehicleId', 'latitude', 'longitude'],
                                properties: {
                                    vehicleId: { type: 'string', format: 'uuid' },
                                    dispatchId: { type: 'string', format: 'uuid' },
                                    latitude: { type: 'number', example: 14.5995 },
                                    longitude: { type: 'number', example: 120.9842 },
                                    speed: { type: 'number', example: 45.2 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'GPS location breadcrumb saved.' } }
            }
        },
        // STUBS
        '/stubs/finance/accounts': {
            get: {
                tags: ['Stubs'],
                summary: 'Finance general ledger account balances stub',
                responses: { 200: { description: 'Account balances.' } }
            }
        },
        '/stubs/scm/warehouses': {
            get: {
                tags: ['Stubs'],
                summary: 'Supply chain warehouse capacity and utilization stub',
                responses: { 200: { description: 'Warehouses list.' } }
            }
        }
    }
};
