import { Router } from 'express';
import * as authController from './authController.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.post('/login', authController.login);
router.post('/login-init', authController.loginInit);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, authController.updateProfile);
router.patch('/profile', authenticate, authController.updateProfile);
router.get('/customers', authenticate, authController.getCustomers);
router.get('/users', authenticate, authController.getCustomers);

export default router;
