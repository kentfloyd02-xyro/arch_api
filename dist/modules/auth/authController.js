import { z } from 'zod';
import * as authService from './authService.js';
import { env } from '../../config/env.js';
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1)
});
const verifyOtpSchema = z.object({
    email: z.string().email(),
    code: z.string().min(1)
});
const resendOtpSchema = z.object({
    email: z.string().email(),
    purpose: z.string().optional()
});
const forgotPasswordInitSchema = z.object({
    email: z.string().email()
});
const forgotPasswordVerifySchema = z.object({
    email: z.string().email(),
    code: z.string().min(1),
    newPassword: z.string().min(6)
});
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(2),
    role: z.string().optional()
});
export async function login(req, res, next) {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const result = await authService.loginUser(email, password);
        // Set cross-subdomain cookie if domain configured
        res.cookie('archon_token', result.token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function loginInit(req, res, next) {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const result = await authService.initLogin(email, password);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function verifyOtp(req, res, next) {
    try {
        const { email, code } = verifyOtpSchema.parse(req.body);
        const result = await authService.verifyLoginOtp(email, code);
        res.cookie('archon_token', result.token, {
            httpOnly: true,
            secure: env.NODE_ENV === 'production',
            sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
            domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function resendOtp(req, res, next) {
    try {
        const { email } = resendOtpSchema.parse(req.body);
        const result = await authService.resendLoginOtp(email);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function forgotPassword(req, res, next) {
    try {
        const { email } = forgotPasswordInitSchema.parse(req.body);
        const result = await authService.initForgotPassword(email);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function resetPassword(req, res, next) {
    try {
        const { email, code, newPassword } = forgotPasswordVerifySchema.parse(req.body);
        const result = await authService.verifyForgotPassword(email, code, newPassword);
        res.json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function register(req, res, next) {
    try {
        const { email, password, fullName, role } = registerSchema.parse(req.body);
        const result = await authService.registerUser(email, password, fullName, role || 'customer');
        res.status(201).json({
            success: true,
            data: result
        });
    }
    catch (err) {
        next(err);
    }
}
export async function me(req, res, next) {
    try {
        const userId = req.user.id;
        const profile = await authService.getUserProfile(userId);
        res.json({
            success: true,
            data: profile
        });
    }
    catch (err) {
        next(err);
    }
}
export async function logout(req, res) {
    res.clearCookie('archon_token', {
        domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN
    });
    res.json({
        success: true,
        message: 'Logged out successfully.'
    });
}
