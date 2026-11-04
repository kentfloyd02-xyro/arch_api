import { Request, Response, NextFunction } from 'express';

export function authorize(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'You must be logged in.' }
      });
    }

    // Superadmin has universal bypass across all subsystems
    if (req.user.global_role === 'superadmin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.global_role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Role '${req.user.global_role}' is not authorized for this resource.`
        }
      });
    }

    next();
  };
}
