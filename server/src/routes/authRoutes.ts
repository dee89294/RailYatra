/**
 * ============================================================================
 * File: server/src/routes/authRoutes.ts
 * Purpose: HTTP REST endpoints for user authentication, verification, and profile.
 * Responsibilities:
 *   - Public routes: `/register`, `/verify-email`, `/resend-verification`,
 *     `/login`, `/forgot-password`, `/reset-password`, `/dev-emails` (dev only).
 *   - Protected routes (`requireAuth`): `/me`, `/profile`, `/change-password`,
 *     `/saved-passengers` (GET, POST, DELETE), `/logout`.
 * Used by: `server/src/index.ts`.
 * Dependencies: `services/authService.ts`, `middleware/authMiddleware.ts`,
 *               `db/repository.ts`, `services/emailService.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { authService } from '../services/authService.js';
import { emailService } from '../services/emailService.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { fullName, email, phone, password } = req.body as {
      fullName: string;
      email: string;
      phone?: string;
      password: string;
    };
    const result = await authService.register({
      fullName: fullName || '',
      email: email || '',
      phone: phone || '',
      password: password || '',
    });
    res.status(201).json({ success: true, data: result });
  })
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = String(req.body?.token || req.query?.token || '');
    const result = await authService.verifyEmail(token);
    res.json({ success: true, data: result });
  })
);

authRouter.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const result = await authService.resendVerification(email || '');
    res.json({ success: true, data: result });
  })
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await authService.login(email || '', password || '');
    res.json({ success: true, data: result });
  })
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const result = await authService.forgotPassword(email || '');
    res.json({ success: true, data: result });
  })
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body as {
      token: string;
      newPassword: string;
    };
    const result = await authService.resetPassword(token || '', newPassword || '');
    res.json({ success: true, data: result });
  })
);

authRouter.post(
  '/logout',
  asyncHandler(async (_req, res) => {
    // JWTs are stateless on the server; client clears stored session token.
    res.json({ success: true, data: { message: 'Logged out successfully.' } });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: { user: req.user, provider: env.provider },
    });
  })
);

authRouter.put(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { full_name, phone } = req.body as { full_name?: string; phone?: string };
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const updated = await repository.updateProfile(
      req.user.id,
      { full_name, phone },
      req.accessToken
    );
    res.json({ success: true, data: { user: updated } });
  })
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const result = await authService.changePassword(
      req.user.id,
      currentPassword || '',
      newPassword || ''
    );
    res.json({ success: true, data: result });
  })
);

// Saved Co-Passengers (Master Passenger List)
authRouter.get(
  '/saved-passengers',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const passengers = await repository.listSavedPassengers(req.user.id);
    res.json({ success: true, data: passengers });
  })
);

authRouter.post(
  '/saved-passengers',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const { full_name, age, gender, berth_preference } = req.body as {
      full_name: string;
      age: number;
      gender: 'Male' | 'Female' | 'Other';
      berth_preference?: string;
    };
    if (!full_name || !age) {
      throw new AppError('Name and age are required.', 400, 'VALIDATION_ERROR');
    }
    const created = await repository.addSavedPassenger(req.user.id, {
      full_name: full_name.trim(),
      age: Number(age),
      gender: gender || 'Male',
      berth_preference: berth_preference || 'No Preference',
    });
    res.status(201).json({ success: true, data: created });
  })
);

authRouter.delete(
  '/saved-passengers/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    await repository.deleteSavedPassenger(req.user.id, String(req.params.id));
    res.json({ success: true, data: { deleted: true } });
  })
);

// Development-only endpoint to inspect captured emails when SMTP is unconfigured
authRouter.get(
  '/dev-emails',
  asyncHandler(async (req, res) => {
    if (env.nodeEnv === 'production' || env.smtp.configured) {
      throw new AppError('Not available when SMTP is active or in production.', 404, 'NOT_FOUND');
    }
    const emailFilter = req.query.email ? String(req.query.email) : undefined;
    res.json({ success: true, data: emailService.getDevOutbox(emailFilter) });
  })
);
