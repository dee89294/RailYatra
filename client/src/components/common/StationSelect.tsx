/**
 * ============================================================================
 * File: client/src/components/common/StationSelect.tsx
 * Purpose: Searchable Indian Railway Station Picker with live all-India search.
 * Responsibilities:
 *   - Displays initial curated stations immediately on click.
 *   - When typing 2+ characters (e.g., `BMKI`, `Motihari`, `Darbhanga`),
 *     queries `GET /api/stations?q=...` (which searches both DB + RailCore's
 *     nationwide station directory) with a 250ms debounce.
 *   - Caches discovered stations in state so the selected station name & code
 *     remain displayed cleanly after closing the dropdown or navigating via URL.
 * Used by: `TrainSearchWidget.tsx`, `SearchTrainsPage.tsx`.
 * ============================================================================
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, MapPin } from 'lucide-react';
import { trainService } from '../../services/trainService';
import type { Station } from '../../types';

interface StationSelectProps {
  label: string;
  stations: Station[];
  value: string;
  onChange: (stationCode: string) => void;
  placeholder?: string;
}

export const StationSelect: React.FC<StationSelectProps> = ({
  label,
  stations,
  value,
  onChange,
  placeholder = 'Select Station',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteStations, setRemoteStations] = useState<Station[]>([]);
  const [knownStations, setKnownStations] = useState<Record<string, Station>>({});
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Merge initial stations + cached selections + live search hits
  useEffect(() => {
    if (stations.length === 0) return;
    setKnownStations((prev) => {
      const next = { ...prev };
      for (const s of stations) next[s.code] = s;
      return next;
    });
  }, [stations]);

  // If URL pre-fills a station code not in initial list (e.g. ?from=BMKI), resolve its details
  useEffect(() => {
    if (!value || knownStations[value]) return;
    trainService
      .getStations(value)
      .then((list) => {
        const match = list.find((s) => s.code === value);
        if (match) {
          setKnownStations((prev) => ({ ...prev, [match.code]: match }));
        }
      })
      .catch(() => {});
  }, [value, knownStations]);

  // Debounced all-India station search when user types 2+ chars
  useEffect(() => {
    const clean = query.trim();
    if (!open || clean.length < 2) {
      setRemoteStations([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      trainService
        .getStations(clean)
        .then((list) => {
          if (!cancelled) {
            setRemoteStations(list);
            setKnownStations((prev) => {
              const next = { ...prev };
              for (const s of list) next[s.code] = s;
              return next;
            });
          }
        })
        .catch(() => {
          if (!cancelled) setRemoteStations([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selected = knownStations[value] || stations.find((s) => s.code === value);

  const displayedStations = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const merged = new Map<string, Station>();
    for (const s of stations) merged.set(s.code, s);
    for (const s of remoteStations) merged.set(s.code, s);

    return Array.from(merged.values()).filter((s) => {
      if (!clean) return true;
      return (
        s.code.toLowerCase().includes(clean) ||
        s.name.toLowerCase().includes(clean) ||
        s.city.toLowerCase().includes(clean)
      );
    });
  }, [stations, remoteStations, query]);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </span>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setQuery('');
        }}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-rail-primary/60 transition-colors text-left"
      >
        <div className="min-w-0">
          {selected ? (
            <div className="truncate text-sm font-bold text-rail-navy">
              {selected.city}{' '}
              <span className="text-rail-primary font-extrabold">({selected.code})</span>
            </div>
          ) : value ? (
            <div className="truncate text-sm font-bold text-rail-navy">{value}</div>
          ) : (
            <span className="text-sm text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 sm:w-80 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="p-2.5 border-b border-slate-100 relative">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type any Indian station or code (e.g., BMKI, Motihari)..."
              className="w-full pl-3 pr-8 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
            />
            {searching && (
              <Loader2 className="w-4 h-4 animate-spin text-rail-primary absolute right-5 top-1/2 -translate-y-1/2" />
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-slate-50">
            {displayedStations.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-500">
                {searching
                  ? 'Searching Indian Railways stations...'
                  : 'No matching stations found. Try full station code or city name.'}
              </li>
            ) : (
              displayedStations.map((station) => (
                <li key={station.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setKnownStations((prev) => ({ ...prev, [station.code]: station }));
                      onChange(station.code);
                      setOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 flex items-start gap-2.5 text-left hover:bg-blue-50 transition-colors ${
                      station.code === value ? 'bg-blue-50/80' : ''
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-rail-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-rail-navy flex items-center gap-1.5">
                        <span className="truncate">{station.city}</span>
                        <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-rail-royal shrink-0">
                          {station.code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {station.name} {station.state && station.state !== 'India' ? `• ${station.state}` : ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
