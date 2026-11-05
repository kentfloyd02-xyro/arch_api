import { Router } from 'express';
import * as auditController from './auditController.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, auditController.getAuditLogs);
router.post('/', authenticate, auditController.createAuditLog);

export default router;
