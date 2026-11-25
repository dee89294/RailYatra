/**
 * ============================================================================
 * File: server/src/routes/pnrRoutes.ts
 * Purpose: Public REST endpoint for checking 10-digit PNR reservation status.
 * Responsibilities:
 *   - Allows both Guest Users and Registered Users to look up PNR status.
 *   - Masks private email/phone PII via `bookingService.lookupPnr`.
 * Used by: `server/src/index.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { bookingService } from '../services/bookingService.js';

export const pnrRouter = Router();

pnrRouter.get(
  '/:pnrNumber',
  asyncHandler(async (req, res) => {
    const result = await bookingService.lookupPnr(String(req.params.pnrNumber));
    res.json({ success: true, data: result });
  })
);
