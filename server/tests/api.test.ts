/**
 * ============================================================================
 * File: server/tests/api.test.ts
 * Purpose: End-to-end automated integration test suite for the RailYatra API.
 * Responsibilities:
 *   - Exercises health check, station search, train search, schedule lookup,
 *     PNR lookup, live train tracking, user registration + email verification,
 *     login, ticket booking + payment, cancellation + refund, and admin RBAC.
 * Run via: `npm --prefix server test`
 * ============================================================================
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

let server: http.Server;
let baseUrl = '';

async function request(
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: Record<string, any> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = (await res.json()) as Record<string, any>;
  return { status: res.status, body };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATA_PROVIDER = 'local';
  const { createApp } = await import('../src/index.js');
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
      }
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('RailYatra Full-Stack API Integration Tests', () => {
  let userToken = '';
  let adminToken = '';
  let createdBookingId = '';

  it('GET /api/health returns healthy status', async () => {
    const { status, body } = await request('/health');
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.service, 'RailYatra API');
  });

  it('Guest can search stations, trains, schedule, PNR, and live tracking', async () => {
    const stations = await request('/stations?q=New%20Delhi');
    assert.equal(stations.status, 200);
    assert.ok(stations.body.data.some((s: any) => s.code === 'NDLS'));

    const tomorrow = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
    const trains = await request(`/trains/search?from=NDLS&to=MMCT&date=${tomorrow}`);
    assert.equal(trains.status, 200);
    assert.ok(trains.body.data.length >= 1);

    const schedule = await request('/trains/22436/schedule');
    assert.equal(schedule.status, 200);
    assert.equal(schedule.body.data.train.train_number, '22436');

    const pnr = await request('/pnr/4528193047');
    assert.equal(pnr.status, 200);
    assert.equal(pnr.body.data.pnr_number, '4528193047');
    assert.equal(pnr.body.data.contact_email, '***@***');

    const tracking = await request('/tracking/22436');
    assert.equal(tracking.status, 200);
    assert.equal(tracking.body.data.train_number, '22436');
    assert.ok(tracking.body.data.stops.length >= 2);
  });

  it('Supports Registration -> Email Verification -> Login -> Booking -> Cancellation', async () => {
    const uniqueEmail = `test_${Date.now()}@railyatra.in`;
    const reg = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Test Passenger',
        email: uniqueEmail,
        phone: '+91 98765 11111',
        password: 'Password@123',
      }),
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.data.requiresVerification, true);
    assert.ok(reg.body.data.verificationPreviewUrl);

    // Unverified login must be blocked
    const blockedLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail, password: 'Password@123' }),
    });
    assert.equal(blockedLogin.status, 403);
    assert.equal(blockedLogin.body.code, 'EMAIL_NOT_VERIFIED');

    // Verify email using preview token
    const url = new URL(reg.body.data.verificationPreviewUrl);
    const token = url.searchParams.get('token');
    assert.ok(token);

    const verified = await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.user.email_verified, true);

    // Login succeeds after email verification
    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail, password: 'Password@123' }),
    });
    assert.equal(login.status, 200);
    userToken = login.body.data.accessToken;
    assert.ok(userToken);

    // Book a ticket
    const journeyDate = new Date(Date.now() + 86400000 * 4).toISOString().slice(0, 10);
    const booking = await request('/bookings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({
        trainNumber: '12952',
        fromStationCode: 'NDLS',
        toStationCode: 'MMCT',
        journeyDate,
        classCode: '3A',
        passengers: [
          { full_name: 'Test Passenger', age: 27, gender: 'Male', berth_preference: 'Lower' },
        ],
        paymentMethod: 'UPI',
        upiId: 'test@okicici',
      }),
    });
    assert.equal(booking.status, 201);
    assert.equal(booking.body.data.booking_status, 'CONFIRMED');
    assert.equal(booking.body.data.passengers[0].current_status, 'CNF');
    createdBookingId = booking.body.data.id;

    // Cancel the booking
    const cancelled = await request(`/bookings/${createdBookingId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({}),
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.booking_status, 'CANCELLED');
    assert.ok(cancelled.body.data.refund_amount > 0);
  });

  it('Enforces Admin Authorization (RBAC)', async () => {
    // Normal user is denied access to admin analytics
    const denied = await request('/admin/analytics', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, 'FORBIDDEN_ADMIN_ONLY');

    // Admin logs in and accesses analytics
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@railyatra.in',
        password: 'Admin@2026',
      }),
    });
    assert.equal(adminLogin.status, 200);
    adminToken = adminLogin.body.data.accessToken;

    const analytics = await request('/admin/analytics', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(analytics.status, 200);
    assert.ok(analytics.body.data.summary.totalTrains >= 14);
  });
});
