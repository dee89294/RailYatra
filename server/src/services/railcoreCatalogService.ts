/**
 * ============================================================================
 * File: server/src/services/railcoreCatalogService.ts
 * Purpose: Live Indian Railways Catalog Integration via RailCore REST API.
 * Responsibilities:
 *   - Searches all Indian Railway stations (`GET /v1/stations/search?q=...`)
 *     so stations beyond the initial seed list (e.g. `BMKI`, `MFP`, `DBG`)
 *     appear dynamically in station pickers.
 *   - Searches trains between any station pair (`GET /v1/routes/trains`) with
 *     live fares, running days, and availability summaries.
 *   - Fetches complete route timetables (`GET /v1/trains/{train}/schedule`)
 *     for any Indian Railway train number.
 * Used by: `services/trainService.ts`.
 * External service: RailCore API (`https://ir.railcore.tech`) via `X-RailCore-Key`.
 * ============================================================================
 */

import { env } from '../config/env.js';
import type {
  ClassAvailability,
  ClassCode,
  QuotaCode,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  TrainSearchResult,
  TrainType,
} from '../types/index.js';
import { paymentService, QUOTA_NAME_MAP } from './paymentService.js';

export const CLASS_METADATA: Record<
  ClassCode,
  { name: string; seats: number; coaches: string[]; ratePerKm: number; minFare: number }
> = {
  '1A': { name: 'AC First Class', seats: 24, coaches: ['H1'], ratePerKm: 3.3, minFare: 1200 },
  '2A': { name: 'AC 2 Tier', seats: 52, coaches: ['A1', 'A2'], ratePerKm: 1.95, minFare: 750 },
  '3A': { name: 'AC 3 Tier', seats: 72, coaches: ['B1', 'B2', 'B3'], ratePerKm: 1.4, minFare: 520 },
  CC: { name: 'AC Chair Car', seats: 78, coaches: ['C1', 'C2', 'C3'], ratePerKm: 1.9, minFare: 420 },
  EC: { name: 'Executive Chair Car', seats: 52, coaches: ['E1'], ratePerKm: 3.6, minFare: 950 },
  SL: { name: 'Sleeper Class', seats: 144, coaches: ['S1', 'S2', 'S3', 'S4'], ratePerKm: 0.56, minFare: 180 },
  '2S': { name: 'Second Sitting', seats: 120, coaches: ['D1', 'D2'], ratePerKm: 0.35, minFare: 95 },
};

const SUPPORTED_CLASSES = new Set<string>(Object.keys(CLASS_METADATA));
const WEEKDAY_TITLE: Record<string, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
};

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeTrainType(rawType?: string, trainName?: string): TrainType {
  const combined = `${rawType || ''} ${trainName || ''}`.toLowerCase();
  if (combined.includes('vande')) return 'Vande Bharat';
  if (combined.includes('rajdhani')) return 'Rajdhani';
  if (combined.includes('shatabdi')) return 'Shatabdi';
  if (combined.includes('duronto')) return 'Duronto';
  if (combined.includes('garib')) return 'Garib Rath';
  if (combined.includes('superfast') || combined === 'sf' || combined.startsWith('sf ')) {
    return 'Superfast';
  }
  return 'Express';
}

function formatRunningDays(days: unknown): string {
  if (!Array.isArray(days) || days.length === 0) {
    return 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';
  }
  return days
    .map((d) => WEEKDAY_TITLE[String(d).toUpperCase()] || toTitleCase(String(d)))
    .join(',');
}

function estimateClassFare(classCode: ClassCode, distanceKm: number): number {
  const meta = CLASS_METADATA[classCode];
  const raw = Math.round((Math.max(100, distanceKm) * meta.ratePerKm) / 5) * 5;
  return Math.max(meta.minFare, raw);
}

async function fetchRailCoreRaw<T>(pathWithQuery: string): Promise<{
  ok: boolean;
  status: number;
  data?: T;
  error?: { code?: string; message?: string };
}> {
  if (!env.railcore.configured) {
    return { ok: false, status: 503, error: { code: 'NOT_CONFIGURED', message: 'RailCore API key not configured' } };
  }
  try {
    const res = await fetch(`${env.railcore.url}${pathWithQuery}`, {
      headers: { 'X-RailCore-Key': env.railcore.key },
      signal: AbortSignal.timeout(6500),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    };
    if (!res.ok || !json.success || !json.data) {
      return { ok: false, status: res.status, error: json.error };
    }
    return { ok: true, status: res.status, data: json.data };
  } catch (err) {
    console.warn(
      `[RailCore Catalog] Request failed (${pathWithQuery}):`,
      err instanceof Error ? err.message : ''
    );
    return { ok: false, status: 500 };
  }
}

async function fetchRailCore<T>(pathWithQuery: string): Promise<T | null> {
  const res = await fetchRailCoreRaw<T>(pathWithQuery);
  return res.ok ? res.data ?? null : null;
}

export const railcoreCatalogService = {
  /**
   * Queries RailCore's nationwide Indian Railways station search index.
   */
  async searchStations(query: string, limit = 20): Promise<Station[]> {
    const clean = query.trim();
    if (!clean) return [];

    const data = await fetchRailCore<{ results?: Array<Record<string, any>> }>(
      `/v1/stations/search?q=${encodeURIComponent(clean)}&limit=${limit}`
    );
    if (!data?.results) return [];

    return data.results
      .filter((r) => r.station_code)
      .map((r) => ({
        id: `rc-${String(r.station_code).toUpperCase()}`,
        code: String(r.station_code).toUpperCase(),
        name: toTitleCase(String(r.station_name || r.display_name || r.station_code)),
        city: toTitleCase(String(r.city || r.station_name || r.station_code)),
        state: String(r.state || 'India'),
        zone: 'IR',
      }));
  },

  /**
   * Searches trains operating between `fromCode` and `toCode` across India.
   * For `GN`, `TQ`, `LD`, `SS`: queries RailCore directly with that quota code.
   * For `PT` (Premium Tatkal): RailCore does not serve live PT availability
   * (`QUOTA_NOT_SUPPORTED`), so we query `GN` base fares from RailCore and
   * calculate dynamic Premium Tatkal fares with a transparent notice.
   */
  async searchTrainsBetween(
    fromCode: string,
    toCode: string,
    journeyDate: string,
    requestedClass: string,
    quotaCode: QuotaCode = 'GN'
  ): Promise<{
    results: TrainSearchResult[];
    discoveredStations: Array<Omit<Station, 'id'>>;
  }> {
    const upstreamQuota = quotaCode === 'PT' ? 'GN' : quotaCode;
    const data = await fetchRailCore<{ trains?: Array<Record<string, any>> }>(
      `/v1/routes/trains?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(
        toCode
      )}&date=${encodeURIComponent(journeyDate)}&quota=${encodeURIComponent(
        upstreamQuota
      )}&match=city`
    );

    if (!data?.trains) {
      return { results: [], discoveredStations: [] };
    }

    const stationMap = new Map<string, Omit<Station, 'id'>>();
    const results: TrainSearchResult[] = [];
    const ptNote =
      'Dynamic PT fare estimate (RailCore API supports live seats for GN, TQ, SS, LD only)';

    for (const t of data.trains) {
      const trainNo = String(t.train_number || '').trim();
      const segFrom = String(t.from_station_code || fromCode).toUpperCase();
      const segTo = String(t.to_station_code || toCode).toUpperCase();
      const segFromName = toTitleCase(String(t.from_station_name || segFrom));
      const segToName = toTitleCase(String(t.to_station_name || segTo));

      if (!trainNo || !segFrom || !segTo) continue;

      stationMap.set(segFrom, {
        code: segFrom,
        name: segFromName,
        city: segFromName,
        state: 'India',
        zone: 'IR',
      });
      stationMap.set(segTo, {
        code: segTo,
        name: segToName,
        city: segToName,
        state: 'India',
        zone: 'IR',
      });

      const distanceKm = Math.max(50, Number(t.distance_km || 500));
      const durationMins = Math.max(30, Number(t.duration_minutes || 300));
      const rawClasses = Array.isArray(t.classes) ? t.classes.map(String) : ['3A', 'SL'];
      let filteredCodes = rawClasses
        .map((c) => c.toUpperCase())
        .filter((c) => SUPPORTED_CLASSES.has(c)) as ClassCode[];

      // Indian Railways excludes 1A (AC First Class) from Tatkal & Premium Tatkal
      if (quotaCode === 'TQ' || quotaCode === 'PT') {
        filteredCodes = filteredCodes.filter((c) => c !== '1A');
      }

      const classCodesToBuild =
        requestedClass === 'ALL'
          ? filteredCodes
          : filteredCodes.filter((c) => c === requestedClass);

      if (classCodesToBuild.length === 0) continue;

      const availSummary = Array.isArray(t.availability_summary)
        ? (t.availability_summary as Array<Record<string, any>>)
        : [];

      const classes: ClassAvailability[] = classCodesToBuild.map((clsCode) => {
        const meta = CLASS_METADATA[clsCode];
        const summary = availSummary.find(
          (a) => String(a.class_code || '').toUpperCase() === clsCode
        );
        const upstreamFare =
          summary && Number(summary.fare) > 0
            ? Number(summary.fare)
            : estimateClassFare(clsCode, distanceKm);

        if (quotaCode === 'PT') {
          const ptPricing = paymentService.calculateQuotaFare(upstreamFare, clsCode, 'PT');
          return {
            class_code: clsCode,
            class_name: meta.name,
            segment_fare: ptPricing.fare,
            total_seats: meta.seats,
            booked_seats: 0,
            available_seats: meta.seats,
            availability_status: 'AVAILABLE',
            availability_label: 'PT DYNAMIC EST.',
            quota: 'PT',
            railcore_supported: false,
            quota_note: ptNote,
          };
        }

        const rawStatus = String(summary?.status || 'AVAILABLE').toUpperCase();
        const status: ClassAvailability['availability_status'] =
          rawStatus === 'RAC'
            ? 'RAC'
            : rawStatus === 'WAITLIST' || rawStatus === 'REGRET' || rawStatus === 'NOT_AVAILABLE'
              ? 'WAITLIST'
              : 'AVAILABLE';

        const fare =
          summary && Number(summary.fare) > 0
            ? Number(summary.fare)
            : paymentService.calculateQuotaFare(
                estimateClassFare(clsCode, distanceKm),
                clsCode,
                quotaCode
              ).fare;

        const label = summary?.text ? String(summary.text) : `AVL ${meta.seats}`;

        return {
          class_code: clsCode,
          class_name: meta.name,
          segment_fare: fare,
          total_seats: meta.seats,
          booked_seats: 0,
          available_seats: status === 'AVAILABLE' ? meta.seats : 0,
          availability_status: status,
          availability_label: label,
          quota: quotaCode,
          railcore_supported: true,
        };
      });

      const trainName = toTitleCase(String(t.extended_train_name || t.train_name || trainNo));
      const runningDays = formatRunningDays(t.running_days);
      const depTime = String(t.departure_time || '06:00');
      const arrTime = String(t.arrival_time || '18:00');
      const arrDay = Math.max(1, 1 + Math.floor(durationMins / 1440));

      results.push({
        train: {
          id: `rc-train-${trainNo}`,
          train_number: trainNo,
          train_name: trainName,
          train_type: normalizeTrainType(t.train_type, trainName),
          source_station_code: segFrom,
          destination_station_code: segTo,
          running_days: runningDays,
          total_distance_km: distanceKm,
          duration_minutes: durationMins,
          is_active: true,
          created_at: new Date().toISOString(),
        },
        from_stop: {
          id: `rc-stop-${trainNo}-${segFrom}`,
          train_id: `rc-train-${trainNo}`,
          station_code: segFrom,
          station_name: segFromName,
          city: segFromName,
          stop_order: 1,
          arrival_time: 'Origin',
          departure_time: depTime,
          halt_minutes: 0,
          day_number: 1,
          distance_from_source_km: 0,
          platform: '1',
        },
        to_stop: {
          id: `rc-stop-${trainNo}-${segTo}`,
          train_id: `rc-train-${trainNo}`,
          station_code: segTo,
          station_name: segToName,
          city: segToName,
          stop_order: 2,
          arrival_time: arrTime,
          departure_time: 'Destination',
          halt_minutes: 0,
          day_number: arrDay,
          distance_from_source_km: distanceKm,
          platform: '1',
        },
        segment_distance_km: distanceKm,
        segment_duration_minutes: durationMins,
        journey_date: journeyDate,
        runs_on_date: true,
        quota: quotaCode,
        quota_label: QUOTA_NAME_MAP[quotaCode],
        quota_note: quotaCode === 'PT' ? ptNote : undefined,
        classes,
      });
    }

    return {
      results,
      discoveredStations: Array.from(stationMap.values()),
    };
  },

  /**
   * Calls RailCore's `/v1/availability/seats` endpoint for real-time quota seat
   * availability, fare breakdown (`tatkal_charge`), and confirmation probability.
   * Note: RailCore explicitly supports GN, TQ, SS, LD and rejects PT with
   * `QUOTA_NOT_SUPPORTED`; for PT we return both RailCore's message and a
   * dynamic estimate derived from live GN/TQ fare.
   */
  async checkSeatAvailability(params: {
    trainNumber: string;
    from: string;
    to: string;
    date: string;
    classCode: ClassCode;
    quotaCode: QuotaCode;
  }) {
    const qs = new URLSearchParams({
      train_number: params.trainNumber,
      from: params.from,
      to: params.to,
      date: params.date,
      class: params.classCode,
      quota: params.quotaCode,
    });

    const res = await fetchRailCoreRaw<{ classes?: Array<Record<string, any>> }>(
      `/v1/availability/seats?${qs.toString()}`
    );

    if (res.ok && res.data?.classes && res.data.classes.length > 0) {
      const cls = res.data.classes[0];
      const breakdown = (cls.fare_breakdown || {}) as Record<string, any>;
      return {
        train_number: params.trainNumber,
        from: params.from,
        to: params.to,
        journey_date: params.date,
        class_code: params.classCode,
        quota: params.quotaCode,
        quota_label: QUOTA_NAME_MAP[params.quotaCode],
        source: 'RAILCORE_LIVE' as const,
        railcore_supported: true,
        status: String(cls.status || 'AVAILABLE'),
        availability_text: String(cls.availability_text || 'AVAILABLE'),
        fare: Number(cls.total_fare || cls.fare || 0),
        tatkal_charge: Number(breakdown.tatkal_charge || 0),
        confirmation_probability: cls.confirmation_probability || null,
        note: undefined,
      };
    }

    // Handle PT (`QUOTA_NOT_SUPPORTED`) by fetching GN base fare from RailCore
    if (params.quotaCode === 'PT') {
      const gnQs = new URLSearchParams({
        train_number: params.trainNumber,
        from: params.from,
        to: params.to,
        date: params.date,
        class: params.classCode,
        quota: 'GN',
      });
      const gnRes = await fetchRailCoreRaw<{ classes?: Array<Record<string, any>> }>(
        `/v1/availability/seats?${gnQs.toString()}`
      );
      const gnFare = Number(gnRes.data?.classes?.[0]?.fare || 0);
      if (gnFare > 0) {
        const ptPricing = paymentService.calculateQuotaFare(gnFare, params.classCode, 'PT');
        return {
          train_number: params.trainNumber,
          from: params.from,
          to: params.to,
          journey_date: params.date,
          class_code: params.classCode,
          quota: 'PT' as const,
          quota_label: QUOTA_NAME_MAP.PT,
          source: 'DYNAMIC_ESTIMATE' as const,
          railcore_supported: false,
          status: 'DYNAMIC_ESTIMATE',
          availability_text: 'PT DYNAMIC EST.',
          fare: ptPricing.fare,
          tatkal_charge: ptPricing.tatkalCharge,
          confirmation_probability: null,
          note:
            res.error?.message ||
            'Seat availability for Premium Tatkal (PT) is not offered by RailCore API (supports GN, TQ, SS, LD). Showing dynamic PT fare estimate.',
        };
      }
    }

    return null;
  },

  /**
   * Fetches full official station-by-station timetable for any Indian train number.
   */
  async getTrainSchedule(trainNumber: string): Promise<{
    train: Train;
    stops: TrainScheduleStop[];
    classes: TrainClass[];
    discoveredStations: Array<Omit<Station, 'id'>>;
  } | null> {
    const clean = trainNumber.trim();
    const d = await fetchRailCore<Record<string, any>>(
      `/v1/trains/${encodeURIComponent(clean)}/schedule`
    );
    if (!d || !Array.isArray(d.stops) || d.stops.length === 0) return null;

    const totalDistance = Math.max(50, Number(d.distance_km || 500));
    const totalDuration = Math.max(30, Number(d.total_duration_minutes || 300));
    const trainName = toTitleCase(String(d.train_name || `Train ${clean}`));
    const srcCode = String(
      d.source_station_code || d.stops[0]?.station_code || ''
    ).toUpperCase();
    const dstCode = String(
      d.destination_station_code || d.stops[d.stops.length - 1]?.station_code || ''
    ).toUpperCase();

    const train: Train = {
      id: `rc-train-${clean}`,
      train_number: String(d.train_number || clean),
      train_name: trainName,
      train_type: normalizeTrainType(d.train_type, trainName),
      source_station_code: srcCode,
      destination_station_code: dstCode,
      running_days: formatRunningDays(d.running_days),
      total_distance_km: totalDistance,
      duration_minutes: totalDuration,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const discoveredStations: Array<Omit<Station, 'id'>> = [];
    const seenStopCodes = new Set<string>();
    const stops: TrainScheduleStop[] = [];

    for (const s of d.stops as Array<Record<string, any>>) {
      const code = String(s.station_code || '').toUpperCase();
      if (!code || seenStopCodes.has(code)) continue;
      seenStopCodes.add(code);

      const stName = toTitleCase(String(s.station_name || code));
      discoveredStations.push({
        code,
        name: stName,
        city: stName,
        state: 'India',
        zone: 'IR',
      });

      const isOrigin = s.stop_type === 'ORIGIN' || stops.length === 0;
      const isDest = s.stop_type === 'DESTINATION';

      stops.push({
        id: `rc-stop-${clean}-${code}`,
        train_id: train.id,
        station_code: code,
        station_name: stName,
        city: stName,
        stop_order: stops.length + 1,
        arrival_time: isOrigin ? 'Origin' : String(s.arrival_time || '--'),
        departure_time: isDest ? 'Destination' : String(s.departure_time || '--'),
        halt_minutes: Number(s.halt_minutes || 0),
        day_number: Number(s.day || 1),
        distance_from_source_km: Math.round(Number(s.distance_km || 0)),
        platform: String(s.platform_number || '1'),
      });
    }

    const rawClasses = Array.isArray(d.classes) ? d.classes.map(String) : ['3A', 'SL'];
    const validClassCodes = rawClasses
      .map((c) => c.toUpperCase())
      .filter((c) => SUPPORTED_CLASSES.has(c)) as ClassCode[];

    const classList = validClassCodes.length > 0 ? validClassCodes : (['3A', 'SL'] as ClassCode[]);
    const classes: TrainClass[] = classList.map((clsCode) => {
      const meta = CLASS_METADATA[clsCode];
      return {
        id: `rc-cls-${clean}-${clsCode}`,
        train_id: train.id,
        class_code: clsCode,
        class_name: meta.name,
        base_fare: estimateClassFare(clsCode, totalDistance),
        total_seats: meta.seats,
        coaches: meta.coaches,
      };
    });

    return { train, stops, classes, discoveredStations };
  },
};
