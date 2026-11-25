/**
 * ============================================================================
 * File: client/src/components/home/HeroSection.tsx
 * Purpose: Signature Landing Page Hero matching the uploaded RailYatra mockup.
 * Responsibilities:
 *   - Combines the integrated `Navbar` (`variant="hero"`), the curved royal-blue
 *     left visual panel showcasing the Vande Bharat Express illustration, and
 *     the crisp right typography block (`YOUR JOURNEY, OUR PRIORITY`,
 *     `BOOK YOUR NEXT JOURNEY`, CTAs `Book Your Ticket` & `Explore Trains`).
 *   - Anchors the floating `TrainSearchWidget` overlapping the bottom edge.
 * Used by: `HomePage.tsx`.
 * ============================================================================
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket, TrainFront } from 'lucide-react';
import { Navbar } from '../layout/Navbar';
import { TrainSearchWidget } from '../common/TrainSearchWidget';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative bg-white overflow-x-clip pb-10">
      {/* Split Hero Backdrop */}
      <div className="relative">
        {/* Left Royal Blue Curved Panel (Desktop) */}
        <div
          className="hidden lg:block absolute inset-y-0 left-0 w-[49%] overflow-hidden pointer-events-none select-none"
          style={{
            borderBottomRightRadius: '180px 120px',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#004FC4] via-[#0662DF] to-[#137CF4]" />
          <img
            src="/images/vande-bharat-hero.jpg"
            alt="Vande Bharat Express High-Speed Train"
            className="w-full h-full object-cover object-right opacity-95"
          />
          {/* Organic white wave overlay on right edge to recreate mockup curve */}
          <svg
            viewBox="0 0 120 600"
            preserveAspectRatio="none"
            className="absolute top-0 right-0 h-full w-24 text-white"
            aria-hidden="true"
          >
            <path
              d="M95,0 C30,140 15,380 85,600 L120,600 L120,0 Z"
              fill="currentColor"
            />
          </svg>
        </div>

        {/* Mobile/Tablet Blue Header Strip */}
        <div className="lg:hidden bg-gradient-to-r from-[#004FC4] to-[#137CF4]">
          <Navbar variant="hero" />
          <div className="px-4 pb-6 pt-2">
            <img
              src="/images/vande-bharat-hero.jpg"
              alt="Vande Bharat Express"
              className="w-full h-52 sm:h-64 object-cover rounded-2xl shadow-lg"
            />
          </div>
        </div>

        {/* Desktop Navbar over Split Background */}
        <div className="hidden lg:block">
          <Navbar variant="hero" />
        </div>

        {/* Hero Copy (Right side on desktop) */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 lg:pt-12 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            <div className="hidden lg:block lg:col-span-6" />
            <div className="lg:col-span-6 lg:pl-12 text-center lg:text-left">
              <p className="text-xs sm:text-sm font-extrabold uppercase tracking-[0.2em] text-rail-primary mb-3">
                Your Journey, Our Priority
              </p>
              <h1 className="text-4xl sm:text-5xl xl:text-[3.45rem] font-extrabold tracking-tight text-rail-navy leading-[1.06]">
                BOOK YOUR <br />
                <span className="text-rail-primary">NEXT JOURNEY</span>
              </h1>
              <p className="mt-4 text-slate-600 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Discover destinations, explore train schedules, and book your railway
                tickets with ease.
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
                <Link
                  to="/search"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all"
                >
                  <Ticket className="w-4 h-4" />
                  <span>Book Your Ticket</span>
                </Link>
                <Link
                  to="/schedule"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border-2 border-slate-200 hover:border-rail-primary bg-white text-rail-navy hover:text-rail-primary font-bold text-sm transition-all"
                >
                  <TrainFront className="w-4 h-4 text-rail-primary" />
                  <span>Explore Trains</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Search Widget overlapping bottom of Hero */}
      <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 lg:-mt-14">
        <TrainSearchWidget />
      </div>
    </section>
  );
};
