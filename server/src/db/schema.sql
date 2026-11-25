-- ============================================================================
-- File: server/src/db/schema.sql
-- Purpose: Local SQLite relational database schema for RailYatra.
-- Responsibilities:
--   - Mirrors `supabase/migrations/001_initial_schema.sql` table-for-table so
--     the repository layer works identically in both local and Supabase modes.
--   - Enables foreign key enforcement (`PRAGMA foreign_keys = ON` at runtime)
--     and stores local password hashes + email verification/reset tokens.
-- Used by: `server/src/db/sqliteClient.ts`.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#0B6EFD',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('EMAIL_VERIFY', 'PASSWORD_RESET')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trains (
  id TEXT PRIMARY KEY,
  train_number TEXT UNIQUE NOT NULL,
  train_name TEXT NOT NULL,
  train_type TEXT NOT NULL CHECK (
    train_type IN ('Vande Bharat', 'Rajdhani', 'Shatabdi', 'Duronto', 'Garib Rath', 'Superfast', 'Express')
  ),
  source_station_code TEXT NOT NULL REFERENCES stations(code) ON UPDATE CASCADE,
  destination_station_code TEXT NOT NULL REFERENCES stations(code) ON UPDATE CASCADE,
  running_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
  total_distance_km INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS train_schedules (
  id TEXT PRIMARY KEY,
  train_id TEXT NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  station_code TEXT NOT NULL REFERENCES stations(code) ON UPDATE CASCADE,
  stop_order INTEGER NOT NULL,
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  halt_minutes INTEGER NOT NULL DEFAULT 0,
  day_number INTEGER NOT NULL DEFAULT 1,
  distance_from_source_km INTEGER NOT NULL DEFAULT 0,
  platform TEXT NOT NULL DEFAULT '1',
  UNIQUE (train_id, stop_order),
  UNIQUE (train_id, station_code)
);

CREATE INDEX IF NOT EXISTS idx_sqlite_schedules_station ON train_schedules(station_code);
CREATE INDEX IF NOT EXISTS idx_sqlite_schedules_train ON train_schedules(train_id, stop_order);

CREATE TABLE IF NOT EXISTS train_classes (
  id TEXT PRIMARY KEY,
  train_id TEXT NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  class_code TEXT NOT NULL CHECK (class_code IN ('1A', '2A', '3A', 'CC', 'EC', 'SL', '2S')),
  class_name TEXT NOT NULL,
  base_fare REAL NOT NULL,
  total_seats INTEGER NOT NULL,
  coaches TEXT NOT NULL,
  UNIQUE (train_id, class_code)
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  pnr_number TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  train_id TEXT NOT NULL REFERENCES trains(id),
  from_station_code TEXT NOT NULL REFERENCES stations(code),
  to_station_code TEXT NOT NULL REFERENCES stations(code),
  journey_date TEXT NOT NULL,
  class_code TEXT NOT NULL,
  quota TEXT NOT NULL DEFAULT 'GENERAL',
  booking_status TEXT NOT NULL CHECK (
    booking_status IN ('CONFIRMED', 'RAC', 'WAITLIST', 'CANCELLED', 'PARTIAL_CANCELLED')
  ),
  chart_prepared INTEGER NOT NULL DEFAULT 0,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  base_fare_total REAL NOT NULL,
  convenience_fee REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL,
  refund_amount REAL NOT NULL DEFAULT 0,
  booked_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sqlite_bookings_user ON bookings(user_id, booked_at);
CREATE INDEX IF NOT EXISTS idx_sqlite_bookings_pnr ON bookings(pnr_number);
CREATE INDEX IF NOT EXISTS idx_sqlite_bookings_train_date ON bookings(train_id, journey_date, class_code);

CREATE TABLE IF NOT EXISTS passengers (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  berth_preference TEXT NOT NULL DEFAULT 'No Preference',
  coach TEXT,
  seat_number TEXT,
  berth_type TEXT,
  current_status TEXT NOT NULL CHECK (current_status IN ('CNF', 'RAC', 'WL', 'CAN')),
  waitlist_position INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sqlite_passengers_booking ON passengers(booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'CARD', 'NETBANKING', 'WALLET')),
  payment_provider TEXT NOT NULL DEFAULT 'RailYatra Pay',
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND')),
  paid_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_passengers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  berth_preference TEXT NOT NULL DEFAULT 'No Preference',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  pnr_reference TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
