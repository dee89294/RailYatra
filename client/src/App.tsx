/**
 * ============================================================================
 * File: client/src/App.tsx
 * Purpose: Root React Router & AuthProvider composition for RailYatra.
 * Responsibilities:
 *   - Wraps the application in `AuthProvider` and `BrowserRouter`.
 *   - Maps public Guest routes (`/`, `/search`, `/schedule`, `/tracking`,
 *     `/pnr`, `/contact`, `/login`, `/signup`, `/verify-email`, `/reset-password`),
 *     protected Registered User routes (`/book`, `/bookings`, `/dashboard`),
 *     and role-protected Administrator route (`/admin`).
 * Used by: `client/src/main.tsx`.
 * ============================================================================
 */

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { BookTicketPage } from './pages/BookTicketPage';
import { ContactPage } from './pages/ContactPage';
import { DashboardPage } from './pages/DashboardPage';
import { HomePage } from './pages/HomePage';
import { LiveTrackingPage } from './pages/LiveTrackingPage';
import { LoginPage } from './pages/LoginPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { PnrStatusPage } from './pages/PnrStatusPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SearchTrainsPage } from './pages/SearchTrainsPage';
import { SignupPage } from './pages/SignupPage';
import { TrainSchedulePage } from './pages/TrainSchedulePage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Guest / Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchTrainsPage />} />
          <Route path="/schedule" element={<TrainSchedulePage />} />
          <Route path="/tracking" element={<LiveTrackingPage />} />
          <Route path="/pnr" element={<PnrStatusPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Authentication & Verification Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Registered & Verified User Protected Routes */}
          <Route
            path="/book"
            element={
              <ProtectedRoute>
                <BookTicketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Administrator Role-Protected Route */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
