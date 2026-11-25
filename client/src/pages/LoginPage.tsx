/**
 * ============================================================================
 * File: client/src/pages/LoginPage.tsx
 * Purpose: User & Administrator Sign-In page.
 * Responsibilities:
 *   - Authenticates email & password via `AuthContext.login()` -> `authService.login()`
 *     -> `POST /api/auth/login`.
 *   - Handles `EMAIL_NOT_VERIFIED` cleanly by letting the user resend their
 *     verification email right inside the alert box (showing Dev link if SMTP off).
 *   - Links to Forgot Password (`/reset-password`) and Sign Up (`/signup`).
 * Used by: `App.tsx` (route `/login`).
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, LogIn, Mail } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';
import { authService } from '../services/authService';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendInfo, setResendInfo] = useState<{ message: string; url?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNeedsVerification(false);
    setResendInfo(null);

    try {
      const profile = await login(email, password);
      if (profile.role === 'admin' && returnTo === '/dashboard') {
        navigate('/admin', { replace: true });
      } else {
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
      }
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await authService.resendVerification(email);
      setResendInfo({ message: res.message, url: res.verificationPreviewUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend verification email.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar variant="solid" />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-rail-navy">Welcome Back to RailYatra</h1>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to book tickets, access your e-tickets, or manage your dashboard.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {needsVerification && (
                <button
                  type="button"
                  onClick={handleResend}
                  className="inline-flex items-center gap-1 text-rail-primary underline font-bold"
                >
                  <Mail className="w-3.5 h-3.5" /> Resend Verification Email
                </button>
              )}
            </div>
          )}

          {resendInfo && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{resendInfo.message}</span>
              </div>
              {resendInfo.url && (
                <a
                  href={resendInfo.url}
                  className="block font-bold text-rail-primary underline break-all"
                >
                  Dev Outbox Quick Verify Link →
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-600">Password</label>
                <Link
                  to="/reset-password"
                  className="text-xs font-bold text-rail-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm shadow-md transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Sign In</span>
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            New to RailYatra?{' '}
            <Link to="/signup" className="font-bold text-rail-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};
