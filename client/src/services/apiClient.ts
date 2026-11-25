/**
 * ============================================================================
 * File: client/src/services/apiClient.ts
 * Purpose: Centralized HTTP communication layer between React frontend & Express API.
 * Responsibilities:
 *   - Prepends `VITE_API_BASE_URL` (defaults to `/api`, proxied by Vite to port 5000).
 *   - Automatically reads the stored session JWT from `localStorage` and attaches
 *     `Authorization: Bearer <token>` on every authenticated request.
 *   - Parses JSON `{ success, data, error, code }` responses consistently and
 *     throws structured `ApiError` objects for clean UI error handling.
 * Used by: All files in `client/src/services/`.
 * ============================================================================
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
export const AUTH_TOKEN_STORAGE_KEY = 'railyatra_access_token';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status = 400, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    error?: string;
    code?: string;
  };

  if (!response.ok || payload.success === false) {
    throw new ApiError(
      payload.error || `Request failed with status ${response.status}`,
      response.status,
      payload.code || 'REQUEST_FAILED'
    );
  }

  return payload.data as T;
}
