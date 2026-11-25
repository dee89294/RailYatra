-- ============================================================================
-- File: supabase/migrations/001_initial_schema.sql
-- Purpose: Complete PostgreSQL + Row Level Security (RLS) schema for RailYatra
--          when deploying with Supabase Auth & Supabase PostgreSQL.
-- Responsibilities:
--   1. Defines all core relational tables (profiles, stations, trains,
--      train_schedules, train_classes, bookings, passengers, payments,
--      saved_passengers, contact_messages).
--   2. Establishes foreign keys, uniqueness constraints, and covering indexes.
--   3. Creates `handle_new_user()` trigger so every Supabase Auth signup
--      automatically gets a matching row in `public.profiles`.
--   4. Enables Row Level Security (RLS) on every table with optimized
--      `(select auth.uid())` predicates, explicit `TO` role clauses, and
--      a private non-exposed `private.is_admin()` helper.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Non-exposed schema for privileged helper functions (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ============================================================================
-- 1. PROFILES TABLE (extends Supabase auth.users with app-level role & details)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_color TEXT NOT NULL DEFAULT '#0B6EFD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Private helper used inside RLS policies to check administrator role safely
-- without triggering infinite RLS recursion on `public.profiles`.
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin'
      )
    ),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;

-- Trigger function running on Supabase Auth user creation or email verification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'user',
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email_verified = (NEW.email_confirmed_at IS NOT NULL),
        updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. STATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zone TEXT NOT NULL
);

-- ============================================================================
-- 3. TRAINS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.trains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_number TEXT UNIQUE NOT NULL,
  train_name TEXT NOT NULL,
  train_type TEXT NOT NULL CHECK (
    train_type IN ('Vande Bharat', 'Rajdhani', 'Shatabdi', 'Duronto', 'Garib Rath', 'Superfast', 'Express')
  ),
  source_station_code TEXT NOT NULL REFERENCES public.stations(code) ON UPDATE CASCADE,
  destination_station_code TEXT NOT NULL REFERENCES public.stations(code) ON UPDATE CASCADE,
  running_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
  total_distance_km INTEGER NOT NULL CHECK (total_distance_km > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trains_source ON public.trains(source_station_code);
CREATE INDEX IF NOT EXISTS idx_trains_destination ON public.trains(destination_station_code);

-- ============================================================================
-- 4. TRAIN SCHEDULES (Ordered intermediate route stops for each train)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.train_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID NOT NULL REFERENCES public.trains(id) ON DELETE CASCADE,
  station_code TEXT NOT NULL REFERENCES public.stations(code) ON UPDATE CASCADE,
  stop_order INTEGER NOT NULL CHECK (stop_order >= 1),
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  halt_minutes INTEGER NOT NULL DEFAULT 0,
  day_number INTEGER NOT NULL DEFAULT 1,
  distance_from_source_km INTEGER NOT NULL DEFAULT 0,
  platform TEXT NOT NULL DEFAULT '1',
  UNIQUE (train_id, stop_order),
  UNIQUE (train_id, station_code)
);

CREATE INDEX IF NOT EXISTS idx_train_schedules_station ON public.train_schedules(station_code);
CREATE INDEX IF NOT EXISTS idx_train_schedules_train ON public.train_schedules(train_id, stop_order);

-- ============================================================================
-- 5. TRAIN CLASSES (Available classes, seat capacity & base fare per train)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.train_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id UUID NOT NULL REFERENCES public.trains(id) ON DELETE CASCADE,
  class_code TEXT NOT NULL CHECK (class_code IN ('1A', '2A', '3A', 'CC', 'EC', 'SL', '2S')),
  class_name TEXT NOT NULL,
  base_fare NUMERIC(10,2) NOT NULL CHECK (base_fare >= 0),
  total_seats INTEGER NOT NULL CHECK (total_seats > 0),
  coaches TEXT NOT NULL DEFAULT '["B1","B2"]',
  UNIQUE (train_id, class_code)
);

-- ============================================================================
-- 6. BOOKINGS TABLE (Links User -> Train -> Route Segment -> Status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pnr_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  train_id UUID NOT NULL REFERENCES public.trains(id),
  from_station_code TEXT NOT NULL REFERENCES public.stations(code),
  to_station_code TEXT NOT NULL REFERENCES public.stations(code),
  journey_date DATE NOT NULL,
  class_code TEXT NOT NULL,
  quota TEXT NOT NULL DEFAULT 'GENERAL',
  booking_status TEXT NOT NULL CHECK (
    booking_status IN ('CONFIRMED', 'RAC', 'WAITLIST', 'CANCELLED', 'PARTIAL_CANCELLED')
  ),
  chart_prepared BOOLEAN NOT NULL DEFAULT FALSE,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  base_fare_total NUMERIC(10,2) NOT NULL,
  convenience_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  refund_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id, booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON public.bookings(pnr_number);
CREATE INDEX IF NOT EXISTS idx_bookings_train_date ON public.bookings(train_id, journey_date, class_code);
CREATE INDEX IF NOT EXISTS idx_bookings_from_station ON public.bookings(from_station_code);
CREATE INDEX IF NOT EXISTS idx_bookings_to_station ON public.bookings(to_station_code);

-- ============================================================================
-- 7. PASSENGERS TABLE (1-to-Many travelers on a single PNR booking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 120),
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  berth_preference TEXT NOT NULL DEFAULT 'No Preference',
  coach TEXT,
  seat_number TEXT,
  berth_type TEXT,
  current_status TEXT NOT NULL CHECK (current_status IN ('CNF', 'RAC', 'WL', 'CAN')),
  waitlist_position INTEGER
);

CREATE INDEX IF NOT EXISTS idx_passengers_booking ON public.passengers(booking_id);

-- ============================================================================
-- 8. PAYMENTS TABLE (1-to-1 / 1-to-Many transaction ledger for bookings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'CARD', 'NETBANKING', 'WALLET')),
  payment_provider TEXT NOT NULL DEFAULT 'RailYatra Pay',
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

-- ============================================================================
-- 9. SAVED PASSENGERS & CONTACT MESSAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age BETWEEN 1 AND 120),
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  berth_preference TEXT NOT NULL DEFAULT 'No Preference',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_passengers_user ON public.saved_passengers(user_id);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  pnr_reference TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. DATA API GRANTS & ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT ON public.stations, public.trains, public.train_schedules, public.train_classes TO anon, authenticated;
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.bookings, public.passengers, public.payments, public.saved_passengers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stations, public.trains, public.train_schedules, public.train_classes TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.train_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: Users read/update own profile; Admins read/update all profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR private.is_admin());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id OR private.is_admin())
  WITH CHECK ((SELECT auth.uid()) = id OR private.is_admin());

-- Public Railway Catalog (Read: Guests & Users; Write: Admins only)
CREATE POLICY "Public read stations" ON public.stations
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admin insert stations" ON public.stations
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "Admin update stations" ON public.stations
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin delete stations" ON public.stations
  FOR DELETE TO authenticated USING (private.is_admin());

CREATE POLICY "Public read trains" ON public.trains
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admin insert trains" ON public.trains
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "Admin update trains" ON public.trains
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin delete trains" ON public.trains
  FOR DELETE TO authenticated USING (private.is_admin());

CREATE POLICY "Public read schedules" ON public.train_schedules
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admin insert schedules" ON public.train_schedules
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "Admin update schedules" ON public.train_schedules
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin delete schedules" ON public.train_schedules
  FOR DELETE TO authenticated USING (private.is_admin());

CREATE POLICY "Public read train classes" ON public.train_classes
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY "Admin insert train classes" ON public.train_classes
  FOR INSERT TO authenticated WITH CHECK (private.is_admin());
CREATE POLICY "Admin update train classes" ON public.train_classes
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin delete train classes" ON public.train_classes
  FOR DELETE TO authenticated USING (private.is_admin());

-- Bookings: Strictly scoped to owner (`user_id = auth.uid()`) or Admin
CREATE POLICY "Users view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin());

CREATE POLICY "Verified users create own bookings" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users or admins update bookings" ON public.bookings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin())
  WITH CHECK ((SELECT auth.uid()) = user_id OR private.is_admin());

-- Passengers: Inherit ownership through parent booking_id
CREATE POLICY "Users view own booking passengers" ON public.passengers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND (b.user_id = (SELECT auth.uid()) OR private.is_admin())
    )
  );

CREATE POLICY "Users insert own booking passengers" ON public.passengers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users or admins update passengers" ON public.passengers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND (b.user_id = (SELECT auth.uid()) OR private.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND (b.user_id = (SELECT auth.uid()) OR private.is_admin())
    )
  );

-- Payments: Scoped to owner or Admin
CREATE POLICY "Users view own payments" ON public.payments
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin());

CREATE POLICY "Users insert own payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Saved Passengers: Scoped to owner or Admin
CREATE POLICY "Users view own saved passengers" ON public.saved_passengers
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin());
CREATE POLICY "Users insert own saved passengers" ON public.saved_passengers
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users update own saved passengers" ON public.saved_passengers
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin())
  WITH CHECK ((SELECT auth.uid()) = user_id OR private.is_admin());
CREATE POLICY "Users delete own saved passengers" ON public.saved_passengers
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id OR private.is_admin());

-- Contact Messages: Anyone can submit; only Admins can view/manage
CREATE POLICY "Anyone can submit contact inquiry" ON public.contact_messages
  FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

CREATE POLICY "Admins view contact inquiries" ON public.contact_messages
  FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY "Admins update contact inquiries" ON public.contact_messages
  FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admins delete contact inquiries" ON public.contact_messages
  FOR DELETE TO authenticated USING (private.is_admin());
