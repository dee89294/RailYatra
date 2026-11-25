/**
 * ============================================================================
 * File: server/src/middleware/adminMiddleware.ts
 * Purpose: Role-Based Access Control (RBAC) middleware for Admin endpoints.
 * Responsibilities:
 *   - Must run AFTER `requireAuth` so `req.user` is populated.
 *   - Enforces `req.user.role === 'admin'`; otherwise returns HTTP 403 FORBIDDEN.
 *   - Teaches the distinction between Authentication ("who are you?") and
 *     Authorization ("are you permitted to perform this admin operation?").
 * Used by: `routes/adminRoutes.ts`.
 * ============================================================================
 */

import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler.js';

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(
      new AppError(
        'Administrator privileges are required to access this resource.',
        403,
        'FORBIDDEN_ADMIN_ONLY'
      )
    );
    return;
  }

  next();
}
