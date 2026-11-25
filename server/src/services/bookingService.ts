/**
 * ============================================================================
 * File: server/src/services/bookingService.ts
 * Purpose: Core Ticket Reservation, Berth Allocation, PNR Lookup, and
 *          Cancellation Management service.
 * Responsibilities:
 *   - Validates route segments, travel class, journey date, and 1–6 passengers.
 *   - Allocates unique non-overlapping Coach & Seat/Berth assignments honoring
 *     passenger berth preferences (`Lower`, `Middle`, `Upper`, `Window`, etc.).
 *   - Transitions seamlessly to `RAC` or `WL` if confirmed seats are exhausted.
 *   - Generates unique 10-digit PNRs and persists `bookings + passengers + payments`
 *     atomically via `repository.createBookingBundle`.
 *   - Handles PNR lookup (sanitized for Guest Users, full details for owner/admin)
 *     and full or per-passenger ticket cancellations with instant refund calculation.
 * Used by: `routes/bookingRoutes.ts`, `routes/pnrRoutes.ts`.
 * Dependencies: `db/repository.ts`, `services/trainService.ts`,
 *               `services/paymentService.ts`, `services/emailService.ts`.
 * ============================================================================
 */

import { repository } from '../db/repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  BookingDetails,
  ClassCode,
  Passenger,
  PaymentMethod,
  UserProfile,
} from '../types/index.js';
import { generatePnrNumber } from '../utils/crypto.js';
import { emailService } from './emailService.js';
import {
  normalizeQuotaCode,
  paymentService,
  QUOTA_NAME_MAP,
} from './paymentService.js';
import { railcoreCatalogService } from './railcoreCatalogService.js';
import { calculateSegmentFare, doesTrainRunOnDate, trainService } from './trainService.js';

export interface PassengerInput {
  full_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  berth_preference: string;
}

const SLEEPER_BERTH_PATTERN = [
  'Lower',
  'Middle',
  'Upper',
  'Lower',
  'Middle',
  'Upper',
  'Side Lower',
  'Side Upper',
];

const TWO_AC_BERTH_PATTERN = [
  'Lower',
  'Upper',
  'Lower',
  'Upper',
  'Side Lower',
  'Side Upper',
];

const FIRST_AC_BERTH_PATTERN = ['Lower', 'Upper', 'Lower', 'Upper'];

const CHAIR_SEAT_PATTERN = ['Window', 'Middle', 'Aisle', 'Aisle', 'Window'];

function determineBerthType(classCode: ClassCode, seatNum: number): string {
  if (classCode === 'CC' || classCode === 'EC' || classCode === '2S') {
    return CHAIR_SEAT_PATTERN[(seatNum - 1) % CHAIR_SEAT_PATTERN.length];
  }
  if (classCode === '1A') {
    return FIRST_AC_BERTH_PATTERN[(seatNum - 1) % FIRST_AC_BERTH_PATTERN.length];
  }
  if (classCode === '2A') {
    return TWO_AC_BERTH_PATTERN[(seatNum - 1) % TWO_AC_BERTH_PATTERN.length];
  }
  return SLEEPER_BERTH_PATTERN[(seatNum - 1) % SLEEPER_BERTH_PATTERN.length];
}

function buildAvailableSeatPool(
  coaches: string[],
  totalSeats: number,
  classCode: ClassCode,
  occupied: Array<{ coach: string; seat_number: string }>
): Array<{ coach: string; seat_number: string; berth_type: string }> {
  const occupiedKeys = new Set(occupied.map((o) => `${o.coach}:${o.seat_number}`));
  const seatsPerCoach = Math.max(1, Math.ceil(totalSeats / Math.max(1, coaches.length)));
  const pool: Array<{ coach: string; seat_number: string; berth_type: string }> = [];

  for (const coach of coaches) {
    for (let s = 1; s <= seatsPerCoach && pool.length < totalSeats; s++) {
      const key = `${coach}:${s}`;
      if (!occupiedKeys.has(key)) {
        pool.push({
          coach,
          seat_number: String(s),
          berth_type: determineBerthType(classCode, s),
        });
      }
    }
  }
  return pool;
}

export const bookingService = {
  /**
   * Computes a pre-checkout fare quote so the UI displays live prices before payment.
   */
  async getFareQuote(input: {
    trainNumber: string;
    from: string;
    to: string;
    classCode: ClassCode;
    passengerCount: number;
    quota?: string;
    journeyDate?: string;
  }) {
    const quotaCode = normalizeQuotaCode(input.quota);
    if ((quotaCode === 'TQ' || quotaCode === 'PT') && input.classCode === '1A') {
      throw new AppError(
        '1A (AC First Class) is not eligible for Tatkal or Premium Tatkal quota.',
        400,
        'CLASS_NOT_ELIGIBLE_FOR_QUOTA'
      );
    }

    await trainService.ensureTrainForBooking(
      input.trainNumber,
      input.from,
      input.to
    );
    const train = await repository.getTrainByNumberOrId(input.trainNumber.trim());
    if (!train) throw new AppError('Train not found.', 404, 'TRAIN_NOT_FOUND');

    const stops = await repository.getTrainSchedule(train.id);
    const fromStop = stops.find((s) => s.station_code === input.from.toUpperCase());
    const toStop = stops.find((s) => s.station_code === input.to.toUpperCase());
    if (!fromStop || !toStop || fromStop.stop_order >= toStop.stop_order) {
      throw new AppError('Invalid route segment for this train.', 400, 'INVALID_ROUTE');
    }

    const classes = await repository.getTrainClasses(train.id);
    const cls = classes.find((c) => c.class_code === input.classCode);
    if (!cls) {
      throw new AppError(`Class ${input.classCode} is not offered on this train.`, 400, 'INVALID_CLASS');
    }

    const segmentDistance = Math.max(
      50,
      toStop.distance_from_source_km - fromStop.distance_from_source_km
    );
    let perPassengerBaseFare = calculateSegmentFare(
      cls,
      segmentDistance,
      train.total_distance_km
    );
    let perPassengerTatkalCharge = 0;
    let quotaNote: string | undefined;

    // When RailCore is available, prefer live RailCore quota fare for GN/TQ/LD/SS
    const targetDate =
      input.journeyDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const liveAvail = await railcoreCatalogService.checkSeatAvailability({
      trainNumber: train.train_number,
      from: fromStop.station_code,
      to: toStop.station_code,
      date: targetDate,
      classCode: input.classCode,
      quotaCode,
    });

    if (liveAvail && liveAvail.fare > 0) {
      perPassengerTatkalCharge = liveAvail.tatkal_charge || 0;
      perPassengerBaseFare = Math.max(100, liveAvail.fare - perPassengerTatkalCharge);
      quotaNote = liveAvail.note;
    } else {
      const pricing = paymentService.calculateQuotaFare(
        perPassengerBaseFare,
        input.classCode,
        quotaCode
      );
      perPassengerTatkalCharge = pricing.tatkalCharge;
      if (quotaCode === 'PT') {
        quotaNote =
          'Dynamic PT fare estimate (RailCore API supports live seats for GN, TQ, SS, LD only).';
      }
    }

    return {
      train,
      fromStop,
      toStop,
      trainClass: cls,
      quotaNote,
      quote: paymentService.calculateFareQuote(
        perPassengerBaseFare,
        Math.max(1, Math.min(6, input.passengerCount)),
        input.classCode,
        quotaCode,
        perPassengerTatkalCharge
      ),
    };
  },

  /**
   * Executes a complete ticket booking + payment transaction for a verified user.
   */
  async createBooking(
    user: UserProfile,
    input: {
      trainNumber: string;
      fromStationCode: string;
      toStationCode: string;
      journeyDate: string;
      classCode: ClassCode;
      quota?: string;
      contactEmail: string;
      contactPhone: string;
      passengers: PassengerInput[];
      paymentMethod: PaymentMethod;
      upiId?: string;
      cardNumber?: string;
      bankName?: string;
    }
  ): Promise<BookingDetails> {
    if (!input.passengers || input.passengers.length < 1 || input.passengers.length > 6) {
      throw new AppError('You can book between 1 and 6 passengers per ticket.', 400, 'VALIDATION_ERROR');
    }

    for (const p of input.passengers) {
      if (!p.full_name || p.full_name.trim().length < 2) {
        throw new AppError('Each passenger must have a valid full name.', 400, 'VALIDATION_ERROR');
      }
      if (!Number.isFinite(p.age) || p.age < 1 || p.age > 120) {
        throw new AppError('Passenger age must be between 1 and 120.', 400, 'VALIDATION_ERROR');
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.journeyDate)) {
      throw new AppError('Journey date must be YYYY-MM-DD.', 400, 'VALIDATION_ERROR');
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    if (input.journeyDate < todayIso) {
      throw new AppError('Cannot book tickets for a past journey date.', 400, 'PAST_DATE');
    }

    const fromCode = input.fromStationCode.trim().toUpperCase();
    const toCode = input.toStationCode.trim().toUpperCase();

    const quotaCode = normalizeQuotaCode(input.quota);
    const { train, trainClass, quote } = await this.getFareQuote({
      trainNumber: input.trainNumber,
      from: fromCode,
      to: toCode,
      classCode: input.classCode,
      passengerCount: input.passengers.length,
      quota: quotaCode,
      journeyDate: input.journeyDate,
    });

    if (!doesTrainRunOnDate(train.running_days, input.journeyDate)) {
      throw new AppError(
        `Train ${train.train_number} does not operate on ${input.journeyDate}. Running days: ${train.running_days}`,
        400,
        'TRAIN_NOT_RUNNING_ON_DATE'
      );
    }

    // 1. Validate & process payment first
    const paymentResult = paymentService.processPayment({
      method: input.paymentMethod,
      amount: quote.totalAmount,
      upiId: input.upiId,
      cardNumber: input.cardNumber,
      bankName: input.bankName,
    });

    // 2. Allocate seats / berths based on live inventory for (train, date, class)
    const occupiedSeats = await repository.getAllocatedSeatsForClassDate(
      train.id,
      input.journeyDate,
      input.classCode
    );
    const totalBookedSoFar = await repository.countBookedSeats(
      train.id,
      input.journeyDate,
      input.classCode
    );
    const seatPool = buildAvailableSeatPool(
      trainClass.coaches,
      trainClass.total_seats,
      input.classCode,
      occupiedSeats
    );

    let racCounter = Math.max(1, totalBookedSoFar - trainClass.total_seats + 1);
    let wlCounter = Math.max(1, totalBookedSoFar - trainClass.total_seats - 9);

    const allocatedPassengers: Array<Omit<Passenger, 'id' | 'booking_id'>> =
      input.passengers.map((pax) => {
        if (seatPool.length > 0) {
          // Try honoring berth preference if a matching berth remains in seatPool
          let chosenIdx = 0;
          if (pax.berth_preference && pax.berth_preference !== 'No Preference') {
            const prefMatch = seatPool.findIndex(
              (s) => s.berth_type.toLowerCase() === pax.berth_preference.toLowerCase()
            );
            if (prefMatch !== -1) chosenIdx = prefMatch;
          }
          const [assigned] = seatPool.splice(chosenIdx, 1);
          return {
            full_name: pax.full_name.trim(),
            age: Number(pax.age),
            gender: pax.gender,
            berth_preference: pax.berth_preference || 'No Preference',
            coach: assigned.coach,
            seat_number: assigned.seat_number,
            berth_type: assigned.berth_type,
            current_status: 'CNF',
            waitlist_position: null,
          };
        }

        if (racCounter <= 10) {
          const pos = racCounter++;
          return {
            full_name: pax.full_name.trim(),
            age: Number(pax.age),
            gender: pax.gender,
            berth_preference: pax.berth_preference || 'No Preference',
            coach: null,
            seat_number: null,
            berth_type: 'Side Lower (RAC)',
            current_status: 'RAC',
            waitlist_position: pos,
          };
        }

        const wlPos = wlCounter++;
        return {
          full_name: pax.full_name.trim(),
          age: Number(pax.age),
          gender: pax.gender,
          berth_preference: pax.berth_preference || 'No Preference',
          coach: null,
          seat_number: null,
          berth_type: null,
          current_status: 'WL',
          waitlist_position: wlPos,
        };
      });

    const hasCnf = allocatedPassengers.some((p) => p.current_status === 'CNF');
    const hasRac = allocatedPassengers.some((p) => p.current_status === 'RAC');
    const bookingStatus = hasCnf ? 'CONFIRMED' : hasRac ? 'RAC' : 'WAITLIST';

    // 3. Ensure unique 10-digit PNR
    let pnrNumber = generatePnrNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existingPnr = await repository.getBookingByPnr(pnrNumber);
      if (!existingPnr) break;
      pnrNumber = generatePnrNumber();
    }

    // 4. Persist booking + passengers + payment transactionally
    const bookingDetails = await repository.createBookingBundle({
      booking: {
        pnr_number: pnrNumber,
        user_id: user.id,
        train_id: train.id,
        from_station_code: fromCode,
        to_station_code: toCode,
        journey_date: input.journeyDate,
        class_code: input.classCode,
        quota: QUOTA_NAME_MAP[quotaCode],
        booking_status: bookingStatus,
        chart_prepared: false,
        contact_email: input.contactEmail.trim() || user.email,
        contact_phone: input.contactPhone.trim() || user.phone || '+91 98000 00000',
        base_fare_total: Number((quote.baseFareTotal + quote.tatkalChargeTotal).toFixed(2)),
        convenience_fee: quote.convenienceFee,
        gst_amount: quote.gstAmount,
        total_amount: quote.totalAmount,
        refund_amount: 0,
      },
      passengers: allocatedPassengers,
      payment: {
        user_id: user.id,
        transaction_id: paymentResult.transactionId,
        payment_method: paymentResult.paymentMethod,
        payment_provider: paymentResult.paymentProvider,
        amount: quote.totalAmount,
        currency: 'INR',
        status: paymentResult.status,
      },
    });

    // 5. Send E-Ticket email asynchronously (non-blocking if SMTP has minor latency)
    emailService.sendBookingConfirmationEmail(bookingDetails).catch((err) => {
      console.warn('[Email] Booking confirmation email warning:', err);
    });

    return bookingDetails;
  },

  /**
   * Public PNR lookup for Guests & Registered Users.
   * Strips private contact email/phone when accessed publicly by PNR number.
   */
  async lookupPnr(pnrNumber: string): Promise<BookingDetails> {
    const cleanPnr = pnrNumber.trim();
    if (!/^\d{10}$/.test(cleanPnr)) {
      throw new AppError('PNR number must be exactly 10 digits.', 400, 'INVALID_PNR_FORMAT');
    }

    const booking = await repository.getBookingByPnr(cleanPnr);
    if (!booking) {
      throw new AppError(
        `No reservation found for PNR ${cleanPnr}. Try sample PNRs: 4528193047 or 8192045612.`,
        404,
        'PNR_NOT_FOUND'
      );
    }

    // Protect user privacy on unauthenticated guest PNR lookups
    return {
      ...booking,
      contact_email: '***@***',
      contact_phone: '******' + booking.contact_phone.slice(-4),
    };
  },

  async getUserBookings(userId: string, accessToken?: string): Promise<BookingDetails[]> {
    return repository.listBookingsForUser(userId, accessToken);
  },

  async getBookingForOwnerOrAdmin(
    bookingId: string,
    user: UserProfile
  ): Promise<BookingDetails> {
    const booking = await repository.getBookingById(bookingId);
    if (!booking) {
      throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    }
    if (booking.user_id !== user.id && user.role !== 'admin') {
      throw new AppError('You do not have access to this reservation.', 403, 'FORBIDDEN');
    }
    return booking;
  },

  /**
   * Cancels either selected passengers or the entire booking and computes refund.
   */
  async cancelBooking(
    bookingId: string,
    user: UserProfile,
    passengerIds?: string[]
  ): Promise<BookingDetails> {
    const booking = await this.getBookingForOwnerOrAdmin(bookingId, user);
    if (booking.booking_status === 'CANCELLED') {
      throw new AppError('This booking is already fully cancelled.', 400, 'ALREADY_CANCELLED');
    }

    const activePassengers = booking.passengers.filter((p) => p.current_status !== 'CAN');
    if (activePassengers.length === 0) {
      throw new AppError('No active passengers remaining to cancel.', 400, 'NOTHING_TO_CANCEL');
    }

    const toCancelIds =
      passengerIds && passengerIds.length > 0
        ? activePassengers
            .filter((p) => passengerIds.includes(p.id))
            .map((p) => p.id)
        : activePassengers.map((p) => p.id);

    if (toCancelIds.length === 0) {
      throw new AppError('Please select at least one active passenger to cancel.', 400, 'VALIDATION_ERROR');
    }

    const isFullCancellation = toCancelIds.length === activePassengers.length;
    const perPaxBaseFare = booking.base_fare_total / Math.max(1, booking.passengers.length);
    const additionalRefund = paymentService.calculateRefundAmount(
      perPaxBaseFare,
      toCancelIds.length,
      booking.class_code
    );
    const totalRefund = Number((booking.refund_amount + additionalRefund).toFixed(2));

    const updated = await repository.cancelPassengersOrBooking({
      bookingId: booking.id,
      passengerIds: toCancelIds,
      refundAmount: totalRefund,
      newBookingStatus: isFullCancellation ? 'CANCELLED' : 'PARTIAL_CANCELLED',
      paymentStatus: isFullCancellation ? 'REFUNDED' : 'PARTIAL_REFUND',
    });

    emailService.sendCancellationEmail(updated, additionalRefund).catch((err) => {
      console.warn('[Email] Cancellation email warning:', err);
    });

    return updated;
  },
};
