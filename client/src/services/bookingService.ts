/**
 * ============================================================================
 * File: client/src/services/bookingService.ts
 * Purpose: Frontend service for fare quotes, ticket reservations, and cancellations.
 * Used by: `BookTicketPage.tsx`, `MyBookingsPage.tsx`, `DashboardPage.tsx`.
 * ============================================================================
 */

import type {
  BookingDetails,
  ClassCode,
  PaymentMethod,
  QuotaCode,
  Train,
  TrainClass,
  TrainScheduleStop,
} from '../types';
import { apiRequest } from './apiClient';

export interface FareQuoteResponse {
  train: Train;
  fromStop: TrainScheduleStop;
  toStop: TrainScheduleStop;
  trainClass: TrainClass;
  quotaNote?: string;
  quote: {
    perPassengerBaseFare: number;
    perPassengerTatkalCharge: number;
    passengerCount: number;
    baseFareTotal: number;
    tatkalChargeTotal: number;
    gstAmount: number;
    convenienceFee: number;
    totalAmount: number;
    quotaCode: QuotaCode;
    quotaName: string;
  };
}

export const bookingService = {
  getFareQuote(params: {
    trainNumber: string;
    from: string;
    to: string;
    classCode: ClassCode;
    passengers: number;
    quota?: string;
    date?: string;
  }) {
    const qs = new URLSearchParams({
      trainNumber: params.trainNumber,
      from: params.from,
      to: params.to,
      classCode: params.classCode,
      passengers: String(params.passengers),
      quota: params.quota || 'GN',
      ...(params.date ? { date: params.date } : {}),
    });
    return apiRequest<FareQuoteResponse>(`/bookings/quote?${qs.toString()}`);
  },

  createBooking(payload: {
    trainNumber: string;
    fromStationCode: string;
    toStationCode: string;
    journeyDate: string;
    classCode: ClassCode;
    quota?: string;
    contactEmail: string;
    contactPhone: string;
    passengers: Array<{
      full_name: string;
      age: number;
      gender: 'Male' | 'Female' | 'Other';
      berth_preference: string;
    }>;
    paymentMethod: PaymentMethod;
    upiId?: string;
    cardNumber?: string;
    bankName?: string;
  }) {
    return apiRequest<BookingDetails>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getMyBookings() {
    return apiRequest<BookingDetails[]>('/bookings/my');
  },

  cancelBooking(bookingId: string, passengerIds?: string[]) {
    return apiRequest<BookingDetails>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ passengerIds }),
    });
  },
};
