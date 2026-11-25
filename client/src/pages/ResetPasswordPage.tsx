/**
 * ============================================================================
 * File: client/src/pages/ResetPasswordPage.tsx
 * Purpose: Forgot Password & Reset Password workflow page.
 * Responsibilities:
 *   - If URL has `?token=...`, displays the Set New Password form (`POST /api/auth/reset-password`).
 *   - Otherwise, displays the Request Reset Link form (`POST /api/auth/forgot-password`).
 * Used by: `App.tsx` (route `/reset-password`).
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { authService } from '../services/authService';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token =
    searchParams.get('token') ||
    hashParams.get('access_token') ||
    '';

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authService.forgotPassword(email);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authService.resetPassword(token, newPassword);
      setSuccessMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar variant="solid" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-rail-primary flex items-center justify-center mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-rail-navy">
              {token ? 'Choose a New Password' : 'Reset Your Password'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {token
                ? 'Enter a new strong password for your RailYatra account.'
                : 'Enter your registered email address to receive a password reset link.'}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-3 rounded-full bg-rail-primary text-white font-bold text-sm"
              >
                Back to Login
              </Link>
            </div>
          ) : token ? (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  New Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Update Password'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Send Reset Instructions'
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};
