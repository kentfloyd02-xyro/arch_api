import { Router } from 'express';
import * as supportController from './supportController.js';

const router = Router();

// Prepared topic & AI assistant answers
router.post('/answer', supportController.answerQuestion);

// Customer inquiries (Tickets)
router.post('/inquiries', supportController.createInquiry);
router.get('/inquiries', supportController.getInquiries);
router.get('/inquiries/:id', supportController.getInquiry);
router.post('/inquiries/:id/messages', supportController.addMessage);
router.post('/inquiries/:id/reply', supportController.replyInquiry);
router.post('/inquiries/:id/close', supportController.closeInquiry);

export default router;
