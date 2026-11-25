/**
 * ============================================================================
 * File: server/src/utils/seedData.ts
 * Purpose: Realistic Indian Railway reference catalog & demo accounts for RailYatra.
 * Responsibilities:
 *   - Provides 26 major Indian Railway stations with official IRCTC codes & zones.
 *   - Provides 14 iconic trains (Vande Bharat, Rajdhani, Shatabdi, Duronto,
 *     Garib Rath, Superfast) with accurate intermediate stops, timings, distances,
 *     and travel classes (1A, 2A, 3A, CC, EC, SL).
 *   - Provides a pre-verified Registered User (`arjun.sharma@railyatra.in`) and
 *     an Administrator (`admin@railyatra.in`) plus 3 sample PNRs so guests and
 *     testers can immediately explore PNR lookup, live tracking, and dashboards.
 * Used by: `db/sqliteClient.ts` (auto-seed on first run) and `utils/runSeed.ts`.
 * ============================================================================
 */

import crypto from 'node:crypto';
import type { TrainType, ClassCode } from '../types/index.js';
import { hashPassword } from './crypto.js';

export interface SeedStation {
  code: string;
  name: string;
  city: string;
  state: string;
  zone: string;
}

export interface SeedTrainStop {
  station_code: string;
  stop_order: number;
  arrival_time: string;
  departure_time: string;
  halt_minutes: number;
  day_number: number;
  distance_from_source_km: number;
  platform: string;
}

export interface SeedTrainClass {
  class_code: ClassCode;
  class_name: string;
  base_fare: number;
  total_seats: number;
  coaches: string[];
}

export interface SeedTrain {
  train_number: string;
  train_name: string;
  train_type: TrainType;
  source_station_code: string;
  destination_station_code: string;
  running_days: string;
  total_distance_km: number;
  duration_minutes: number;
  stops: SeedTrainStop[];
  classes: SeedTrainClass[];
}

export const SEED_STATIONS: SeedStation[] = [
  { code: 'NDLS', name: 'New Delhi Railway Station', city: 'New Delhi', state: 'Delhi', zone: 'NR' },
  { code: 'MMCT', name: 'Mumbai Central', city: 'Mumbai', state: 'Maharashtra', zone: 'WR' },
  { code: 'CSMT', name: 'Chhatrapati Shivaji Maharaj Terminus', city: 'Mumbai', state: 'Maharashtra', zone: 'CR' },
  { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal', zone: 'ER' },
  { code: 'MAS', name: 'MGR Chennai Central', city: 'Chennai', state: 'Tamil Nadu', zone: 'SR' },
  { code: 'SBC', name: 'KSR Bengaluru City Junction', city: 'Bengaluru', state: 'Karnataka', zone: 'SWR' },
  { code: 'ADI', name: 'Ahmedabad Junction', city: 'Ahmedabad', state: 'Gujarat', zone: 'WR' },
  { code: 'PUNE', name: 'Pune Junction', city: 'Pune', state: 'Maharashtra', zone: 'CR' },
  { code: 'JP', name: 'Jaipur Junction', city: 'Jaipur', state: 'Rajasthan', zone: 'NWR' },
  { code: 'LKO', name: 'Lucknow Charbagh NR', city: 'Lucknow', state: 'Uttar Pradesh', zone: 'NR' },
  { code: 'CNB', name: 'Kanpur Central', city: 'Kanpur', state: 'Uttar Pradesh', zone: 'NCR' },
  { code: 'PRYJ', name: 'Prayagraj Junction', city: 'Prayagraj', state: 'Uttar Pradesh', zone: 'NCR' },
  { code: 'BSB', name: 'Varanasi Junction', city: 'Varanasi', state: 'Uttar Pradesh', zone: 'NR' },
  { code: 'DDU', name: 'Pt. Deen Dayal Upadhyaya Jn', city: 'Mughalsarai', state: 'Uttar Pradesh', zone: 'ECR' },
  { code: 'PNBE', name: 'Patna Junction', city: 'Patna', state: 'Bihar', zone: 'ECR' },
  { code: 'AGC', name: 'Agra Cantt', city: 'Agra', state: 'Uttar Pradesh', zone: 'NCR' },
  { code: 'GWL', name: 'Gwalior Junction', city: 'Gwalior', state: 'Madhya Pradesh', zone: 'NCR' },
  { code: 'BPL', name: 'Bhopal Junction', city: 'Bhopal', state: 'Madhya Pradesh', zone: 'WCR' },
  { code: 'KOTA', name: 'Kota Junction', city: 'Kota', state: 'Rajasthan', zone: 'WCR' },
  { code: 'BRC', name: 'Vadodara Junction', city: 'Vadodara', state: 'Gujarat', zone: 'WR' },
  { code: 'ST', name: 'Surat', city: 'Surat', state: 'Gujarat', zone: 'WR' },
  { code: 'NGP', name: 'Nagpur Junction', city: 'Nagpur', state: 'Maharashtra', zone: 'CR' },
  { code: 'SC', name: 'Secunderabad Junction', city: 'Hyderabad', state: 'Telangana', zone: 'SCR' },
  { code: 'BZA', name: 'Vijayawada Junction', city: 'Vijayawada', state: 'Andhra Pradesh', zone: 'SCR' },
  { code: 'VSKP', name: 'Visakhapatnam Junction', city: 'Visakhapatnam', state: 'Andhra Pradesh', zone: 'ECoR' },
  { code: 'ASR', name: 'Amritsar Junction', city: 'Amritsar', state: 'Punjab', zone: 'NR' },
];

export const SEED_TRAINS: SeedTrain[] = [
  {
    train_number: '22436',
    train_name: 'New Delhi - Varanasi Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'NDLS',
    destination_station_code: 'BSB',
    running_days: 'Mon,Tue,Wed,Fri,Sat,Sun',
    total_distance_km: 759,
    duration_minutes: 480,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '06:00', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '16' },
      { station_code: 'CNB', stop_order: 2, arrival_time: '10:08', departure_time: '10:10', halt_minutes: 2, day_number: 1, distance_from_source_km: 440, platform: '1' },
      { station_code: 'PRYJ', stop_order: 3, arrival_time: '12:08', departure_time: '12:10', halt_minutes: 2, day_number: 1, distance_from_source_km: 634, platform: '6' },
      { station_code: 'BSB', stop_order: 4, arrival_time: '14:00', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 759, platform: '1' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1750, total_seats: 78, coaches: ['C1', 'C2', 'C3', 'C4', 'C5'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 3320, total_seats: 52, coaches: ['E1', 'E2'] },
    ],
  },
  {
    train_number: '22435',
    train_name: 'Varanasi - New Delhi Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'BSB',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Fri,Sat,Sun',
    total_distance_km: 759,
    duration_minutes: 480,
    stops: [
      { station_code: 'BSB', stop_order: 1, arrival_time: 'Origin', departure_time: '15:00', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'PRYJ', stop_order: 2, arrival_time: '16:30', departure_time: '16:32', halt_minutes: 2, day_number: 1, distance_from_source_km: 125, platform: '5' },
      { station_code: 'CNB', stop_order: 3, arrival_time: '18:32', departure_time: '18:34', halt_minutes: 2, day_number: 1, distance_from_source_km: 319, platform: '2' },
      { station_code: 'NDLS', stop_order: 4, arrival_time: '23:00', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 759, platform: '16' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1750, total_seats: 78, coaches: ['C1', 'C2', 'C3', 'C4'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 3320, total_seats: 52, coaches: ['E1', 'E2'] },
    ],
  },
  {
    train_number: '12952',
    train_name: 'Mumbai Tejas Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'NDLS',
    destination_station_code: 'MMCT',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 1386,
    duration_minutes: 935,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '16:55', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '3' },
      { station_code: 'KOTA', stop_order: 2, arrival_time: '21:30', departure_time: '21:40', halt_minutes: 10, day_number: 1, distance_from_source_km: 465, platform: '1' },
      { station_code: 'BRC', stop_order: 3, arrival_time: '03:41', departure_time: '03:51', halt_minutes: 10, day_number: 2, distance_from_source_km: 993, platform: '2' },
      { station_code: 'ST', stop_order: 4, arrival_time: '05:18', departure_time: '05:23', halt_minutes: 5, day_number: 2, distance_from_source_km: 1122, platform: '1' },
      { station_code: 'MMCT', stop_order: 5, arrival_time: '08:30', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 1386, platform: '5' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 4780, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 2890, total_seats: 52, coaches: ['A1', 'A2', 'A3'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2085, total_seats: 72, coaches: ['B1', 'B2', 'B3', 'B4'] },
    ],
  },
  {
    train_number: '12951',
    train_name: 'New Delhi Tejas Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'MMCT',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 1386,
    duration_minutes: 940,
    stops: [
      { station_code: 'MMCT', stop_order: 1, arrival_time: 'Origin', departure_time: '17:00', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '4' },
      { station_code: 'ST', stop_order: 2, arrival_time: '19:43', departure_time: '19:48', halt_minutes: 5, day_number: 1, distance_from_source_km: 264, platform: '2' },
      { station_code: 'BRC', stop_order: 3, arrival_time: '21:08', departure_time: '21:18', halt_minutes: 10, day_number: 1, distance_from_source_km: 393, platform: '1' },
      { station_code: 'KOTA', stop_order: 4, arrival_time: '03:15', departure_time: '03:25', halt_minutes: 10, day_number: 2, distance_from_source_km: 921, platform: '2' },
      { station_code: 'NDLS', stop_order: 5, arrival_time: '08:40', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 1386, platform: '3' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 4780, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 2890, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2085, total_seats: 72, coaches: ['B1', 'B2', 'B3'] },
    ],
  },
  {
    train_number: '12302',
    train_name: 'Howrah Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'NDLS',
    destination_station_code: 'HWH',
    running_days: 'Mon,Tue,Wed,Thu,Sat,Sun',
    total_distance_km: 1451,
    duration_minutes: 1020,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '16:50', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '12' },
      { station_code: 'CNB', stop_order: 2, arrival_time: '21:32', departure_time: '21:37', halt_minutes: 5, day_number: 1, distance_from_source_km: 440, platform: '4' },
      { station_code: 'PRYJ', stop_order: 3, arrival_time: '23:38', departure_time: '23:40', halt_minutes: 2, day_number: 1, distance_from_source_km: 634, platform: '3' },
      { station_code: 'DDU', stop_order: 4, arrival_time: '01:35', departure_time: '01:45', halt_minutes: 10, day_number: 2, distance_from_source_km: 787, platform: '1' },
      { station_code: 'PNBE', stop_order: 5, arrival_time: '04:15', departure_time: '04:25', halt_minutes: 10, day_number: 2, distance_from_source_km: 999, platform: '2' },
      { station_code: 'HWH', stop_order: 6, arrival_time: '09:50', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 1451, platform: '9' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 5120, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 3040, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2190, total_seats: 72, coaches: ['B1', 'B2', 'B3', 'B4'] },
    ],
  },
  {
    train_number: '12301',
    train_name: 'Howrah - New Delhi Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'HWH',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sun',
    total_distance_km: 1451,
    duration_minutes: 1025,
    stops: [
      { station_code: 'HWH', stop_order: 1, arrival_time: 'Origin', departure_time: '16:50', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '9' },
      { station_code: 'PNBE', stop_order: 2, arrival_time: '22:10', departure_time: '22:20', halt_minutes: 10, day_number: 1, distance_from_source_km: 452, platform: '1' },
      { station_code: 'DDU', stop_order: 3, arrival_time: '00:55', departure_time: '01:05', halt_minutes: 10, day_number: 2, distance_from_source_km: 664, platform: '4' },
      { station_code: 'PRYJ', stop_order: 4, arrival_time: '02:55', departure_time: '02:57', halt_minutes: 2, day_number: 2, distance_from_source_km: 817, platform: '2' },
      { station_code: 'CNB', stop_order: 5, arrival_time: '04:50', departure_time: '04:55', halt_minutes: 5, day_number: 2, distance_from_source_km: 1011, platform: '3' },
      { station_code: 'NDLS', stop_order: 6, arrival_time: '09:55', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 1451, platform: '14' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 5120, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 3040, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2190, total_seats: 72, coaches: ['B1', 'B2', 'B3'] },
    ],
  },
  {
    train_number: '12002',
    train_name: 'New Delhi - Bhopal Shatabdi Express',
    train_type: 'Shatabdi',
    source_station_code: 'NDLS',
    destination_station_code: 'BPL',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 702,
    duration_minutes: 505,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '06:00', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'AGC', stop_order: 2, arrival_time: '07:50', departure_time: '07:55', halt_minutes: 5, day_number: 1, distance_from_source_km: 195, platform: '1' },
      { station_code: 'GWL', stop_order: 3, arrival_time: '09:13', departure_time: '09:18', halt_minutes: 5, day_number: 1, distance_from_source_km: 313, platform: '1' },
      { station_code: 'BPL', stop_order: 4, arrival_time: '14:25', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 702, platform: '2' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1580, total_seats: 78, coaches: ['C1', 'C2', 'C3', 'C4'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 2990, total_seats: 52, coaches: ['E1'] },
    ],
  },
  {
    train_number: '20901',
    train_name: 'Mumbai Central - Ahmedabad Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'MMCT',
    destination_station_code: 'ADI',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
    total_distance_km: 491,
    duration_minutes: 335,
    stops: [
      { station_code: 'MMCT', stop_order: 1, arrival_time: 'Origin', departure_time: '06:00', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '2' },
      { station_code: 'ST', stop_order: 2, arrival_time: '08:40', departure_time: '08:43', halt_minutes: 3, day_number: 1, distance_from_source_km: 263, platform: '1' },
      { station_code: 'BRC', stop_order: 3, arrival_time: '10:03', departure_time: '10:06', halt_minutes: 3, day_number: 1, distance_from_source_km: 392, platform: '3' },
      { station_code: 'ADI', stop_order: 4, arrival_time: '11:35', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 491, platform: '1' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1385, total_seats: 78, coaches: ['C1', 'C2', 'C3', 'C4'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 2595, total_seats: 52, coaches: ['E1'] },
    ],
  },
  {
    train_number: '20902',
    train_name: 'Ahmedabad - Mumbai Central Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'ADI',
    destination_station_code: 'MMCT',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
    total_distance_km: 491,
    duration_minutes: 335,
    stops: [
      { station_code: 'ADI', stop_order: 1, arrival_time: 'Origin', departure_time: '14:40', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'BRC', stop_order: 2, arrival_time: '15:52', departure_time: '15:55', halt_minutes: 3, day_number: 1, distance_from_source_km: 99, platform: '2' },
      { station_code: 'ST', stop_order: 3, arrival_time: '17:15', departure_time: '17:18', halt_minutes: 3, day_number: 1, distance_from_source_km: 228, platform: '1' },
      { station_code: 'MMCT', stop_order: 4, arrival_time: '20:15', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 491, platform: '2' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1385, total_seats: 78, coaches: ['C1', 'C2', 'C3'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 2595, total_seats: 52, coaches: ['E1'] },
    ],
  },
  {
    train_number: '12622',
    train_name: 'Tamil Nadu Superfast Express',
    train_type: 'Superfast',
    source_station_code: 'NDLS',
    destination_station_code: 'MAS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 2182,
    duration_minutes: 1965,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '21:05', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '7' },
      { station_code: 'AGC', stop_order: 2, arrival_time: '23:25', departure_time: '23:30', halt_minutes: 5, day_number: 1, distance_from_source_km: 195, platform: '2' },
      { station_code: 'BPL', stop_order: 3, arrival_time: '05:45', departure_time: '05:55', halt_minutes: 10, day_number: 2, distance_from_source_km: 702, platform: '1' },
      { station_code: 'NGP', stop_order: 4, arrival_time: '11:40', departure_time: '11:50', halt_minutes: 10, day_number: 2, distance_from_source_km: 1091, platform: '3' },
      { station_code: 'BZA', stop_order: 5, arrival_time: '22:15', departure_time: '22:25', halt_minutes: 10, day_number: 2, distance_from_source_km: 1751, platform: '1' },
      { station_code: 'MAS', stop_order: 6, arrival_time: '05:50', departure_time: 'Destination', halt_minutes: 0, day_number: 3, distance_from_source_km: 2182, platform: '5' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 5340, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 3150, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2170, total_seats: 72, coaches: ['B1', 'B2', 'B3', 'B4'] },
      { class_code: 'SL', class_name: 'Sleeper Class', base_fare: 825, total_seats: 144, coaches: ['S1', 'S2', 'S3', 'S4', 'S5'] },
    ],
  },
  {
    train_number: '12627',
    train_name: 'Karnataka Superfast Express',
    train_type: 'Superfast',
    source_station_code: 'SBC',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 2406,
    duration_minutes: 2160,
    stops: [
      { station_code: 'SBC', stop_order: 1, arrival_time: 'Origin', departure_time: '19:20', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'SC', stop_order: 2, arrival_time: '06:10', departure_time: '06:20', halt_minutes: 10, day_number: 2, distance_from_source_km: 645, platform: '4' },
      { station_code: 'NGP', stop_order: 3, arrival_time: '14:35', departure_time: '14:45', halt_minutes: 10, day_number: 2, distance_from_source_km: 1218, platform: '2' },
      { station_code: 'BPL', stop_order: 4, arrival_time: '20:30', departure_time: '20:40', halt_minutes: 10, day_number: 2, distance_from_source_km: 1607, platform: '1' },
      { station_code: 'AGC', stop_order: 5, arrival_time: '04:15', departure_time: '04:20', halt_minutes: 5, day_number: 3, distance_from_source_km: 2211, platform: '2' },
      { station_code: 'NDLS', stop_order: 6, arrival_time: '07:20', departure_time: 'Destination', halt_minutes: 0, day_number: 3, distance_from_source_km: 2406, platform: '4' },
    ],
    classes: [
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 3290, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2260, total_seats: 72, coaches: ['B1', 'B2', 'B3'] },
      { class_code: 'SL', class_name: 'Sleeper Class', base_fare: 870, total_seats: 144, coaches: ['S1', 'S2', 'S3', 'S4'] },
    ],
  },
  {
    train_number: '20607',
    train_name: 'Chennai Central - Mysuru Vande Bharat Express',
    train_type: 'Vande Bharat',
    source_station_code: 'MAS',
    destination_station_code: 'SBC',
    running_days: 'Mon,Tue,Thu,Fri,Sat,Sun',
    total_distance_km: 359,
    duration_minutes: 265,
    stops: [
      { station_code: 'MAS', stop_order: 1, arrival_time: 'Origin', departure_time: '05:50', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '6' },
      { station_code: 'SBC', stop_order: 2, arrival_time: '10:15', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 359, platform: '7' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1095, total_seats: 78, coaches: ['C1', 'C2', 'C3'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 2120, total_seats: 52, coaches: ['E1'] },
    ],
  },
  {
    train_number: '12124',
    train_name: 'Deccan Queen Superfast Express',
    train_type: 'Superfast',
    source_station_code: 'PUNE',
    destination_station_code: 'CSMT',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 192,
    duration_minutes: 195,
    stops: [
      { station_code: 'PUNE', stop_order: 1, arrival_time: 'Origin', departure_time: '07:15', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'CSMT', stop_order: 2, arrival_time: '10:30', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 192, platform: '8' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 435, total_seats: 78, coaches: ['C1', 'C2', 'C3'] },
      { class_code: '2S', class_name: 'Second Sitting', base_fare: 125, total_seats: 120, coaches: ['D1', 'D2', 'D3'] },
    ],
  },
  {
    train_number: '12958',
    train_name: 'Swarna Jayanti Rajdhani Express',
    train_type: 'Rajdhani',
    source_station_code: 'ADI',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 934,
    duration_minutes: 735,
    stops: [
      { station_code: 'ADI', stop_order: 1, arrival_time: 'Origin', departure_time: '18:20', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'JP', stop_order: 2, arrival_time: '02:35', departure_time: '02:45', halt_minutes: 10, day_number: 2, distance_from_source_km: 626, platform: '4' },
      { station_code: 'NDLS', stop_order: 3, arrival_time: '07:30', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 934, platform: '2' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 3650, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 2150, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 1520, total_seats: 72, coaches: ['B1', 'B2', 'B3'] },
    ],
  },
  {
    train_number: '12413',
    train_name: 'Pooja Superfast Express',
    train_type: 'Superfast',
    source_station_code: 'JP',
    destination_station_code: 'ASR',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 756,
    duration_minutes: 760,
    stops: [
      { station_code: 'JP', stop_order: 1, arrival_time: 'Origin', departure_time: '16:10', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '3' },
      { station_code: 'NDLS', stop_order: 2, arrival_time: '21:15', departure_time: '21:30', halt_minutes: 15, day_number: 1, distance_from_source_km: 308, platform: '5' },
      { station_code: 'ASR', stop_order: 3, arrival_time: '04:50', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 756, platform: '1' },
    ],
    classes: [
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 1680, total_seats: 52, coaches: ['A1'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 1180, total_seats: 72, coaches: ['B1', 'B2'] },
      { class_code: 'SL', class_name: 'Sleeper Class', base_fare: 455, total_seats: 144, coaches: ['S1', 'S2', 'S3'] },
    ],
  },
  {
    train_number: '12286',
    train_name: 'Nizamuddin - Secunderabad Duronto Express',
    train_type: 'Duronto',
    source_station_code: 'NDLS',
    destination_station_code: 'SC',
    running_days: 'Mon,Tue,Thu,Fri,Sat',
    total_distance_km: 1661,
    duration_minutes: 1320,
    stops: [
      { station_code: 'NDLS', stop_order: 1, arrival_time: 'Origin', departure_time: '15:55', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '6' },
      { station_code: 'BPL', stop_order: 2, arrival_time: '23:25', departure_time: '23:32', halt_minutes: 7, day_number: 1, distance_from_source_km: 702, platform: '2' },
      { station_code: 'NGP', stop_order: 3, arrival_time: '04:55', departure_time: '05:00', halt_minutes: 5, day_number: 2, distance_from_source_km: 1091, platform: '1' },
      { station_code: 'SC', stop_order: 4, arrival_time: '13:55', departure_time: 'Destination', halt_minutes: 0, day_number: 2, distance_from_source_km: 1661, platform: '1' },
    ],
    classes: [
      { class_code: '1A', class_name: 'AC First Class', base_fare: 4990, total_seats: 24, coaches: ['H1'] },
      { class_code: '2A', class_name: 'AC 2 Tier', base_fare: 2980, total_seats: 52, coaches: ['A1', 'A2'] },
      { class_code: '3A', class_name: 'AC 3 Tier', base_fare: 2050, total_seats: 72, coaches: ['B1', 'B2', 'B3'] },
      { class_code: 'SL', class_name: 'Sleeper Class', base_fare: 785, total_seats: 144, coaches: ['S1', 'S2', 'S3'] },
    ],
  },
  {
    train_number: '22503',
    train_name: 'Lucknow - New Delhi Shatabdi Express',
    train_type: 'Shatabdi',
    source_station_code: 'LKO',
    destination_station_code: 'NDLS',
    running_days: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
    total_distance_km: 511,
    duration_minutes: 390,
    stops: [
      { station_code: 'LKO', stop_order: 1, arrival_time: 'Origin', departure_time: '15:35', halt_minutes: 0, day_number: 1, distance_from_source_km: 0, platform: '1' },
      { station_code: 'CNB', stop_order: 2, arrival_time: '16:50', departure_time: '16:55', halt_minutes: 5, day_number: 1, distance_from_source_km: 74, platform: '3' },
      { station_code: 'NDLS', stop_order: 3, arrival_time: '22:05', departure_time: 'Destination', halt_minutes: 0, day_number: 1, distance_from_source_km: 511, platform: '15' },
    ],
    classes: [
      { class_code: 'CC', class_name: 'AC Chair Car', base_fare: 1295, total_seats: 78, coaches: ['C1', 'C2', 'C3'] },
      { class_code: 'EC', class_name: 'Executive Chair Car', base_fare: 2480, total_seats: 52, coaches: ['E1'] },
    ],
  },
];

export function futureIsoDate(daysFromToday: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysFromToday);
  return dt.toISOString().slice(0, 10);
}

export function buildDemoUsers() {
  return [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'arjun.sharma@railyatra.in',
      full_name: 'Arjun Sharma',
      phone: '+91 98765 43210',
      role: 'user' as const,
      email_verified: true,
      password_hash: hashPassword('Travel@2026'),
      avatar_color: '#0B6EFD',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'admin@railyatra.in',
      full_name: 'Priya Nair (RailYatra Admin)',
      phone: '+91 98111 00001',
      role: 'admin' as const,
      email_verified: true,
      password_hash: hashPassword('Admin@2026'),
      avatar_color: '#0A2540',
    },
  ];
}

export function createUuid(): string {
  return crypto.randomUUID();
}
