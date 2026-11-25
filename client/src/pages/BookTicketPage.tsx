/**
 * ============================================================================
 * File: client/src/pages/BookTicketPage.tsx
 * Purpose: Complete Multi-Passenger Ticket Reservation & Payment Checkout page.
 * Responsibilities:
 *   - Protected by `ProtectedRoute` (requires authenticated & verified user).
 *   - Loads dynamic itemized fare quote (`GET /api/bookings/quote`) and user's
 *     saved co-passengers (`GET /api/auth/saved-passengers`) for 1-click autofill.
 *   - Supports adding/removing 1–6 passengers with Berth Preferences.
 *   - Integrates interactive Payment Gateway section (UPI, Debit/Credit Card,
 *     NetBanking, RailYatra Wallet) and creates booking (`POST /api/bookings`).
 *   - Displays instant PNR Confirmation + opens printable E-Ticket modal.
 * Used by: `App.tsx` (route `/book`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { ETicketModal } from '../components/common/ETicketModal';
import { QUOTA_OPTIONS } from '../components/common/TrainSearchWidget';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { bookingService, type FareQuoteResponse } from '../services/bookingService';
import type {
  BookingDetails,
  ClassCode,
  PaymentMethod,
  QuotaCode,
  SavedPassenger,
} from '../types';

interface PassengerDraft {
  full_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  berth_preference: string;
}

export const BookTicketPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const trainNumber = searchParams.get('train') || '22436';
  const from = searchParams.get('from') || 'NDLS';
  const to = searchParams.get('to') || 'BSB';
  const date =
    searchParams.get('date') ||
    new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const classCode = (searchParams.get('class') || 'CC') as ClassCode;
  const initialQuota = ((searchParams.get('quota') || 'GN').toUpperCase() as QuotaCode);
  const initialCount = Math.min(6, Math.max(1, Number(searchParams.get('passengers') || 1)));

  const [quota, setQuota] = useState<QuotaCode>(initialQuota);
  const [passengers, setPassengers] = useState<PassengerDraft[]>(() =>
    Array.from({ length: initialCount }, (_, idx) => ({
      full_name: idx === 0 && user ? user.full_name : '',
      age: 28,
      gender: 'Male',
      berth_preference: 'No Preference',
    }))
  );
  const [savedPassengers, setSavedPassengers] = useState<SavedPassenger[]>([]);
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '+91 98765 43210');

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [upiId, setUpiId] = useState('arjun@okicici');
  const [cardNumber, setCardNumber] = useState('4532 8810 4421 9012');
  const [bankName, setBankName] = useState('State Bank of India');

  const [quoteData, setQuoteData] = useState<FareQuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<BookingDetails | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  useEffect(() => {
    authService
      .listSavedPassengers()
      .then(setSavedPassengers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoadingQuote(true);
    setError('');
    bookingService
      .getFareQuote({
        trainNumber,
        from,
        to,
        classCode,
        passengers: passengers.length,
        quota,
        date,
      })
      .then(setQuoteData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Unable to fetch fare quote.')
      )
      .finally(() => setLoadingQuote(false));
  }, [trainNumber, from, to, classCode, passengers.length, quota, date]);

  const addPassenger = () => {
    if (passengers.length >= 6) return;
    setPassengers((prev) => [
      ...prev,
      { full_name: '', age: 25, gender: 'Female', berth_preference: 'No Preference' },
    ]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length <= 1) return;
    setPassengers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updatePassenger = (
    index: number,
    field: keyof PassengerDraft,
    value: string | number
  ) => {
    setPassengers((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, [field]: value } : p))
    );
  };

  const applySavedPassenger = (saved: SavedPassenger) => {
    const emptyIdx = passengers.findIndex((p) => !p.full_name.trim());
    if (emptyIdx !== -1) {
      setPassengers((prev) =>
        prev.map((p, idx) =>
          idx === emptyIdx
            ? {
                full_name: saved.full_name,
                age: saved.age,
                gender: saved.gender,
                berth_preference: saved.berth_preference,
              }
            : p
        )
      );
      return;
    }
    if (passengers.length < 6) {
      setPassengers((prev) => [
        ...prev,
        {
          full_name: saved.full_name,
          age: saved.age,
          gender: saved.gender,
          berth_preference: saved.berth_preference,
        },
      ]);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const booking = await bookingService.createBooking({
        trainNumber,
        fromStationCode: from,
        toStationCode: to,
        journeyDate: date,
        classCode,
        quota,
        contactEmail,
        contactPhone,
        passengers,
        paymentMethod,
        upiId,
        cardNumber,
        bankName,
      });
      setConfirmedBooking(booking);
      setShowTicketModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const berthOptions =
    classCode === 'CC' || classCode === 'EC' || classCode === '2S'
      ? ['No Preference', 'Window', 'Aisle', 'Middle']
      : ['No Preference', 'Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper'];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Secure Checkout"
        title={
          quoteData
            ? `${quoteData.train.train_number} ${quoteData.train.train_name}`
            : `Book Train ${trainNumber}`
        }
        subtitle={`${from} → ${to} • ${date} • Class ${classCode}`}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {confirmedBooking ? (
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-emerald-200 shadow-card p-8 text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-700">
                Reservation Confirmed
              </span>
              <h2 className="text-2xl font-extrabold text-rail-navy mt-1">
                PNR: {confirmedBooking.pnr_number}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Your ticket for {confirmedBooking.passengers.length} passenger(s) is{' '}
                <strong>{confirmedBooking.booking_status}</strong>.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTicketModal(true)}
                className="px-6 py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm"
              >
                View / Print E-Ticket
              </button>
              <Link
                to="/bookings"
                className="px-6 py-3 rounded-full border border-slate-200 hover:border-rail-primary text-rail-navy font-bold text-sm"
              >
                Go to My Bookings
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Passengers & Payment */}
            <div className="lg:col-span-8 space-y-6">
              {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Saved Co-Passengers Quick Fill */}
              {savedPassengers.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
                  <div className="text-xs font-extrabold text-rail-royal flex items-center gap-1.5 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5" /> Quick-Add Saved Co-Passengers
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {savedPassengers.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => applySavedPassenger(sp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-blue-200 hover:border-rail-primary text-xs font-bold text-rail-navy"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-rail-primary" />
                        {sp.full_name} ({sp.age})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Passenger Form Cards */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-rail-navy">
                    Passenger Details ({passengers.length}/6)
                  </h2>
                  {passengers.length < 6 && (
                    <button
                      type="button"
                      onClick={addPassenger}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-50 text-rail-primary hover:bg-blue-100 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-4 h-4" /> Add Passenger
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {passengers.map((pax, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-rail-royal">
                          Passenger #{idx + 1}
                        </span>
                        {passengers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePassenger(idx)}
                            className="text-xs font-bold text-rose-600 hover:underline inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={pax.full_name}
                            onChange={(e) =>
                              updatePassenger(idx, 'full_name', e.target.value)
                            }
                            placeholder="As per Govt ID"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Age
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={120}
                            required
                            value={pax.age}
                            onChange={(e) =>
                              updatePassenger(idx, 'age', Number(e.target.value))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Gender
                          </label>
                          <select
                            value={pax.gender}
                            onChange={(e) =>
                              updatePassenger(
                                idx,
                                'gender',
                                e.target.value as PassengerDraft['gender']
                              )
                            }
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Berth Preference
                          </label>
                          <select
                            value={pax.berth_preference}
                            onChange={(e) =>
                              updatePassenger(idx, 'berth_preference', e.target.value)
                            }
                            className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium"
                          >
                            {berthOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-extrabold text-rail-navy">
                  Ticket Delivery Contact
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      E-Ticket Email
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      SMS Mobile Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Gateway Section */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-extrabold text-rail-navy flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-rail-primary" /> Payment Method
                  </h2>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" /> 256-Bit Encrypted Checkout
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {(['UPI', 'CARD', 'NETBANKING', 'WALLET'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all ${
                        paymentMethod === m
                          ? 'bg-rail-primary text-white border-rail-primary shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-rail-primary'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'UPI' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      required
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="yourname@okicici"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}

                {paymentMethod === 'CARD' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Debit / Credit Card Number
                    </label>
                    <input
                      type="text"
                      required
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                )}

                {paymentMethod === 'NETBANKING' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Select Bank
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                    >
                      <option value="State Bank of India">State Bank of India</option>
                      <option value="HDFC Bank">HDFC Bank</option>
                      <option value="ICICI Bank">ICICI Bank</option>
                      <option value="Axis Bank">Axis Bank</option>
                    </select>
                  </div>
                )}

                {paymentMethod === 'WALLET' && (
                  <p className="text-xs text-slate-500">
                    Pay instantaneously using your pre-verified RailYatra Wallet balance.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Sticky Fare Summary */}
            <div className="lg:col-span-4">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-card sticky top-24 space-y-5">
                <h3 className="text-lg font-extrabold text-rail-navy border-b border-slate-100 pb-3">
                  Fare Summary
                </h3>

                {loadingQuote ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-rail-primary" />
                  </div>
                ) : quoteData ? (
                  <>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>Boarding</span>
                        <strong className="text-rail-navy">
                          {from} ({quoteData.fromStop.departure_time})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Destination</span>
                        <strong className="text-rail-navy">
                          {to} ({quoteData.toStop.arrival_time})
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Travel Class</span>
                        <strong className="text-rail-navy">
                          {quoteData.trainClass.class_name} ({classCode})
                        </strong>
                      </div>
                      <div className="pt-1">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">
                          Reservation Quota
                        </label>
                        <select
                          value={quota}
                          onChange={(e) => setQuota(e.target.value as QuotaCode)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-rail-navy"
                        >
                          {QUOTA_OPTIONS.map((q) => (
                            <option key={q.code} value={q.code}>
                              {q.label} ({q.code})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {quoteData.quotaNote && (
                      <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-rail-navy leading-relaxed">
                        {quoteData.quotaNote}
                      </div>
                    )}

                    <div className="border-t border-dashed border-slate-200 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>
                          Base Fare ({passengers.length} &times; ₹
                          {quoteData.quote.perPassengerBaseFare})
                        </span>
                        <span className="font-semibold">
                          ₹{quoteData.quote.baseFareTotal.toFixed(2)}
                        </span>
                      </div>
                      {quoteData.quote.tatkalChargeTotal > 0 && (
                        <div className="flex justify-between text-amber-700 font-semibold">
                          <span>
                            {quota === 'PT' ? 'Premium Tatkal Surge' : 'Tatkal Surcharge'} (
                            {passengers.length} &times; ₹
                            {quoteData.quote.perPassengerTatkalCharge})
                          </span>
                          <span>₹{quoteData.quote.tatkalChargeTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>GST (5% AC)</span>
                        <span className="font-semibold">
                          ₹{quoteData.quote.gstAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Convenience Fee</span>
                        <span className="font-semibold">
                          ₹{quoteData.quote.convenienceFee.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-3 border-t border-slate-200 text-lg font-extrabold text-rail-navy">
                        <span>Total Payable</span>
                        <span className="text-rail-primary">
                          ₹{quoteData.quote.totalAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3.5 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-extrabold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Processing Payment...
                        </>
                      ) : (
                        <>Pay ₹{quoteData.quote.totalAmount.toFixed(2)} &amp; Confirm Ticket</>
                      )}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </form>
        )}
      </main>

      {showTicketModal && confirmedBooking && (
        <ETicketModal
          booking={confirmedBooking}
          onClose={() => setShowTicketModal(false)}
        />
      )}

      <Footer />
    </div>
  );
};
