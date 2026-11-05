import { z } from 'zod';
import * as supportService from './supportService.js';
export async function answerQuestion(req, res, next) {
    try {
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
        const schema = z.object({
            customerName: z.string().min(1).default('Customer'),
            customerEmail: z.string().email(),
            customerId: z.string().nullable().optional(),
            question: z.string().min(1),
            messages: z.array(z.any()).optional()
        });
        const payload = schema.parse(req.body);
        const inquiry = await supportService.createInquiry(payload);
        res.status(201).json(inquiry);
    }
    catch (err) {
        next(err);
    }
}
export async function getInquiries(req, res, next) {
    try {
        const status = req.query.status;
        const inquiries = await supportService.getInquiries(status);
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
        const id = req.params.id;
        const schema = z.object({
            text: z.string().min(1),
            sender: z.enum(['user', 'admin']).default('user')
        });
        const { text, sender } = schema.parse(req.body);
        const result = await supportService.addMessage(id, text, sender);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function replyInquiry(req, res, next) {
    try {
        const id = req.params.id;
        const schema = z.object({
            reply: z.string().min(1)
        });
        const { reply } = schema.parse(req.body);
        const result = await supportService.replyInquiry(id, reply);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function closeInquiry(req, res, next) {
    try {
        const id = req.params.id;
        const result = await supportService.closeInquiry(id);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
