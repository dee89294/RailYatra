/**
 * ============================================================================
 * File: client/src/components/home/PopularRoutes.tsx
 * Purpose: Featured Indian Railway Corridors & Platform Highlights on HomePage.
 * Responsibilities:
 *   - Offers 1-click quick search shortcuts for India's busiest rail corridors
 *     (Delhi-Varanasi Vande Bharat, Delhi-Mumbai Rajdhani, Mumbai-Ahmedabad, etc.).
 *   - Explains capabilities across Guest Users, Registered Users, and Admins.
 * Used by: `HomePage.tsx`.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Shield, Sparkles } from 'lucide-react';

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const PopularRoutes: React.FC = () => {
  const tomorrow = tomorrowIso();
  const corridors = [
    {
      badge: 'Vande Bharat Express',
      route: 'New Delhi → Varanasi',
      from: 'NDLS',
      to: 'BSB',
      duration: '8h 00m',
      fare: 'From ₹1,750',
      trainNo: '22436',
    },
    {
      badge: 'Tejas Rajdhani',
      route: 'New Delhi → Mumbai Central',
      from: 'NDLS',
      to: 'MMCT',
      duration: '15h 35m',
      fare: 'From ₹2,085',
      trainNo: '12952',
    },
    {
      badge: 'Vande Bharat Express',
      route: 'Mumbai → Ahmedabad',
      from: 'MMCT',
      to: 'ADI',
      duration: '5h 35m',
      fare: 'From ₹1,385',
      trainNo: '20901',
    },
    {
      badge: 'Howrah Rajdhani',
      route: 'New Delhi → Kolkata (Howrah)',
      from: 'NDLS',
      to: 'HWH',
      duration: '17h 00m',
      fare: 'From ₹2,190',
      trainNo: '12302',
    },
  ];

  return (
    <div className="space-y-16">
      {/* Popular Rail Corridors */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-rail-primary">
              Popular Express Corridors
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-rail-navy mt-1">
              Explore Flagship Indian Rail Routes
            </h2>
          </div>
          <Link
            to="/schedule"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-rail-primary hover:text-rail-royal"
          >
            View All Train Schedules <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {corridors.map((c) => (
            <div
              key={c.trainNo}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-card transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-rail-royal">
                    {c.badge}
                  </span>
                  <span className="text-xs font-bold text-slate-400">#{c.trainNo}</span>
                </div>
                <h3 className="text-lg font-extrabold text-rail-navy">{c.route}</h3>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rail-primary" />
                    {c.duration}
                  </span>
                  <span className="font-bold text-emerald-700">{c.fare}</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <Link
                  to={`/search?from=${c.from}&to=${c.to}&date=${tomorrow}&class=ALL&passengers=1`}
                  className="text-xs font-bold text-rail-primary hover:underline"
                >
                  Check Availability →
                </Link>
                <Link
                  to={`/tracking?train=${c.trainNo}`}
                  className="text-xs font-semibold text-slate-500 hover:text-rail-navy"
                >
                  Live Status
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why RailYatra / Role Capabilities Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-rail-navy via-[#0F315C] to-rail-royal rounded-3xl p-8 sm:p-12 text-white shadow-xl">
          <div className="max-w-2xl mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Sparkles className="w-3.5 h-3.5" /> Built for Every Traveler
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-2">
              Fast Reservations, Transparent PNR &amp; Live Running Status
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/15">
              <CheckCircle2 className="w-7 h-7 text-sky-300 mb-3" />
              <h3 className="font-bold text-lg">Instant Guest Tools</h3>
              <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">
                Search trains, inspect complete station timetables, verify 10-digit PNR
                statuses, and track live train locations without creating an account.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/15">
              <Shield className="w-7 h-7 text-emerald-300 mb-3" />
              <h3 className="font-bold text-lg">Verified Passenger Booking</h3>
              <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">
                Sign up with email verification to book up to 6 passengers with berth
                preferences, UPI/Card checkout, printable E-Tickets, and easy refunds.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/15">
              <Clock className="w-7 h-7 text-amber-300 mb-3" />
              <h3 className="font-bold text-lg">Unified Operations Console</h3>
              <p className="text-sm text-blue-100 mt-1.5 leading-relaxed">
                Role-protected Admin portal to manage trains, stations, reservation charts,
                revenue analytics, and passenger support inquiries in real time.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
