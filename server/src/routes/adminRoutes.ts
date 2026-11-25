/**
 * ============================================================================
 * File: server/src/routes/adminRoutes.ts
 * Purpose: Protected Administrator REST API endpoints (`/api/admin/*`).
 * Responsibilities:
 *   - Enforces BOTH `requireAuth` AND `requireAdmin` on every route in this router.
 *   - Provides analytics overview, station creation, train/schedule management,
 *     reservation/chart oversight, user directory management, and contact tickets.
 * Used by: `server/src/index.ts`.
 * Dependencies: `middleware/authMiddleware.ts`, `middleware/adminMiddleware.ts`,
 *               `services/adminService.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { requireAdmin } from '../middleware/adminMiddleware.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { adminService } from '../services/adminService.js';
import type { Booking, ContactMessage } from '../types/index.js';

export const adminRouter = Router();

// Apply Authentication + Admin Authorization guards to ALL admin routes
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const data = await adminService.getDashboardAnalytics();
    res.json({ success: true, data });
  })
);

adminRouter.get(
  '/trains',
  asyncHandler(async (_req, res) => {
    const trains = await adminService.listAllTrainsDetailed();
    res.json({ success: true, data: trains });
  })
);

adminRouter.post(
  '/trains',
  asyncHandler(async (req, res) => {
    const created = await adminService.createTrain(req.body);
    res.status(201).json({ success: true, data: created });
  })
);

adminRouter.patch(
  '/trains/:id/status',
  asyncHandler(async (req, res) => {
    const { is_active } = req.body as { is_active: boolean };
    const updated = await adminService.setTrainActiveStatus(
      String(req.params.id),
      Boolean(is_active)
    );
    res.json({ success: true, data: updated });
  })
);

adminRouter.post(
  '/stations',
  asyncHandler(async (req, res) => {
    const created = await adminService.createStation(req.body);
    res.status(201).json({ success: true, data: created });
  })
);

adminRouter.get(
  '/bookings',
  asyncHandler(async (_req, res) => {
    const bookings = await adminService.listAllBookings();
    res.json({ success: true, data: bookings });
  })
);

adminRouter.patch(
  '/bookings/:id',
  asyncHandler(async (req, res) => {
    const { booking_status, chart_prepared } = req.body as {
      booking_status?: Booking['booking_status'];
      chart_prepared?: boolean;
    };
    const updated = await adminService.updateBookingStatus(
      String(req.params.id),
      { booking_status, chart_prepared }
    );
    res.json({ success: true, data: updated });
  })
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await adminService.listUsers();
    res.json({ success: true, data: users });
  })
);

adminRouter.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const { role } = req.body as { role: 'user' | 'admin' };
    const updated = await adminService.updateUserRole(String(req.params.id), role);
    res.json({ success: true, data: updated });
  })
);

adminRouter.get(
  '/messages',
  asyncHandler(async (_req, res) => {
    const messages = await adminService.listContactMessages();
    res.json({ success: true, data: messages });
  })
);

adminRouter.patch(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status: ContactMessage['status'] };
    const updated = await adminService.updateContactMessageStatus(
      String(req.params.id),
      status
    );
    res.json({ success: true, data: updated });
  })
);
