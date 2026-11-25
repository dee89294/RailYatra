/**
 * ============================================================================
 * File: server/src/db/supabaseClient.ts
 * Purpose: Initializes Supabase SDK clients for Backend <-> Supabase communication.
 * Responsibilities:
 *   - Provides `supabaseAdmin` (uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS for
 *     trusted administrative operations, PNR public sanitization, and seeding).
 *   - Provides `supabaseAnon` (for public auth actions like signIn / signUp / reset).
 *   - Provides `createSupabaseUserClient(accessToken)` which injects the user's
 *     Bearer JWT so PostgreSQL Row Level Security (RLS) policies enforce ownership
 *     using `auth.uid()` directly inside Supabase!
 * Used by: `db/repository.ts`, `services/authService.ts`, `middleware/authMiddleware.ts`.
 * External service: Supabase Auth & Supabase PostgreSQL (`@supabase/supabase-js`).
 * ============================================================================
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase Admin client (Service Role).
 * IMPORTANT: Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend!
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!env.supabase.configured) {
    throw new Error('Supabase credentials are not configured in server/.env');
  }
  if (!adminClient) {
    adminClient = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

/**
 * Returns a singleton Supabase Anon client for public auth flows (signUp, signInWithPassword).
 */
export function getSupabaseAnon(): SupabaseClient {
  if (!env.supabase.configured) {
    throw new Error('Supabase credentials are not configured in server/.env');
  }
  if (!anonClient) {
    anonClient = createClient(env.supabase.url, env.supabase.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

/**
 * Creates a request-scoped Supabase client carrying a logged-in user's JWT.
 * Every PostgreSQL query executed through this client is automatically filtered
 * by the RLS policies in `supabase/migrations/001_initial_schema.sql`.
 */
export function createSupabaseUserClient(accessToken: string): SupabaseClient {
  if (!env.supabase.configured) {
    throw new Error('Supabase credentials are not configured in server/.env');
  }
  return createClient(env.supabase.url, env.supabase.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
