import { query } from '../../db/connection.js';
import * as shopService from '../shop/shopService.js';

// ------------------------------------------------------------------------------
// VEHICLES
// ------------------------------------------------------------------------------

export async function getAllVehicles(status?: string) {
  let sql = 'SELECT * FROM fleet.vehicles WHERE 1=1';
  const params: any[] = [];
  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  sql += ' ORDER BY plate_number ASC';

  const result = await query(sql, params);
  return result.rows;
}

export async function getVehicleById(id: string) {
  const result = await query('SELECT * FROM fleet.vehicles WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found.' };
  }
  return result.rows[0];
}

export async function createVehicle(data: {
  plateNumber: string;
  model: string;
  vehicleType?: string;
  capacityKg?: number;
  fuelCapacityLiters?: number;
  currentOdometer?: number;
}) {
  const result = await query(
    `INSERT INTO fleet.vehicles (
       plate_number, model, vehicle_type, capacity_kg, fuel_capacity_liters, current_odometer, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'Available')
     RETURNING *`,
    [
      data.plateNumber.toUpperCase().trim(),
      data.model,
      data.vehicleType || 'Truck',
      data.capacityKg || 1000.00,
      data.fuelCapacityLiters || 80.00,
      data.currentOdometer || 0.00
    ]
  );
  return result.rows[0];
}

export async function updateVehicle(id: string, data: Partial<{
  plateNumber: string;
  model: string;
  vehicleType: string;
  capacityKg: number;
  fuelCapacityLiters: number;
  currentOdometer: number;
  status: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [id];

  const map: Record<string, string> = {
    plateNumber: 'plate_number',
    model: 'model',
    vehicleType: 'vehicle_type',
    capacityKg: 'capacity_kg',
    fuelCapacityLiters: 'fuel_capacity_liters',
    currentOdometer: 'current_odometer',
    status: 'status'
  };

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && map[key]) {
      params.push(val);
      fields.push(`${map[key]} = $${params.length}`);
    }
  }

  if (fields.length === 0) {
    return getVehicleById(id);
  }

  const sql = `UPDATE fleet.vehicles SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
  const result = await query(sql, params);
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// DRIVERS (DIRECT RELATIONAL LINK TO HRMS EMPLOYEES)
// ------------------------------------------------------------------------------

export async function getAllDrivers(onlyAvailable?: boolean) {
  let sql = `
    SELECT d.*, e.employee_no, e.first_name, e.last_name, e.email, e.phone,
           dept.name AS department_name
    FROM fleet.drivers d
    JOIN hrms.employees e ON e.id = d.employee_id
    LEFT JOIN hrms.departments dept ON dept.id = e.department_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (onlyAvailable) {
    sql += ' AND d.is_available = TRUE';
  }
  sql += ' ORDER BY e.last_name ASC';

  const result = await query(sql, params);
  return result.rows;
}

export async function createDriver(data: {
  employeeId: string;
  licenseNumber: string;
  licenseExpiry?: string;
}) {
  const result = await query(
    `INSERT INTO fleet.drivers (employee_id, license_number, license_expiry, is_available)
     VALUES ($1, $2, $3, TRUE)
     RETURNING *`,
    [data.employeeId, data.licenseNumber, data.licenseExpiry || null]
  );
  return result.rows[0];
}

// ------------------------------------------------------------------------------
// DISPATCHES & AUTOMATED CROSS-MODULE SYNC WITH SHOP ORDERS
// ------------------------------------------------------------------------------

export async function getAllDispatches(options: { status?: string; driverId?: string } = {}) {
  let sql = `
    SELECT d.*, v.plate_number, v.model AS vehicle_model,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone,
           o.order_number, o.customer_name, o.customer_phone, o.total AS order_total, o.current_tracking_step
    FROM fleet.dispatches d
    LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    LEFT JOIN shop.orders o ON o.id = d.order_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (options.status) {
    params.push(options.status);
    sql += ` AND d.status = $${params.length}`;
  }
  if (options.driverId) {
    params.push(options.driverId);
    sql += ` AND d.driver_id = $${params.length}`;
  }
  sql += ' ORDER BY d.created_at DESC';

  const result = await query(sql, params);
  return result.rows;
}

export async function getDispatchById(id: string) {
  const result = await query(
    `SELECT d.*, v.plate_number, v.model AS vehicle_model,
            dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone,
            o.order_number, o.customer_name, o.customer_phone, o.delivery_address AS customer_address,
            o.total AS order_total, o.current_tracking_step, o.delivery_status
     FROM fleet.dispatches d
     LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
     LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
     LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
     LEFT JOIN shop.orders o ON o.id = d.order_id
     WHERE d.id = $1 OR d.dispatch_number = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch record not found.' };
  }
  return result.rows[0];
}

export async function assignDispatch(dispatchId: string, vehicleId: string, driverId: string) {
  const dispRes = await query(
    `UPDATE fleet.dispatches
     SET vehicle_id = $1, driver_id = $2, status = 'Assigned'
     WHERE id = $3
     RETURNING *`,
    [vehicleId, driverId, dispatchId]
  );

  if (dispRes.rows.length === 0) {
    throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch record not found.' };
  }
  const dispatch = dispRes.rows[0];

  // Mark vehicle and driver as assigned/busy
  await query("UPDATE fleet.vehicles SET status = 'On Trip' WHERE id = $1", [vehicleId]);
  await query("UPDATE fleet.drivers SET is_available = FALSE WHERE id = $1", [driverId]);

  // AUTOMATED CROSS-MODULE BRIDGE: Update linked shop order to 'Factory Packed'
  if (dispatch.order_id) {
    await shopService.updateOrderStatus(dispatch.order_id, 'Processing', 'Factory Packed');
  }

  return dispatch;
}

export async function startDispatch(dispatchId: string) {
  const dispRes = await query(
    `UPDATE fleet.dispatches SET status = 'In Transit' WHERE id = $1 RETURNING *`,
    [dispatchId]
  );
  if (dispRes.rows.length === 0) {
    throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch not found.' };
  }
  const dispatch = dispRes.rows[0];

  // AUTOMATED CROSS-MODULE BRIDGE: Update linked shop order to 'Out for Delivery'
  if (dispatch.order_id) {
    await shopService.updateOrderStatus(dispatch.order_id, 'In Transit', 'Out for Delivery');
  }

  return dispatch;
}

export async function completeDispatch(
  dispatchId: string,
  proofOfDeliveryUrl?: string,
  endOdometer?: number
) {
  const dispRes = await query(
    `UPDATE fleet.dispatches
     SET status = 'Completed', completed_at = NOW(), proof_of_delivery_url = $1
     WHERE id = $2
     RETURNING *`,
    [proofOfDeliveryUrl || null, dispatchId]
  );

  if (dispRes.rows.length === 0) {
    throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch not found.' };
  }
  const dispatch = dispRes.rows[0];

  // Release vehicle and driver back to Available
  if (dispatch.vehicle_id) {
    await query(
      `UPDATE fleet.vehicles
       SET status = 'Available',
           current_odometer = COALESCE($1, current_odometer)
       WHERE id = $2`,
      [endOdometer || null, dispatch.vehicle_id]
    );
  }
  if (dispatch.driver_id) {
    await query("UPDATE fleet.drivers SET is_available = TRUE WHERE id = $1", [dispatch.driver_id]);
  }

  // AUTOMATED CROSS-MODULE BRIDGE: Mark linked shop order as 'Delivered'
  if (dispatch.order_id) {
    await shopService.updateOrderStatus(dispatch.order_id, 'Delivered', 'Delivered');
  }

  return dispatch;
}

// ------------------------------------------------------------------------------
// FUEL LOGS & GPS TRACKING
// ------------------------------------------------------------------------------

export async function getFuelLogs(vehicleId?: string) {
  let sql = `
    SELECT f.*, v.plate_number, v.model AS vehicle_model,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name
    FROM fleet.fuel_logs f
    JOIN fleet.vehicles v ON v.id = f.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = f.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (vehicleId) {
    params.push(vehicleId);
    sql += ` AND f.vehicle_id = $${params.length}`;
  }
  sql += ' ORDER BY f.created_at DESC';

  const result = await query(sql, params);
  return result.rows;
}

export async function logFuel(data: {
  vehicleId: string;
  driverId?: string;
  liters: number;
  cost: number;
  odometer?: number;
  receiptUrl?: string;
}) {
  const result = await query(
    `INSERT INTO fleet.fuel_logs (vehicle_id, driver_id, liters, cost, odometer, receipt_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.vehicleId,
      data.driverId || null,
      data.liters,
      data.cost,
      data.odometer || null,
      data.receiptUrl || null
    ]
  );
  return result.rows[0];
}

export async function logLocation(data: {
  vehicleId: string;
  driverId?: string;
  dispatchId?: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}) {
  const result = await query(
    `INSERT INTO fleet.location_logs (
       vehicle_id, driver_id, dispatch_id, latitude, longitude, speed, heading
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.vehicleId,
      data.driverId || null,
      data.dispatchId || null,
      data.latitude,
      data.longitude,
      data.speed || 0.00,
      data.heading || 0.00
    ]
  );
  return result.rows[0];
}

export async function getDispatchLocations(dispatchId: string) {
  const result = await query(
    `SELECT * FROM fleet.location_logs
     WHERE dispatch_id = $1
     ORDER BY recorded_at ASC`,
    [dispatchId]
  );
  return result.rows;
}
