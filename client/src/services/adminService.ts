/**
 * ============================================================================
 * File: client/src/services/adminService.ts
 * Purpose: Frontend API client for Administrator Console endpoints (`/api/admin/*`).
 * Used by: `AdminDashboardPage.tsx`.
 * ============================================================================
 */

import type {
  BookingDetails,
  ClassCode,
  ContactMessage,
  Station,
  Train,
  TrainClass,
  TrainScheduleStop,
  TrainType,
  UserProfile,
} from '../types';
import { apiRequest } from './apiClient';

export interface AdminAnalytics {
  summary: {
    totalTrains: number;
    activeTrains: number;
    totalStations: number;
    totalUsers: number;
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    netRevenue: number;
    totalRefunds: number;
    openInquiries: number;
  };
  classBreakdown: Record<string, number>;
  recentBookings: BookingDetails[];
}

export const adminService = {
  getAnalytics() {
    return apiRequest<AdminAnalytics>('/admin/analytics');
  },

  listTrains() {
    return apiRequest<
      Array<{
        train: Train;
        stops: TrainScheduleStop[];
        classes: TrainClass[];
      }>
    >('/admin/trains');
  },

  createTrain(payload: {
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
      platform: string;
    }>;
    classes: Array<{
      class_code: ClassCode;
      class_name: string;
      base_fare: number;
      total_seats: number;
      coaches: string[];
    }>;
  }) {
    return apiRequest<Train>('/admin/trains', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleTrainActive(trainId: string, isActive: boolean) {
    return apiRequest<Train>(`/admin/trains/${trainId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  createStation(payload: {
    code: string;
    name: string;
    city: string;
    state: string;
    zone: string;
  }) {
    return apiRequest<Station>('/admin/stations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listAllBookings() {
    return apiRequest<BookingDetails[]>('/admin/bookings');
  },

  updateBooking(
    bookingId: string,
    updates: { booking_status?: BookingDetails['booking_status']; chart_prepared?: boolean }
  ) {
    return apiRequest<BookingDetails>(`/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  listUsers() {
    return apiRequest<UserProfile[]>('/admin/users');
  },

  updateUserRole(userId: string, role: 'user' | 'admin') {
    return apiRequest<UserProfile>(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  listMessages() {
    return apiRequest<ContactMessage[]>('/admin/messages');
  },

  updateMessageStatus(id: string, status: ContactMessage['status']) {
    return apiRequest<ContactMessage>(`/admin/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};
