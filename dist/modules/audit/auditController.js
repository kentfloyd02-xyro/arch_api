import * as auditService from './auditService.js';
export async function getAuditLogs(req, res, next) {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const action = req.query.action;
        const module = req.query.module;
        const search = req.query.search;
        const logs = await auditService.getAuditLogs({ limit, offset, action, module, search });
        res.json({
            success: true,
            data: logs
        });
    }
    catch (err) {
        next(err);
    }
}
export async function createAuditLog(req, res, next) {
    try {
        const { module, action, resourceId, details, target } = req.body;
        const userId = req.user?.id || null;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Archon Admin Console';
        const log = await auditService.createAuditLogRecord({
            userId,
            module: module || 'admin',
            action: action || 'ADMIN_OPERATION',
            resourceId: resourceId || target,
            details: typeof details === 'object' ? details : { details, target },
            ipAddress,
            userAgent
        });
        res.status(201).json({ success: true, data: log });
    }
    catch (err) {
        next(err);
    }
}
