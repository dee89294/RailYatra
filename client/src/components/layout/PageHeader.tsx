/**
 * ============================================================================
 * File: client/src/components/layout/PageHeader.tsx
 * Purpose: Reusable inner-page layout header combining Navbar + blue banner.
 * Used by: All inner pages (Search, Schedule, Tracking, PNR, Bookings, Dashboard, Admin, Contact).
 * ============================================================================
 */

import React from 'react';
import { Navbar } from './Navbar';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  rightSlot?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  rightSlot,
}) => {
  return (
    <>
      <Navbar variant="solid" />
      <section className="bg-gradient-to-r from-rail-navy via-rail-royal to-rail-primary text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            {badge && (
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-100 bg-white/15 px-3 py-1 rounded-full mb-2">
                {badge}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-blue-100 text-sm sm:text-base mt-1.5 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {rightSlot && <div>{rightSlot}</div>}
        </div>
      </section>
    </>
  );
};
