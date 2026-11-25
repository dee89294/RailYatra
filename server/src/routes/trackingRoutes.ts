/**
 * ============================================================================
 * File: server/src/routes/trackingRoutes.ts
 * Purpose: Public REST endpoint for Live Train Running Status & Tracking.
 * Responsibilities:
 *   - Exposes `GET /api/tracking/:trainNumber?date=YYYY-MM-DD`.
 *   - Delegates to `railwayApiService.getLiveTrainStatus`, which seamlessly
 *     handles external API integration or schedule-synchronized live fallback.
 * Used by: `server/src/index.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { railwayApiService } from '../services/railwayApiService.js';

export const trackingRouter = Router();

trackingRouter.get(
  '/:trainNumber',
  asyncHandler(async (req, res) => {
    const date = req.query.date ? String(req.query.date) : undefined;
    const status = await railwayApiService.getLiveTrainStatus(
      String(req.params.trainNumber),
      date
    );
    res.json({ success: true, data: status });
  })
);
