/**
 * ============================================================================
 * File: client/src/components/home/QuickActions.tsx
 * Purpose: Three primary Quick Action Feature Cards below the Search Widget
 *          matching the RailYatra mockup (plus direct Live Tracking access).
 * Used by: `HomePage.tsx`.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CalendarClock, Radio, TicketCheck } from 'lucide-react';

export const QuickActions: React.FC = () => {
  const cards = [
    {
      title: 'Check PNR Status',
      description: 'Track your booking.',
      to: '/pnr',
      icon: TicketCheck,
    },
    {
      title: 'Train Schedule',
      description: 'Find train timings.',
      to: '/schedule',
      icon: CalendarClock,
    },
    {
      title: 'Manage Booking',
      description: 'View or cancel tickets.',
      to: '/bookings',
      icon: Briefcase,
    },
    {
      title: 'Live Train Status',
      description: 'Real-time train location.',
      to: '/tracking',
      icon: Radio,
    },
  ];

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 mb-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-card hover:border-blue-100 p-5 flex items-center gap-4 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-rail-primary group-hover:bg-rail-royal text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-rail-navy group-hover:text-rail-primary transition-colors">
                  {card.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
