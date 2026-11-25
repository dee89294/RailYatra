/**
 * ============================================================================
 * File: client/src/pages/SearchTrainsPage.tsx
 * Purpose: Interactive Train Search Results & Availability Explorer page.
 * Responsibilities:
 *   - Reads URL search parameters (`from`, `to`, `date`, `class`, `passengers`).
 *   - Fetches live route & seat availability from `GET /api/trains/search`.
 *   - Supports filtering by Train Type (Vande Bharat, Rajdhani, Shatabdi, etc.)
 *     and sorting by Departure Time or Duration.
 *   - Clicking any class card proceeds to `/book` (or prompts login if Guest).
 * Used by: `App.tsx` (route `/search`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Clock,
  Filter,
  Info,
  Loader2,
  Radio,
  RefreshCw,
  TrainFront,
  Zap,
} from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { QUOTA_OPTIONS, TrainSearchWidget } from '../components/common/TrainSearchWidget';
import { trainService } from '../services/trainService';
import type {
  ClassCode,
  LiveQuotaAvailabilityResponse,
  QuotaCode,
  TrainSearchResult,
} from '../types';

function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getDefaultTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const SearchTrainsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') || 'NDLS';
  const to = searchParams.get('to') || 'MMCT';
  const date = searchParams.get('date') || getDefaultTomorrow();
  const classCode = searchParams.get('class') || 'ALL';
  const passengers = Number(searchParams.get('passengers') || 1);
  const quota = ((searchParams.get('quota') || 'GN').toUpperCase() as QuotaCode);

  const [results, setResults] = useState<TrainSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trainTypeFilter, setTrainTypeFilter] = useState('ALL');
  const [liveChecks, setLiveChecks] = useState<
    Record<string, LiveQuotaAvailabilityResponse | 'loading'>
  >({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setLiveChecks({});

    trainService
      .searchTrains({ from, to, date, classCode, passengers, quota })
      .then((data) => {
        if (active) setResults(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Search failed.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [from, to, date, classCode, passengers, quota]);

  const handleWidgetSearch = (next: {
    from: string;
    to: string;
    date: string;
    classCode: string;
    passengers: number;
    quota: QuotaCode;
  }) => {
    setSearchParams({
      from: next.from,
      to: next.to,
      date: next.date,
      class: next.classCode,
      passengers: String(next.passengers),
      quota: next.quota,
    });
  };

  const filteredResults =
    trainTypeFilter === 'ALL'
      ? results
      : results.filter((r) => r.train.train_type === trainTypeFilter);

  const handleSelectClass = (result: TrainSearchResult, selectedClass: string) => {
    const qs = new URLSearchParams({
      train: result.train.train_number,
      from: result.from_stop.station_code,
      to: result.to_stop.station_code,
      date: result.journey_date,
      class: selectedClass,
      passengers: String(passengers),
      quota,
    });
    navigate(`/book?${qs.toString()}`);
  };

  const handleVerifyLiveQuota = async (
    e: React.MouseEvent,
    result: TrainSearchResult,
    clsCode: ClassCode
  ) => {
    e.stopPropagation();
    const key = `${result.train.train_number}:${clsCode}:${quota}`;
    setLiveChecks((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const live = await trainService.checkLiveAvailability({
        trainNumber: result.train.train_number,
        from: result.from_stop.station_code,
        to: result.to_stop.station_code,
        date: result.journey_date,
        classCode: clsCode,
        quota,
      });
      setLiveChecks((prev) => ({ ...prev, [key]: live }));
    } catch {
      setLiveChecks((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const quotaTitle = QUOTA_OPTIONS.find((q) => q.code === quota)?.label || 'General';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge={`Train Search • ${quotaTitle} (${quota})`}
        title={`${from} → ${to}`}
        subtitle={`Journey Date: ${date} • ${passengers} ${
          passengers === 1 ? 'Passenger' : 'Passengers'
        } • Quota: ${quotaTitle} (${quota})`}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <TrainSearchWidget
          initialFrom={from}
          initialTo={to}
          initialDate={date}
          initialClass={classCode}
          initialPassengers={passengers}
          initialQuota={quota}
          onSearch={handleWidgetSearch}
        />

        {(quota === 'TQ' || quota === 'PT') && (
          <div
            className={`mt-4 rounded-2xl border p-4 flex items-start gap-3 text-xs sm:text-sm ${
              quota === 'TQ'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-rail-navy'
            }`}
          >
            {quota === 'TQ' ? (
              <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-rail-primary shrink-0 mt-0.5" />
            )}
            <div>
              {quota === 'TQ' ? (
                <>
                  <strong>Tatkal Quota (TQ) Active:</strong> Live Tatkal fares &amp; availability
                  are fetched from RailCore API (AC opens 10:00 AM &bull; Non-AC 11:00 AM one
                  day prior; 1A is excluded). Click <strong>Verify Live Quota</strong> on any
                  class card for real-time confirmation probability.
                </>
              ) : (
                <>
                  <strong>Premium Tatkal (PT) Active:</strong> Note that RailCore API currently
                  returns <code className="font-bold">QUOTA_NOT_SUPPORTED</code> for live PT
                  seat counts (RailCore supports GN, TQ, SS, LD). RailYatra computes dynamic
                  Premium Tatkal fares from live General base fares so you can compare and book
                  under PT.
                </>
              )}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-600">
            {loading
              ? 'Searching Indian Railways corridors...'
              : `${filteredResults.length} train${
                  filteredResults.length === 1 ? '' : 's'
                } found between ${from} and ${to}`}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
              <Filter className="w-3.5 h-3.5" /> Train Type:
            </span>
            {['ALL', 'Vande Bharat', 'Rajdhani', 'Shatabdi', 'Duronto', 'Superfast'].map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTrainTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    trainTypeFilter === type
                      ? 'bg-rail-primary text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-rail-primary'
                  }`}
                >
                  {type === 'ALL' ? 'All Trains' : type}
                </button>
              )
            )}
          </div>
        </div>

        {/* Results */}
        <div className="mt-5 space-y-5">
          {loading && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-rail-primary" />
              <p className="text-sm font-medium">Checking live berth &amp; seat inventory...</p>
            </div>
          )}

          {!loading && error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold">{error}</span>
            </div>
          )}

          {!loading && !error && filteredResults.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <TrainFront className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-rail-navy">
                No direct trains found for {from} → {to}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Try searching popular corridors like NDLS → MMCT, NDLS → BSB, NDLS → HWH,
                MMCT → ADI, or NDLS → MAS.
              </p>
            </div>
          )}

          {!loading &&
            filteredResults.map((item) => (
              <div
                key={item.train.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-card transition-all overflow-hidden"
              >
                {/* Train Header */}
                <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-rail-navy text-white text-xs font-extrabold tracking-wide">
                      {item.train.train_number}
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-extrabold text-rail-navy">
                        {item.train.train_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-semibold text-rail-primary">
                          {item.train.train_type}
                        </span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          Runs: {item.train.running_days}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!item.runs_on_date && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                        Does not run on {item.journey_date}
                      </span>
                    )}
                    <Link
                      to={`/schedule?train=${item.train.train_number}`}
                      className="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-rail-primary text-slate-700 hover:text-rail-primary transition-colors"
                    >
                      View Schedule
                    </Link>
                    <Link
                      to={`/tracking?train=${item.train.train_number}`}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 text-rail-primary hover:bg-blue-100 transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5" /> Live Status
                    </Link>
                  </div>
                </div>

                {/* Timings + Class Availability Cards */}
                <div className="p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-2xl font-extrabold text-rail-navy">
                        {item.from_stop.departure_time}
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        {item.from_stop.station_code} &bull; {item.from_stop.city}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Day {item.from_stop.day_number} &bull; Platform {item.from_stop.platform}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center px-4">
                      <div className="text-xs font-bold text-slate-500 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-rail-primary" />
                        {formatDuration(item.segment_duration_minutes)} &bull;{' '}
                        {item.segment_distance_km} km
                      </div>
                      <div className="w-full max-w-xs h-0.5 bg-slate-200 my-2 relative flex items-center justify-center">
                        <ArrowRight className="w-4 h-4 text-rail-primary bg-white px-0.5" />
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <div className="text-2xl font-extrabold text-rail-navy">
                        {item.to_stop.arrival_time}
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        {item.to_stop.station_code} &bull; {item.to_stop.city}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Day {item.to_stop.day_number} &bull; Platform {item.to_stop.platform}
                      </div>
                    </div>
                  </div>

                  {/* Classes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    {item.classes.map((cls) => {
                      const isAvailable = cls.availability_status === 'AVAILABLE';
                      const isRac = cls.availability_status === 'RAC';
                      const checkKey = `${item.train.train_number}:${cls.class_code}:${quota}`;
                      const liveInfo = liveChecks[checkKey];
                      const displayFare =
                        liveInfo && liveInfo !== 'loading' && liveInfo.fare > 0
                          ? liveInfo.fare
                          : cls.segment_fare;
                      const displayLabel =
                        liveInfo && liveInfo !== 'loading'
                          ? liveInfo.availability_text
                          : cls.availability_label;

                      return (
                        <div
                          key={cls.class_code}
                          role="button"
                          tabIndex={item.runs_on_date ? 0 : -1}
                          onClick={() => {
                            if (item.runs_on_date) handleSelectClass(item, cls.class_code);
                          }}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && item.runs_on_date) {
                              e.preventDefault();
                              handleSelectClass(item, cls.class_code);
                            }
                          }}
                          className={`text-left rounded-2xl p-4 border transition-all ${
                            !item.runs_on_date
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                              : isAvailable
                                ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400 hover:shadow-md cursor-pointer'
                                : 'bg-amber-50/40 border-amber-200 hover:border-amber-400 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-extrabold text-rail-navy">
                              {cls.class_code}{' '}
                              <span className="text-[10px] font-bold text-slate-400">
                                ({quota})
                              </span>
                            </span>
                            <span className="text-sm font-extrabold text-rail-royal">
                              ₹{displayFare}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {cls.class_name}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                                isAvailable
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isRac
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {displayLabel}
                            </span>
                            {item.runs_on_date && (
                              <span className="text-xs font-bold text-rail-primary">
                                Book Now →
                              </span>
                            )}
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                            <button
                              type="button"
                              onClick={(e) => void handleVerifyLiveQuota(e, item, cls.class_code)}
                              className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-rail-primary"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${
                                  liveInfo === 'loading' ? 'animate-spin text-rail-primary' : ''
                                }`}
                              />
                              {liveInfo === 'loading'
                                ? 'Checking RailCore...'
                                : 'Verify Live Quota'}
                            </button>
                            {liveInfo && liveInfo !== 'loading' && liveInfo.confirmation_probability && (
                              <span className="font-bold text-rail-royal">
                                {liveInfo.confirmation_probability.text}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};
