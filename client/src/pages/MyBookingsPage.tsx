/**
 * ============================================================================
 * File: client/src/pages/MyBookingsPage.tsx
 * Purpose: Manage Reservations Page (`/bookings`) for Registered Users.
 * Responsibilities:
 *   - Fetches user's reservations via `GET /api/bookings/my` (RLS-scoped).
 *   - Filters bookings across `ALL`, `UPCOMING`, `COMPLETED`, and `CANCELLED`.
 *   - Allows opening Printable E-Ticket Modal, inspecting passenger coach/berth,
 *     and cancelling either individual passengers or the entire booking with instant
 *     refund calculation (`POST /api/bookings/:id/cancel`).
 * Used by: `App.tsx` (route `/bookings`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  Calendar,
  FileText,
  Loader2,
  Radio,
  TrainFront,
} from 'lucide-react';
import { ETicketModal } from '../components/common/ETicketModal';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { bookingService } from '../services/bookingService';
import type { BookingDetails } from '../types';

export const MyBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [selectedTicket, setSelectedTicket] = useState<BookingDetails | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = () => {
    setLoading(true);
    bookingService
      .getMyBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load bookings.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const filtered = bookings.filter((b) => {
    if (tab === 'CANCELLED') return b.booking_status === 'CANCELLED';
    if (tab === 'UPCOMING')
      return b.booking_status !== 'CANCELLED' && b.journey_date >= today;
    if (tab === 'COMPLETED')
      return b.booking_status !== 'CANCELLED' && b.journey_date < today;
    return true;
  });

  const handleCancelBooking = async (bookingId: string, passengerId?: string) => {
    const confirmed = window.confirm(
      passengerId
        ? 'Cancel this passenger from the ticket? 90% of base fare + GST will be refunded.'
        : 'Cancel this entire reservation? 90% of base fare + GST will be refunded.'
    );
    if (!confirmed) return;

    setCancellingId(bookingId);
    try {
      const updated = await bookingService.cancelBooking(
        bookingId,
        passengerId ? [passengerId] : undefined
      );
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Manage Reservations"
        title="My Railway Bookings"
        subtitle="View upcoming journeys, download printable e-tickets, track live running status, or cancel reservations."
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-full text-xs font-extrabold transition-colors ${
                  tab === t
                    ? 'bg-rail-primary text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-rail-primary'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <Link
            to="/search"
            className="px-5 py-2.5 rounded-full bg-rail-navy text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            + Book New Ticket
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rail-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <TrainFront className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-rail-navy">No bookings in this view</h3>
            <p className="text-sm text-slate-500">
              Ready for your next trip? Search trains and book your seat in seconds.
            </p>
            <Link
              to="/search"
              className="inline-block px-5 py-2.5 rounded-full bg-rail-primary text-white text-xs font-bold"
            >
              Search Trains
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-rail-navy text-white text-xs font-extrabold tracking-widest">
                      PNR: {booking.pnr_number}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                        booking.booking_status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : booking.booking_status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {booking.booking_status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-rail-primary" />
                      {booking.journey_date}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(booking)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-50 text-rail-primary hover:bg-blue-100 text-xs font-bold"
                    >
                      <FileText className="w-3.5 h-3.5" /> E-Ticket
                    </button>
                    {booking.train && (
                      <Link
                        to={`/tracking?train=${booking.train.train_number}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 text-slate-700 hover:border-rail-primary text-xs font-bold"
                      >
                        <Radio className="w-3.5 h-3.5 text-rail-primary" /> Track
                      </Link>
                    )}
                    {booking.booking_status !== 'CANCELLED' && (
                      <button
                        type="button"
                        disabled={cancellingId === booking.id}
                        onClick={() => handleCancelBooking(booking.id)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {cancellingId === booking.id ? 'Cancelling...' : 'Cancel Ticket'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-extrabold text-rail-navy">
                        {booking.train?.train_number} &bull; {booking.train?.train_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {booking.from_station_code} ({booking.departure_time || '--'}) →{' '}
                        {booking.to_station_code} ({booking.arrival_time || '--'}) &bull; Class{' '}
                        <strong>{booking.class_code}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-rail-navy">
                        ₹{booking.total_amount.toFixed(2)}
                      </div>
                      {booking.refund_amount > 0 && (
                        <div className="text-xs font-bold text-emerald-700">
                          Refunded: ₹{booking.refund_amount.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Passengers List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {booking.passengers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div>
                          <span className="font-bold text-rail-navy">{p.full_name}</span>{' '}
                          <span className="text-slate-500">
                            ({p.age}/{p.gender[0]})
                          </span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {p.coach && p.seat_number
                              ? `Coach ${p.coach}, Seat ${p.seat_number} (${p.berth_type})`
                              : p.berth_type || '--'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-extrabold px-2 py-0.5 rounded-full ${
                              p.current_status === 'CNF'
                                ? 'bg-emerald-100 text-emerald-700'
                                : p.current_status === 'CAN'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {p.current_status}
                          </span>
                          {p.current_status !== 'CAN' &&
                            booking.passengers.filter((x) => x.current_status !== 'CAN').length >
                              1 && (
                              <button
                                type="button"
                                onClick={() => handleCancelBooking(booking.id, p.id)}
                                className="text-[11px] font-bold text-rose-600 hover:underline"
                              >
                                Cancel
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedTicket && (
        <ETicketModal
          booking={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}

      <Footer />
    </div>
  );
};
