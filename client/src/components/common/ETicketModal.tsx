/**
 * ============================================================================
 * File: client/src/components/common/ETicketModal.tsx
 * Purpose: Printable IRCTC-style Electronic Reservation Slip (E-Ticket) Modal.
 * Responsibilities:
 *   - Displays complete PNR, train details, departure/arrival timings,
 *     passenger coach & berth statuses, itemized fare & GST, and a vector QR.
 *   - Supports browser print / Save as PDF via CSS `@media print` rules.
 * Used by: `BookTicketPage.tsx`, `MyBookingsPage.tsx`.
 * ============================================================================
 */

import React from 'react';
import { Printer, TrainFront, X } from 'lucide-react';
import type { BookingDetails } from '../../types';

interface ETicketModalProps {
  booking: BookingDetails;
  onClose: () => void;
}

/**
 * Generates a deterministic decorative verification matrix SVG representing
 * a scannable ticket QR badge encoded with the PNR number.
 */
const TicketQrGraphic: React.FC<{ pnr: string }> = ({ pnr }) => {
  const seed = pnr.split('').map((c) => Number(c) || 3);
  const cells: boolean[] = [];
  for (let i = 0; i < 49; i++) {
    const val = (seed[i % seed.length] * (i + 7)) % 5;
    cells.push(val < 3);
  }
  return (
    <svg
      viewBox="0 0 70 70"
      className="w-20 h-20 border border-slate-200 rounded-lg p-1 bg-white"
      aria-label={`QR verification code for PNR ${pnr}`}
    >
      {cells.map((filled, idx) => {
        const x = (idx % 7) * 10;
        const y = Math.floor(idx / 7) * 10;
        return filled ? (
          <rect key={idx} x={x} y={y} width={8.5} height={8.5} rx={1.5} fill="#0A2540" />
        ) : null;
      })}
    </svg>
  );
};

export const ETicketModal: React.FC<ETicketModalProps> = ({ booking, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        id="printable-eticket"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-6"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-rail-navy via-rail-royal to-rail-primary text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
              <TrainFront className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">
                RailYatra Electronic Reservation Slip
              </h2>
              <p className="text-xs text-blue-100">Your Journey, Our Priority.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-rail-navy text-xs font-bold hover:bg-blue-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close E-Ticket"
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* PNR + Status + QR */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-dashed border-slate-200">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                PNR Number
              </span>
              <div className="text-2xl font-extrabold tracking-widest text-rail-navy">
                {booking.pnr_number}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    booking.booking_status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : booking.booking_status === 'CANCELLED'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {booking.booking_status}
                </span>
                <span className="text-xs text-slate-500">
                  Class: <strong className="text-slate-700">{booking.class_code}</strong> &bull;
                  Quota: <strong className="text-slate-700">{booking.quota}</strong>
                </span>
              </div>
            </div>
            <TicketQrGraphic pnr={booking.pnr_number} />
          </div>

          {/* Train & Route Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400">Boarding</span>
              <div className="text-lg font-extrabold text-rail-navy">
                {booking.from_station_code}
              </div>
              <div className="text-xs text-slate-600">
                {booking.from_station?.city || booking.from_station_code}
              </div>
              <div className="text-xs font-bold text-rail-primary mt-1">
                Dep: {booking.departure_time || '--'}
              </div>
            </div>

            <div className="sm:text-center flex flex-col justify-center">
              <div className="text-xs font-bold text-rail-royal">
                {booking.train?.train_number} &bull; {booking.train?.train_name}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Date of Journey: <strong className="text-slate-800">{booking.journey_date}</strong>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[11px] font-semibold uppercase text-slate-400">Destination</span>
              <div className="text-lg font-extrabold text-rail-navy">
                {booking.to_station_code}
              </div>
              <div className="text-xs text-slate-600">
                {booking.to_station?.city || booking.to_station_code}
              </div>
              <div className="text-xs font-bold text-rail-primary mt-1">
                Arr: {booking.arrival_time || '--'}
              </div>
            </div>
          </div>

          {/* Passengers Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Passenger Details ({booking.passengers.length})
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3.5 py-2.5">#</th>
                    <th className="px-3.5 py-2.5">Name</th>
                    <th className="px-3.5 py-2.5">Age / Gender</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Coach / Berth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.passengers.map((pax, i) => (
                    <tr key={pax.id}>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-500">{i + 1}</td>
                      <td className="px-3.5 py-2.5 font-bold text-rail-navy">{pax.full_name}</td>
                      <td className="px-3.5 py-2.5 text-slate-600">
                        {pax.age} / {pax.gender[0]}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            pax.current_status === 'CNF'
                              ? 'bg-emerald-100 text-emerald-700'
                              : pax.current_status === 'CAN'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {pax.current_status}
                          {pax.waitlist_position ? ` #${pax.waitlist_position}` : ''}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-slate-700">
                        {pax.coach && pax.seat_number
                          ? `${pax.coach} / ${pax.seat_number} (${pax.berth_type})`
                          : pax.berth_type || '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <div className="space-y-1">
              <div>
                Transaction ID:{' '}
                <strong className="text-slate-800">
                  {booking.payment?.transaction_id || 'N/A'}
                </strong>
              </div>
              <div>
                Payment Mode:{' '}
                <strong className="text-slate-800">
                  {booking.payment?.payment_method || 'UPI'} ({booking.payment?.status || 'SUCCESS'})
                </strong>
              </div>
              <div>Booked On: {new Date(booking.booked_at).toLocaleString()}</div>
            </div>
            <div className="sm:text-right space-y-1">
              <div>Base Fare: ₹{booking.base_fare_total.toFixed(2)}</div>
              <div>GST &amp; Convenience Fee: ₹{(booking.gst_amount + booking.convenience_fee).toFixed(2)}</div>
              <div className="text-base font-extrabold text-rail-navy">
                Total Paid: ₹{booking.total_amount.toFixed(2)}
              </div>
              {booking.refund_amount > 0 && (
                <div className="text-emerald-700 font-bold">
                  Refund Initiated: ₹{booking.refund_amount.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
