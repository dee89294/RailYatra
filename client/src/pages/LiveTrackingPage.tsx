/**
 * ============================================================================
 * File: client/src/pages/LiveTrackingPage.tsx
 * Purpose: Real-Time Live Train Location & Running Status Tracker.
 * Responsibilities:
 *   - Calls `GET /api/tracking/:trainNumber` (which queries external Indian
 *     Railway APIs when configured, or uses schedule-synchronized live status).
 *   - Displays visual route progress bar, delay badge, current station, next
 *     station, platform estimates, and quick-pick flagship train chips.
 * Used by: `App.tsx` (route `/tracking`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Navigation,
  Radio,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { trainService } from '../services/trainService';
import type { LiveTrackingResponse } from '../types';

export const LiveTrackingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trainInput, setTrainInput] = useState(searchParams.get('train') || '22436');
  const [tracking, setTracking] = useState<LiveTrackingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async (trainNo: string) => {
    if (!trainNo.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await trainService.getLiveTracking(trainNo.trim());
      setTracking(res);
    } catch (err) {
      setTracking(null);
      setError(err instanceof Error ? err.message : 'Unable to load live status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get('train') || '22436';
    setTrainInput(initial);
    void fetchStatus(initial);
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ train: trainInput.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Live Running Status"
        title="Track Live Train Location"
        subtitle="Check real-time train position, current halt, expected platform, and running delay across Indian Railways."
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Search Box */}
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-3xl shadow-card border border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-rail-primary absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={trainInput}
              onChange={(e) => setTrainInput(e.target.value)}
              placeholder="Enter 5-digit Train Number (e.g., 22436, 12952, 12302, 20901)..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary text-sm font-bold text-rail-navy"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
            <span>Track Train</span>
          </button>
        </form>

        {/* Quick-Pick Flagship Trains */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-500">Quick Track:</span>
          {[
            { num: '22436', label: '22436 Varanasi Vande Bharat' },
            { num: '12952', label: '12952 Mumbai Rajdhani' },
            { num: '12302', label: '12302 Howrah Rajdhani' },
            { num: '20901', label: '20901 Ahmedabad Vande Bharat' },
            { num: '12622', label: '12622 Tamil Nadu Exp' },
          ].map((t) => (
            <button
              key={t.num}
              type="button"
              onClick={() => setSearchParams({ train: t.num })}
              className={`px-3 py-1.5 rounded-full font-semibold border transition-colors ${
                tracking?.train_number === t.num
                  ? 'bg-rail-primary text-white border-rail-primary'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-rail-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold">{error}</span>
          </div>
        )}

        {tracking && (
          <div className="mt-6 space-y-6">
            {/* Live Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-rail-navy text-white text-xs font-extrabold">
                      #{tracking.train_number}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-rail-primary">
                      <span className="w-2 h-2 rounded-full bg-rail-primary animate-pulse" />
                      {tracking.data_source === 'RAILCORE_LIVE'
                        ? 'RailCore Live Feed'
                        : tracking.data_source === 'EXTERNAL_API'
                          ? 'External Railway Feed'
                          : 'Live Schedule Telemetry'}
                    </span>
                    {tracking.speed_kmph !== undefined && tracking.speed_kmph > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        {tracking.speed_kmph} km/h
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-extrabold text-rail-navy mt-2">
                    {tracking.train_name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Route: {tracking.source} → {tracking.destination} &bull;{' '}
                    {tracking.status_text ? `${tracking.status_text} • ` : ''}
                    Updated {new Date(tracking.last_updated).toLocaleTimeString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`px-4 py-2 rounded-2xl text-xs font-extrabold ${
                      tracking.delay_minutes === 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {tracking.delay_minutes === 0
                      ? 'Running On Time'
                      : `Delayed by ${tracking.delay_minutes} mins`}
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchStatus(tracking.train_number)}
                    title="Refresh live status"
                    className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Position + Progress Bar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-5">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                  <span className="text-[11px] font-bold uppercase text-rail-primary">
                    Current / Last Passed Station
                  </span>
                  <div className="text-lg font-extrabold text-rail-navy mt-1">
                    {tracking.current_station_name} ({tracking.current_station_code})
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Next Upcoming Stop
                  </span>
                  <div className="text-lg font-extrabold text-rail-navy mt-1">
                    {tracking.next_station_name
                      ? `${tracking.next_station_name} (${tracking.next_station_code})`
                      : 'Final Destination Reached'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase text-slate-500">
                    Distance Covered
                  </span>
                  <div className="text-lg font-extrabold text-rail-navy mt-1">
                    {tracking.distance_covered_km} / {tracking.total_distance_km} km (
                    {tracking.progress_percent}%)
                  </div>
                </div>
              </div>

              <div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rail-royal to-rail-primary rounded-full transition-all duration-500"
                    style={{ width: `${tracking.progress_percent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Station Timeline */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-extrabold text-rail-navy uppercase tracking-wider mb-5">
                Live Route Timeline
              </h3>
              <div className="space-y-4">
                {tracking.stops.map((stop) => {
                  const isCurrent = stop.status === 'CURRENT';
                  const isDeparted = stop.status === 'DEPARTED';
                  return (
                    <div
                      key={stop.station_code}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border ${
                        isCurrent
                          ? 'bg-blue-50/70 border-rail-primary shadow-sm'
                          : isDeparted
                            ? 'bg-slate-50/60 border-slate-100'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-rail-primary text-white animate-pulse'
                              : isDeparted
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isCurrent ? (
                            <Navigation className="w-4 h-4" />
                          ) : isDeparted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Clock className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-extrabold text-rail-navy text-sm sm:text-base">
                            {stop.station_name} ({stop.station_code})
                            {isCurrent && (
                              <span className="ml-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rail-primary text-white">
                                CURRENT POSITION
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {stop.distance_km} km &bull; Platform {stop.platform}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-xs sm:text-right pl-12 sm:pl-0">
                        <div>
                          <div className="text-slate-400 font-semibold">Arrival</div>
                          <div className="font-bold text-rail-navy">
                            {stop.actual_arrival}{' '}
                            {stop.actual_arrival !== stop.scheduled_arrival && (
                              <span className="text-slate-400 line-through font-normal">
                                {stop.scheduled_arrival}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 font-semibold">Departure</div>
                          <div className="font-bold text-rail-navy">
                            {stop.actual_departure}{' '}
                            {stop.actual_departure !== stop.scheduled_departure && (
                              <span className="text-slate-400 line-through font-normal">
                                {stop.scheduled_departure}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};
