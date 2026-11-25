/**
 * ============================================================================
 * File: client/src/pages/TrainSchedulePage.tsx
 * Purpose: Complete Train Time Table & Route Explorer for Guest & Registered Users.
 * Responsibilities:
 *   - Displays directory of all trains (searchable by train number, name, or city).
 *   - Loads and displays station-by-station route timetable (`arrival`, `departure`,
 *     `halt`, `day`, `distance km`, `platform`) plus travel classes & base fares.
 * Used by: `App.tsx` (route `/schedule`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, MapPin, Radio, Search, TrainFront } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { trainService } from '../services/trainService';
import type { Train, TrainClass, TrainScheduleStop } from '../types';

export const TrainSchedulePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTrainNo = searchParams.get('train') || '22436';

  const [allTrains, setAllTrains] = useState<
    Array<{ train: Train; stops: TrainScheduleStop[]; classes: TrainClass[] }>
  >([]);
  const [filterText, setFilterText] = useState('');
  const [directTrainInput, setDirectTrainInput] = useState('');
  const [directTrainData, setDirectTrainData] = useState<{
    train: Train;
    stops: TrainScheduleStop[];
    classes: TrainClass[];
  } | null>(null);
  const [directError, setDirectError] = useState('');
  const [selectedTrainNo, setSelectedTrainNo] = useState(initialTrainNo);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    trainService
      .listAllTrains()
      .then((list) => {
        setAllTrains(list);
        if (list.length > 0 && !list.some((t) => t.train.train_number === selectedTrainNo)) {
          // If URL requested a RailCore train not in the local directory, fetch it directly
          trainService
            .getTrainSchedule(selectedTrainNo)
            .then(setDirectTrainData)
            .catch(() => setSelectedTrainNo(list[0].train.train_number));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tParam = searchParams.get('train');
    if (tParam) {
      setSelectedTrainNo(tParam);
      if (!allTrains.some((item) => item.train.train_number === tParam)) {
        trainService
          .getTrainSchedule(tParam)
          .then((res) => {
            setDirectTrainData(res);
            setDirectError('');
          })
          .catch(() => {});
      } else {
        setDirectTrainData(null);
      }
    }
  }, [searchParams, allTrains]);

  const handleLookupTrainNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = directTrainInput.trim();
    if (!num) return;
    setDirectError('');
    try {
      const res = await trainService.getTrainSchedule(num);
      setDirectTrainData(res);
      setSelectedTrainNo(res.train.train_number);
      setSearchParams({ train: res.train.train_number });
    } catch (err) {
      setDirectError(err instanceof Error ? err.message : `Train ${num} not found.`);
    }
  };

  const filteredList = allTrains.filter((item) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return (
      item.train.train_number.toLowerCase().includes(q) ||
      item.train.train_name.toLowerCase().includes(q) ||
      item.train.source_station_code.toLowerCase().includes(q) ||
      item.train.destination_station_code.toLowerCase().includes(q)
    );
  });

  const selected =
    (directTrainData && directTrainData.train.train_number === selectedTrainNo
      ? directTrainData
      : allTrains.find((item) => item.train.train_number === selectedTrainNo)) ||
    allTrains[0];

  const handleSelectTrain = (num: string) => {
    setSelectedTrainNo(num);
    setSearchParams({ train: num });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Official Route Timetable"
        title="Train Schedules &amp; Route Explorer"
        subtitle="Inspect intermediate halts, platform assignments, running days, and travel classes for every RailYatra train."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Train Selector Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Direct All-India Train # Lookup */}
            <form
              onSubmit={handleLookupTrainNumber}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2"
            >
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-rail-primary">
                Lookup Any Indian Train #
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={directTrainInput}
                  onChange={(e) => setDirectTrainInput(e.target.value)}
                  placeholder="e.g., 12557, 12309, 15567"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rail-primary hover:bg-rail-royal text-white text-xs font-bold"
                >
                  Find
                </button>
              </div>
              {directError && <p className="text-xs font-semibold text-rose-600">{directError}</p>}
            </form>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter by train # or name..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <div className="mt-4 max-h-[540px] overflow-y-auto space-y-2 pr-1">
                {loading && (
                  <p className="text-xs text-slate-500 p-3">Loading train directory...</p>
                )}
                {filteredList.map(({ train }) => {
                  const active = train.train_number === selected?.train.train_number;
                  return (
                    <button
                      key={train.id}
                      type="button"
                      onClick={() => handleSelectTrain(train.train_number)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                        active
                          ? 'bg-blue-50 border-rail-primary shadow-sm'
                          : 'bg-white border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-rail-navy text-white">
                          {train.train_number}
                        </span>
                        <span className="text-[11px] font-bold text-rail-primary">
                          {train.train_type}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-rail-navy mt-1.5">
                        {train.train_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {train.source_station_code} → {train.destination_station_code} &bull;{' '}
                        {train.total_distance_km} km
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Schedule Details */}
          <div className="lg:col-span-8">
            {selected ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-wrap items-start justify-between gap-4 bg-slate-50/60">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-rail-primary text-white text-xs font-extrabold">
                        #{selected.train.train_number}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {selected.train.train_type}
                      </span>
                    </div>
                    <h2 className="text-2xl font-extrabold text-rail-navy mt-2">
                      {selected.train.train_name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-2">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rail-primary" />
                        {selected.train.source_station_code} →{' '}
                        {selected.train.destination_station_code} (
                        {selected.train.total_distance_km} km)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-rail-primary" />
                        {Math.floor(selected.train.duration_minutes / 60)}h{' '}
                        {selected.train.duration_minutes % 60}m
                      </span>
                      <span>Runs: {selected.train.running_days}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/tracking?train=${selected.train.train_number}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-50 text-rail-primary text-xs font-bold hover:bg-blue-100 transition-colors"
                    >
                      <Radio className="w-3.5 h-3.5" /> Live Location
                    </Link>
                    <Link
                      to={`/search?from=${selected.train.source_station_code}&to=${selected.train.destination_station_code}&date=${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-rail-primary text-white text-xs font-bold hover:bg-rail-royal transition-colors"
                    >
                      <TrainFront className="w-3.5 h-3.5" /> Book This Train
                    </Link>
                  </div>
                </div>

                {/* Route Stops Table */}
                <div className="p-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                    Station-by-Station Route Timetable
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Station</th>
                          <th className="px-4 py-3">Arrival</th>
                          <th className="px-4 py-3">Departure</th>
                          <th className="px-4 py-3">Halt</th>
                          <th className="px-4 py-3">Day</th>
                          <th className="px-4 py-3">Distance</th>
                          <th className="px-4 py-3">PF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selected.stops.map((stop) => (
                          <tr key={stop.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 font-bold text-slate-400">
                              {stop.stop_order}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-rail-navy">
                                {stop.station_name || stop.station_code}{' '}
                                <span className="text-rail-primary">({stop.station_code})</span>
                              </div>
                              <div className="text-xs text-slate-500">{stop.city}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {stop.arrival_time}
                            </td>
                            <td className="px-4 py-3 font-semibold text-rail-navy">
                              {stop.departure_time}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {stop.halt_minutes > 0 ? `${stop.halt_minutes} min` : '--'}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                              Day {stop.day_number}
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                              {stop.distance_from_source_km} km
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-700">
                              {stop.platform}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Available Classes & Base Fares */}
                  <div className="mt-6">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Travel Classes &amp; Full-Route Base Fares
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {selected.classes.map((cls) => (
                        <div
                          key={cls.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-rail-navy">
                              {cls.class_code}
                            </span>
                            <span className="font-extrabold text-rail-primary">
                              ₹{cls.base_fare}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{cls.class_name}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Capacity: {cls.total_seats} seats ({cls.coaches.join(', ')})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
                Select a train from the directory to view its full route schedule.
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
