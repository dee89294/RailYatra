/**
 * ============================================================================
 * File: client/src/components/common/ProtectedRoute.tsx
 * Purpose: Frontend Route Guard component enforcing Authentication & RBAC.
 * Responsibilities:
 *   - Prevents unauthenticated Guest Users from accessing private routes
 *     (`/dashboard`, `/bookings`, `/book`).
 *   - Redirects non-admin users away from `/admin` with clear authorization guard.
 *   - Preserves intended destination URL in `location.state.from` so users return
 *     to their booking/dashboard immediately after logging in.
 *   - Note: Frontend route guards enhance UX, while Express backend middleware
 *     (`requireAuth`, `requireAdmin`) + Supabase RLS enforce true security!
 * Used by: `App.tsx`.
 * ============================================================================
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { user, isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-rail-primary" />
        <p className="text-sm font-medium">Verifying your RailYatra session...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-card border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-rail-navy">Administrator Access Required</h2>
          <p className="text-sm text-slate-600">
            Your account ({user.email}) has role <span className="font-semibold">Registered User</span>.
            Only Administrator accounts can access the RailYatra Admin Operations Console.
          </p>
          <Navigate to="/dashboard" replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
