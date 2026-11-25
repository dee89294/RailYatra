/**
 * ============================================================================
 * File: server/src/db/sqliteClient.ts
 * Purpose: Initializes and manages the local SQLite database using Node's
 *          built-in `node:sqlite` (`DatabaseSync`).
 * Responsibilities:
 *   - Creates `server/data/railyatra.db` if it doesn't exist.
 *   - Executes `server/src/db/schema.sql` to ensure all tables & indexes exist.
 *   - Enables foreign key constraints (`PRAGMA foreign_keys = ON`).
 *   - Seeds initial stations, trains, schedules, classes, demo users, and
 *     sample PNR bookings on first run so the app works immediately out of the box.
 * Used by: `db/repository.ts` (when running in `local` mode) and `utils/runSeed.ts`.
 * ============================================================================
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync as NodeDatabaseSync } from 'node:sqlite';
import {
  SEED_STATIONS,
  SEED_TRAINS,
  buildDemoUsers,
  createUuid,
  futureIsoDate,
} from '../utils/seedData.js';

type DatabaseSync = NodeDatabaseSync;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: DatabaseSync | null = null;

/**
 * Returns the singleton `DatabaseSync` instance, initializing schema and seed data
 * on first access.
 */
export function getSqliteDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const require = createRequire(import.meta.url);
  // Load `node:sqlite` lazily via computed name so serverless bundlers on Vercel
  // running in Supabase mode do not fail trying to trace built-in SQLite.
  const sqliteModule = ['node', 'sqlite'].join(':');
  const { DatabaseSync } = require(sqliteModule) as {
    DatabaseSync: new (filePath: string) => DatabaseSync;
  };

  const dataDir = process.env.VERCEL
    ? path.join(os.tmpdir(), 'railyatra-data')
    : path.resolve(__dirname, '../../data');
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, 'railyatra.db');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  const localSchemaPath = path.join(__dirname, 'schema.sql');
  const srcSchemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  const schemaSqlPath = fs.existsSync(localSchemaPath) ? localSchemaPath : srcSchemaPath;
  const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
  db.exec(schemaSql);

  dbInstance = db;
  seedSqliteIfEmpty(db);

  return db;
}

/**
 * Populates stations, trains, demo accounts, and 3 sample PNRs if the database
 * is newly created (i.e., `stations` count is 0). Safe and idempotent to call anytime.
 */
export function seedSqliteIfEmpty(db: DatabaseSync): void {
  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM stations')
    .get() as { total: number };

  if (countRow && countRow.total > 0) {
    return;
  }

  console.log('[RailYatra SQLite] Seeding initial Indian Railway catalog & demo data...');

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Seed stations
    const insertStation = db.prepare(
      'INSERT OR IGNORE INTO stations (id, code, name, city, state, zone) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const s of SEED_STATIONS) {
      insertStation.run(createUuid(), s.code, s.name, s.city, s.state, s.zone);
    }

    // 2. Seed trains, schedules, and classes
    const insertTrain = db.prepare(
      `INSERT OR IGNORE INTO trains
       (id, train_number, train_name, train_type, source_station_code, destination_station_code, running_days, total_distance_km, duration_minutes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    );
    const insertStop = db.prepare(
      `INSERT OR IGNORE INTO train_schedules
       (id, train_id, station_code, stop_order, arrival_time, departure_time, halt_minutes, day_number, distance_from_source_km, platform)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertClass = db.prepare(
      `INSERT OR IGNORE INTO train_classes
       (id, train_id, class_code, class_name, base_fare, total_seats, coaches)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const trainIdByNumber = new Map<string, string>();
    for (const t of SEED_TRAINS) {
      const trainId = createUuid();
      trainIdByNumber.set(t.train_number, trainId);
      insertTrain.run(
        trainId,
        t.train_number,
        t.train_name,
        t.train_type,
        t.source_station_code,
        t.destination_station_code,
        t.running_days,
        t.total_distance_km,
        t.duration_minutes
      );

      for (const stop of t.stops) {
        insertStop.run(
          createUuid(),
          trainId,
          stop.station_code,
          stop.stop_order,
          stop.arrival_time,
          stop.departure_time,
          stop.halt_minutes,
          stop.day_number,
          stop.distance_from_source_km,
          stop.platform
        );
      }

      for (const cls of t.classes) {
        insertClass.run(
          createUuid(),
          trainId,
          cls.class_code,
          cls.class_name,
          cls.base_fare,
          cls.total_seats,
          JSON.stringify(cls.coaches)
        );
      }
    }

    // 3. Seed demo users (1 regular verified user + 1 administrator)
    const demoUsers = buildDemoUsers();
    const insertUser = db.prepare(
      `INSERT OR IGNORE INTO profiles
       (id, email, full_name, phone, role, email_verified, password_hash, avatar_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of demoUsers) {
      insertUser.run(
        u.id,
        u.email,
        u.full_name,
        u.phone,
        u.role,
        u.email_verified ? 1 : 0,
        u.password_hash,
        u.avatar_color
      );
    }

    // 4. Seed saved co-passengers for Arjun Sharma
    const insertSaved = db.prepare(
      `INSERT INTO saved_passengers (id, user_id, full_name, age, gender, berth_preference)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertSaved.run(createUuid(), demoUsers[0].id, 'Ananya Sharma', 29, 'Female', 'Lower');
    insertSaved.run(createUuid(), demoUsers[0].id, 'Rohan Verma', 34, 'Male', 'Window');

    // 5. Seed 3 realistic PNR bookings so PNR Lookup & My Bookings work out-of-the-box
    const insertBooking = db.prepare(
      `INSERT INTO bookings
       (id, pnr_number, user_id, train_id, from_station_code, to_station_code, journey_date, class_code, quota,
        booking_status, chart_prepared, contact_email, contact_phone, base_fare_total, convenience_fee, gst_amount, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GENERAL', ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPassenger = db.prepare(
      `INSERT INTO passengers
       (id, booking_id, full_name, age, gender, berth_preference, coach, seat_number, berth_type, current_status, waitlist_position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertPayment = db.prepare(
      `INSERT INTO payments
       (id, booking_id, user_id, transaction_id, payment_method, payment_provider, amount, currency, status)
       VALUES (?, ?, ?, ?, ?, 'RailYatra Pay', ?, 'INR', 'SUCCESS')`
    );

    const vbTrainId = trainIdByNumber.get('22436');
    const rajTrainId = trainIdByNumber.get('12952');
    const tnTrainId = trainIdByNumber.get('12622');

    if (vbTrainId) {
      const b1 = createUuid();
      insertBooking.run(
        b1,
        '4528193047',
        demoUsers[0].id,
        vbTrainId,
        'NDLS',
        'BSB',
        futureIsoDate(3),
        'CC',
        'CONFIRMED',
        0,
        demoUsers[0].email,
        demoUsers[0].phone,
        1750,
        35,
        87.5,
        1872.5
      );
      insertPassenger.run(createUuid(), b1, 'Arjun Sharma', 31, 'Male', 'Window', 'C2', '14', 'Window', 'CNF', null);
      insertPayment.run(createUuid(), b1, demoUsers[0].id, 'RYPAY202611250001', 'UPI', 1872.5);
    }

    if (rajTrainId) {
      const b2 = createUuid();
      insertBooking.run(
        b2,
        '8192045612',
        demoUsers[0].id,
        rajTrainId,
        'NDLS',
        'MMCT',
        futureIsoDate(7),
        '2A',
        'CONFIRMED',
        0,
        demoUsers[0].email,
        demoUsers[0].phone,
        5780,
        35,
        289,
        6104
      );
      insertPassenger.run(createUuid(), b2, 'Arjun Sharma', 31, 'Male', 'Lower', 'A1', '19', 'Lower', 'CNF', null);
      insertPassenger.run(createUuid(), b2, 'Ananya Sharma', 29, 'Female', 'Upper', 'A1', '20', 'Upper', 'CNF', null);
      insertPayment.run(createUuid(), b2, demoUsers[0].id, 'RYPAY202611250002', 'CARD', 6104);
    }

    if (tnTrainId) {
      const b3 = createUuid();
      insertBooking.run(
        b3,
        '6390174825',
        demoUsers[0].id,
        tnTrainId,
        'NDLS',
        'MAS',
        futureIsoDate(-5),
        '3A',
        'CONFIRMED',
        1,
        demoUsers[0].email,
        demoUsers[0].phone,
        2170,
        35,
        108.5,
        2313.5
      );
      insertPassenger.run(createUuid(), b3, 'Arjun Sharma', 31, 'Male', 'Side Lower', 'B3', '31', 'Side Lower', 'CNF', null);
      insertPayment.run(createUuid(), b3, demoUsers[0].id, 'RYPAY202611200003', 'NETBANKING', 2313.5);
    }

    // 6. Seed 1 sample contact inquiry for Admin panel
    db.prepare(
      `INSERT INTO contact_messages (id, name, email, subject, pnr_reference, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      createUuid(),
      'Meera Krishnan',
      'meera.k@example.com',
      'Wheelchair Assistance Request',
      '8192045612',
      'Kindly arrange battery-operated cart support at New Delhi Platform 3 for senior citizen traveler.',
      'NEW'
    );

    db.exec('COMMIT;');
    console.log('[RailYatra SQLite] Seed complete.');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
