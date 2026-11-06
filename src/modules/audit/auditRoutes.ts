import { Router } from 'express';
import * as auditController from './auditController.js';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, auditController.getAuditLogs);
router.post('/', optionalAuthenticate, auditController.createAuditLog);

export default router;
