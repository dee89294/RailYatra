/**
 * ============================================================================
 * File: client/src/pages/DashboardPage.tsx
 * Purpose: Personal Passenger Dashboard (`/dashboard`) for Registered Users.
 * Responsibilities:
 *   - Displays personal journey statistics (upcoming trips, total bookings,
 *     total spent, saved co-passengers).
 *   - Highlights the next upcoming train reservation with E-Ticket & Live Track links.
 *   - Allows managing Saved Co-Passengers (`GET/POST/DELETE /api/auth/saved-passengers`),
 *     updating profile info (`PUT /api/auth/profile`), and changing password.
 * Used by: `App.tsx` (route `/dashboard`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  CheckCircle2,
  KeyRound,
  Plus,
  Radio,
  ShieldCheck,
  Ticket,
  Trash2,
  User,
  Users,
  Wallet,
} from 'lucide-react';
import { ETicketModal } from '../components/common/ETicketModal';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { bookingService } from '../services/bookingService';
import type { BookingDetails, SavedPassenger } from '../types';

export const DashboardPage: React.FC = () => {
  const { user, setUser, isAdmin } = useAuth();
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [ticketModal, setTicketModal] = useState<BookingDetails | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [profileMsg, setProfileMsg] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');

  // Saved passenger form state
  const [paxName, setPaxName] = useState('');
  const [paxAge, setPaxAge] = useState(25);
  const [paxGender, setPaxGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [paxBerth, setPaxBerth] = useState('Lower');

  useEffect(() => {
    bookingService.getMyBookings().then(setBookings).catch(() => {});
    authService.listSavedPassengers().then(setSavedPassengers).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhone(user.phone);
    }
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter(
    (b) => b.booking_status !== 'CANCELLED' && b.journey_date >= today
  );
  const nextTrip = upcoming[upcoming.length - 1] || upcoming[0];
  const totalSpent = bookings.reduce(
    (sum, b) => sum + (b.total_amount - b.refund_amount),
    0
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    const res = await authService.updateProfile({ full_name: fullName, phone });
    setUser(res.user);
    setProfileMsg('Profile details saved successfully.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');
    try {
      const res = await authService.changePassword(currentPassword, newPassword);
      setPwdMsg(res.message);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : 'Unable to change password.');
    }
  };

  const handleAddSavedPassenger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paxName.trim()) return;
    const created = await authService.addSavedPassenger({
      full_name: paxName.trim(),
      age: Number(paxAge),
      gender: paxGender,
      berth_preference: paxBerth,
    });
    setSavedPassengers((prev) => [created, ...prev]);
    setPaxName('');
  };

  const handleDeleteSaved = async (id: string) => {
    await authService.deleteSavedPassenger(id);
    setSavedPassengers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Personal Dashboard"
        title={`Namaste, ${user?.full_name || 'Traveler'}`}
        subtitle={`Email: ${user?.email} • Verification Status: ${
          user?.email_verified ? 'Verified' : 'Pending'
        }`}
        rightSlot={
          isAdmin ? (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-rail-navy font-extrabold text-xs shadow-md hover:bg-blue-50"
            >
              <ShieldCheck className="w-4 h-4 text-rail-primary" />
              Open Admin Console
            </Link>
          ) : (
            <Link
              to="/search"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-rail-primary font-extrabold text-xs shadow-md hover:bg-blue-50"
            >
              <Ticket className="w-4 h-4" />
              Book New Ticket
            </Link>
          )
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Upcoming Journeys</span>
              <CalendarCheck className="w-5 h-5 text-rail-primary" />
            </div>
            <div className="text-3xl font-extrabold text-rail-navy mt-2">
              {upcoming.length}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Total Reservations</span>
              <Ticket className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-3xl font-extrabold text-rail-navy mt-2">
              {bookings.length}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Net Travel Spend</span>
              <Wallet className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-3xl font-extrabold text-rail-navy mt-2">
              ₹{totalSpent.toFixed(0)}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase">
              <span>Saved Co-Passengers</span>
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-rail-navy mt-2">
              {savedPassengers.length}
            </div>
          </div>
        </div>

        {/* Next Upcoming Trip Spotlight */}
        {nextTrip && (
          <div className="bg-gradient-to-r from-rail-navy to-rail-royal text-white rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200">
                Next Upcoming Journey
              </span>
              <h2 className="text-2xl font-extrabold mt-1">
                {nextTrip.train?.train_number} &bull; {nextTrip.train?.train_name}
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                {nextTrip.from_station_code} ({nextTrip.departure_time}) →{' '}
                {nextTrip.to_station_code} ({nextTrip.arrival_time}) &bull;{' '}
                <strong>{nextTrip.journey_date}</strong> &bull; PNR:{' '}
                <strong className="tracking-wider">{nextTrip.pnr_number}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setTicketModal(nextTrip)}
                className="px-5 py-2.5 rounded-full bg-white text-rail-navy font-bold text-xs hover:bg-blue-50"
              >
                View E-Ticket
              </button>
              {nextTrip.train && (
                <Link
                  to={`/tracking?train=${nextTrip.train.train_number}`}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white/15 border border-white/25 text-white font-bold text-xs hover:bg-white/25"
                >
                  <Radio className="w-3.5 h-3.5" /> Live Status
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Saved Co-Passengers Master List */}
          <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-extrabold text-rail-navy flex items-center gap-2">
              <Users className="w-5 h-5 text-rail-primary" /> Saved Co-Passengers
            </h2>

            <form
              onSubmit={handleAddSavedPassenger}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-100"
            >
              <input
                type="text"
                required
                value={paxName}
                onChange={(e) => setPaxName(e.target.value)}
                placeholder="Co-passenger name"
                className="sm:col-span-5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium"
              />
              <input
                type="number"
                min={1}
                max={120}
                value={paxAge}
                onChange={(e) => setPaxAge(Number(e.target.value))}
                className="sm:col-span-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              />
              <select
                value={paxGender}
                onChange={(e) =>
                  setPaxGender(e.target.value as 'Male' | 'Female' | 'Other')
                }
                className="sm:col-span-2 px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              >
                <option value="Male">M</option>
                <option value="Female">F</option>
                <option value="Other">O</option>
              </select>
              <select
                value={paxBerth}
                onChange={(e) => setPaxBerth(e.target.value)}
                className="sm:col-span-3 px-2 py-2 rounded-xl border border-slate-200 bg-white text-xs"
              >
                <option value="Lower">Lower</option>
                <option value="Middle">Middle</option>
                <option value="Upper">Upper</option>
                <option value="Window">Window</option>
              </select>
              <button
                type="submit"
                className="sm:col-span-12 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-rail-primary hover:bg-rail-royal text-white text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> Add to Master List
              </button>
            </form>

            <div className="space-y-2">
              {savedPassengers.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Save family or frequent travelers here for 1-click ticket checkout.
                </p>
              ) : (
                savedPassengers.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs"
                  >
                    <div>
                      <span className="font-bold text-rail-navy">{sp.full_name}</span>{' '}
                      <span className="text-slate-500">
                        ({sp.age} yrs, {sp.gender}) &bull; Pref: {sp.berth_preference}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteSaved(sp.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Delete saved passenger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Profile & Security */}
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={handleSaveProfile}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4"
            >
              <h2 className="text-lg font-extrabold text-rail-navy flex items-center gap-2">
                <User className="w-5 h-5 text-rail-primary" /> Profile Information
              </h2>
              {profileMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {profileMsg}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-rail-primary hover:bg-rail-royal text-white text-xs font-bold"
              >
                Save Profile
              </button>
            </form>

            <form
              onSubmit={handleChangePassword}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4"
            >
              <h2 className="text-lg font-extrabold text-rail-navy flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-rail-primary" /> Change Password
              </h2>
              {pwdMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                  {pwdMsg}
                </div>
              )}
              {pwdErr && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold">
                  {pwdErr}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (8+ chars)"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full border border-rail-primary text-rail-primary hover:bg-blue-50 text-xs font-bold"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      </main>

      {ticketModal && (
        <ETicketModal booking={ticketModal} onClose={() => setTicketModal(null)} />
      )}

      <Footer />
    </div>
  );
};
