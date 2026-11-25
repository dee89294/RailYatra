/**
 * ============================================================================
 * File: client/src/components/layout/Footer.tsx
 * Purpose: Consistent site-wide Footer for RailYatra.
 * Responsibilities:
 *   - Provides quick links to core passenger tools (Search, PNR, Schedule,
 *     Live Tracking, Bookings, Support) and displays 24x7 passenger helpline info.
 * Used by: All pages.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, PhoneCall, ShieldCheck } from 'lucide-react';
import { RailYatraLogo } from './Navbar';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-rail-navy text-slate-300 mt-20 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <RailYatraLogo light />
            <p className="text-sm text-slate-400 leading-relaxed">
              Modern, reliable Indian Railway ticket reservation, live running status,
              PNR tracking, and seamless e-ticket management across India.
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              Secured Authentication &amp; RLS Data Protection
            </div>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Passenger Services
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/search" className="hover:text-white transition-colors">
                  Book Train Tickets
                </Link>
              </li>
              <li>
                <Link to="/pnr" className="hover:text-white transition-colors">
                  Check PNR Status
                </Link>
              </li>
              <li>
                <Link to="/schedule" className="hover:text-white transition-colors">
                  Train Time Table &amp; Schedule
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-white transition-colors">
                  Live Train Location
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              Account &amp; Portals
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/dashboard" className="hover:text-white transition-colors">
                  Passenger Dashboard
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="hover:text-white transition-colors">
                  Manage &amp; Cancel Bookings
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Login / Verify Email
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-white transition-colors">
                  Help &amp; Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">
              24x7 RailCare Support
            </h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2.5">
                <PhoneCall className="w-4 h-4 text-rail-primary shrink-0" />
                <span>Helpline: 139 / 1800-111-139</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-rail-primary shrink-0" />
                <span>care@railyatra.in</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rail-primary shrink-0 mt-0.5" />
                <span>Rail Bhavan Digital Hub, New Delhi — 110001</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} RailYatra Indian Railway Reservation System. All rights reserved.</p>
          <p>Built for Indian Rail Travelers &bull; Your Journey, Our Priority.</p>
        </div>
      </div>
    </footer>
  );
};
