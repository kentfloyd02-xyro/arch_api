import { Router } from 'express';
import authRoutes from '../modules/auth/authRoutes.js';
import hrmsRoutes from '../modules/hrms/hrmsRoutes.js';
import wfmRoutes from '../modules/wfm/wfmRoutes.js';
import payrollRoutes from '../modules/payroll/payrollRoutes.js';
import fleetRoutes from '../modules/fleet/fleetRoutes.js';
import shopRoutes from '../modules/shop/shopRoutes.js';
import supportRoutes from '../modules/support/supportRoutes.js';
import auditRoutes from '../modules/audit/auditRoutes.js';
import stubsRoutes from '../modules/stubs/stubsRoutes.js';
import { analyzeReviews } from '../modules/shop/reviewAnalysisController.js';
import { getReviews, addReview } from '../modules/shop/shopController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Base API Information Endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Archon Nell Centralized Backend Gateway',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      health: '/health',
      docs: '/api/docs',
      shopProducts: '/api/v1/shop/products',
      shopCategories: '/api/v1/shop/categories',
      shopVouchers: '/api/v1/shop/vouchers',
      support: '/api/v1/support',
      auditLogs: '/api/v1/audit-logs',
      auth: '/api/v1/auth'
    }
  });
});

router.use('/auth', authRoutes);
router.use('/hrms', hrmsRoutes);
router.use('/wfm', wfmRoutes);
router.use('/payroll', payrollRoutes);
router.use('/fleet', fleetRoutes);
router.use('/shop', shopRoutes);
router.use('/support', supportRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/audit', auditRoutes);
router.use('/stubs', stubsRoutes);

// Direct Reviews Endpoints
router.post('/reviews/analyze', analyzeReviews);
router.get('/reviews/:productId', getReviews);
router.post('/reviews', authenticate, addReview);

export default router;
