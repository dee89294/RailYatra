/**
 * ============================================================================
 * File: client/src/types/index.ts
 * Purpose: Shared frontend TypeScript domain types for RailYatra.
 * Responsibilities:
 *   - Defines strictly typed contracts for Users, Stations, Trains, Schedules,
 *     Class Availability, Bookings, Passengers, Payments, Live Tracking, and
 *     Admin Analytics matching the Express backend JSON responses.
 * Used by: `services/*`, `context/AuthContext.tsx`, `components/*`, `pages/*`.
 * ============================================================================
 */

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  email_verified: boolean;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  zone: string;
}

export type TrainType =
  | 'Vande Bharat'
  | 'Rajdhani'
  | 'Shatabdi'
  | 'Duronto'
  | 'Garib Rath'
  | 'Superfast'
  | 'Express';

export type ClassCode = '1A' | '2A' | '3A' | 'CC' | 'EC' | 'SL' | '2S';

export interface Train {
  id: string;
  train_number: string;
  train_name: string;
  train_type: TrainType;
  source_station_code: string;
  destination_station_code: string;
  running_days: string;
  total_distance_km: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface TrainScheduleStop {
  id: string;
  train_id: string;
  station_code: string;
  station_name?: string;
  city?: string;
  stop_order: number;
  arrival_time: string;
  departure_time: string;
  halt_minutes: number;
  day_number: number;
  distance_from_source_km: number;
  platform: string;
}

export type QuotaCode = 'GN' | 'TQ' | 'PT' | 'LD' | 'SS';

export interface TrainClass {
  id: string;
  train_id: string;
  class_code: ClassCode;
  class_name: string;
  base_fare: number;
  total_seats: number;
  coaches: string[];
}

export interface ClassAvailability {
  class_code: ClassCode;
  class_name: string;
  segment_fare: number;
  total_seats: number;
  booked_seats: number;
  available_seats: number;
  availability_status: 'AVAILABLE' | 'RAC' | 'WAITLIST';
  availability_label: string;
  quota?: QuotaCode;
  railcore_supported?: boolean;
  quota_note?: string;
}

export interface TrainSearchResult {
  train: Train;
  from_stop: TrainScheduleStop;
  to_stop: TrainScheduleStop;
  segment_distance_km: number;
  segment_duration_minutes: number;
  journey_date: string;
  runs_on_date: boolean;
  quota?: QuotaCode;
  quota_label?: string;
  quota_note?: string;
  classes: ClassAvailability[];
}

export interface LiveQuotaAvailabilityResponse {
  train_number: string;
  from: string;
  to: string;
  journey_date: string;
  class_code: ClassCode;
  quota: QuotaCode;
  quota_label: string;
  source: 'RAILCORE_LIVE' | 'DYNAMIC_ESTIMATE';
  railcore_supported: boolean;
  status: string;
  availability_text: string;
  fare: number;
  tatkal_charge: number;
  confirmation_probability?: { percentage: number; label: string; text: string } | null;
  note?: string;
}

export type BookingStatus =
  | 'CONFIRMED'
  | 'RAC'
  | 'WAITLIST'
  | 'CANCELLED'
  | 'PARTIAL_CANCELLED';

export interface Passenger {
  id: string;
  booking_id: string;
  full_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  berth_preference: string;
  coach: string | null;
  seat_number: string | null;
  berth_type: string | null;
  current_status: 'CNF' | 'RAC' | 'WL' | 'CAN';
  waitlist_position: number | null;
}

export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';

export interface Payment {
  id: string;
  booking_id: string;
  user_id: string;
  transaction_id: string;
  payment_method: PaymentMethod;
  payment_provider: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'PARTIAL_REFUND';
  paid_at: string;
}

export interface BookingDetails {
  id: string;
  pnr_number: string;
  user_id: string;
  train_id: string;
  from_station_code: string;
  to_station_code: string;
  journey_date: string;
  class_code: ClassCode;
  quota: string;
  booking_status: BookingStatus;
  chart_prepared: boolean;
  contact_email: string;
  contact_phone: string;
  base_fare_total: number;
  convenience_fee: number;
  gst_amount: number;
  total_amount: number;
  refund_amount: number;
  booked_at: string;
  cancelled_at: string | null;
  train?: Train;
  from_station?: Station;
  to_station?: Station;
  departure_time?: string;
  arrival_time?: string;
  passengers: Passenger[];
  payment?: Payment | null;
}

export interface SavedPassenger {
  id: string;
  user_id: string;
  full_name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  berth_preference: string;
  created_at: string;
}

export interface LiveTrackingStop {
  station_code: string;
  station_name: string;
  city: string;
  stop_order: number;
  scheduled_arrival: string;
  scheduled_departure: string;
  actual_arrival: string;
  actual_departure: string;
  delay_minutes: number;
  distance_km: number;
  platform: string;
  status: 'DEPARTED' | 'CURRENT' | 'UPCOMING';
}

export interface LiveTrackingResponse {
  train_number: string;
  train_name: string;
  train_type: TrainType;
  source: string;
  destination: string;
  journey_date: string;
  data_source: 'RAILCORE_LIVE' | 'EXTERNAL_API' | 'LIVE_SIMULATION';
  running_status: 'ON_TIME' | 'SLIGHT_DELAY' | 'DELAYED' | 'AT_ORIGIN' | 'ARRIVED';
  status_text?: string;
  speed_kmph?: number;
  approaching_station_name?: string | null;
  delay_minutes: number;
  current_station_code: string;
  current_station_name: string;
  next_station_code: string | null;
  next_station_name: string | null;
  distance_covered_km: number;
  total_distance_km: number;
  progress_percent: number;
  last_updated: string;
  stops: LiveTrackingStop[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  pnr_reference: string;
  message: string;
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  created_at: string;
}

export interface DevEmailPreview {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  verificationUrl?: string;
  sentAt: string;
}
