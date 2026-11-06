import { z } from 'zod';
import * as shopService from './shopService.js';
// Categories
export async function getCategories(req, res, next) {
    try {
        const data = await shopService.getAllCategories();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createCategory(req, res, next) {
    try {
        const schema = z.object({
            name: z.string().min(2),
            slug: z.string().min(2),
            description: z.string().optional()
        });
        const { name, slug, description } = schema.parse(req.body);
        const data = await shopService.createCategory(name, slug, description);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Products
export async function getProducts(req, res, next) {
    try {
        const { category, category_id, search, include_inactive, include_deleted } = req.query;
        const data = await shopService.getAllProducts({
            categorySlug: category,
            categoryId: category_id,
            search: search,
            includeInactive: include_inactive === 'true',
            includeDeleted: include_deleted === 'true'
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getProduct(req, res, next) {
    try {
        const data = await shopService.getProductById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createProduct(req, res, next) {
    try {
        const schema = z.object({
            categoryId: z.string().uuid().optional(),
            category: z.string().optional(),
            customId: z.string().optional(),
            title: z.string().min(2),
            description: z.string().optional(),
            price: z.number().positive(),
            stock: z.number().int().nonnegative().optional(),
            sku: z.string().optional(),
            images: z.array(z.string()).optional(),
            specs: z.record(z.any()).optional(),
            shippingWeightKg: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await shopService.createProduct(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateProduct(req, res, next) {
    try {
        const data = await shopService.updateProduct(req.params.id, req.body);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function archiveProduct(req, res, next) {
    try {
        const data = await shopService.archiveProduct(req.params.id, req.body?.isActive);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function deleteProduct(req, res, next) {
    try {
        const permanent = req.query.permanent === 'true';
        const data = await shopService.deleteProduct(req.params.id, permanent);
        res.json({
            success: true,
            message: permanent ? 'Product permanently deleted' : 'Product moved to trash',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function restoreProduct(req, res, next) {
    try {
        const data = await shopService.restoreProduct(req.params.id);
        res.json({ success: true, message: 'Product restored successfully', data });
    }
    catch (err) {
        next(err);
    }
}
// Vouchers
export async function getVouchers(req, res, next) {
    try {
        const data = await shopService.getVouchers();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Projects
export async function getProjects(req, res, next) {
    try {
        const data = await shopService.getProjects();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function validateVoucher(req, res, next) {
    try {
        const schema = z.object({
            code: z.string().min(2),
            subtotal: z.number().nonnegative()
        });
        const { code, subtotal } = schema.parse(req.body);
        const data = await shopService.validateVoucher(code, subtotal);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Orders & Checkout
export async function checkout(req, res, next) {
    try {
        const schema = z.object({
            customerName: z.string().min(2),
            customerEmail: z.string().email(),
            customerPhone: z.string().min(7),
            deliveryAddress: z.string().min(5),
            deliveryNotes: z.string().optional().nullable(),
            paymentMethod: z.enum(['GCash', 'Maya', 'Bank', 'COD']),
            gcashRefNumber: z.string().optional().nullable(),
            proofImage: z.string().optional().nullable(),
            subtotal: z.number().nonnegative().optional(),
            shippingFee: z.number().nonnegative().optional(),
            discount: z.number().nonnegative().optional(),
            discountAmount: z.number().nonnegative().optional(),
            discountType: z.string().optional().nullable(),
            total: z.number().nonnegative().optional(),
            totalAmount: z.number().nonnegative().optional(),
            voucherCode: z.string().optional().nullable(),
            userId: z.string().optional().nullable(),
            items: z.array(z.object({
                productId: z.string().optional().nullable(),
                customId: z.string().optional().nullable(),
                id: z.string().optional().nullable(),
                title: z.string().min(1),
                price: z.number().positive(),
                quantity: z.number().int().positive(),
                total: z.number().positive()
            })).min(1, 'Order must contain at least one item')
        });
        const parsed = schema.parse(req.body);
        const subtotal = parsed.subtotal ?? parsed.items.reduce((s, i) => s + i.total, 0);
        const total = parsed.total ?? parsed.totalAmount ?? subtotal;
        const discount = parsed.discount ?? parsed.discountAmount ?? 0;
        const shippingFee = parsed.shippingFee ?? 0;
        const userId = req.user?.id || parsed.userId || req.body.userId || null;
        const data = await shopService.createOrder({
            ...parsed,
            subtotal,
            shippingFee,
            discount,
            discountAmount: discount,
            discountType: parsed.discountType || '',
            total,
            totalAmount: total,
            userId
        });
        res.status(201).json({
            success: true,
            message: 'Order placed successfully and logistics dispatch scheduled.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getOrders(req, res, next) {
    try {
        const { status, search } = req.query;
        const userRole = String(req.user?.global_role || req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'superadmin' || userRole === 'admin';
        const userId = isAdmin ? undefined : req.user?.id;
        const customerEmail = isAdmin ? undefined : req.user?.email;
        const data = await shopService.getAllOrders({
            userId,
            customerEmail,
            status: status,
            search: search
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getOrder(req, res, next) {
    try {
        const data = await shopService.getOrderByIdOrNumber(req.params.identifier);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateOrder(req, res, next) {
    try {
        const schema = z.object({
            deliveryStatus: z.string().optional(),
            status: z.string().optional(),
            trackingStep: z.string().optional(),
            notes: z.string().optional(),
            cancelReason: z.string().optional(),
            refundDetails: z.any().optional(),
            restoreStock: z.boolean().optional(),
            performedBy: z.any().optional()
        });
        const parsed = schema.parse(req.body);
        const targetStatus = parsed.deliveryStatus || parsed.status;
        if (!targetStatus) {
            throw { statusCode: 400, message: 'Status is required.' };
        }
        const actorUserId = req.user?.id || null;
        const actorDetails = typeof parsed.performedBy === 'object' ? parsed.performedBy : {
            name: parsed.performedBy || req.user?.full_name || 'User',
            notes: parsed.notes
        };
        const data = await shopService.updateOrderStatus(req.params.id, targetStatus, parsed.trackingStep, actorUserId, actorDetails, parsed.cancelReason || parsed.notes, parsed.refundDetails, parsed.restoreStock);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Reviews
export async function getReviews(req, res, next) {
    try {
        const data = await shopService.getProductReviews(req.params.productId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function addReview(req, res, next) {
    try {
        const schema = z.object({
            productId: z.string().uuid(),
            customerName: z.string().min(2),
            rating: z.number().int().min(1).max(5),
            comment: z.string().optional(),
            aiSentiment: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const userId = req.user?.id;
        const data = await shopService.createProductReview({
            ...parsed,
            userId
        });
        res.status(201).json({ success: true, message: 'Review submitted.', data });
    }
    catch (err) {
        next(err);
    }
}
