import { Request, Response, NextFunction } from 'express';
import * as auditService from './auditService.js';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const action = req.query.action as string | undefined;
    const module = req.query.module as string | undefined;
    const search = req.query.search as string | undefined;

    const logs = await auditService.getAuditLogs({ limit, offset, action, module, search });
    res.json({
      success: true,
      data: logs
    });
  } catch (err) {
    next(err);
  }
}
