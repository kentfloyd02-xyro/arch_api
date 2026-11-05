import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as supportService from './supportService.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const supportRateLimits = new Map<string, RateLimitEntry>();

function checkSupportRateLimit(key: string, limit = 5, windowMs = 30000) {
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

export async function answerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const clientKey = user?.email || req.ip || 'anonymous';
    checkSupportRateLimit(clientKey, 5, 30000);

    const schema = z.object({
      topicId: z.string().optional(),
      question: z.string().optional()
    });
    const { topicId, question } = schema.parse(req.body);
    const result = await supportService.answerQuestion(topicId, question);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function createInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
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
  } catch (err) {
    next(err);
  }
}

export async function getInquiries(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const status = req.query.status as string | undefined;
    const isAdmin = user?.role === 'admin';
    const customerFilter = isAdmin ? undefined : { customerEmail: user?.email, customerId: user?.id };
    const inquiries = await supportService.getInquiries(status, customerFilter);
    res.json(inquiries);
  } catch (err) {
    next(err);
  }
}

export async function getInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const inquiry = await supportService.getInquiryById(id);
    res.json(inquiry);
  } catch (err) {
    next(err);
  }
}

export async function addMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const id = req.params.id as string;
    const schema = z.object({
      text: z.string().min(1)
    });
    const { text } = schema.parse(req.body);
    const sender = user?.global_role === 'superadmin' ? 'admin' : 'user';

    // Rate limit customer messages
    if (sender === 'user') {
      const clientKey = user?.email || req.ip || 'anonymous';
      checkSupportRateLimit(clientKey, 5, 30000);
    }

    const result = await supportService.addMessage(id, text, sender);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function replyInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const schema = z.object({
      reply: z.string().min(1)
    });
    const { reply } = schema.parse(req.body);
    const result = await supportService.replyInquiry(id, reply);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function closeInquiry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const result = await supportService.closeInquiry(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
