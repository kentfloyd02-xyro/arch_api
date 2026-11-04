import { z } from 'zod';
import * as fleetService from './fleetService.js';
// Vehicles
export async function getVehicles(req, res, next) {
    try {
        const status = req.query.status;
        const data = await fleetService.getAllVehicles(status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getVehicle(req, res, next) {
    try {
        const data = await fleetService.getVehicleById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createVehicle(req, res, next) {
    try {
        const schema = z.object({
            plateNumber: z.string().min(3),
            model: z.string().min(2),
            vehicleType: z.string().optional(),
            capacityKg: z.number().positive().optional(),
            fuelCapacityLiters: z.number().positive().optional(),
            currentOdometer: z.number().nonnegative().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.createVehicle(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateVehicle(req, res, next) {
    try {
        const data = await fleetService.updateVehicle(req.params.id, req.body);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Drivers
export async function getDrivers(req, res, next) {
    try {
        const onlyAvailable = req.query.available === 'true';
        const data = await fleetService.getAllDrivers(onlyAvailable);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function registerDriver(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            licenseNumber: z.string().min(5),
            licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.createDriver(parsed);
        res.status(201).json({ success: true, message: 'Driver profile registered.', data });
    }
    catch (err) {
        next(err);
    }
}
// Dispatches
export async function getDispatches(req, res, next) {
    try {
        const { status, driver_id } = req.query;
        const data = await fleetService.getAllDispatches({
            status: status,
            driverId: driver_id
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getDispatch(req, res, next) {
    try {
        const data = await fleetService.getDispatchById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function assignDispatch(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid()
        });
        const { vehicleId, driverId } = schema.parse(req.body);
        const data = await fleetService.assignDispatch(req.params.id, vehicleId, driverId);
        res.json({
            success: true,
            message: 'Dispatch assigned to vehicle and driver. E-Commerce tracking updated to Factory Packed.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function startDispatch(req, res, next) {
    try {
        const data = await fleetService.startDispatch(req.params.id);
        res.json({
            success: true,
            message: 'Dispatch departed. E-Commerce tracking updated to Out for Delivery.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function completeDispatch(req, res, next) {
    try {
        const schema = z.object({
            proofOfDeliveryUrl: z.string().optional(),
            endOdometer: z.number().positive().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.completeDispatch(req.params.id, parsed.proofOfDeliveryUrl, parsed.endOdometer);
        res.json({
            success: true,
            message: 'Dispatch completed successfully. Order marked as Delivered in E-Commerce store.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
// Fuel Logs & Location Tracking
export async function getFuel(req, res, next) {
    try {
        const vehicleId = req.query.vehicle_id;
        const data = await fleetService.getFuelLogs(vehicleId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function logFuel(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid().optional(),
            liters: z.number().positive(),
            cost: z.number().positive(),
            odometer: z.number().nonnegative().optional(),
            receiptUrl: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.logFuel(parsed);
        res.status(201).json({ success: true, message: 'Fuel log recorded.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function recordLocation(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid().optional(),
            dispatchId: z.string().uuid().optional(),
            latitude: z.number(),
            longitude: z.number(),
            speed: z.number().optional(),
            heading: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.logLocation(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getRouteLocations(req, res, next) {
    try {
        const data = await fleetService.getDispatchLocations(req.params.dispatchId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
