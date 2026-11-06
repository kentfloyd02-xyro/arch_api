import { Router } from 'express';
import * as supportController from './supportController.js';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate.js';

const router = Router();

// Prepared topic & AI assistant answers
router.post('/answer', optionalAuthenticate, supportController.answerQuestion);

// Customer inquiries (Tickets)
router.post('/inquiries', optionalAuthenticate, supportController.createInquiry);
router.get('/inquiries', optionalAuthenticate, supportController.getInquiries);
router.get('/inquiries/:id', optionalAuthenticate, supportController.getInquiry);
router.post('/inquiries/:id/messages', optionalAuthenticate, supportController.addMessage);

// Admin-only management
router.post('/inquiries/:id/reply', authenticate, supportController.replyInquiry);
router.post('/inquiries/:id/close', authenticate, supportController.closeInquiry);

export default router;
