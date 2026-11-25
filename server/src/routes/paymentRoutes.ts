/**
 * ============================================================================
 * File: server/src/routes/paymentRoutes.ts
 * Purpose: REST endpoint for standalone fare estimation & payment verification helpers.
 * Responsibilities:
 *   - Exposes `POST /api/payments/calculate-fare` for quick itemized quote checks.
 * Used by: `server/src/index.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { paymentService } from '../services/paymentService.js';
import type { ClassCode } from '../types/index.js';

export const paymentRouter = Router();

paymentRouter.post(
  '/calculate-fare',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { perPassengerBaseFare, passengerCount, classCode } = req.body as {
      perPassengerBaseFare: number;
      passengerCount: number;
      classCode: ClassCode;
    };
    const quote = paymentService.calculateFareQuote(
      Number(perPassengerBaseFare || 0),
      Math.max(1, Number(passengerCount || 1)),
      classCode || '3A'
    );
    res.json({ success: true, data: quote });
  })
);
