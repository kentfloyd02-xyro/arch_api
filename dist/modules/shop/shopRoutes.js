import { Router } from 'express';
import * as shopController from './shopController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
// --- Public Endpoints (Customer Storefront) ---
router.get('/categories', shopController.getCategories);
router.get('/products', shopController.getProducts);
router.get('/products/:id', shopController.getProduct);
router.post('/vouchers/validate', shopController.validateVoucher);
router.post('/orders', shopController.checkout);
router.get('/orders/track/:identifier', shopController.getOrder);
router.get('/reviews/:productId', shopController.getReviews);
// --- Authenticated Endpoints ---
router.post('/reviews', authenticate, shopController.addReview);
router.get('/orders', authenticate, shopController.getOrders);
router.get('/orders/:identifier', authenticate, shopController.getOrder);
router.patch('/orders/:id/status', authenticate, authorize(['superadmin', 'fleet_manager']), shopController.updateOrder);
// --- Admin Management ---
router.post('/categories', authenticate, authorize(['superadmin']), shopController.createCategory);
router.post('/products', authenticate, authorize(['superadmin']), shopController.createProduct);
router.put('/products/:id', authenticate, authorize(['superadmin']), shopController.updateProduct);
export default router;
