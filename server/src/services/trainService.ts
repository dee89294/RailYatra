/**
 * ============================================================================
 * File: server/src/services/trainService.ts
 * Purpose: Train discovery, schedule inspection, dynamic fare calculation,
 *          and real-time seat availability computation.
 * Responsibilities:
 *   - Searches stations across both the local/Supabase catalog AND RailCore's
 *     all-India station directory (`GET /v1/stations/search`) so every Indian
 *     Railway station (e.g. `BMKI`, `MFP`, `DBG`) is discoverable.
 *   - Searches trains connecting any `from` -> `to` pair across both DB catalog
 *     and RailCore (`GET /v1/routes/trains`).
 *   - Retrieves full schedules from DB or live RailCore (`GET /v1/trains/{no}/schedule`).
 *   - Ensures RailCore-discovered trains & stations are persisted into DB before
 *     booking so relational Foreign Keys (`bookings`, `passengers`, `payments`)
 *     stay 100% consistent.
 * Used by: `routes/trainRoutes.ts`, `services/bookingService.ts`.
 * Dependencies: `db/repository.ts`, `services/railcoreCatalogService.ts`.
 * ============================================================================
 */

import { env } from '../config/env.js';
import { repository } from '../db/repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  ClassAvailability,
  ClassCode,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  TrainSearchResult,
} from '../types/index.js';
import { railcoreCatalogService } from './railcoreCatalogService.js';
import { normalizeQuotaCode, paymentService, QUOTA_NAME_MAP } from './paymentService.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseTimeToMinutes(timeStr: string, dayNumber: number): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = Number(hStr || 0);
  const m = Number(mStr || 0);
  return (dayNumber - 1) * 1440 + h * 60 + m;
}

export function doesTrainRunOnDate(runningDays: string, isoDate: string): boolean {
  const dt = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return true;
  const dayAbbr = WEEKDAYS[dt.getDay()];
  return runningDays
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .includes(dayAbbr.toLowerCase());
}

/**
 * Computes proportional fare for an intermediate segment `(fromStop -> toStop)`,
 * rounded cleanly to the nearest ₹5 with a sensible minimum fare floor.
 */
export function calculateSegmentFare(
  cls: TrainClass,
  segmentDistanceKm: number,
  totalDistanceKm: number
): number {
  if (totalDistanceKm <= 0 || segmentDistanceKm <= 0) return cls.base_fare;
  const ratio = Math.min(1, Math.max(0.25, segmentDistanceKm / totalDistanceKm));
  const raw = cls.base_fare * ratio;
  const minFloor = cls.class_code === '2S' ? 85 : cls.class_code === 'SL' ? 180 : 350;
  return Math.max(minFloor, Math.round(raw / 5) * 5);
}

export const trainService = {
  /**
   * Searches stations in DB and, when a query of 2+ characters is provided,
   * enriches results live from RailCore's all-India station search API.
   */
  async searchStations(query?: string): Promise<Station[]> {
    const dbStations = await repository.listStations(query);
    const cleanQuery = (query || '').trim();

    if (cleanQuery.length < 2 || !env.railcore.configured) {
      return dbStations;
    }

    const remoteStations = await railcoreCatalogService.searchStations(cleanQuery, 20);
    if (remoteStations.length === 0) return dbStations;

    // Cache newly discovered stations in DB asynchronously so FKs stay ready
    const dbCodes = new Set(dbStations.map((s) => s.code));
    const newStations = remoteStations
      .filter((s) => !dbCodes.has(s.code))
      .map(({ id: _ignored, ...rest }) => rest);
    if (newStations.length > 0) {
      repository.upsertStationsBatch(newStations).catch(() => {});
    }

    const merged = new Map<string, Station>();
    for (const s of dbStations) merged.set(s.code, s);
    for (const s of remoteStations) {
      if (!merged.has(s.code)) merged.set(s.code, s);
    }
    return Array.from(merged.values());
  },

  async listAllTrains(searchQuery?: string): Promise<
    Array<{
      train: Train;
      stops: TrainScheduleStop[];
      classes: TrainClass[];
    }>
  > {
    const trains = await repository.listTrains(false);
    const q = (searchQuery || '').trim().toLowerCase();
    const filtered = q
      ? trains.filter(
          (t) =>
            t.train_number.toLowerCase().includes(q) ||
            t.train_name.toLowerCase().includes(q) ||
            t.source_station_code.toLowerCase().includes(q) ||
            t.destination_station_code.toLowerCase().includes(q)
        )
      : trains;

    return Promise.all(
      filtered.map(async (train) => ({
        train,
        stops: await repository.getTrainSchedule(train.id),
        classes: await repository.getTrainClasses(train.id),
      }))
    );
  },

  /**
   * Searches trains passing through `from` before `to` on `journeyDate`.
   * Merges curated database trains with live RailCore all-India route results.
   */
  async searchTrains(params: {
    from: string;
    to: string;
    date: string;
    classCode?: string;
    passengers?: number;
    quota?: string;
  }): Promise<TrainSearchResult[]> {
    const fromCode = params.from.trim().toUpperCase();
    const toCode = params.to.trim().toUpperCase();
    const journeyDate = params.date.trim();
    const requestedClass = params.classCode?.trim().toUpperCase() || 'ALL';
    const minSeats = Math.max(1, Number(params.passengers || 1));
    const quotaCode = normalizeQuotaCode(params.quota);

    if (!fromCode || !toCode) {
      throw new AppError('Both From and To station codes are required.', 400, 'VALIDATION_ERROR');
    }
    if (fromCode === toCode) {
      throw new AppError('Source and Destination stations cannot be the same.', 400, 'VALIDATION_ERROR');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(journeyDate)) {
      throw new AppError('Journey date must be in YYYY-MM-DD format.', 400, 'VALIDATION_ERROR');
    }

    const [trains, railcoreSearch] = await Promise.all([
      repository.listTrains(false),
      env.railcore.configured
        ? railcoreCatalogService.searchTrainsBetween(
            fromCode,
            toCode,
            journeyDate,
            requestedClass,
            quotaCode
          )
        : Promise.resolve({ results: [], discoveredStations: [] }),
    ]);

    if (railcoreSearch.discoveredStations.length > 0) {
      repository.upsertStationsBatch(railcoreSearch.discoveredStations).catch(() => {});
    }

    const ptNote =
      'Dynamic PT fare estimate (RailCore API supports live seats for GN, TQ, SS, LD only)';

    const dbResults: TrainSearchResult[] = [];
    for (const train of trains) {
      const stops = await repository.getTrainSchedule(train.id);
      const fromStop = stops.find((s) => s.station_code === fromCode);
      const toStop = stops.find((s) => s.station_code === toCode);

      if (!fromStop || !toStop || fromStop.stop_order >= toStop.stop_order) {
        continue;
      }

      const classes = await repository.getTrainClasses(train.id);
      let eligibleClasses =
        quotaCode === 'TQ' || quotaCode === 'PT'
          ? classes.filter((c) => c.class_code !== '1A')
          : classes;

      const matchingClasses =
        requestedClass === 'ALL'
          ? eligibleClasses
          : eligibleClasses.filter((c) => c.class_code === (requestedClass as ClassCode));

      if (matchingClasses.length === 0) continue;

      const segmentDistance = Math.max(
        50,
        toStop.distance_from_source_km - fromStop.distance_from_source_km
      );
      const depTime =
        fromStop.departure_time === 'Destination'
          ? fromStop.arrival_time
          : fromStop.departure_time;
      const arrTime =
        toStop.arrival_time === 'Origin' ? toStop.departure_time : toStop.arrival_time;
      const segmentDuration = Math.max(
        30,
        parseTimeToMinutes(arrTime, toStop.day_number) -
          parseTimeToMinutes(depTime, fromStop.day_number)
      );

      const classAvailabilities: ClassAvailability[] = await Promise.all(
        matchingClasses.map(async (cls) => {
          const bookedSeats = await repository.countBookedSeats(
            train.id,
            journeyDate,
            cls.class_code
          );
          const remaining = cls.total_seats - bookedSeats;
          const generalFare = calculateSegmentFare(
            cls,
            segmentDistance,
            train.total_distance_km
          );
          const { fare: segmentFare } = paymentService.calculateQuotaFare(
            generalFare,
            cls.class_code,
            quotaCode
          );

          const wlPrefix = quotaCode === 'TQ' ? 'TQWL' : 'WL';

          if (remaining >= minSeats) {
            return {
              class_code: cls.class_code,
              class_name: cls.class_name,
              segment_fare: segmentFare,
              total_seats: cls.total_seats,
              booked_seats: bookedSeats,
              available_seats: remaining,
              availability_status: 'AVAILABLE',
              availability_label:
                quotaCode === 'PT' ? `PT EST. (${remaining})` : `AVL ${remaining}`,
              quota: quotaCode,
              railcore_supported: quotaCode !== 'PT',
              quota_note: quotaCode === 'PT' ? ptNote : undefined,
            };
          }
          if (remaining > -10) {
            const racNo = Math.max(1, 1 - remaining);
            return {
              class_code: cls.class_code,
              class_name: cls.class_name,
              segment_fare: segmentFare,
              total_seats: cls.total_seats,
              booked_seats: bookedSeats,
              available_seats: 0,
              availability_status: 'RAC',
              availability_label: `RAC ${racNo}`,
              quota: quotaCode,
            };
          }
          const wlNo = Math.abs(remaining + 9);
          return {
            class_code: cls.class_code,
            class_name: cls.class_name,
            segment_fare: segmentFare,
            total_seats: cls.total_seats,
            booked_seats: bookedSeats,
            available_seats: 0,
            availability_status: 'WAITLIST',
            availability_label: `${wlPrefix} ${wlNo}`,
            quota: quotaCode,
          };
        })
      );

      dbResults.push({
        train,
        from_stop: fromStop,
        to_stop: toStop,
        segment_distance_km: segmentDistance,
        segment_duration_minutes: segmentDuration,
        journey_date: journeyDate,
        runs_on_date: doesTrainRunOnDate(train.running_days, journeyDate),
        quota: quotaCode,
        quota_label: QUOTA_NAME_MAP[quotaCode],
        quota_note: quotaCode === 'PT' ? ptNote : undefined,
        classes: classAvailabilities,
      });
    }

    // Prefer RailCore live route results when available so live quota fares/statuses show accurately
    const mergedByTrain = new Map<string, TrainSearchResult>();
    for (const r of railcoreSearch.results) {
      mergedByTrain.set(r.train.train_number, r);
    }
    for (const r of dbResults) {
      if (!mergedByTrain.has(r.train.train_number)) {
        mergedByTrain.set(r.train.train_number, r);
      }
    }

    const results = Array.from(mergedByTrain.values());
    results.sort((a, b) => {
      if (a.runs_on_date !== b.runs_on_date) return a.runs_on_date ? -1 : 1;
      return a.from_stop.departure_time.localeCompare(b.from_stop.departure_time);
    });

    return results;
  },

  /**
   * Queries live seat availability for a specific train, class, date, and quota
   * via RailCore `/v1/availability/seats` with graceful DB fallback.
   */
  async checkLiveQuotaAvailability(params: {
    trainNumber: string;
    from: string;
    to: string;
    date: string;
    classCode: string;
    quota: string;
  }) {
    const classCode = params.classCode.trim().toUpperCase() as ClassCode;
    const quotaCode = normalizeQuotaCode(params.quota);
    const fromCode = params.from.trim().toUpperCase();
    const toCode = params.to.trim().toUpperCase();

    if ((quotaCode === 'TQ' || quotaCode === 'PT') && classCode === '1A') {
      throw new AppError(
        '1A (AC First Class) is not offered under Tatkal or Premium Tatkal quota.',
        400,
        'CLASS_NOT_ELIGIBLE_FOR_QUOTA'
      );
    }

    if (env.railcore.configured) {
      const live = await railcoreCatalogService.checkSeatAvailability({
        trainNumber: params.trainNumber.trim(),
        from: fromCode,
        to: toCode,
        date: params.date.trim(),
        classCode,
        quotaCode,
      });
      if (live) return live;
    }

    // Fallback to DB schedule & fare calculation
    await this.ensureTrainForBooking(params.trainNumber, fromCode, toCode);
    const train = await repository.getTrainByNumberOrId(params.trainNumber.trim());
    if (!train) throw new AppError('Train not found.', 404, 'TRAIN_NOT_FOUND');

    const [stops, classes] = await Promise.all([
      repository.getTrainSchedule(train.id),
      repository.getTrainClasses(train.id),
    ]);
    const fromStop = stops.find((s) => s.station_code === fromCode);
    const toStop = stops.find((s) => s.station_code === toCode);
    const cls = classes.find((c) => c.class_code === classCode);
    if (!fromStop || !toStop || !cls) {
      throw new AppError('Invalid route or class.', 400, 'VALIDATION_ERROR');
    }

    const segmentDist = Math.max(
      50,
      toStop.distance_from_source_km - fromStop.distance_from_source_km
    );
    const baseFare = calculateSegmentFare(cls, segmentDist, train.total_distance_km);
    const { fare, tatkalCharge } = paymentService.calculateQuotaFare(
      baseFare,
      classCode,
      quotaCode
    );
    const booked = await repository.countBookedSeats(train.id, params.date, classCode);
    const remaining = Math.max(0, cls.total_seats - booked);

    return {
      train_number: train.train_number,
      from: fromCode,
      to: toCode,
      journey_date: params.date,
      class_code: classCode,
      quota: quotaCode,
      quota_label: QUOTA_NAME_MAP[quotaCode],
      source: 'DYNAMIC_ESTIMATE' as const,
      railcore_supported: false,
      status: remaining > 0 ? 'AVAILABLE' : 'WAITLIST',
      availability_text: remaining > 0 ? `AVL ${remaining}` : 'WL 1',
      fare,
      tatkal_charge: tatkalCharge,
      confirmation_probability: null,
      note:
        quotaCode === 'PT'
          ? 'Dynamic PT fare estimate (RailCore API supports live seats for GN, TQ, SS, LD only).'
          : 'Schedule-based estimate (live RailCore response unavailable).',
    };
  },

  async getTrainScheduleByNumber(trainNumber: string): Promise<{
    train: Train;
    stops: TrainScheduleStop[];
    classes: TrainClass[];
  }> {
    const clean = trainNumber.trim();
    const train = await repository.getTrainByNumberOrId(clean);
    if (train) {
      const [stops, classes] = await Promise.all([
        repository.getTrainSchedule(train.id),
        repository.getTrainClasses(train.id),
      ]);
      if (stops.length > 0 && classes.length > 0) {
        return { train, stops, classes };
      }
    }

    if (env.railcore.configured) {
      const rcSchedule = await railcoreCatalogService.getTrainSchedule(clean);
      if (rcSchedule) {
        return {
          train: rcSchedule.train,
          stops: rcSchedule.stops,
          classes: rcSchedule.classes,
        };
      }
    }

    throw new AppError(`Train ${trainNumber} was not found.`, 404, 'TRAIN_NOT_FOUND');
  },

  /**
   * Ensures a train (and its route stations/classes) exists in the database before
   * computing a booking quote or inserting a booking row with Foreign Keys.
   */
  async ensureTrainForBooking(
    trainNumber: string,
    fromCode: string,
    toCode: string
  ): Promise<void> {
    const clean = trainNumber.trim();
    const existing = await repository.getTrainByNumberOrId(clean);
    if (existing) {
      const stops = await repository.getTrainSchedule(existing.id);
      const hasFrom = stops.some((s) => s.station_code === fromCode.toUpperCase());
      const hasTo = stops.some((s) => s.station_code === toCode.toUpperCase());
      if (hasFrom && hasTo) return;
    }

    if (!env.railcore.configured) return;

    const rcSchedule = await railcoreCatalogService.getTrainSchedule(clean);
    if (!rcSchedule) return;

    await repository.ensureTrainCatalog({
      train: {
        train_number: rcSchedule.train.train_number,
        train_name: rcSchedule.train.train_name,
        train_type: rcSchedule.train.train_type,
        source_station_code: rcSchedule.train.source_station_code,
        destination_station_code: rcSchedule.train.destination_station_code,
        running_days: rcSchedule.train.running_days,
        total_distance_km: rcSchedule.train.total_distance_km,
        duration_minutes: rcSchedule.train.duration_minutes,
        is_active: true,
      },
      stops: rcSchedule.stops.map(({ id: _id, train_id: _tid, ...rest }) => rest),
      classes: rcSchedule.classes.map(({ id: _id, train_id: _tid, ...rest }) => rest),
      stations: rcSchedule.discoveredStations,
    });
  },
};
