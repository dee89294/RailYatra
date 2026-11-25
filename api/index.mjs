/**
 * ============================================================================
 * File: api/index.mjs
 * Purpose: Vercel Serverless Function entrypoint for the RailYatra Express API.
 * Responsibilities:
 *   - Imports `createApp()` from the compiled Express bundle (`server/dist/index.js`
 *     built during Vercel's `buildCommand`) so every `/api/*` request executes
 *     through our full Express router stack on Vercel without `app.listen()`.
 * Used by: Vercel runtime via `vercel.json` rewrites (`/api/(.*)` -> `/api`).
 * ============================================================================
 */

import { createApp } from '../server/dist/index.js';

const app = createApp();

export default app;
