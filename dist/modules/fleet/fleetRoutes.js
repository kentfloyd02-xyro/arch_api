import { Router } from 'express';
import * as fleetController from './fleetController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
router.use(authenticate);
// Vehicles
router.get('/vehicles', fleetController.getVehicles);
router.get('/vehicles/:id', fleetController.getVehicle);
router.post('/vehicles', authorize(['superadmin', 'fleet_manager']), fleetController.createVehicle);
router.put('/vehicles/:id', authorize(['superadmin', 'fleet_manager']), fleetController.updateVehicle);
// Drivers
router.get('/drivers', fleetController.getDrivers);
router.post('/drivers', authorize(['superadmin', 'fleet_manager', 'hr_admin']), fleetController.registerDriver);
// Dispatches
router.get('/dispatches', fleetController.getDispatches);
router.get('/dispatches/:id', fleetController.getDispatch);
router.patch('/dispatches/:id/assign', authorize(['superadmin', 'fleet_manager']), fleetController.assignDispatch);
router.post('/dispatches/:id/start', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.startDispatch);
router.post('/dispatches/:id/complete', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.completeDispatch);
// Fuel & Trip Expenses
router.get('/fuel', fleetController.getFuel);
router.post('/fuel', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.logFuel);
// Live GPS Location Tracking
router.post('/location', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.recordLocation);
router.get('/dispatches/:dispatchId/locations', fleetController.getRouteLocations);
export default router;
