/**
 * ============================================================================
 * File: client/src/context/AuthContext.tsx
 * Purpose: Global React Authentication Context Provider for RailYatra.
 * Responsibilities:
 *   - Restores an active user session on app boot by validating the stored
 *     JWT against `GET /api/auth/me`.
 *   - Exposes `user`, `isAuthenticated`, `isAdmin`, `isLoading`, `login()`,
 *     `logout()`, and `refreshProfile()` across the entire React component tree.
 *   - Teaches React Context state sharing across Navbar, ProtectedRoute, and pages.
 * Used by: `App.tsx`, `Navbar.tsx`, `ProtectedRoute.tsx`, and authenticated pages.
 * ============================================================================
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AUTH_TOKEN_STORAGE_KEY } from '../services/apiClient';
import { authService } from '../services/authService';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      setUser(res.user);
    } catch {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login(email, password);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on stateless JWT logout
    }
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        isAdmin: user?.role === 'admin',
        login,
        logout,
        refreshProfile,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
