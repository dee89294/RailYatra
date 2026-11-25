/**
 * ============================================================================
 * File: server/src/services/adminService.ts
 * Purpose: Administrator Operations & Analytics Service.
 * Responsibilities:
 *   - Aggregates system-wide KPIs (total bookings, net revenue, active trains,
 *     registered users, open support inquiries, class-wise breakdown).
 *   - Manages stations and trains/schedules/classes creation & activation.
 *   - Inspects and updates booking chart/confirmation status and user roles.
 *   - Manages Contact Us inquiries.
 * Used by: `routes/adminRoutes.ts` (protected by `requireAuth` + `requireAdmin`).
 * Dependencies: `db/repository.ts`, `middleware/errorHandler.ts`.
 * ============================================================================
 */

import { repository } from '../db/repository.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  Booking,
  ClassCode,
  ContactMessage,
  Train,
  TrainType,
} from '../types/index.js';

export const adminService = {
  async getDashboardAnalytics() {
    const [trains, stations, bookings, users, messages] = await Promise.all([
      repository.listTrains(true),
      repository.listStations(),
      repository.listAllBookings(),
      repository.listAllUsers(),
      repository.listContactMessages(),
    ]);

    const confirmedBookings = bookings.filter((b) => b.booking_status !== 'CANCELLED');
    const cancelledBookings = bookings.filter((b) => b.booking_status === 'CANCELLED');
    const grossRevenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);
    const totalRefunds = bookings.reduce((sum, b) => sum + b.refund_amount, 0);
    const netRevenue = Number((grossRevenue - totalRefunds).toFixed(2));

    const classBreakdown: Record<string, number> = {};
    for (const b of bookings) {
      classBreakdown[b.class_code] = (classBreakdown[b.class_code] || 0) + 1;
    }

    return {
      summary: {
        totalTrains: trains.length,
        activeTrains: trains.filter((t) => t.is_active).length,
        totalStations: stations.length,
        totalUsers: users.length,
        totalBookings: bookings.length,
        confirmedBookings: confirmedBookings.length,
        cancelledBookings: cancelledBookings.length,
        netRevenue,
        totalRefunds: Number(totalRefunds.toFixed(2)),
        openInquiries: messages.filter((m) => m.status !== 'RESOLVED').length,
      },
      classBreakdown,
      recentBookings: bookings.slice(0, 10),
    };
  },

  async listAllTrainsDetailed() {
    const trains = await repository.listTrains(true);
    return Promise.all(
      trains.map(async (train) => ({
        train,
        stops: await repository.getTrainSchedule(train.id),
        classes: await repository.getTrainClasses(train.id),
      }))
    );
  },

  async createStation(input: {
    code: string;
    name: string;
    city: string;
    state: string;
    zone: string;
  }) {
    if (!input.code || input.code.trim().length < 2 || !input.name || !input.city) {
      throw new AppError('Station code, name, and city are required.', 400, 'VALIDATION_ERROR');
    }
    return repository.createStation({
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      city: input.city.trim(),
      state: input.state.trim() || 'India',
      zone: input.zone.trim().toUpperCase() || 'IR',
    });
  },

  async createTrain(input: {
    train_number: string;
    train_name: string;
    train_type: TrainType;
    source_station_code: string;
    destination_station_code: string;
    running_days: string;
    total_distance_km: number;
    duration_minutes: number;
    stops: Array<{
      station_code: string;
      arrival_time: string;
      departure_time: string;
      halt_minutes: number;
      day_number: number;
      distance_from_source_km: number;
      platform?: string;
    }>;
    classes: Array<{
      class_code: ClassCode;
      class_name: string;
      base_fare: number;
      total_seats: number;
      coaches: string[];
    }>;
  }): Promise<Train> {
    if (!input.train_number || !input.train_name) {
      throw new AppError('Train number and name are required.', 400, 'VALIDATION_ERROR');
    }
    if (!input.stops || input.stops.length < 2) {
      throw new AppError('A train must have at least 2 route stops (origin and destination).', 400, 'VALIDATION_ERROR');
    }
    if (!input.classes || input.classes.length < 1) {
      throw new AppError('A train must offer at least 1 travel class.', 400, 'VALIDATION_ERROR');
    }

    const existing = await repository.getTrainByNumberOrId(input.train_number.trim());
    if (existing) {
      throw new AppError(`Train ${input.train_number} already exists.`, 409, 'DUPLICATE_TRAIN');
    }

    return repository.createTrainWithDetails({
      train_number: input.train_number.trim(),
      train_name: input.train_name.trim(),
      train_type: input.train_type,
      source_station_code: input.source_station_code.trim().toUpperCase(),
      destination_station_code: input.destination_station_code.trim().toUpperCase(),
      running_days: input.running_days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      total_distance_km: Number(input.total_distance_km),
      duration_minutes: Number(input.duration_minutes),
      stops: input.stops.map((s, idx) => ({
        station_code: s.station_code.trim().toUpperCase(),
        stop_order: idx + 1,
        arrival_time: s.arrival_time,
        departure_time: s.departure_time,
        halt_minutes: Number(s.halt_minutes || 0),
        day_number: Number(s.day_number || 1),
        distance_from_source_km: Number(s.distance_from_source_km || 0),
        platform: s.platform || '1',
      })),
      classes: input.classes.map((c) => ({
        class_code: c.class_code,
        class_name: c.class_name,
        base_fare: Number(c.base_fare),
        total_seats: Number(c.total_seats),
        coaches: c.coaches && c.coaches.length > 0 ? c.coaches : ['C1'],
      })),
    });
  },

  async setTrainActiveStatus(trainId: string, isActive: boolean) {
    const updated = await repository.toggleTrainActive(trainId, isActive);
    if (!updated) throw new AppError('Train not found.', 404, 'TRAIN_NOT_FOUND');
    return updated;
  },

  async listAllBookings() {
    return repository.listAllBookings();
  },

  async updateBookingStatus(
    bookingId: string,
    updates: { booking_status?: Booking['booking_status']; chart_prepared?: boolean }
  ) {
    const updated = await repository.updateBookingAdminFields(bookingId, updates);
    if (!updated) throw new AppError('Booking not found.', 404, 'BOOKING_NOT_FOUND');
    return updated;
  },

  async listUsers() {
    return repository.listAllUsers();
  },

  async updateUserRole(targetUserId: string, role: 'user' | 'admin') {
    const updated = await repository.updateProfile(targetUserId, { role });
    if (!updated) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
    return updated;
  },

  async listContactMessages() {
    return repository.listContactMessages();
  },

  async updateContactMessageStatus(id: string, status: ContactMessage['status']) {
    const updated = await repository.updateContactMessageStatus(id, status);
    if (!updated) throw new AppError('Inquiry not found.', 404, 'NOT_FOUND');
    return updated;
  },
};
