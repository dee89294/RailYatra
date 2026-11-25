/**
 * ============================================================================
 * File: client/src/services/authService.ts
 * Purpose: Frontend Authentication & User Profile API client.
 * Responsibilities:
 *   - Communicates with `/api/auth/*` endpoints for signup, email verification,
 *     login, logout, password reset, profile updates, and saved co-passengers.
 * Used by: `context/AuthContext.tsx`, `LoginPage.tsx`, `SignupPage.tsx`,
 *          `VerifyEmailPage.tsx`, `ResetPasswordPage.tsx`, `DashboardPage.tsx`.
 * ============================================================================
 */

import type { DevEmailPreview, SavedPassenger, UserProfile } from '../types';
import { apiRequest } from './apiClient';

export const authService = {
  register(input: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) {
    return apiRequest<{
      message: string;
      email: string;
      requiresVerification: boolean;
      verificationPreviewUrl?: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  verifyEmail(token: string) {
    return apiRequest<{ message: string; user: UserProfile }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  resendVerification(email: string) {
    return apiRequest<{ message: string; verificationPreviewUrl?: string }>(
      '/auth/resend-verification',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  },

  login(email: string, password: string) {
    return apiRequest<{
      user: UserProfile;
      accessToken: string;
      provider: 'supabase' | 'local';
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  forgotPassword(email: string) {
    return apiRequest<{ message: string; resetPreviewUrl?: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      }
    );
  },

  resetPassword(token: string, newPassword: string) {
    return apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  },

  logout() {
    return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
  },

  getMe() {
    return apiRequest<{ user: UserProfile; provider: string }>('/auth/me');
  },

  updateProfile(updates: { full_name: string; phone: string }) {
    return apiRequest<{ user: UserProfile }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  listSavedPassengers() {
    return apiRequest<SavedPassenger[]>('/auth/saved-passengers');
  },

  addSavedPassenger(input: {
    full_name: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    berth_preference: string;
  }) {
    return apiRequest<SavedPassenger>('/auth/saved-passengers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  deleteSavedPassenger(id: string) {
    return apiRequest<{ deleted: boolean }>(`/auth/saved-passengers/${id}`, {
      method: 'DELETE',
    });
  },

  getDevEmails(email?: string) {
    const query = email ? `?email=${encodeURIComponent(email)}` : '';
    return apiRequest<DevEmailPreview[]>(`/auth/dev-emails${query}`);
  },
};
