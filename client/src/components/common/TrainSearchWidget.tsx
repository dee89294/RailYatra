/**
 * ============================================================================
 * File: client/src/components/common/TrainSearchWidget.tsx
 * Purpose: Floating Horizontal Train Search Bar matching the RailYatra mockup.
 * Responsibilities:
 *   - Loads stations from `trainService.getStations()`.
 *   - Renders From Station, Swap (`⇄`), To Station, Journey Date, Travel Class,
 *     Passengers count, and the primary `Search Trains` button.
 *   - Navigates to `/search?...` with URL query parameters (or updates them live).
 * Used by: `HomePage.tsx` (overlaps Hero bottom) and `SearchTrainsPage.tsx`.
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Calendar, Search, Users } from 'lucide-react';
import { trainService } from '../../services/trainService';
import type { QuotaCode, Station } from '../../types';
import { StationSelect } from './StationSelect';

export const QUOTA_OPTIONS: Array<{
  code: QuotaCode;
  label: string;
  badge?: string;
}> = [
  { code: 'GN', label: 'General' },
  { code: 'TQ', label: 'Tatkal', badge: 'TQ' },
  { code: 'PT', label: 'Premium Tatkal', badge: 'PT' },
  { code: 'LD', label: 'Ladies' },
  { code: 'SS', label: 'Senior Citizen' },
];

interface TrainSearchWidgetProps {
  initialFrom?: string;
  initialTo?: string;
  initialDate?: string;
  initialClass?: string;
  initialPassengers?: number;
  initialQuota?: QuotaCode;
  onSearch?: (params: {
    from: string;
    to: string;
    date: string;
    classCode: string;
    passengers: number;
    quota: QuotaCode;
  }) => void;
}

function getDefaultTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const TrainSearchWidget: React.FC<TrainSearchWidgetProps> = ({
  initialFrom = 'NDLS',
  initialTo = 'MMCT',
  initialDate = getDefaultTomorrow(),
  initialClass = 'ALL',
  initialPassengers = 1,
  initialQuota = 'GN',
  onSearch,
}) => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [date, setDate] = useState(initialDate);
  const [classCode, setClassCode] = useState(initialClass);
  const [passengers, setPassengers] = useState(initialPassengers);
  const [quota, setQuota] = useState<QuotaCode>(initialQuota);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    trainService
      .getStations()
      .then(setStations)
      .catch(() => {
        /* Fallback silently; page will show errors on submit if API down */
      });
  }, []);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
    setDate(initialDate);
    setClassCode(initialClass);
    setPassengers(initialPassengers);
    setQuota(initialQuota);
  }, [initialFrom, initialTo, initialDate, initialClass, initialPassengers, initialQuota]);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) {
      setErrorMsg('Please select both From and To stations.');
      return;
    }
    if (from === to) {
      setErrorMsg('From and To stations must be different.');
      return;
    }
    setErrorMsg('');

    if (onSearch) {
      onSearch({ from, to, date, classCode, passengers, quota });
      return;
    }

    const qs = new URLSearchParams({
      from,
      to,
      date,
      class: classCode,
      passengers: String(passengers),
      quota,
    });
    navigate(`/search?${qs.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-3xl shadow-card border border-slate-100 p-4 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        {/* From Station + Swap + To Station */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2 flex-[2.2] min-w-0">
          <StationSelect
            label="From Station"
            stations={stations}
            value={from}
            onChange={(code) => {
              setFrom(code);
              setErrorMsg('');
            }}
            placeholder="Select Station"
          />

          <button
            type="button"
            onClick={handleSwap}
            title="Swap stations"
            aria-label="Swap From and To stations"
            className="self-center sm:self-auto sm:mb-1 w-9 h-9 rounded-full bg-blue-50 hover:bg-rail-primary text-rail-primary hover:text-white flex items-center justify-center transition-colors shrink-0 border border-blue-100"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <StationSelect
            label="To Station"
            stations={stations}
            value={to}
            onChange={(code) => {
              setTo(code);
              setErrorMsg('');
            }}
            placeholder="Select Station"
          />
        </div>

        {/* Journey Date */}
        <div className="flex-1 min-w-[155px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Journey Date
          </label>
          <div className="relative">
            <Calendar className="w-4 h-4 text-rail-primary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary text-sm font-bold text-rail-navy"
              required
            />
          </div>
        </div>

        {/* Travel Class */}
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Travel Class
          </label>
          <select
            value={classCode}
            onChange={(e) => setClassCode(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary text-sm font-bold text-rail-navy"
          >
            <option value="ALL">All Classes</option>
            <option value="EC">Exec. Chair (EC)</option>
            <option value="CC">Chair Car (CC)</option>
            <option value="1A">AC First (1A)</option>
            <option value="2A">AC 2 Tier (2A)</option>
            <option value="3A">AC 3 Tier (3A)</option>
            <option value="SL">Sleeper (SL)</option>
            <option value="2S">Second Sitting (2S)</option>
          </select>
        </div>

        {/* Passengers */}
        <div className="w-full lg:w-28">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Passengers
          </label>
          <div className="relative">
            <Users className="w-4 h-4 text-rail-primary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={passengers}
              onChange={(e) => setPassengers(Number(e.target.value))}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary text-sm font-bold text-rail-navy"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Search Button */}
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm shadow-md shadow-blue-500/25 transition-all shrink-0 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>Search Trains</span>
        </button>
      </div>

      {/* Quota Selector Pills (General, Tatkal, Premium Tatkal, Ladies, Senior Citizen) */}
      <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-100">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-1">
          Booking Quota:
        </span>
        {QUOTA_OPTIONS.map((q) => {
          const active = quota === q.code;
          const isUrgent = q.code === 'TQ' || q.code === 'PT';
          return (
            <button
              key={q.code}
              type="button"
              onClick={() => setQuota(q.code)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                active
                  ? isUrgent
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-rail-primary text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-rail-primary'
              }`}
            >
              <span>{q.label}</span>
              {q.badge && (
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {q.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <p className="mt-2.5 text-xs font-semibold text-rose-600">{errorMsg}</p>
      )}
    </form>
  );
};
