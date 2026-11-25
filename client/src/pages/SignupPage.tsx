/**
 * ============================================================================
 * File: client/src/pages/SignupPage.tsx
 * Purpose: New Passenger Registration & Email Verification onboarding page.
 * Responsibilities:
 *   - Submits user details to `POST /api/auth/register`.
 *   - Creates the auth user + matching `profiles` record on the backend.
 *   - Instructs the user to check their email inbox (and in dev mode when SMTP
 *     isn't configured, renders a convenient Dev Outbox verification link!).
 * Used by: `App.tsx` (route `/signup`).
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, MailCheck, UserPlus } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { authService } from '../services/authService';

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    message: string;
    email: string;
    verificationPreviewUrl?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authService.register({ fullName, email, phone, password });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
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
            <h1 className="text-2xl font-extrabold text-rail-navy">Create RailYatra Account</h1>
            <p className="text-sm text-slate-500 mt-1">
              Register once to book railway tickets, save co-passengers, and download e-tickets.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2.5">
                <div className="flex items-center gap-2 font-extrabold text-sm">
                  <MailCheck className="w-5 h-5 text-emerald-600" />
                  <span>Verification Email Dispatched!</span>
                </div>
                <p className="text-xs leading-relaxed">{result.message}</p>
                {result.verificationPreviewUrl && (
                  <div className="pt-2 border-t border-emerald-200">
                    <div className="text-[11px] font-bold uppercase text-emerald-700 mb-1">
                      Dev Email Outbox (No SMTP Configured)
                    </div>
                    <a
                      href={result.verificationPreviewUrl}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Click to Verify Email Now
                    </a>
                  </div>
                )}
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-3 rounded-full border border-rail-primary text-rail-primary font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Kavya Deshmukh"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="kavya@example.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Password (min. 8 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm shadow-md transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Sign Up &amp; Verify Email</span>
              </button>
            </form>
          )}

          <p className="text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-bold text-rail-primary hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
};
