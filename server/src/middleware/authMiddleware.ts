/**
 * ============================================================================
 * File: server/src/middleware/authMiddleware.ts
 * Purpose: Authentication & email-verification middleware for protected routes.
 * Responsibilities:
 *   - Extracts the Bearer JWT from the HTTP `Authorization` header.
 *   - Validates the token against Supabase Auth (`supabaseAdmin.auth.getUser`)
 *     when `env.provider === 'supabase'`, OR verifies the HMAC-SHA256 JWT when
 *     running in `local` mode.
 *   - Loads the corresponding user record from the `profiles` table and attaches
 *     `req.user` and `req.accessToken` for downstream handlers.
 *   - Exposes `requireVerifiedEmail` to block unverified users from booking tickets.
 * Used by: `routes/authRoutes.ts`, `routes/bookingRoutes.ts`,
 *          `routes/paymentRoutes.ts`, `routes/adminRoutes.ts`.
 * ============================================================================
 */

import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { getSupabaseAdmin } from '../db/supabaseClient.js';
import { verifyLocalJwt } from '../utils/crypto.js';
import type { UserProfile } from '../types/index.js';
import { AppError } from './errorHandler.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      accessToken?: string;
    }
  }
}

/**
 * Middleware: Requires a valid authenticated session token.
 * Rejects Guest Users with HTTP 401 UNAUTHORIZED.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Please log in.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Invalid authorization token.', 401, 'UNAUTHORIZED');
    }

    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin().auth.getUser(token);
      if (error || !data.user) {
        throw new AppError('Session expired or invalid. Please log in again.', 401, 'INVALID_TOKEN');
      }

      let profile = await repository.getProfileById(data.user.id);
      if (!profile) {
        throw new AppError('User profile record not found.', 401, 'PROFILE_NOT_FOUND');
      }

      // Keep email_verified synced with Supabase Auth's email_confirmed_at
      const isConfirmed = Boolean(data.user.email_confirmed_at);
      if (isConfirmed && !profile.email_verified) {
        const synced = await repository.updateProfile(profile.id, { email_verified: true });
        if (synced) profile = { ...synced, password_hash: null };
      }

      const { password_hash: _ignored, ...safeProfile } = profile;
      req.user = safeProfile;
      req.accessToken = token;
      next();
      return;
    }

    // Local JWT verification path
    const payload = verifyLocalJwt(token);
    if (!payload) {
      throw new AppError('Session expired or invalid. Please log in again.', 401, 'INVALID_TOKEN');
    }

    const profile = await repository.getProfileById(payload.sub);
    if (!profile) {
      throw new AppError('Account no longer exists.', 401, 'PROFILE_NOT_FOUND');
    }

    const { password_hash: _ignored, ...safeProfile } = profile;
    req.user = safeProfile;
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Ensures the authenticated user has verified their email address
 * before performing sensitive actions like booking tickets or processing payments.
 */
export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    return;
  }
  if (!req.user.email_verified) {
    next(
      new AppError(
        'Please verify your email address before booking tickets.',
        403,
        'EMAIL_NOT_VERIFIED'
      )
    );
    return;
  }
  next();
}
