/**
 * ============================================================================
 * File: server/src/services/railwayApiService.ts
 * Purpose: Live Train Running Status & Location Tracking Service.
 * Responsibilities:
 *   - Primary Live Source: Calls **RailCore Indian Railway API**
 *     (`GET https://ir.railcore.tech/v1/trains/{train_number}/live?date=YYYY-MM-DD`)
 *     using the `X-RailCore-Key` header whenever `RAILCORE_API_KEY` is configured.
 *   - Supports tracking ANY Indian Railway train number via RailCore, even trains
 *     not present in the local 14-train catalog!
 *   - Secondary External Source: Supports generic RapidAPI endpoint if configured.
 *   - Fallback: Uses a deterministic schedule-synchronized IST live tracker when
 *     no external key is configured or if external feed is temporarily unavailable.
 * Used by: `routes/trackingRoutes.ts`.
 * External services: RailCore REST API (`https://ir.railcore.tech`).
 * ============================================================================
 */

import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type { LiveTrackingResponse, LiveTrackingStop, TrainType } from '../types/index.js';

function addMinutesToTimeStr(timeStr: string, minutesToAdd: number): string {
  if (timeStr === 'Origin' || timeStr === 'Destination') return timeStr;
  const [hStr, mStr] = timeStr.split(':');
  const total = (((Number(hStr) * 60 + Number(mStr) + minutesToAdd) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function toScheduleMinute(timeStr: string, dayNumber: number): number {
  const [hStr, mStr] = timeStr.split(':');
  return (dayNumber - 1) * 1440 + Number(hStr || 0) * 60 + Number(mStr || 0);
}

/**
 * Formats an ISO-8601 timestamp (e.g., `2026-11-25T17:05:21.000+05:30`) to IST `HH:MM`.
 */
function formatIsoToIstTime(iso?: string | null, fallback = '--'): string {
  if (!iso) return fallback;
  const match = String(iso).match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return fallback;
  const ist = new Date(dt.getTime() + 330 * 60 * 1000);
  return `${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Returns current Indian Standard Time (UTC+5:30) date (`YYYY-MM-DD`) and minutes since midnight.
 */
function getCurrentIstDateAndMinutes(): { isoDate: string; minutesOfDay: number } {
  const istMs = Date.now() + 330 * 60 * 1000;
  const istDate = new Date(istMs);
  return {
    isoDate: istDate.toISOString().slice(0, 10),
    minutesOfDay: istDate.getUTCHours() * 60 + istDate.getUTCMinutes(),
  };
}

function normalizeTrainType(rawType?: string): TrainType {
  const lower = (rawType || '').toLowerCase();
  if (lower.includes('vande')) return 'Vande Bharat';
  if (lower.includes('rajdhani')) return 'Rajdhani';
  if (lower.includes('shatabdi')) return 'Shatabdi';
  if (lower.includes('duronto')) return 'Duronto';
  if (lower.includes('garib')) return 'Garib Rath';
  if (lower.includes('superfast')) return 'Superfast';
  return 'Express';
}

export const railwayApiService = {
  /**
   * Fetches live running status for `trainNumber` on `journeyDate`.
   * Priority: RailCore API -> Generic External API -> Schedule-Synchronized Fallback.
   */
  async getLiveTrainStatus(
    trainNumber: string,
    journeyDate?: string
  ): Promise<LiveTrackingResponse> {
    const cleanNumber = trainNumber.trim();
    const { isoDate: todayIst } = getCurrentIstDateAndMinutes();
    const targetDate = journeyDate || todayIst;

    // 1. Try RailCore Live API first when RAILCORE_API_KEY is configured
    if (env.railcore.configured) {
      try {
        const endpoint = `${env.railcore.url}/v1/trains/${encodeURIComponent(
          cleanNumber
        )}/live?date=${encodeURIComponent(targetDate)}`;

        const response = await fetch(endpoint, {
          headers: {
            'X-RailCore-Key': env.railcore.key,
          },
          signal: AbortSignal.timeout(7000),
        });

        if (response.ok) {
          const json = (await response.json()) as Record<string, unknown>;
          const mapped = this.tryMapRailCorePayload(json, cleanNumber, targetDate);
          if (mapped) return mapped;
        }
      } catch (err) {
        console.warn(
          `[RailCore API] Live lookup fallback for ${cleanNumber}:`,
          err instanceof Error ? err.message : ''
        );
      }
    }

    const train = await repository.getTrainByNumberOrId(cleanNumber);
    if (!train) {
      throw new AppError(
        `Train ${cleanNumber} was not found in RailYatra directory.`,
        404,
        'TRAIN_NOT_FOUND'
      );
    }

    const stops = await repository.getTrainSchedule(train.id);
    if (stops.length === 0) {
      throw new AppError('Schedule data unavailable for this train.', 404, 'NO_SCHEDULE');
    }

    // 2. Try generic RapidAPI endpoint if configured
    if (env.railwayApi.configured) {
      try {
        const url = new URL(env.railwayApi.url);
        url.searchParams.set('trainNo', train.train_number);
        url.searchParams.set('startDay', '0');

        const response = await fetch(url.toString(), {
          headers: {
            'x-rapidapi-key': env.railwayApi.key,
            ...(env.railwayApi.host ? { 'x-rapidapi-host': env.railwayApi.host } : {}),
          },
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const externalJson = (await response.json()) as Record<string, unknown>;
          const mapped = this.tryMapExternalPayload(externalJson, train, stops, targetDate);
          if (mapped) return mapped;
        }
      } catch (err) {
        console.warn(
          `[LiveTracking] External Railway API unavailable for ${cleanNumber}, using schedule-synchronized tracker.`,
          err instanceof Error ? err.message : ''
        );
      }
    }

    // 3. Deterministic schedule-synchronized live tracking model
    return this.buildScheduleSynchronizedStatus(train, stops, targetDate);
  },

  /**
   * Maps the official RailCore `/v1/trains/{train}/live` JSON envelope into RailYatra's
   * unified `LiveTrackingResponse` model.
   * Keeps all official halts (`is_stopping === true`) plus the live current anchor
   * station so the UI stays crisp and readable without 200+ intermediate passing signals.
   */
  tryMapRailCorePayload(
    payload: Record<string, unknown>,
    trainNumber: string,
    targetDate: string
  ): LiveTrackingResponse | null {
    if (!payload.success || !payload.data || typeof payload.data !== 'object') {
      return null;
    }

    const d = payload.data as Record<string, any>;
    const rawStations = Array.isArray(d.stations) ? (d.stations as Array<Record<string, any>>) : [];
    if (rawStations.length === 0) return null;

    const currentCode = String(d.current_station_code || '').toUpperCase();
    const visibleStations = rawStations.filter(
      (s) =>
        s.is_stopping === true ||
        s.stop_type === 'ORIGIN' ||
        s.stop_type === 'DESTINATION' ||
        String(s.station_code || '').toUpperCase() === currentCode
    );

    const currentVisibleIdx = visibleStations.findIndex(
      (s) => String(s.station_code || '').toUpperCase() === currentCode
    );

    const mappedStops: LiveTrackingStop[] = visibleStations.map((s, idx) => {
      const code = String(s.station_code || '').toUpperCase();
      const isOrigin = s.stop_type === 'ORIGIN';
      const isDest = s.stop_type === 'DESTINATION';
      const isCurrent = code === currentCode || idx === currentVisibleIdx;
      const departed = Boolean(s.has_departed || s.travelled);

      return {
        station_code: code,
        station_name: String(s.station_name || code),
        city: String(s.station_name || code),
        stop_order: idx + 1,
        scheduled_arrival: isOrigin ? 'Origin' : formatIsoToIstTime(s.scheduled_arrival),
        scheduled_departure: isDest ? 'Destination' : formatIsoToIstTime(s.scheduled_departure),
        actual_arrival: isOrigin
          ? 'Origin'
          : formatIsoToIstTime(s.actual_arrival || s.eta || s.scheduled_arrival),
        actual_departure: isDest
          ? 'Destination'
          : formatIsoToIstTime(s.actual_departure || s.etd || s.scheduled_departure),
        delay_minutes: Number(s.delay_departure_minutes ?? s.delay_arrival_minutes ?? d.delay_minutes ?? 0),
        distance_km: Math.round(Number(s.distance_km || 0)),
        platform: String(s.platform_number || '1'),
        status: isCurrent ? 'CURRENT' : departed ? 'DEPARTED' : 'UPCOMING',
      };
    });

    const delayMinutes = Number(d.delay_minutes || 0);
    const nextStopObj = (d.next_stop || null) as Record<string, any> | null;
    const rawStatus = String(d.status || '').toUpperCase();
    const runningStatus: LiveTrackingResponse['running_status'] =
      rawStatus === 'ARRIVED'
        ? 'ARRIVED'
        : delayMinutes <= 3
          ? 'ON_TIME'
          : delayMinutes <= 15
            ? 'SLIGHT_DELAY'
            : 'DELAYED';

    return {
      train_number: String(d.train_number || trainNumber),
      train_name: String(d.train_name || `Train ${trainNumber}`),
      train_type: normalizeTrainType(d.train_type_label || d.train_type),
      source: String(d.source_station_code || mappedStops[0]?.station_code || ''),
      destination: String(
        d.destination_station_code || mappedStops[mappedStops.length - 1]?.station_code || ''
      ),
      journey_date: String(d.journey_date || targetDate),
      data_source: 'RAILCORE_LIVE',
      running_status: runningStatus,
      status_text: d.status_text ? String(d.status_text) : undefined,
      speed_kmph: typeof d.speed_kmph === 'number' ? Math.round(d.speed_kmph) : undefined,
      approaching_station_name: d.approaching_station_name
        ? String(d.approaching_station_name)
        : null,
      delay_minutes: delayMinutes,
      current_station_code: currentCode || mappedStops[0]?.station_code || '',
      current_station_name: String(d.current_station_name || currentCode),
      next_station_code: nextStopObj?.station_code
        ? String(nextStopObj.station_code)
        : d.next_station_code
          ? String(d.next_station_code)
          : null,
      next_station_name: nextStopObj?.station_name
        ? String(nextStopObj.station_name)
        : d.approaching_station_name
          ? String(d.approaching_station_name)
          : null,
      distance_covered_km: Math.round(Number(d.distance_covered_km || 0)),
      total_distance_km: Math.round(Number(d.total_distance_km || 0)),
      progress_percent: Math.min(100, Math.max(1, Math.round(Number(d.progress_percent || 0)))),
      last_updated: String(d.last_reported_at || d.freshness?.retrieved_at || new Date().toISOString()),
      stops: mappedStops,
    };
  },

  tryMapExternalPayload(
    payload: Record<string, unknown>,
    train: NonNullable<Awaited<ReturnType<typeof repository.getTrainByNumberOrId>>>,
    stops: Awaited<ReturnType<typeof repository.getTrainSchedule>>,
    targetDate: string
  ): LiveTrackingResponse | null {
    const body = (payload.body || payload.data || payload) as Record<string, unknown>;
    if (!body || typeof body !== 'object') return null;

    const currentStationCode = String(
      body.current_station_code || body.currentStationCode || ''
    ).toUpperCase();
    if (!currentStationCode) return null;

    const delayMinutes = Number(body.delay || body.delay_minutes || 0);
    const currentIdx = Math.max(
      0,
      stops.findIndex((s) => s.station_code === currentStationCode)
    );
    const currentStop = stops[currentIdx];
    const nextStop = stops[currentIdx + 1] || null;

    const mappedStops: LiveTrackingStop[] = stops.map((s, idx) => ({
      station_code: s.station_code,
      station_name: s.station_name || s.station_code,
      city: s.city || '',
      stop_order: s.stop_order,
      scheduled_arrival: s.arrival_time,
      scheduled_departure: s.departure_time,
      actual_arrival: addMinutesToTimeStr(s.arrival_time, delayMinutes),
      actual_departure: addMinutesToTimeStr(s.departure_time, delayMinutes),
      delay_minutes: delayMinutes,
      distance_km: s.distance_from_source_km,
      platform: s.platform,
      status: idx < currentIdx ? 'DEPARTED' : idx === currentIdx ? 'CURRENT' : 'UPCOMING',
    }));

    return {
      train_number: train.train_number,
      train_name: train.train_name,
      train_type: train.train_type,
      source: train.source_station_code,
      destination: train.destination_station_code,
      journey_date: targetDate,
      data_source: 'EXTERNAL_API',
      running_status:
        delayMinutes <= 5 ? 'ON_TIME' : delayMinutes <= 20 ? 'SLIGHT_DELAY' : 'DELAYED',
      delay_minutes: delayMinutes,
      current_station_code: currentStop.station_code,
      current_station_name: currentStop.station_name || currentStop.station_code,
      next_station_code: nextStop?.station_code || null,
      next_station_name: nextStop?.station_name || null,
      distance_covered_km: currentStop.distance_from_source_km,
      total_distance_km: train.total_distance_km,
      progress_percent: Math.round(
        (currentStop.distance_from_source_km / Math.max(1, train.total_distance_km)) * 100
      ),
      last_updated: new Date().toISOString(),
      stops: mappedStops,
    };
  },

  buildScheduleSynchronizedStatus(
    train: NonNullable<Awaited<ReturnType<typeof repository.getTrainByNumberOrId>>>,
    stops: Awaited<ReturnType<typeof repository.getTrainSchedule>>,
    targetDate: string
  ): LiveTrackingResponse {
    const numSeed = Number(train.train_number.replace(/\D/g, '')) || 100;
    const delayMinutes = [0, 0, 2, 4, 8, 12][numSeed % 6];

    const firstStop = stops[0];
    const lastStop = stops[stops.length - 1];
    const startMin = toScheduleMinute(firstStop.departure_time, firstStop.day_number);
    const endMin = toScheduleMinute(lastStop.arrival_time, lastStop.day_number);
    const totalRunMin = Math.max(60, endMin - startMin);

    const { minutesOfDay: istNow } = getCurrentIstDateAndMinutes();
    let elapsedMin = istNow - (startMin % 1440);
    if (elapsedMin < 0) elapsedMin += 1440;
    const simulatedJourneyMin = startMin + (elapsedMin % totalRunMin);

    let currentIdx = 0;
    for (let i = 0; i < stops.length; i++) {
      const stopTimeStr =
        stops[i].arrival_time === 'Origin'
          ? stops[i].departure_time
          : stops[i].arrival_time;
      const stopMin = toScheduleMinute(stopTimeStr, stops[i].day_number) + delayMinutes;
      if (simulatedJourneyMin >= stopMin) {
        currentIdx = i;
      }
    }

    const currentStop = stops[currentIdx];
    const nextStop = stops[currentIdx + 1] || null;
    const progressPercent = Math.min(
      98,
      Math.max(
        5,
        Math.round(((simulatedJourneyMin - startMin) / totalRunMin) * 100)
      )
    );
    const distanceCovered = Math.round((train.total_distance_km * progressPercent) / 100);

    const mappedStops: LiveTrackingStop[] = stops.map((s, idx) => ({
      station_code: s.station_code,
      station_name: s.station_name || s.station_code,
      city: s.city || '',
      stop_order: s.stop_order,
      scheduled_arrival: s.arrival_time,
      scheduled_departure: s.departure_time,
      actual_arrival: addMinutesToTimeStr(s.arrival_time, delayMinutes),
      actual_departure: addMinutesToTimeStr(s.departure_time, delayMinutes),
      delay_minutes: idx <= currentIdx ? delayMinutes : Math.max(0, delayMinutes - 2),
      distance_km: s.distance_from_source_km,
      platform: s.platform,
      status: idx < currentIdx ? 'DEPARTED' : idx === currentIdx ? 'CURRENT' : 'UPCOMING',
    }));

    return {
      train_number: train.train_number,
      train_name: train.train_name,
      train_type: train.train_type,
      source: train.source_station_code,
      destination: train.destination_station_code,
      journey_date: targetDate,
      data_source: 'LIVE_SIMULATION',
      running_status:
        delayMinutes === 0 ? 'ON_TIME' : delayMinutes <= 5 ? 'SLIGHT_DELAY' : 'DELAYED',
      delay_minutes: delayMinutes,
      current_station_code: currentStop.station_code,
      current_station_name: currentStop.station_name || currentStop.station_code,
      next_station_code: nextStop?.station_code || null,
      next_station_name: nextStop?.station_name || null,
      distance_covered_km: distanceCovered,
      total_distance_km: train.total_distance_km,
      progress_percent: progressPercent,
      last_updated: new Date().toISOString(),
      stops: mappedStops,
    };
  },
};
