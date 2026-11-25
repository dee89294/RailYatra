/**
 * ============================================================================
 * File: client/src/pages/AdminDashboardPage.tsx
 * Purpose: Role-Protected Administrator Operations Console (`/admin`).
 * Responsibilities:
 *   - Displays system-wide analytics (Net Revenue, Bookings, Trains, Open Inquiries).
 *   - Manages Trains & Schedules (toggle active status, add new train routes).
 *   - Manages Stations (add new railway stations).
 *   - Oversees all Bookings (mark chart prepared, update status).
 *   - Manages Registered Users (promote/demote roles) & Contact Us Inquiries.
 * Used by: `App.tsx` (route `/admin`, wrapped in `<ProtectedRoute requireAdmin>`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  ShieldCheck,
  Ticket,
  TrainFront,
  Users,
} from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { adminService, type AdminAnalytics } from '../services/adminService';
import { trainService } from '../services/trainService';
import type {
  BookingDetails,
  ClassCode,
  ContactMessage,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  TrainType,
  UserProfile,
} from '../types';

type AdminTab = 'analytics' | 'trains' | 'stations' | 'bookings' | 'users';

export const AdminDashboardPage: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [trains, setTrains] = useState<
    Array<{ train: Train; stops: TrainScheduleStop[]; classes: TrainClass[] }>
  >([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [bookings, setBookings] = useState<BookingDetails[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);

  // New Station Form
  const [stCode, setStCode] = useState('');
  const [stName, setStName] = useState('');
  const [stCity, setStCity] = useState('');
  const [stState, setStState] = useState('');
  const [stZone, setStZone] = useState('NR');

  // New Train Form
  const [trNo, setTrNo] = useState('');
  const [trName, setTrName] = useState('');
  const [trType, setTrType] = useState<TrainType>('Vande Bharat');
  const [trFrom, setTrFrom] = useState('NDLS');
  const [trTo, setTrTo] = useState('JP');
  const [trDep, setTrDep] = useState('07:00');
  const [trArr, setTrArr] = useState('11:30');
  const [trDist, setTrDist] = useState(308);
  const [trDur, setTrDur] = useState(270);
  const [trClassCode, setTrClassCode] = useState<ClassCode>('CC');
  const [trFare, setTrFare] = useState(950);
  const [trSeats, setTrSeats] = useState(78);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [an, tr, st, bk, us, ms] = await Promise.all([
        adminService.getAnalytics(),
        adminService.listTrains(),
        trainService.getStations(),
        adminService.listAllBookings(),
        adminService.listUsers(),
        adminService.listMessages(),
      ]);
      setAnalytics(an);
      setTrains(tr);
      setStations(st);
      setBookings(bk);
      setUsers(us);
      setMessages(ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin console.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleToggleTrain = async (trainId: string, currentActive: boolean) => {
    const updated = await adminService.toggleTrainActive(trainId, !currentActive);
    setTrains((prev) =>
      prev.map((item) =>
        item.train.id === trainId ? { ...item, train: updated } : item
      )
    );
    setNotice(`Train ${updated.train_number} status updated.`);
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const created = await adminService.createStation({
        code: stCode,
        name: stName,
        city: stCity,
        state: stState,
        zone: stZone,
      });
      setStations((prev) => [...prev, created]);
      setStCode('');
      setStName('');
      setStCity('');
      setStState('');
      setNotice(`Station ${created.code} added successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create station.');
    }
  };

  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminService.createTrain({
        train_number: trNo,
        train_name: trName,
        train_type: trType,
        source_station_code: trFrom,
        destination_station_code: trTo,
        running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
        total_distance_km: Number(trDist),
        duration_minutes: Number(trDur),
        stops: [
          {
            station_code: trFrom,
            arrival_time: 'Origin',
            departure_time: trDep,
            halt_minutes: 0,
            day_number: 1,
            distance_from_source_km: 0,
            platform: '1',
          },
          {
            station_code: trTo,
            arrival_time: trArr,
            departure_time: 'Destination',
            halt_minutes: 0,
            day_number: 1,
            distance_from_source_km: Number(trDist),
            platform: '2',
          },
        ],
        classes: [
          {
            class_code: trClassCode,
            class_name: trClassCode === 'CC' ? 'AC Chair Car' : `Class ${trClassCode}`,
            base_fare: Number(trFare),
            total_seats: Number(trSeats),
            coaches: ['C1', 'C2'],
          },
        ],
      });
      setTrNo('');
      setTrName('');
      setNotice('New train route & schedule published successfully.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create train.');
    }
  };

  const handleMarkChart = async (bookingId: string, chartPrepared: boolean) => {
    const updated = await adminService.updateBooking(bookingId, {
      chart_prepared: !chartPrepared,
    });
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
  };

  const handleMessageStatus = async (
    id: string,
    status: ContactMessage['status']
  ) => {
    const updated = await adminService.updateMessageStatus(id, status);
    setMessages((prev) => prev.map((m) => (m.id === id ? updated : m)));
  };

  const handleRoleChange = async (userId: string, role: 'user' | 'admin') => {
    const updated = await adminService.updateUserRole(userId, role);
    setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    setNotice(`Updated role for ${updated.email} to ${updated.role}.`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="Administrator RBAC Portal"
        title="RailYatra Operations Console"
        subtitle="Manage railway fleets, station directory, reservation charts, passenger users, and support inquiries."
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'analytics', label: 'Overview & Analytics', icon: BarChart3 },
              { id: 'trains', label: `Trains (${trains.length})`, icon: TrainFront },
              { id: 'stations', label: `Stations (${stations.length})`, icon: MapPin },
              { id: 'bookings', label: `Bookings (${bookings.length})`, icon: Ticket },
              { id: 'users', label: `Users & Support (${users.length})`, icon: Users },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-extrabold transition-colors ${
                  tab === item.id
                    ? 'bg-rail-navy text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-rail-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {notice}
          </div>
        )}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-rail-primary" />
          </div>
        ) : (
          <>
            {/* TAB 1: ANALYTICS */}
            {tab === 'analytics' && analytics && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Net Revenue
                    </span>
                    <div className="text-2xl font-extrabold text-rail-navy mt-1">
                      ₹{analytics.summary.netRevenue.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Total Reservations
                    </span>
                    <div className="text-2xl font-extrabold text-rail-navy mt-1">
                      {analytics.summary.totalBookings} (
                      {analytics.summary.confirmedBookings} Active)
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Active Trains
                    </span>
                    <div className="text-2xl font-extrabold text-rail-navy mt-1">
                      {analytics.summary.activeTrains} / {analytics.summary.totalTrains}
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <span className="text-xs font-bold uppercase text-slate-400">
                      Open Support Inquiries
                    </span>
                    <div className="text-2xl font-extrabold text-rail-primary mt-1">
                      {analytics.summary.openInquiries}
                    </div>
                  </div>
                </div>

                {/* Class Breakdown */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-base font-extrabold text-rail-navy mb-4">
                    Bookings by Travel Class
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {Object.entries(analytics.classBreakdown).map(([cls, count]) => (
                      <div
                        key={cls}
                        className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-center"
                      >
                        <div className="text-xs font-bold text-rail-royal">{cls}</div>
                        <div className="text-2xl font-extrabold text-rail-navy mt-1">
                          {count}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TRAINS & SCHEDULES */}
            {tab === 'trains' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleCreateTrain}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4"
                >
                  <h2 className="text-base font-extrabold text-rail-navy flex items-center gap-2">
                    <Plus className="w-4 h-4 text-rail-primary" /> Add New Express Train
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <input
                      type="text"
                      required
                      value={trNo}
                      onChange={(e) => setTrNo(e.target.value)}
                      placeholder="Train # (e.g. 20978)"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      required
                      value={trName}
                      onChange={(e) => setTrName(e.target.value)}
                      placeholder="Train Name"
                      className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <select
                      value={trType}
                      onChange={(e) => setTrType(e.target.value as TrainType)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    >
                      <option value="Vande Bharat">Vande Bharat</option>
                      <option value="Rajdhani">Rajdhani</option>
                      <option value="Shatabdi">Shatabdi</option>
                      <option value="Duronto">Duronto</option>
                      <option value="Superfast">Superfast</option>
                    </select>
                    <select
                      value={trFrom}
                      onChange={(e) => setTrFrom(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    >
                      {stations.map((s) => (
                        <option key={s.code} value={s.code}>
                          From: {s.code}
                        </option>
                      ))}
                    </select>
                    <select
                      value={trTo}
                      onChange={(e) => setTrTo(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    >
                      {stations.map((s) => (
                        <option key={s.code} value={s.code}>
                          To: {s.code}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={trDep}
                      onChange={(e) => setTrDep(e.target.value)}
                      placeholder="Dep HH:MM"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="text"
                      value={trArr}
                      onChange={(e) => setTrArr(e.target.value)}
                      placeholder="Arr HH:MM"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      value={trDist}
                      onChange={(e) => setTrDist(Number(e.target.value))}
                      placeholder="Distance km"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      value={trDur}
                      onChange={(e) => setTrDur(Number(e.target.value))}
                      placeholder="Duration mins"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <select
                      value={trClassCode}
                      onChange={(e) => setTrClassCode(e.target.value as ClassCode)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    >
                      <option value="CC">CC</option>
                      <option value="3A">3A</option>
                      <option value="2A">2A</option>
                      <option value="SL">SL</option>
                    </select>
                    <input
                      type="number"
                      value={trFare}
                      onChange={(e) => setTrFare(Number(e.target.value))}
                      placeholder="Base Fare ₹"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      type="number"
                      value={trSeats}
                      onChange={(e) => setTrSeats(Number(e.target.value))}
                      placeholder="Total Seats"
                      className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 px-5 py-2 rounded-xl bg-rail-primary hover:bg-rail-royal text-white text-xs font-bold"
                    >
                      Create Train &amp; Schedule
                    </button>
                  </div>
                </form>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Train #</th>
                        <th className="px-4 py-3">Name &amp; Type</th>
                        <th className="px-4 py-3">Route</th>
                        <th className="px-4 py-3">Stops</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {trains.map(({ train, stops }) => (
                        <tr key={train.id}>
                          <td className="px-4 py-3 font-extrabold text-rail-navy">
                            {train.train_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-rail-navy">{train.train_name}</div>
                            <div className="text-xs text-slate-500">{train.train_type}</div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold">
                            {train.source_station_code} → {train.destination_station_code}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {stops.length} stops
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                                train.is_active
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {train.is_active ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                void handleToggleTrain(train.id, train.is_active)
                              }
                              className="text-xs font-bold text-rail-primary hover:underline"
                            >
                              {train.is_active ? 'Suspend' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: STATIONS */}
            {tab === 'stations' && (
              <div className="space-y-6">
                <form
                  onSubmit={handleCreateStation}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm grid grid-cols-1 sm:grid-cols-6 gap-3"
                >
                  <input
                    type="text"
                    required
                    value={stCode}
                    onChange={(e) => setStCode(e.target.value.toUpperCase())}
                    placeholder="Code (e.g. UJN)"
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={stName}
                    onChange={(e) => setStName(e.target.value)}
                    placeholder="Station Name"
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={stCity}
                    onChange={(e) => setStCity(e.target.value)}
                    placeholder="City"
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    required
                    value={stState}
                    onChange={(e) => setStState(e.target.value)}
                    placeholder="State"
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={stZone}
                      onChange={(e) => setStZone(e.target.value.toUpperCase())}
                      placeholder="Zone"
                      className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 rounded-xl bg-rail-primary text-white text-xs font-bold"
                    >
                      Add
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stations.map((s) => (
                    <div
                      key={s.code}
                      className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-extrabold text-rail-navy text-sm">
                          {s.city}{' '}
                          <span className="text-rail-primary font-bold">({s.code})</span>
                        </div>
                        <div className="text-xs text-slate-500">{s.name}</div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {s.zone}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: BOOKINGS */}
            {tab === 'bookings' && (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">PNR</th>
                      <th className="px-4 py-3">Train &amp; Route</th>
                      <th className="px-4 py-3">Date / Class</th>
                      <th className="px-4 py-3">Passengers</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-3 font-extrabold text-rail-navy">
                          {b.pnr_number}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-bold text-rail-navy">
                            {b.train?.train_number} {b.train?.train_name}
                          </div>
                          <div className="text-slate-500">
                            {b.from_station_code} → {b.to_station_code}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {b.journey_date} &bull; <strong>{b.class_code}</strong>
                        </td>
                        <td className="px-4 py-3 text-xs">{b.passengers.length}</td>
                        <td className="px-4 py-3 font-bold text-rail-navy">
                          ₹{b.total_amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              b.booking_status === 'CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : b.booking_status === 'CANCELLED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {b.booking_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => void handleMarkChart(b.id, b.chart_prepared)}
                            className={`text-xs font-bold px-3 py-1 rounded-full border ${
                              b.chart_prepared
                                ? 'bg-blue-50 border-blue-200 text-rail-primary'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {b.chart_prepared ? 'Chart Ready' : 'Prepare Chart'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 5: USERS & SUPPORT MESSAGES */}
            {tab === 'users' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-extrabold text-rail-navy flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-rail-primary" /> Registered Accounts
                  </h2>
                  <div className="space-y-2.5">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-rail-navy">{u.full_name}</div>
                          <div className="text-slate-500">
                            {u.email} &bull;{' '}
                            {u.email_verified ? 'Verified' : 'Unverified'}
                          </div>
                        </div>
                        <select
                          value={u.role}
                          onChange={(e) =>
                            void handleRoleChange(
                              u.id,
                              e.target.value as 'user' | 'admin'
                            )
                          }
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <h2 className="text-base font-extrabold text-rail-navy flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-rail-primary" /> Support Inquiries
                  </h2>
                  <div className="space-y-3">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-rail-navy">{m.subject}</span>
                          <select
                            value={m.status}
                            onChange={(e) =>
                              void handleMessageStatus(
                                m.id,
                                e.target.value as ContactMessage['status']
                              )
                            }
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-bold"
                          >
                            <option value="NEW">NEW</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="RESOLVED">RESOLVED</option>
                          </select>
                        </div>
                        <div className="text-slate-600">{m.message}</div>
                        <div className="text-[11px] text-slate-400">
                          From: {m.name} ({m.email})
                          {m.pnr_reference ? ` • PNR: ${m.pnr_reference}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};
