/**
 * ============================================================================
 * File: server/src/index.ts
 * Purpose: Main Express Backend API entry point for RailYatra.
 * Responsibilities:
 *   - Configures security headers (`helmet`), CORS (`CLIENT_URL`), and JSON body parsing.
 *   - Initializes local SQLite database on startup if running in `local` mode.
 *   - Mounts all modular API routers (`/api/auth`, `/api/trains`, `/api/stations`,
 *     `/api/bookings`, `/api/pnr`, `/api/tracking`, `/api/payments`, `/api/admin`, `/api/contact`).
 *   - Exposes `/api/health` for diagnostics and registers the global `errorHandler`.
 * Used by: `npm run dev:server`, `npm start`, and automated tests.
 * ============================================================================
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { getSqliteDb } from './db/sqliteClient.js';
import { errorHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/adminRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { bookingRouter } from './routes/bookingRoutes.js';
import { contactRouter } from './routes/contactRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { pnrRouter } from './routes/pnrRoutes.js';
import { trackingRouter } from './routes/trackingRoutes.js';
import { trainRouter } from './routes/trainRoutes.js';

export function createApp() {
  if (env.provider === 'local') {
    getSqliteDb();
  }

  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  // System health & configuration introspection (never leaks secret keys)
  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'RailYatra API',
        status: 'healthy',
        provider: env.provider,
        smtpConfigured: env.smtp.configured,
        railcoreConfigured: env.railcore.configured,
        railwayApiConfigured: env.railwayApi.configured,
        checks: {
          supabaseUrl: Boolean(env.supabase.url),
          supabaseAnonKey: Boolean(env.supabase.anonKey),
          supabaseServiceRoleKey: Boolean(env.supabase.serviceRoleKey),
          smtpHost: Boolean(env.smtp.host),
          smtpUser: Boolean(env.smtp.user),
          smtpPass: Boolean(env.smtp.pass),
        },
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', trainRouter);
  app.use('/api/bookings', bookingRouter);
  app.use('/api/pnr', pnrRouter);
  app.use('/api/tracking', trackingRouter);
  app.use('/api/payments', paymentRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/contact', contactRouter);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found.',
      code: 'ENDPOINT_NOT_FOUND',
    });
  });

  app.use(errorHandler);
  return app;
}

const isMainModule =
  !process.env.VERCEL &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  const app = createApp();
  app.listen(env.port, () => {
    console.log(
      `\n[RailYatra API] Server listening on http://localhost:${env.port} (Mode: ${env.provider.toUpperCase()})`
    );
  });
}
