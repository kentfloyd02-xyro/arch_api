import { z } from 'zod';
import * as supportService from './supportService.js';
import { createAuditLogRecord } from '../audit/auditService.js';
const supportRateLimits = new Map();
function checkSupportRateLimit(key, limit = 5, windowMs = 30000) {
    const now = Date.now();
    const entry = supportRateLimits.get(key);
    if (!entry || now > entry.resetAt) {
        supportRateLimits.set(key, { count: 1, resetAt: now + windowMs });
        return;
    }
    if (entry.count >= limit) {
        const waitSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
        throw {
            statusCode: 429,
            code: 'SUPPORT_RATE_LIMIT_EXCEEDED',
            message: `Rate limit reached: Maximum ${limit} consecutive messages allowed. Please wait ${waitSec} second(s) to avoid message buffer.`
        };
    }
    entry.count += 1;
}
function checkIsAdmin(user) {
    if (!user)
        return false;
    const role = String(user.global_role || user.role || '').toLowerCase();
    return role === 'superadmin' || role === 'admin';
}
export async function answerQuestion(req, res, next) {
    try {
        const user = req.user;
        const clientKey = user?.email || req.ip || 'anonymous';
        checkSupportRateLimit(clientKey, 5, 30000);
        const schema = z.object({
            topicId: z.string().optional(),
            question: z.string().optional()
        });
        const { topicId, question } = schema.parse(req.body);
        const result = await supportService.answerQuestion(topicId, question);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
}
export async function createInquiry(req, res, next) {
    try {
        const user = req.user;
        const schema = z.object({
            customerName: z.string().optional(),
            customerEmail: z.string().email().optional(),
            question: z.string().min(1),
            messages: z.array(z.any()).optional()
        });
        const payload = schema.parse(req.body);
        const customerName = user?.full_name || payload.customerName || 'Customer';
        const customerEmail = user?.email || payload.customerEmail;
        if (!customerEmail) {
            throw { statusCode: 400, code: 'EMAIL_REQUIRED', message: 'User email is required to submit an inquiry.' };
        }
        const clientKey = customerEmail || req.ip || 'anonymous';
        checkSupportRateLimit(clientKey, 5, 30000);
        const inquiry = await supportService.createInquiry({
            customerName,
            customerEmail,
            customerId: user?.id || null,
            question: payload.question,
            messages: payload.messages
        });
        res.status(201).json(inquiry);
    }
    catch (err) {
        next(err);
    }
}
export async function getInquiries(req, res, next) {
    try {
        const user = req.user;
        const status = req.query.status;
        const isAdmin = checkIsAdmin(user);
        const customerFilter = isAdmin ? undefined : { customerEmail: user?.email, customerId: user?.id };
        const inquiries = await supportService.getInquiries(status, customerFilter);
        res.json(inquiries);
    }
    catch (err) {
        next(err);
    }
}
export async function getInquiry(req, res, next) {
    try {
        const id = req.params.id;
        const inquiry = await supportService.getInquiryById(id);
        res.json(inquiry);
    }
    catch (err) {
        next(err);
    }
}
export async function addMessage(req, res, next) {
    try {
        const user = req.user;
        const id = req.params.id;
        const schema = z.object({
            text: z.string().min(1)
        });
        const { text } = schema.parse(req.body);
        const isAdmin = checkIsAdmin(user);
        const sender = isAdmin ? 'admin' : 'user';
        // Rate limit customer messages
        if (!isAdmin) {
            const clientKey = user?.email || req.ip || 'anonymous';
            checkSupportRateLimit(clientKey, 5, 30000);
        }
        const result = await supportService.addMessage(id, text, sender);
        if (isAdmin) {
            try {
                await createAuditLogRecord({
                    userId: user?.id || null,
                    module: 'support',
                    action: 'SUPPORT_TICKET_REPLIED',
                    resourceId: result.inquiry?.ticketNumber || id,
                    details: {
                        ticketNumber: result.inquiry?.ticketNumber || id,
                        customerEmail: result.inquiry?.customerEmail,
                        message: text.slice(0, 100)
                    },
                    ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
                    userAgent: req.headers['user-agent'] || 'Archon Support'
                });
            }
            catch (e) {
                console.warn('[Audit Log] Support admin message log error:', e);
            }
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function replyInquiry(req, res, next) {
    try {
        const user = req.user;
        const id = req.params.id;
        const schema = z.object({
            reply: z.string().min(1)
        });
        const { reply } = schema.parse(req.body);
        const result = await supportService.replyInquiry(id, reply);
        try {
            await createAuditLogRecord({
                userId: user?.id || null,
                module: 'support',
                action: 'SUPPORT_TICKET_REPLIED',
                resourceId: result.inquiry?.ticketNumber || id,
                details: {
                    ticketNumber: result.inquiry?.ticketNumber || id,
                    customerEmail: result.inquiry?.customerEmail,
                    reply: reply.slice(0, 100)
                },
                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
                userAgent: req.headers['user-agent'] || 'Archon Support'
            });
        }
        catch (e) {
            console.warn('[Audit Log] Support reply log error:', e);
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function closeInquiry(req, res, next) {
    try {
        const user = req.user;
        const id = req.params.id;
        const result = await supportService.closeInquiry(id);
        try {
            await createAuditLogRecord({
                userId: user?.id || null,
                module: 'support',
                action: 'SUPPORT_TICKET_CLOSED',
                resourceId: result.ticketNumber || id,
                details: {
                    ticketNumber: result.ticketNumber || id,
                    customerEmail: result.customerEmail
                },
                ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
                userAgent: req.headers['user-agent'] || 'Archon Support'
            });
        }
        catch (e) {
            console.warn('[Audit Log] Support close ticket log error:', e);
        }
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
