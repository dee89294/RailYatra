/**
 * ============================================================================
 * File: server/src/middleware/errorHandler.ts
 * Purpose: Centralized error handling utilities and Express error middleware.
 * Responsibilities:
 *   - Defines `AppError` for predictable operational HTTP errors (400, 401, 403, 404, 409).
 *   - Provides `asyncHandler` so async route controllers never cause unhandled
 *     promise rejections and always forward errors to `errorHandler`.
 *   - Formats consistent `{ success: false, error, code }` JSON responses.
 * Used by: `index.ts` and all files in `server/src/routes/` and `services/`.
 * ============================================================================
 */

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Wraps an async Express route handler and automatically forwards any thrown
 * exception or rejected promise to Express's `next(err)` error pipeline.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Global Express error-handling middleware (must be registered AFTER all routes).
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error('[RailYatra Error]', err);
  res.status(500).json({
    success: false,
    error:
      env.nodeEnv === 'development'
        ? err.message || 'Internal server error'
        : 'An unexpected error occurred. Please try again.',
    code: 'INTERNAL_SERVER_ERROR',
  });
}
