/**
 * ============================================================================
 * File: client/src/pages/PnrStatusPage.tsx
 * Purpose: 10-Digit PNR Reservation Status Checker (available to Guest & Logged-in Users).
 * Responsibilities:
 *   - Accepts a 10-digit PNR number and queries `GET /api/pnr/:pnrNumber`.
 *   - Provides quick-test buttons for seeded sample PNRs (`4528193047`, `8192045612`).
 *   - Displays train details, chart status, and current booking/berth statuses
 *     for every passenger on the reservation.
 * Used by: `App.tsx` (route `/pnr`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, Search, TicketCheck } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { trainService } from '../services/trainService';
import type { BookingDetails } from '../types';

export const PnrStatusPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pnrInput, setPnrInput] = useState(searchParams.get('pnr') || '');
  const [result, setResult] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async (pnr: string) => {
    if (!pnr.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await trainService.checkPnrStatus(pnr.trim());
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Unable to check PNR status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const pnrParam = searchParams.get('pnr');
    if (pnrParam) {
      setPnrInput(pnrParam);
      void lookup(pnrParam);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ pnr: pnrInput.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Instant PNR Enquiry"
        title="Check PNR Status"
        subtitle="Enter your 10-digit Passenger Name Record (PNR) number to verify seat confirmation, coach, berth, and chart preparation."
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-card border border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <TicketCheck className="w-5 h-5 text-rail-primary absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              maxLength={10}
              value={pnrInput}
              onChange={(e) => setPnrInput(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 10-digit PNR number (e.g., 4528193047)"
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary text-base font-extrabold tracking-widest text-rail-navy"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Check Status</span>
          </button>
        </form>

        {/* Sample PNRs for easy testing */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-500">Sample PNRs to test:</span>
          {['4528193047', '8192045612', '6390174825'].map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => setSearchParams({ pnr: sample })}
              className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-rail-primary font-bold text-rail-navy transition-colors"
            >
              {sample}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-rail-navy to-rail-royal text-white px-6 py-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-blue-200 font-bold">
                  PNR Status Report
                </div>
                <div className="text-2xl font-extrabold tracking-widest mt-0.5">
                  {result.pnr_number}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/15 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  {result.booking_status}
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-xs font-semibold">
                  {result.chart_prepared ? 'Chart Prepared' : 'Chart Not Prepared'}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400">Train</span>
                  <div className="text-sm font-extrabold text-rail-navy mt-0.5">
                    {result.train?.train_number} &bull; {result.train?.train_name}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400">Journey</span>
                  <div className="text-sm font-extrabold text-rail-navy mt-0.5">
                    {result.from_station_code} ({result.departure_time || '--'}) →{' '}
                    {result.to_station_code} ({result.arrival_time || '--'})
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400">
                    Date &amp; Class
                  </span>
                  <div className="text-sm font-extrabold text-rail-navy mt-0.5">
                    {result.journey_date} &bull; Class {result.class_code} ({result.quota})
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Passenger Berth &amp; Confirmation Details
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Passenger Name</th>
                        <th className="px-4 py-3">Age / Gender</th>
                        <th className="px-4 py-3">Current Status</th>
                        <th className="px-4 py-3">Coach / Seat / Berth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.passengers.map((p, idx) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-rail-navy">{p.full_name}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {p.age} / {p.gender}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                                p.current_status === 'CNF'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : p.current_status === 'CAN'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {p.current_status}
                              {p.waitlist_position ? ` #${p.waitlist_position}` : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {p.coach && p.seat_number
                              ? `${p.coach} / ${p.seat_number} (${p.berth_type})`
                              : p.berth_type || '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
