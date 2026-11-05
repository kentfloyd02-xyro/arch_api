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
