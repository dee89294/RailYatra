/**
 * ============================================================================
 * File: server/src/routes/bookingRoutes.ts
 * Purpose: Protected REST endpoints for ticket booking, fare quotes, and cancellations.
 * Responsibilities:
 *   - `GET /api/bookings/quote` — computes itemized fare before checkout.
 *   - `GET /api/bookings/my` — returns logged-in user's bookings (RLS-scoped).
 *   - `POST /api/bookings` — creates booking + passengers + payment (requires verified email).
 *   - `GET /api/bookings/:id` — gets single reservation (owner or admin only).
 *   - `POST /api/bookings/:id/cancel` — full or per-passenger cancellation.
 * Used by: `server/src/index.ts`.
 * Dependencies: `middleware/authMiddleware.ts`, `services/bookingService.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth, requireVerifiedEmail } from '../middleware/authMiddleware.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';
import { bookingService } from '../services/bookingService.js';
import type { ClassCode, PaymentMethod } from '../types/index.js';

export const bookingRouter = Router();

bookingRouter.get(
  '/quote',
  asyncHandler(async (req, res) => {
    const trainNumber = String(req.query.trainNumber || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const classCode = String(req.query.classCode || '') as ClassCode;
    const passengerCount = Number(req.query.passengers || 1);
    const quota = req.query.quota ? String(req.query.quota) : 'GN';
    const journeyDate = req.query.date ? String(req.query.date) : undefined;

    const data = await bookingService.getFareQuote({
      trainNumber,
      from,
      to,
      classCode,
      passengerCount,
      quota,
      journeyDate,
    });
    res.json({ success: true, data });
  })
);

bookingRouter.get(
  '/my',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const bookings = await bookingService.getUserBookings(
      req.user.id,
      req.accessToken
    );
    res.json({ success: true, data: bookings });
  })
);

bookingRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const body = req.body as {
      trainNumber: string;
      fromStationCode: string;
      toStationCode: string;
      journeyDate: string;
      classCode: ClassCode;
      quota?: string;
      contactEmail?: string;
      contactPhone?: string;
      passengers: Array<{
        full_name: string;
        age: number;
        gender: 'Male' | 'Female' | 'Other';
        berth_preference: string;
      }>;
      paymentMethod: PaymentMethod;
      upiId?: string;
      cardNumber?: string;
      bankName?: string;
    };

    const booking = await bookingService.createBooking(req.user, {
      ...body,
      contactEmail: body.contactEmail || req.user.email,
      contactPhone: body.contactPhone || req.user.phone || '+91 98000 00000',
    });

    res.status(201).json({ success: true, data: booking });
  })
);

bookingRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const booking = await bookingService.getBookingForOwnerOrAdmin(
      String(req.params.id),
      req.user
    );
    res.json({ success: true, data: booking });
  })
);

bookingRouter.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    const { passengerIds } = (req.body || {}) as { passengerIds?: string[] };
    const updated = await bookingService.cancelBooking(
      String(req.params.id),
      req.user,
      passengerIds
    );
    res.json({ success: true, data: updated });
  })
);
