/**
 * ============================================================================
 * File: server/src/routes/contactRoutes.ts
 * Purpose: Public Contact Us & Customer Support inquiry submission endpoint.
 * Responsibilities:
 *   - Accepts inquiries from Guest Users and Registered Users (`POST /api/contact`).
 *   - Validates required fields and persists inquiries in `contact_messages`.
 * Used by: `server/src/index.ts`.
 * ============================================================================
 */

import { Router } from 'express';
import { repository } from '../db/repository.js';
import { AppError, asyncHandler } from '../middleware/errorHandler.js';

export const contactRouter = Router();

contactRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email, subject, pnr_reference, message } = req.body as {
      name: string;
      email: string;
      subject: string;
      pnr_reference?: string;
      message: string;
    };

    if (!name?.trim() || !email?.includes('@') || !subject?.trim() || !message?.trim()) {
      throw new AppError(
        'Name, valid email, subject, and message are required.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const saved = await repository.createContactMessage({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      pnr_reference: (pnr_reference || '').trim(),
      message: message.trim(),
    });

    res.status(201).json({ success: true, data: saved });
  })
);
