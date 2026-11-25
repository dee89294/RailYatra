/**
 * ============================================================================
 * File: server/src/routes/trainRoutes.ts
 * Purpose: Public REST endpoints for Station Directory, Train Search, and Schedules.
 * Responsibilities:
 *   - Serves both Guest Users and Registered Users without requiring login.
 *   - `GET /api/stations` — lists or searches railway stations.
 *   - `GET /api/trains` — lists all active trains with stops and classes.
 *   - `GET /api/trains/search` — searches trains between From & To on a date.
 *   - `GET /api/trains/:trainNumber/schedule` — full route timetable.
 * Used by: `server/src/index.ts`.
 * Dependencies: `services/trainService.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { trainService } from '../services/trainService.js';

export const trainRouter = Router();

trainRouter.get(
  '/stations',
  asyncHandler(async (req, res) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const stations = await trainService.searchStations(q);
    res.json({ success: true, data: stations });
  })
);

trainRouter.get(
  '/trains',
  asyncHandler(async (req, res) => {
    const q = req.query.q ? String(req.query.q) : undefined;
    const trains = await trainService.listAllTrains(q);
    res.json({ success: true, data: trains });
  })
);

trainRouter.get(
  '/trains/search',
  asyncHandler(async (req, res) => {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const classCode = req.query.class ? String(req.query.class) : 'ALL';
    const passengers = Number(req.query.passengers || 1);
    const quota = req.query.quota ? String(req.query.quota) : 'GN';

    const results = await trainService.searchTrains({
      from,
      to,
      date,
      classCode,
      passengers,
      quota,
    });
    res.json({ success: true, data: results });
  })
);

trainRouter.get(
  '/trains/availability',
  asyncHandler(async (req, res) => {
    const trainNumber = String(req.query.trainNumber || '');
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const date = String(req.query.date || new Date().toISOString().slice(0, 10));
    const classCode = String(req.query.class || '3A');
    const quota = String(req.query.quota || 'GN');

    const result = await trainService.checkLiveQuotaAvailability({
      trainNumber,
      from,
      to,
      date,
      classCode,
      quota,
    });
    res.json({ success: true, data: result });
  })
);

trainRouter.get(
  '/trains/:trainNumber/schedule',
  asyncHandler(async (req, res) => {
    const schedule = await trainService.getTrainScheduleByNumber(
      String(req.params.trainNumber)
    );
    res.json({ success: true, data: schedule });
  })
);
