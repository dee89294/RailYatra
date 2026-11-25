/**
 * ============================================================================
 * File: client/src/pages/HomePage.tsx
 * Purpose: Primary Landing Page of RailYatra matching the UI mockup.
 * Responsibilities:
 *   - Composes `HeroSection`, `QuickActions`, `PopularRoutes`, and `Footer`.
 * Used by: `App.tsx` (route `/`).
 * ============================================================================
 */

import React from 'react';
import { Footer } from '../components/layout/Footer';
import { HeroSection } from '../components/home/HeroSection';
import { PopularRoutes } from '../components/home/PopularRoutes';
import { QuickActions } from '../components/home/QuickActions';

export const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1">
        <HeroSection />
        <QuickActions />
        <PopularRoutes />
      </main>
      <Footer />
    </div>
  );
};
