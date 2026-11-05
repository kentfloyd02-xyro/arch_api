import { Router } from 'express';
import * as supportController from './supportController.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// Prepared topic & AI assistant answers (Requires login)
router.post('/answer', authenticate, supportController.answerQuestion);

// Customer inquiries (Tickets - Requires login)
router.post('/inquiries', authenticate, supportController.createInquiry);
router.get('/inquiries', authenticate, supportController.getInquiries);
router.get('/inquiries/:id', authenticate, supportController.getInquiry);
router.post('/inquiries/:id/messages', authenticate, supportController.addMessage);
router.post('/inquiries/:id/reply', authenticate, supportController.replyInquiry);
router.post('/inquiries/:id/close', authenticate, supportController.closeInquiry);

export default router;
