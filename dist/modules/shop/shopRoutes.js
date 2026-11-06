import { Router } from 'express';
import * as shopController from './shopController.js';
import { analyzeReviews } from './reviewAnalysisController.js';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
const router = Router();
// --- Public Endpoints (Customer Storefront) ---
router.get('/categories', shopController.getCategories);
router.get('/products', shopController.getProducts);
router.get('/products/:id', shopController.getProduct);
router.get('/projects', shopController.getProjects);
router.get('/vouchers', shopController.getVouchers);
router.post('/vouchers/validate', shopController.validateVoucher);
router.post('/orders', optionalAuthenticate, shopController.checkout);
router.get('/orders/track/:identifier', shopController.getOrder);
router.get('/reviews/:productId', shopController.getReviews);
router.post('/reviews/analyze', analyzeReviews);
// --- Authenticated Endpoints ---
router.post('/reviews', authenticate, shopController.addReview);
router.get('/orders', authenticate, shopController.getOrders);
router.get('/orders/:identifier', authenticate, shopController.getOrder);
router.patch('/orders/:id/status', optionalAuthenticate, shopController.updateOrder);
// --- Admin Management (Allowed for superadmin and admin) ---
router.post('/categories', authenticate, authorize(['superadmin', 'admin']), shopController.createCategory);
router.post('/products', authenticate, authorize(['superadmin', 'admin']), shopController.createProduct);
router.put('/products/:id', authenticate, authorize(['superadmin', 'admin']), shopController.updateProduct);
router.patch('/products/:id/archive', authenticate, authorize(['superadmin', 'admin']), shopController.archiveProduct);
router.patch('/products/:id/restore', authenticate, authorize(['superadmin', 'admin']), shopController.restoreProduct);
router.delete('/products/:id', authenticate, authorize(['superadmin', 'admin']), shopController.deleteProduct);
export default router;
