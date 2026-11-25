/**
 * ============================================================================
 * File: client/src/services/trainService.ts
 * Purpose: Frontend service for Railway Stations, Train Search, Schedules,
 *          PNR Status Lookup, and Live Train Tracking.
 * Used by: `StationSelect.tsx`, `SearchTrainsPage.tsx`, `TrainSchedulePage.tsx`,
 *          `PnrStatusPage.tsx`, `LiveTrackingPage.tsx`, `HomePage.tsx`.
 * ============================================================================
 */

import type {
  BookingDetails,
  ClassCode,
  LiveQuotaAvailabilityResponse,
  LiveTrackingResponse,
  QuotaCode,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  TrainSearchResult,
} from '../types';
import { apiRequest } from './apiClient';

export const trainService = {
  getStations(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return apiRequest<Station[]>(`/stations${q}`);
  },

  listAllTrains(query?: string) {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return apiRequest<
      Array<{
        train: Train;
        stops: TrainScheduleStop[];
        classes: TrainClass[];
      }>
    >(`/trains${q}`);
  },

  searchTrains(params: {
    from: string;
    to: string;
    date: string;
    classCode?: string;
    passengers?: number;
    quota?: string;
  }) {
    const qs = new URLSearchParams({
      from: params.from,
      to: params.to,
      date: params.date,
      class: params.classCode || 'ALL',
      passengers: String(params.passengers || 1),
      quota: params.quota || 'GN',
    });
    return apiRequest<TrainSearchResult[]>(`/trains/search?${qs.toString()}`);
  },

  checkLiveAvailability(params: {
    trainNumber: string;
    from: string;
    to: string;
    date: string;
    classCode: ClassCode;
    quota: QuotaCode;
  }) {
    const qs = new URLSearchParams({
      trainNumber: params.trainNumber,
      from: params.from,
      to: params.to,
      date: params.date,
      class: params.classCode,
      quota: params.quota,
    });
    return apiRequest<LiveQuotaAvailabilityResponse>(
      `/trains/availability?${qs.toString()}`
    );
  },

  getTrainSchedule(trainNumber: string) {
    return apiRequest<{
      train: Train;
      stops: TrainScheduleStop[];
      classes: TrainClass[];
    }>(`/trains/${encodeURIComponent(trainNumber)}/schedule`);
  },

  checkPnrStatus(pnrNumber: string) {
    return apiRequest<BookingDetails>(`/pnr/${encodeURIComponent(pnrNumber.trim())}`);
  },

  getLiveTracking(trainNumber: string, date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return apiRequest<LiveTrackingResponse>(
      `/tracking/${encodeURIComponent(trainNumber.trim())}${qs}`
    );
  },
};
