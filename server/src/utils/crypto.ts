/**
 * ============================================================================
 * File: server/src/utils/crypto.ts
 * Purpose: Cryptographic helpers for authentication, token generation, and IDs.
 * Responsibilities:
 *   - Password hashing & verification using Node's native `crypto.scryptSync`
 *     with per-user random 16-byte salt and constant-time comparison.
 *   - Compact HMAC-SHA256 JWT signing and verification for local auth sessions.
 *   - Cryptographically random token generation (for email verification & reset)
 *     and SHA-256 hashing before storing tokens in the database.
 *   - Realistic 10-digit Indian Railway PNR & Payment Transaction ID generators.
 * Used by: `services/authService.ts`, `services/bookingService.ts`,
 *          `services/paymentService.ts`, `middleware/authMiddleware.ts`.
 * ============================================================================
 */

import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface LocalJwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  email_verified: boolean;
  iat: number;
  exp: number;
}

/**
 * Hashes a plaintext password using `scrypt` with a unique 16-byte salt.
 * Storing `salt:derivedKey` protects against rainbow table attacks.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies a plaintext password against a stored `salt:hash` string using
 * `crypto.timingSafeEqual` to prevent timing side-channel attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(keyHex, 'hex');
  if (derivedBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(derivedBuffer, storedBuffer);
}

/**
 * Signs an HMAC-SHA256 JSON Web Token (JWT) valid for 7 days.
 * In Supabase mode, Supabase Auth issues and signs JWTs instead.
 */
export function signLocalJwt(
  payload: Omit<LocalJwtPayload, 'iat' | 'exp'>,
  ttlSeconds = 60 * 60 * 24 * 7
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  ).toString('base64url');

  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 JWT and checks expiration.
 * Returns decoded payload if valid, or `null` if tampered/expired.
 */
export function verifyLocalJwt(token: string): LocalJwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', env.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const decoded = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as LocalJwtPayload;

    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Generates a raw random token (sent via email link) and its SHA-256 hash
 * (stored in the database so raw tokens are never stored at rest).
 */
export function createVerificationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates an authentic 10-digit Indian Railway PNR starting with 2, 4, 6, or 8.
 */
export function generatePnrNumber(): string {
  const prefixes = ['2', '4', '6', '8'];
  const prefix = prefixes[crypto.randomInt(0, prefixes.length)];
  let rest = '';
  for (let i = 0; i < 9; i++) {
    rest += String(crypto.randomInt(0, 10));
  }
  return `${prefix}${rest}`;
}

/**
 * Generates a unique payment transaction ID such as `RYPAY20261125849201`.
 */
export function generateTransactionId(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `RYPAY${datePart}${randPart}`;
}
