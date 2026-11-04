import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[Error] ${req.method} ${req.url}:`, err.message || err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data provided.',
        issues: err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      }
    });
  }

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal server error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
}
