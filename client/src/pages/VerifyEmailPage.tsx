/**
 * ============================================================================
 * File: client/src/pages/VerifyEmailPage.tsx
 * Purpose: Email Address Verification Landing Page (`/verify-email?token=...`).
 * Responsibilities:
 *   - Extracts the verification `token` (or `token_hash`) from URL query parameters.
 *   - Calls `POST /api/auth/verify-email` automatically on mount.
 *   - Displays success confirmation and directs the user to Login.
 * Used by: `App.tsx` (route `/verify-email`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { Navbar } from '../components/layout/Navbar';
import { authService } from '../services/authService';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const token =
    searchParams.get('token') ||
    searchParams.get('token_hash') ||
    hashParams.get('access_token') ||
    '';

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Confirming your RailYatra verification token...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing from the link.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar variant="solid" />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-card border border-slate-100 p-8 text-center space-y-5">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-rail-primary mx-auto" />
              <h1 className="text-xl font-extrabold text-rail-navy">Verifying Email...</h1>
              <p className="text-sm text-slate-500">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-extrabold text-rail-navy">Email Verified!</h1>
              <p className="text-sm text-slate-600">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm transition-colors"
              >
                Continue to Login
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h1 className="text-xl font-extrabold text-rail-navy">Verification Failed</h1>
              <p className="text-sm text-rose-600">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full py-3 rounded-full border border-rail-primary text-rail-primary font-bold text-sm hover:bg-blue-50 transition-colors"
              >
                Back to Login
              </Link>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};
