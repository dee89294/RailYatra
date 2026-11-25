/**
 * ============================================================================
 * File: client/src/components/layout/Navbar.tsx
 * Purpose: Top Navigation Bar for RailYatra matching the brand mockup.
 * Responsibilities:
 *   - Displays the RailYatra circular railway emblem, title, and tagline.
 *   - Supports `variant="hero"` (white logo text over left blue hero wave,
 *     navy nav links over white right panel) and `variant="solid"` (crisp white
 *     sticky header for inner pages).
 *   - Conditionally renders Guest CTAs (`Login`, `Sign Up`) OR authenticated
 *     Registered User / Admin controls (`Dashboard`, `Admin Panel`, `Logout`).
 * Used by: `HomePage.tsx` (`variant="hero"`) and `PageHeader.tsx` / inner pages.
 * ============================================================================
 */

import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  TrainFront,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface NavbarProps {
  variant?: 'hero' | 'solid';
}

export const RailYatraLogo: React.FC<{ light?: boolean }> = ({ light = false }) => (
  <Link to="/" className="flex items-center gap-3 group">
    <div
      className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-105 ${
        light
          ? 'bg-white/15 border-white/80 text-white shadow-md backdrop-blur-sm'
          : 'bg-rail-primary border-rail-royal/20 text-white shadow-sm'
      }`}
    >
      <TrainFront className="w-6 h-6" />
    </div>
    <div className="leading-tight">
      <div
        className={`text-xl font-extrabold tracking-tight ${
          light ? 'text-white' : 'text-rail-navy'
        }`}
      >
        RailYatra
      </div>
      <div
        className={`text-[11px] font-medium ${
          light ? 'text-blue-100' : 'text-slate-500'
        }`}
      >
        Your Journey, Our Priority
      </div>
    </div>
  </Link>
);

export const Navbar: React.FC<NavbarProps> = ({ variant = 'solid' }) => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Home', to: '/' },
    { label: 'Book Tickets', to: '/search' },
    { label: 'Train Schedule', to: '/schedule' },
    { label: 'Live Tracking', to: '/tracking' },
    { label: 'PNR Status', to: '/pnr' },
    { label: 'My Bookings', to: '/bookings' },
    { label: 'Contact Us', to: '/contact' },
  ];

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  const isHero = variant === 'hero';

  return (
    <header
      className={
        isHero
          ? 'relative z-30 w-full'
          : 'sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* On mobile/tablet in hero mode, show dark text if white bg, or light over blue */}
          <div className="lg:hidden">
            <RailYatraLogo light={isHero} />
          </div>
          <div className="hidden lg:block">
            <RailYatraLogo light={isHero} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `relative py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isActive
                      ? 'text-rail-primary'
                      : 'text-slate-700 hover:text-rail-primary'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    {isActive && (
                      <span className="absolute left-0 right-0 -bottom-0.5 h-0.5 bg-rail-primary rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right Auth / User Actions */}
          <div className="hidden lg:flex items-center gap-2.5">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-rail-navy bg-slate-100 hover:bg-blue-50 hover:text-rail-primary transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4 text-rail-primary" />
                  <span>{user.full_name.split(' ')[0]}</span>
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold bg-rail-navy text-white hover:bg-slate-800 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-300" />
                    <span>Admin</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log Out"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-5 py-2 rounded-full text-sm font-semibold border border-rail-primary text-rail-primary bg-white hover:bg-blue-50 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  className="px-5 py-2 rounded-full text-sm font-semibold bg-rail-primary text-white hover:bg-rail-royal shadow-sm transition-colors"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className={`lg:hidden p-2 rounded-xl border ${
              isHero
                ? 'border-white/40 bg-white/90 text-rail-navy'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 shadow-xl px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                  isActive
                    ? 'bg-blue-50 text-rail-primary'
                    : 'text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 rounded-xl bg-blue-50 text-rail-primary text-sm font-semibold"
                >
                  <UserIcon className="w-4 h-4 inline mr-1" />
                  Dashboard
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2.5 rounded-xl bg-rail-navy text-white text-sm font-semibold"
                  >
                    Admin Panel
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold"
                >
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 rounded-xl border border-rail-primary text-rail-primary text-sm font-semibold"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 text-center px-4 py-2.5 rounded-xl bg-rail-primary text-white text-sm font-semibold"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
