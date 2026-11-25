/**
 * ============================================================================
 * File: server/src/config/env.ts
 * Purpose: Centralized, validated environment configuration loader.
 * Responsibilities:
 *   - Loads `.env` variables via `dotenv`.
 *   - Determines the active backend persistence/auth provider (`supabase` vs `local`)
 *     based on `DATA_PROVIDER` and whether Supabase credentials are present.
 *   - Exposes SMTP, External Railway API, CORS, and JWT settings with safe defaults.
 * Used by: `index.ts`, `db/supabaseClient.ts`, `services/authService.ts`,
 *          `services/emailService.ts`, `services/railwayApiService.ts`.
 * External services read: `.env` file (`SUPABASE_*`, `SMTP_*`, `RAILWAY_API_*`).
 * ============================================================================
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env relative to server root regardless of current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();
const supabaseServiceRoleKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  ''
).trim();

const requestedMode = (process.env.DATA_PROVIDER || 'auto').toLowerCase();
const hasSupabaseCredentials = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey
);

/**
 * Learning Note:
 * Why support both "supabase" and "local" modes?
 * - When `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
 *   are set in `.env`, RailYatra runs against real Supabase Auth & PostgreSQL.
 * - When developing locally without cloud keys yet, it automatically falls back
 *   to built-in SQLite (`server/data/railyatra.db`) with matching relational tables.
 */
const activeProvider: 'supabase' | 'local' =
  requestedMode === 'supabase'
    ? 'supabase'
    : requestedMode === 'local'
      ? 'local'
      : hasSupabaseCredentials
        ? 'supabase'
        : 'local';

if (requestedMode === 'supabase' && !hasSupabaseCredentials) {
  console.warn(
    '[RailYatra Config] DATA_PROVIDER=supabase was requested, but SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to local SQLite mode.'
  );
}

const vercelProductionUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
const vercelPreviewUrl = (process.env.VERCEL_URL || '').trim();
const vercelBranchUrl = (process.env.VERCEL_BRANCH_URL || '').trim();

const explicitClientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const defaultClientUrl = vercelProductionUrl
  ? `https://${vercelProductionUrl}`
  : vercelPreviewUrl
    ? `https://${vercelPreviewUrl}`
    : 'http://localhost:5173';

const allowedOrigins = Array.from(
  new Set([
    ...explicitClientUrls,
    defaultClientUrl,
    ...(vercelProductionUrl ? [`https://${vercelProductionUrl}`] : []),
    ...(vercelPreviewUrl ? [`https://${vercelPreviewUrl}`] : []),
    ...(vercelBranchUrl ? [`https://${vercelBranchUrl}`] : []),
  ])
);

export const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: (explicitClientUrls[0] || defaultClientUrl).replace(/\/$/, ''),
  allowedOrigins,
  jwtSecret:
    process.env.JWT_SECRET || 'railyatra-dev-secret-change-in-production-2026',

  provider:
    requestedMode === 'supabase' && !hasSupabaseCredentials
      ? ('local' as const)
      : activeProvider,

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceRoleKey,
    configured: hasSupabaseCredentials,
  },

  smtp: {
    host: (process.env.SMTP_HOST || '').trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim(),
    from: process.env.SMTP_FROM || 'RailYatra Support <no-reply@railyatra.in>',
    configured: Boolean(
      (process.env.SMTP_HOST || '').trim() &&
        (process.env.SMTP_USER || '').trim() &&
        (process.env.SMTP_PASS || '').trim()
    ),
  },

  railcore: {
    url: (process.env.RAILCORE_API_URL || 'https://ir.railcore.tech').replace(/\/$/, ''),
    key: (process.env.RAILCORE_API_KEY || '').trim(),
    configured: Boolean((process.env.RAILCORE_API_KEY || '').trim()),
  },

  railwayApi: {
    url: (process.env.RAILWAY_API_URL || '').trim(),
    key: (process.env.RAILWAY_API_KEY || '').trim(),
    host: (process.env.RAILWAY_API_HOST || '').trim(),
    configured: Boolean(
      (process.env.RAILWAY_API_URL || '').trim() &&
        (process.env.RAILWAY_API_KEY || '').trim()
    ),
  },
};
