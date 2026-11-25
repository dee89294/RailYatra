/**
 * ============================================================================
 * File: server/src/db/repository.ts
 * Purpose: Unified Repository (Data Access Layer) for RailYatra.
 * Responsibilities:
 *   - Abstracts database queries away from business services (`trainService`,
 *     `bookingService`, `adminService`, `authService`, etc.).
 *   - Automatically routes reads/writes to either **Supabase PostgreSQL**
 *     (respecting RLS via `createSupabaseUserClient` or trusted `getSupabaseAdmin`)
 *     OR **local SQLite** (`getSqliteDb()`).
 * Used by: All files in `server/src/services/`.
 * Database tables interacted with: `profiles`, `stations`, `trains`,
 *   `train_schedules`, `train_classes`, `bookings`, `passengers`, `payments`,
 *   `saved_passengers`, `contact_messages`, `auth_tokens`.
 * ============================================================================
 */

import { env } from '../config/env.js';
import { getSqliteDb } from './sqliteClient.js';
import { createSupabaseUserClient, getSupabaseAdmin } from './supabaseClient.js';
import { createUuid } from '../utils/seedData.js';
import type {
  Booking,
  BookingDetails,
  ClassCode,
  ContactMessage,
  InternalUserRecord,
  Passenger,
  Payment,
  SavedPassenger,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  UserProfile,
} from '../types/index.js';

function mapSqliteProfile(row: Record<string, unknown>): InternalUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    full_name: String(row.full_name),
    phone: String(row.phone || ''),
    role: (row.role as 'user' | 'admin') || 'user',
    email_verified: Boolean(row.email_verified),
    password_hash: row.password_hash ? String(row.password_hash) : null,
    avatar_color: String(row.avatar_color || '#0B6EFD'),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapTrainRow(row: Record<string, unknown>): Train {
  return {
    id: String(row.id),
    train_number: String(row.train_number),
    train_name: String(row.train_name),
    train_type: row.train_type as Train['train_type'],
    source_station_code: String(row.source_station_code),
    destination_station_code: String(row.destination_station_code),
    running_days: String(row.running_days),
    total_distance_km: Number(row.total_distance_km),
    duration_minutes: Number(row.duration_minutes),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

function mapTrainClassRow(row: Record<string, unknown>): TrainClass {
  let coaches: string[] = [];
  try {
    coaches =
      typeof row.coaches === 'string'
        ? (JSON.parse(row.coaches) as string[])
        : Array.isArray(row.coaches)
          ? (row.coaches as string[])
          : [];
  } catch {
    coaches = ['B1'];
  }
  return {
    id: String(row.id),
    train_id: String(row.train_id),
    class_code: row.class_code as ClassCode,
    class_name: String(row.class_name),
    base_fare: Number(row.base_fare),
    total_seats: Number(row.total_seats),
    coaches,
  };
}

export const repository = {
  // ==========================================================================
  // PROFILES & AUTH TOKENS
  // ==========================================================================
  async getProfileByEmail(email: string): Promise<InternalUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('*')
        .eq('email', normalized)
        .maybeSingle();
      if (error || !data) return null;
      return { ...data, password_hash: null } as InternalUserRecord;
    }

    const row = getSqliteDb()
      .prepare('SELECT * FROM profiles WHERE lower(email) = ?')
      .get(normalized) as Record<string, unknown> | undefined;
    return row ? mapSqliteProfile(row) : null;
  },

  async getProfileById(id: string): Promise<InternalUserRecord | null> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return { ...data, password_hash: null } as InternalUserRecord;
    }

    const row = getSqliteDb()
      .prepare('SELECT * FROM profiles WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapSqliteProfile(row) : null;
  },

  async createLocalProfile(input: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    password_hash: string;
    email_verified?: boolean;
  }): Promise<UserProfile> {
    const now = new Date().toISOString();
    getSqliteDb()
      .prepare(
        `INSERT INTO profiles (id, email, full_name, phone, role, email_verified, password_hash, avatar_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', ?, ?, '#0B6EFD', ?, ?)`
      )
      .run(
        input.id,
        input.email.toLowerCase(),
        input.full_name,
        input.phone,
        input.email_verified ? 1 : 0,
        input.password_hash,
        now,
        now
      );

    const created = await this.getProfileById(input.id);
    if (!created) throw new Error('Failed to create user profile');
    const { password_hash: _ignored, ...safeProfile } = created;
    return safeProfile;
  },

  async updateProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, 'full_name' | 'phone' | 'email_verified' | 'role'>>,
    accessToken?: string
  ): Promise<UserProfile | null> {
    if (env.provider === 'supabase') {
      const client = accessToken && !updates.role
        ? createSupabaseUserClient(accessToken)
        : getSupabaseAdmin();
      const { data, error } = await client
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select('*')
        .single();
      if (error || !data) return null;
      return data as UserProfile;
    }

    const existing = await this.getProfileById(userId);
    if (!existing) return null;

    getSqliteDb()
      .prepare(
        `UPDATE profiles
         SET full_name = ?, phone = ?, email_verified = ?, role = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        updates.full_name ?? existing.full_name,
        updates.phone ?? existing.phone,
        updates.email_verified !== undefined
          ? updates.email_verified
            ? 1
            : 0
          : existing.email_verified
            ? 1
            : 0,
        updates.role ?? existing.role,
        new Date().toISOString(),
        userId
      );

    const updated = await this.getProfileById(userId);
    if (!updated) return null;
    const { password_hash: _ignored, ...safeProfile } = updated;
    return safeProfile;
  },

  async updateLocalPassword(userId: string, passwordHash: string): Promise<void> {
    getSqliteDb()
      .prepare('UPDATE profiles SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), userId);
  },

  async storeLocalAuthToken(input: {
    userId: string;
    tokenHash: string;
    tokenType: 'EMAIL_VERIFY' | 'PASSWORD_RESET';
    expiresAt: string;
  }): Promise<void> {
    getSqliteDb()
      .prepare(
        `INSERT INTO auth_tokens (id, user_id, token_hash, token_type, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(createUuid(), input.userId, input.tokenHash, input.tokenType, input.expiresAt);
  },

  async consumeLocalAuthToken(
    tokenHash: string,
    tokenType: 'EMAIL_VERIFY' | 'PASSWORD_RESET'
  ): Promise<{ user_id: string } | null> {
    const db = getSqliteDb();
    const row = db
      .prepare(
        `SELECT * FROM auth_tokens
         WHERE token_hash = ? AND token_type = ? AND used_at IS NULL`
      )
      .get(tokenHash, tokenType) as Record<string, unknown> | undefined;

    if (!row) return null;
    if (new Date(String(row.expires_at)).getTime() < Date.now()) {
      return null;
    }

    db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      String(row.id)
    );
    return { user_id: String(row.user_id) };
  },

  // ==========================================================================
  // STATIONS & TRAINS
  // ==========================================================================
  async listStations(query?: string): Promise<Station[]> {
    if (env.provider === 'supabase') {
      let builder = getSupabaseAdmin().from('stations').select('*').order('city');
      if (query && query.trim()) {
        const q = query.trim();
        builder = builder.or(`code.ilike.%${q}%,name.ilike.%${q}%,city.ilike.%${q}%`);
      }
      const { data, error } = await builder;
      if (error) throw error;
      return (data || []) as Station[];
    }

    const db = getSqliteDb();
    if (query && query.trim()) {
      const pattern = `%${query.trim().toLowerCase()}%`;
      return db
        .prepare(
          `SELECT * FROM stations
           WHERE lower(code) LIKE ? OR lower(name) LIKE ? OR lower(city) LIKE ?
           ORDER BY city ASC`
        )
        .all(pattern, pattern, pattern) as unknown as Station[];
    }
    return db.prepare('SELECT * FROM stations ORDER BY city ASC').all() as unknown as Station[];
  },

  async createStation(station: Omit<Station, 'id'>): Promise<Station> {
    const code = station.code.trim().toUpperCase();
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('stations')
        .insert({ ...station, code })
        .select('*')
        .single();
      if (error || !data) throw error || new Error('Failed to create station');
      return data as Station;
    }

    const id = createUuid();
    getSqliteDb()
      .prepare('INSERT INTO stations (id, code, name, city, state, zone) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, code, station.name, station.city, station.state, station.zone.toUpperCase());
    return { id, ...station, code, zone: station.zone.toUpperCase() };
  },

  async upsertStationsBatch(stations: Array<Omit<Station, 'id'>>): Promise<void> {
    if (stations.length === 0) return;
    const normalized = stations.map((s) => ({
      code: s.code.trim().toUpperCase(),
      name: s.name.trim(),
      city: s.city.trim(),
      state: s.state.trim() || 'India',
      zone: s.zone.trim().toUpperCase() || 'IR',
    }));

    if (env.provider === 'supabase') {
      await getSupabaseAdmin()
        .from('stations')
        .upsert(normalized, { onConflict: 'code', ignoreDuplicates: true });
      return;
    }

    const db = getSqliteDb();
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO stations (id, code, name, city, state, zone) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const s of normalized) {
      stmt.run(createUuid(), s.code, s.name, s.city, s.state, s.zone);
    }
  },

  async ensureTrainCatalog(input: {
    train: Omit<Train, 'id' | 'created_at'>;
    stops: Array<Omit<TrainScheduleStop, 'id' | 'train_id'>>;
    classes: Array<Omit<TrainClass, 'id' | 'train_id'>>;
    stations: Array<Omit<Station, 'id'>>;
  }): Promise<Train> {
    await this.upsertStationsBatch(input.stations);

    const existing = await this.getTrainByNumberOrId(input.train.train_number);
    if (existing) {
      const [curStops, curClasses] = await Promise.all([
        this.getTrainSchedule(existing.id),
        this.getTrainClasses(existing.id),
      ]);

      if (env.provider === 'supabase') {
        const admin = getSupabaseAdmin();
        if (curStops.length === 0 && input.stops.length > 0) {
          const { error } = await admin.from('train_schedules').upsert(
            input.stops.map((s) => ({
              train_id: existing.id,
              station_code: s.station_code,
              stop_order: s.stop_order,
              arrival_time: s.arrival_time,
              departure_time: s.departure_time,
              halt_minutes: s.halt_minutes,
              day_number: s.day_number,
              distance_from_source_km: s.distance_from_source_km,
              platform: s.platform || '1',
            })),
            { onConflict: 'train_id,station_code' }
          );
          if (error) throw error;
        }
        if (curClasses.length === 0 && input.classes.length > 0) {
          const { error } = await admin.from('train_classes').upsert(
            input.classes.map((c) => ({
              train_id: existing.id,
              class_code: c.class_code,
              class_name: c.class_name,
              base_fare: c.base_fare,
              total_seats: c.total_seats,
              coaches: JSON.stringify(c.coaches),
            })),
            { onConflict: 'train_id,class_code' }
          );
          if (error) throw error;
        }
      }
      return existing;
    }

    return this.createTrainWithDetails({
      train_number: input.train.train_number,
      train_name: input.train.train_name,
      train_type: input.train.train_type,
      source_station_code: input.train.source_station_code,
      destination_station_code: input.train.destination_station_code,
      running_days: input.train.running_days,
      total_distance_km: input.train.total_distance_km,
      duration_minutes: input.train.duration_minutes,
      stops: input.stops,
      classes: input.classes,
    });
  },

  async listTrains(includeInactive = false): Promise<Train[]> {
    if (env.provider === 'supabase') {
      let q = getSupabaseAdmin().from('trains').select('*').order('train_number');
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map((r) => mapTrainRow(r as Record<string, unknown>));
    }

    const sql = includeInactive
      ? 'SELECT * FROM trains ORDER BY train_number ASC'
      : 'SELECT * FROM trains WHERE is_active = 1 ORDER BY train_number ASC';
    const rows = getSqliteDb().prepare(sql).all() as Record<string, unknown>[];
    return rows.map(mapTrainRow);
  },

  async getTrainByNumberOrId(identifier: string): Promise<Train | null> {
    const clean = identifier.trim();
    if (env.provider === 'supabase') {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
      const query = getSupabaseAdmin().from('trains').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', clean).maybeSingle()
        : await query.eq('train_number', clean).maybeSingle();
      if (error || !data) return null;
      return mapTrainRow(data as Record<string, unknown>);
    }

    const row = getSqliteDb()
      .prepare('SELECT * FROM trains WHERE train_number = ? OR id = ?')
      .get(clean, clean) as Record<string, unknown> | undefined;
    return row ? mapTrainRow(row) : null;
  },

  async getTrainSchedule(trainId: string): Promise<TrainScheduleStop[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('train_schedules')
        .select('*, stations(name, city)')
        .eq('train_id', trainId)
        .order('stop_order');
      if (error) throw error;
      return (data || []).map((r: Record<string, unknown>) => {
        const stationObj = r.stations as { name?: string; city?: string } | undefined;
        return {
          id: String(r.id),
          train_id: String(r.train_id),
          station_code: String(r.station_code),
          station_name: stationObj?.name,
          city: stationObj?.city,
          stop_order: Number(r.stop_order),
          arrival_time: String(r.arrival_time),
          departure_time: String(r.departure_time),
          halt_minutes: Number(r.halt_minutes),
          day_number: Number(r.day_number),
          distance_from_source_km: Number(r.distance_from_source_km),
          platform: String(r.platform),
        };
      });
    }

    const rows = getSqliteDb()
      .prepare(
        `SELECT ts.*, s.name as station_name, s.city as city
         FROM train_schedules ts
         JOIN stations s ON s.code = ts.station_code
         WHERE ts.train_id = ?
         ORDER BY ts.stop_order ASC`
      )
      .all(trainId) as unknown as TrainScheduleStop[];
    return rows;
  },

  async getTrainClasses(trainId: string): Promise<TrainClass[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('train_classes')
        .select('*')
        .eq('train_id', trainId);
      if (error) throw error;
      return (data || []).map((r) => mapTrainClassRow(r as Record<string, unknown>));
    }

    const rows = getSqliteDb()
      .prepare('SELECT * FROM train_classes WHERE train_id = ?')
      .all(trainId) as Record<string, unknown>[];
    return rows.map(mapTrainClassRow);
  },

  async countBookedSeats(
    trainId: string,
    journeyDate: string,
    classCode: ClassCode
  ): Promise<number> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select('id, passengers(id, current_status)')
        .eq('train_id', trainId)
        .eq('journey_date', journeyDate)
        .eq('class_code', classCode)
        .neq('booking_status', 'CANCELLED');
      if (error) throw error;
      let count = 0;
      for (const b of data || []) {
        const pax = (b.passengers || []) as Array<{ current_status: string }>;
        count += pax.filter((p) => p.current_status !== 'CAN').length;
      }
      return count;
    }

    const row = getSqliteDb()
      .prepare(
        `SELECT COUNT(p.id) as booked_count
         FROM passengers p
         JOIN bookings b ON b.id = p.booking_id
         WHERE b.train_id = ?
           AND b.journey_date = ?
           AND b.class_code = ?
           AND b.booking_status != 'CANCELLED'
           AND p.current_status != 'CAN'`
      )
      .get(trainId, journeyDate, classCode) as { booked_count: number } | undefined;
    return row ? Number(row.booked_count) : 0;
  },

  async getAllocatedSeatsForClassDate(
    trainId: string,
    journeyDate: string,
    classCode: ClassCode
  ): Promise<Array<{ coach: string; seat_number: string }>> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select('passengers(coach, seat_number, current_status)')
        .eq('train_id', trainId)
        .eq('journey_date', journeyDate)
        .eq('class_code', classCode)
        .neq('booking_status', 'CANCELLED');
      if (error) throw error;
      const taken: Array<{ coach: string; seat_number: string }> = [];
      for (const b of data || []) {
        const pax = (b.passengers || []) as Array<{
          coach: string | null;
          seat_number: string | null;
          current_status: string;
        }>;
        for (const p of pax) {
          if (p.current_status === 'CNF' && p.coach && p.seat_number) {
            taken.push({ coach: p.coach, seat_number: p.seat_number });
          }
        }
      }
      return taken;
    }

    return getSqliteDb()
      .prepare(
        `SELECT p.coach, p.seat_number
         FROM passengers p
         JOIN bookings b ON b.id = p.booking_id
         WHERE b.train_id = ?
           AND b.journey_date = ?
           AND b.class_code = ?
           AND p.current_status = 'CNF'
           AND p.coach IS NOT NULL
           AND p.seat_number IS NOT NULL`
      )
      .all(trainId, journeyDate, classCode) as Array<{
      coach: string;
      seat_number: string;
    }>;
  },

  // ==========================================================================
  // BOOKINGS, PASSENGERS & PAYMENTS
  // ==========================================================================
  async createBookingBundle(input: {
    booking: Omit<Booking, 'id' | 'booked_at' | 'cancelled_at'>;
    passengers: Array<Omit<Passenger, 'id' | 'booking_id'>>;
    payment: Omit<Payment, 'id' | 'booking_id' | 'paid_at'>;
  }): Promise<BookingDetails> {
    if (env.provider === 'supabase') {
      const admin = getSupabaseAdmin();
      const { data: bookingRow, error: bErr } = await admin
        .from('bookings')
        .insert(input.booking)
        .select('*')
        .single();
      if (bErr || !bookingRow) throw bErr || new Error('Booking creation failed');

      const paxPayload = input.passengers.map((p) => ({
        ...p,
        booking_id: bookingRow.id,
      }));
      const { error: pErr } = await admin.from('passengers').insert(paxPayload);
      if (pErr) throw pErr;

      const { error: payErr } = await admin.from('payments').insert({
        ...input.payment,
        booking_id: bookingRow.id,
      });
      if (payErr) throw payErr;

      const full = await this.getBookingByPnr(bookingRow.pnr_number);
      if (!full) throw new Error('Booking saved but could not reload details');
      return full;
    }

    const db = getSqliteDb();
    const bookingId = createUuid();
    const now = new Date().toISOString();

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        `INSERT INTO bookings
         (id, pnr_number, user_id, train_id, from_station_code, to_station_code, journey_date, class_code, quota,
          booking_status, chart_prepared, contact_email, contact_phone, base_fare_total, convenience_fee, gst_amount,
          total_amount, refund_amount, booked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        bookingId,
        input.booking.pnr_number,
        input.booking.user_id,
        input.booking.train_id,
        input.booking.from_station_code,
        input.booking.to_station_code,
        input.booking.journey_date,
        input.booking.class_code,
        input.booking.quota,
        input.booking.booking_status,
        input.booking.chart_prepared ? 1 : 0,
        input.booking.contact_email,
        input.booking.contact_phone,
        input.booking.base_fare_total,
        input.booking.convenience_fee,
        input.booking.gst_amount,
        input.booking.total_amount,
        input.booking.refund_amount,
        now
      );

      const insPax = db.prepare(
        `INSERT INTO passengers
         (id, booking_id, full_name, age, gender, berth_preference, coach, seat_number, berth_type, current_status, waitlist_position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const p of input.passengers) {
        insPax.run(
          createUuid(),
          bookingId,
          p.full_name,
          p.age,
          p.gender,
          p.berth_preference,
          p.coach,
          p.seat_number,
          p.berth_type,
          p.current_status,
          p.waitlist_position
        );
      }

      db.prepare(
        `INSERT INTO payments
         (id, booking_id, user_id, transaction_id, payment_method, payment_provider, amount, currency, status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        createUuid(),
        bookingId,
        input.payment.user_id,
        input.payment.transaction_id,
        input.payment.payment_method,
        input.payment.payment_provider,
        input.payment.amount,
        input.payment.currency,
        input.payment.status,
        now
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const full = await this.getBookingByPnr(input.booking.pnr_number);
    if (!full) throw new Error('Booking saved but could not reload details');
    return full;
  },

  async getBookingByPnr(pnr: string): Promise<BookingDetails | null> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select('*, trains(*), passengers(*), payments(*)')
        .eq('pnr_number', pnr.trim())
        .maybeSingle();
      if (error || !data) return null;
      return this.hydrateSupabaseBooking(data as Record<string, unknown>);
    }

    const row = getSqliteDb()
      .prepare('SELECT * FROM bookings WHERE pnr_number = ?')
      .get(pnr.trim()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.hydrateSqliteBooking(row);
  },

  async getBookingById(id: string): Promise<BookingDetails | null> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select('*, trains(*), passengers(*), payments(*)')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return this.hydrateSupabaseBooking(data as Record<string, unknown>);
    }

    const row = getSqliteDb()
      .prepare('SELECT * FROM bookings WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.hydrateSqliteBooking(row);
  },

  async listBookingsForUser(
    userId: string,
    accessToken?: string
  ): Promise<BookingDetails[]> {
    if (env.provider === 'supabase') {
      // Uses RLS-scoped client when accessToken is provided so PostgreSQL enforces `auth.uid() = user_id`
      const client = accessToken
        ? createSupabaseUserClient(accessToken)
        : getSupabaseAdmin();
      const { data, error } = await client
        .from('bookings')
        .select('*, trains(*), passengers(*), payments(*)')
        .eq('user_id', userId)
        .order('booked_at', { ascending: false });
      if (error) throw error;
      return Promise.all(
        (data || []).map((row) =>
          this.hydrateSupabaseBooking(row as Record<string, unknown>)
        )
      );
    }

    const rows = getSqliteDb()
      .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY booked_at DESC')
      .all(userId) as Record<string, unknown>[];
    return Promise.all(rows.map((r) => this.hydrateSqliteBooking(r)));
  },

  async listAllBookings(): Promise<BookingDetails[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('bookings')
        .select('*, trains(*), passengers(*), payments(*)')
        .order('booked_at', { ascending: false });
      if (error) throw error;
      return Promise.all(
        (data || []).map((row) =>
          this.hydrateSupabaseBooking(row as Record<string, unknown>)
        )
      );
    }

    const rows = getSqliteDb()
      .prepare('SELECT * FROM bookings ORDER BY booked_at DESC')
      .all() as Record<string, unknown>[];
    return Promise.all(rows.map((r) => this.hydrateSqliteBooking(r)));
  },

  async cancelPassengersOrBooking(input: {
    bookingId: string;
    passengerIds?: string[];
    refundAmount: number;
    newBookingStatus: Booking['booking_status'];
    paymentStatus: Payment['status'];
  }): Promise<BookingDetails> {
    const now = new Date().toISOString();
    if (env.provider === 'supabase') {
      const admin = getSupabaseAdmin();
      if (input.passengerIds && input.passengerIds.length > 0) {
        await admin
          .from('passengers')
          .update({ current_status: 'CAN', coach: null, seat_number: null })
          .in('id', input.passengerIds);
      } else {
        await admin
          .from('passengers')
          .update({ current_status: 'CAN', coach: null, seat_number: null })
          .eq('booking_id', input.bookingId);
      }

      await admin
        .from('bookings')
        .update({
          booking_status: input.newBookingStatus,
          refund_amount: input.refundAmount,
          cancelled_at: now,
        })
        .eq('id', input.bookingId);

      await admin
        .from('payments')
        .update({ status: input.paymentStatus })
        .eq('booking_id', input.bookingId);

      const updated = await this.getBookingById(input.bookingId);
      if (!updated) throw new Error('Booking not found after cancellation');
      return updated;
    }

    const db = getSqliteDb();
    db.exec('BEGIN TRANSACTION;');
    try {
      if (input.passengerIds && input.passengerIds.length > 0) {
        const stmt = db.prepare(
          `UPDATE passengers SET current_status = 'CAN', coach = NULL, seat_number = NULL WHERE id = ? AND booking_id = ?`
        );
        for (const pid of input.passengerIds) {
          stmt.run(pid, input.bookingId);
        }
      } else {
        db.prepare(
          `UPDATE passengers SET current_status = 'CAN', coach = NULL, seat_number = NULL WHERE booking_id = ?`
        ).run(input.bookingId);
      }

      db.prepare(
        `UPDATE bookings SET booking_status = ?, refund_amount = ?, cancelled_at = ? WHERE id = ?`
      ).run(input.newBookingStatus, input.refundAmount, now, input.bookingId);

      db.prepare('UPDATE payments SET status = ? WHERE booking_id = ?').run(
        input.paymentStatus,
        input.bookingId
      );

      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const updated = await this.getBookingById(input.bookingId);
    if (!updated) throw new Error('Booking not found after cancellation');
    return updated;
  },

  async updateBookingAdminFields(
    bookingId: string,
    updates: { booking_status?: Booking['booking_status']; chart_prepared?: boolean }
  ): Promise<BookingDetails | null> {
    if (env.provider === 'supabase') {
      const { error } = await getSupabaseAdmin()
        .from('bookings')
        .update(updates)
        .eq('id', bookingId);
      if (error) throw error;
      return this.getBookingById(bookingId);
    }

    const existing = await this.getBookingById(bookingId);
    if (!existing) return null;
    getSqliteDb()
      .prepare('UPDATE bookings SET booking_status = ?, chart_prepared = ? WHERE id = ?')
      .run(
        updates.booking_status ?? existing.booking_status,
        updates.chart_prepared !== undefined
          ? updates.chart_prepared
            ? 1
            : 0
          : existing.chart_prepared
            ? 1
            : 0,
        bookingId
      );
    return this.getBookingById(bookingId);
  },

  // ==========================================================================
  // ADMIN TRAIN CREATION & UPDATES
  // ==========================================================================
  async createTrainWithDetails(input: {
    train_number: string;
    train_name: string;
    train_type: Train['train_type'];
    source_station_code: string;
    destination_station_code: string;
    running_days: string;
    total_distance_km: number;
    duration_minutes: number;
    stops: Array<Omit<TrainScheduleStop, 'id' | 'train_id'>>;
    classes: Array<Omit<TrainClass, 'id' | 'train_id'>>;
  }): Promise<Train> {
    if (env.provider === 'supabase') {
      const admin = getSupabaseAdmin();
      const { data: tRow, error } = await admin
        .from('trains')
        .insert({
          train_number: input.train_number,
          train_name: input.train_name,
          train_type: input.train_type,
          source_station_code: input.source_station_code,
          destination_station_code: input.destination_station_code,
          running_days: input.running_days,
          total_distance_km: input.total_distance_km,
          duration_minutes: input.duration_minutes,
          is_active: true,
        })
        .select('*')
        .single();
      if (error || !tRow) throw error || new Error('Failed to create train');

      if (input.stops.length > 0) {
        const stopRows = input.stops.map((s) => ({
          train_id: tRow.id,
          station_code: s.station_code,
          stop_order: s.stop_order,
          arrival_time: s.arrival_time,
          departure_time: s.departure_time,
          halt_minutes: s.halt_minutes,
          day_number: s.day_number,
          distance_from_source_km: s.distance_from_source_km,
          platform: s.platform || '1',
        }));
        const { error: stopErr } = await admin
          .from('train_schedules')
          .upsert(stopRows, { onConflict: 'train_id,station_code' });
        if (stopErr) throw stopErr;
      }
      if (input.classes.length > 0) {
        const classRows = input.classes.map((c) => ({
          train_id: tRow.id,
          class_code: c.class_code,
          class_name: c.class_name,
          base_fare: c.base_fare,
          total_seats: c.total_seats,
          coaches: JSON.stringify(c.coaches),
        }));
        const { error: clsErr } = await admin
          .from('train_classes')
          .upsert(classRows, { onConflict: 'train_id,class_code' });
        if (clsErr) throw clsErr;
      }
      return mapTrainRow(tRow as Record<string, unknown>);
    }

    const db = getSqliteDb();
    const trainId = createUuid();
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(
        `INSERT INTO trains
         (id, train_number, train_name, train_type, source_station_code, destination_station_code, running_days, total_distance_km, duration_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(
        trainId,
        input.train_number,
        input.train_name,
        input.train_type,
        input.source_station_code,
        input.destination_station_code,
        input.running_days,
        input.total_distance_km,
        input.duration_minutes
      );

      const insStop = db.prepare(
        `INSERT INTO train_schedules
         (id, train_id, station_code, stop_order, arrival_time, departure_time, halt_minutes, day_number, distance_from_source_km, platform)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const s of input.stops) {
        insStop.run(
          createUuid(),
          trainId,
          s.station_code,
          s.stop_order,
          s.arrival_time,
          s.departure_time,
          s.halt_minutes,
          s.day_number,
          s.distance_from_source_km,
          s.platform || '1'
        );
      }

      const insClass = db.prepare(
        `INSERT INTO train_classes
         (id, train_id, class_code, class_name, base_fare, total_seats, coaches)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const c of input.classes) {
        insClass.run(
          createUuid(),
          trainId,
          c.class_code,
          c.class_name,
          c.base_fare,
          c.total_seats,
          JSON.stringify(c.coaches)
        );
      }
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }

    const created = await this.getTrainByNumberOrId(trainId);
    if (!created) throw new Error('Failed to fetch created train');
    return created;
  },

  async toggleTrainActive(trainId: string, isActive: boolean): Promise<Train | null> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('trains')
        .update({ is_active: isActive })
        .eq('id', trainId)
        .select('*')
        .maybeSingle();
      if (error || !data) return null;
      return mapTrainRow(data as Record<string, unknown>);
    }

    getSqliteDb()
      .prepare('UPDATE trains SET is_active = ? WHERE id = ?')
      .run(isActive ? 1 : 0, trainId);
    return this.getTrainByNumberOrId(trainId);
  },

  // ==========================================================================
  // SAVED PASSENGERS, USERS & CONTACT MESSAGES
  // ==========================================================================
  async listSavedPassengers(userId: string): Promise<SavedPassenger[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('saved_passengers')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SavedPassenger[];
    }

    return getSqliteDb()
      .prepare('SELECT * FROM saved_passengers WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as SavedPassenger[];
  },

  async addSavedPassenger(
    userId: string,
    input: Omit<SavedPassenger, 'id' | 'user_id' | 'created_at'>
  ): Promise<SavedPassenger> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('saved_passengers')
        .insert({ ...input, user_id: userId })
        .select('*')
        .single();
      if (error || !data) throw error || new Error('Failed to save passenger');
      return data as SavedPassenger;
    }

    const id = createUuid();
    const now = new Date().toISOString();
    getSqliteDb()
      .prepare(
        `INSERT INTO saved_passengers (id, user_id, full_name, age, gender, berth_preference, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, userId, input.full_name, input.age, input.gender, input.berth_preference, now);
    return { id, user_id: userId, ...input, created_at: now };
  },

  async deleteSavedPassenger(userId: string, passengerId: string): Promise<void> {
    if (env.provider === 'supabase') {
      await getSupabaseAdmin()
        .from('saved_passengers')
        .delete()
        .eq('id', passengerId)
        .eq('user_id', userId);
      return;
    }
    getSqliteDb()
      .prepare('DELETE FROM saved_passengers WHERE id = ? AND user_id = ?')
      .run(passengerId, userId);
  },

  async listAllUsers(): Promise<UserProfile[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, email, full_name, phone, role, email_verified, avatar_color, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as UserProfile[];
    }

    const rows = getSqliteDb()
      .prepare('SELECT * FROM profiles ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map((r) => {
      const { password_hash: _ignored, ...safe } = mapSqliteProfile(r);
      return safe;
    });
  },

  async createContactMessage(
    input: Omit<ContactMessage, 'id' | 'status' | 'created_at'>
  ): Promise<ContactMessage> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('contact_messages')
        .insert({ ...input, status: 'NEW' })
        .select('*')
        .single();
      if (error || !data) throw error || new Error('Failed to submit inquiry');
      return data as ContactMessage;
    }

    const id = createUuid();
    const now = new Date().toISOString();
    getSqliteDb()
      .prepare(
        `INSERT INTO contact_messages (id, name, email, subject, pnr_reference, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'NEW', ?)`
      )
      .run(id, input.name, input.email, input.subject, input.pnr_reference || '', input.message, now);
    return { id, ...input, status: 'NEW', created_at: now };
  },

  async listContactMessages(): Promise<ContactMessage[]> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContactMessage[];
    }

    return getSqliteDb()
      .prepare('SELECT * FROM contact_messages ORDER BY created_at DESC')
      .all() as unknown as ContactMessage[];
  },

  async updateContactMessageStatus(
    id: string,
    status: ContactMessage['status']
  ): Promise<ContactMessage | null> {
    if (env.provider === 'supabase') {
      const { data, error } = await getSupabaseAdmin()
        .from('contact_messages')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      return data as ContactMessage | null;
    }

    getSqliteDb()
      .prepare('UPDATE contact_messages SET status = ? WHERE id = ?')
      .run(status, id);
    return (
      (getSqliteDb()
        .prepare('SELECT * FROM contact_messages WHERE id = ?')
        .get(id) as ContactMessage | undefined) || null
    );
  },

  // ==========================================================================
  // INTERNAL HYDRATION HELPERS
  // ==========================================================================
  async hydrateSqliteBooking(row: Record<string, unknown>): Promise<BookingDetails> {
    const db = getSqliteDb();
    const bookingId = String(row.id);
    const trainId = String(row.train_id);

    const trainRaw = db
      .prepare('SELECT * FROM trains WHERE id = ?')
      .get(trainId) as Record<string, unknown> | undefined;
    const fromStation = db
      .prepare('SELECT * FROM stations WHERE code = ?')
      .get(String(row.from_station_code)) as Station | undefined;
    const toStation = db
      .prepare('SELECT * FROM stations WHERE code = ?')
      .get(String(row.to_station_code)) as Station | undefined;
    const fromStop = db
      .prepare('SELECT * FROM train_schedules WHERE train_id = ? AND station_code = ?')
      .get(trainId, String(row.from_station_code)) as TrainScheduleStop | undefined;
    const toStop = db
      .prepare('SELECT * FROM train_schedules WHERE train_id = ? AND station_code = ?')
      .get(trainId, String(row.to_station_code)) as TrainScheduleStop | undefined;
    const passengers = db
      .prepare('SELECT * FROM passengers WHERE booking_id = ?')
      .all(bookingId) as unknown as Passenger[];
    const payment = db
      .prepare('SELECT * FROM payments WHERE booking_id = ? ORDER BY paid_at DESC LIMIT 1')
      .get(bookingId) as Payment | undefined;

    return {
      id: bookingId,
      pnr_number: String(row.pnr_number),
      user_id: String(row.user_id),
      train_id: trainId,
      from_station_code: String(row.from_station_code),
      to_station_code: String(row.to_station_code),
      journey_date: String(row.journey_date),
      class_code: row.class_code as ClassCode,
      quota: String(row.quota),
      booking_status: row.booking_status as Booking['booking_status'],
      chart_prepared: Boolean(row.chart_prepared),
      contact_email: String(row.contact_email),
      contact_phone: String(row.contact_phone),
      base_fare_total: Number(row.base_fare_total),
      convenience_fee: Number(row.convenience_fee),
      gst_amount: Number(row.gst_amount),
      total_amount: Number(row.total_amount),
      refund_amount: Number(row.refund_amount),
      booked_at: String(row.booked_at),
      cancelled_at: row.cancelled_at ? String(row.cancelled_at) : null,
      train: trainRaw ? mapTrainRow(trainRaw) : undefined,
      from_station: fromStation,
      to_station: toStation,
      departure_time: fromStop?.departure_time,
      arrival_time: toStop?.arrival_time,
      passengers,
      payment: payment || null,
    };
  },

  async hydrateSupabaseBooking(row: Record<string, unknown>): Promise<BookingDetails> {
    const trainRaw = row.trains as Record<string, unknown> | undefined;
    const passengers = (row.passengers || []) as Passenger[];
    const payments = (row.payments || []) as Payment[];
    const stations = await this.listStations();
    const fromStation = stations.find((s) => s.code === String(row.from_station_code));
    const toStation = stations.find((s) => s.code === String(row.to_station_code));
    const stops = await this.getTrainSchedule(String(row.train_id));
    const fromStop = stops.find((s) => s.station_code === String(row.from_station_code));
    const toStop = stops.find((s) => s.station_code === String(row.to_station_code));

    return {
      id: String(row.id),
      pnr_number: String(row.pnr_number),
      user_id: String(row.user_id),
      train_id: String(row.train_id),
      from_station_code: String(row.from_station_code),
      to_station_code: String(row.to_station_code),
      journey_date: String(row.journey_date),
      class_code: row.class_code as ClassCode,
      quota: String(row.quota),
      booking_status: row.booking_status as Booking['booking_status'],
      chart_prepared: Boolean(row.chart_prepared),
      contact_email: String(row.contact_email),
      contact_phone: String(row.contact_phone),
      base_fare_total: Number(row.base_fare_total),
      convenience_fee: Number(row.convenience_fee),
      gst_amount: Number(row.gst_amount),
      total_amount: Number(row.total_amount),
      refund_amount: Number(row.refund_amount),
      booked_at: String(row.booked_at),
      cancelled_at: row.cancelled_at ? String(row.cancelled_at) : null,
      train: trainRaw ? mapTrainRow(trainRaw) : undefined,
      from_station: fromStation,
      to_station: toStation,
      departure_time: fromStop?.departure_time,
      arrival_time: toStop?.arrival_time,
      passengers,
      payment: payments[0] || null,
    };
  },
};
