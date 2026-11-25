/**
 * ============================================================================
 * File: server/src/services/emailService.ts
 * Purpose: Transactional SMTP Email Service (Nodemailer + Dev Preview Outbox).
 * Responsibilities:
 *   - Sends real SMTP emails via `nodemailer` whenever `SMTP_HOST`, `SMTP_USER`,
 *     and `SMTP_PASS` are configured in `server/.env`.
 *   - In local zero-config development (when SMTP isn't configured), stores clean
 *     previews in an in-memory `devOutbox` and prints verification/reset links
 *     to the server console so developers can test the complete verification flow!
 * Used by: `services/authService.ts`, `services/bookingService.ts`, `routes/authRoutes.ts`.
 * External service: SMTP server via `nodemailer`.
 * ============================================================================
 */

import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import type { BookingDetails, DevEmailPreview } from '../types/index.js';

const devOutbox: DevEmailPreview[] = [];

function createTransporter() {
  if (!env.smtp.configured) return null;
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

async function dispatchEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  verificationUrl?: string;
  resetUrl?: string;
}): Promise<{ deliveredVia: 'smtp' | 'dev_outbox' }> {
  const preview: DevEmailPreview = {
    id: crypto.randomUUID(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    verificationUrl: input.verificationUrl,
    resetUrl: input.resetUrl,
    sentAt: new Date().toISOString(),
  };

  // Always retain recent previews in development for easy testing/debugging
  if (env.nodeEnv !== 'production') {
    devOutbox.unshift(preview);
    if (devOutbox.length > 30) devOutbox.pop();
  }

  const transporter = createTransporter();
  if (transporter) {
    await transporter.sendMail({
      from: env.smtp.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { deliveredVia: 'smtp' };
  }

  console.log(`\n[RailYatra Dev Email Outbox] To: ${input.to} | Subject: ${input.subject}`);
  if (input.verificationUrl) {
    console.log(` -> Verification Link: ${input.verificationUrl}`);
  }
  if (input.resetUrl) {
    console.log(` -> Password Reset Link: ${input.resetUrl}`);
  }
  return { deliveredVia: 'dev_outbox' };
}

export const emailService = {
  /**
   * Sends an account email-verification link after user signup.
   */
  async sendVerificationEmail(to: string, fullName: string, rawToken: string) {
    const verificationUrl = `${env.clientUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0052CC, #0B6EFD); padding: 24px; color: white;">
          <h1 style="margin: 0; font-size: 22px;">RailYatra</h1>
          <p style="margin: 4px 0 0; opacity: 0.9; font-size: 13px;">Your Journey, Our Priority.</p>
        </div>
        <div style="padding: 24px; color: #0f172a;">
          <h2 style="margin-top: 0;">Verify your email address</h2>
          <p>Namaste <strong>${fullName}</strong>,</p>
          <p>Welcome to RailYatra! Please confirm your email address to unlock ticket reservations, PNR alerts, and your personal travel dashboard.</p>
          <p style="margin: 28px 0;">
            <a href="${verificationUrl}" style="background: #0B6EFD; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">
              Verify Email Address
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b;">Or copy this link into your browser:<br />${verificationUrl}</p>
        </div>
      </div>
    `;

    return dispatchEmail({
      to,
      subject: 'Verify your RailYatra account',
      html,
      text: `Namaste ${fullName}, verify your RailYatra email here: ${verificationUrl}`,
      verificationUrl,
    });
  },

  /**
   * Sends a password reset link expiring in 1 hour.
   */
  async sendPasswordResetEmail(to: string, fullName: string, rawToken: string) {
    const resetUrl = `${env.clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: #0A2540; padding: 24px; color: white;">
          <h1 style="margin: 0; font-size: 22px;">RailYatra Security</h1>
        </div>
        <div style="padding: 24px; color: #0f172a;">
          <h2 style="margin-top: 0;">Reset your password</h2>
          <p>Hello ${fullName},</p>
          <p>We received a request to reset your RailYatra password. Click the button below within 60 minutes to choose a new password.</p>
          <p style="margin: 28px 0;">
            <a href="${resetUrl}" style="background: #0B6EFD; color: white; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">
              Reset Password
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b;">If you did not request this, you can safely ignore this email.</p>
        </div>
      </div>
    `;

    return dispatchEmail({
      to,
      subject: 'Reset your RailYatra password',
      html,
      text: `Reset your RailYatra password: ${resetUrl}`,
      resetUrl,
    });
  },

  /**
   * Sends an Electronic Reservation Slip (E-Ticket) summary after payment succeeds.
   */
  async sendBookingConfirmationEmail(booking: BookingDetails) {
    const paxList = booking.passengers
      .map(
        (p, idx) =>
          `<li>${idx + 1}. ${p.full_name} (${p.age}/${p.gender[0]}) — <strong>${p.current_status}</strong> ${
            p.coach && p.seat_number ? `${p.coach}/${p.seat_number} (${p.berth_type})` : ''
          }</li>`
      )
      .join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0052CC, #0B6EFD); padding: 20px 24px; color: white;">
          <h2 style="margin: 0;">E-Ticket Confirmed — PNR: ${booking.pnr_number}</h2>
          <p style="margin: 4px 0 0; font-size: 13px;">RailYatra — Your Journey, Our Priority.</p>
        </div>
        <div style="padding: 24px; color: #0f172a;">
          <p><strong>Train:</strong> ${booking.train?.train_number} ${booking.train?.train_name}</p>
          <p><strong>Route:</strong> ${booking.from_station_code} (${booking.departure_time || '--'}) → ${booking.to_station_code} (${booking.arrival_time || '--'})</p>
          <p><strong>Journey Date:</strong> ${booking.journey_date} | <strong>Class:</strong> ${booking.class_code}</p>
          <p><strong>Total Paid:</strong> ₹${booking.total_amount.toFixed(2)}</p>
          <h3>Passengers</h3>
          <ul>${paxList}</ul>
        </div>
      </div>
    `;

    return dispatchEmail({
      to: booking.contact_email,
      subject: `RailYatra E-Ticket Confirmed | PNR ${booking.pnr_number}`,
      html,
      text: `Your RailYatra ticket (PNR ${booking.pnr_number}) on ${booking.train?.train_number} ${booking.train?.train_name} on ${booking.journey_date} is ${booking.booking_status}. Total: INR ${booking.total_amount}.`,
    });
  },

  /**
   * Sends a cancellation and refund confirmation notice.
   */
  async sendCancellationEmail(booking: BookingDetails, refundAmount: number) {
    return dispatchEmail({
      to: booking.contact_email,
      subject: `RailYatra Ticket Cancelled | PNR ${booking.pnr_number}`,
      html: `<p>Your booking (PNR <strong>${booking.pnr_number}</strong>) has been updated to <strong>${booking.booking_status}</strong>. Refund of <strong>₹${refundAmount.toFixed(2)}</strong> has been initiated to your original payment method.</p>`,
      text: `PNR ${booking.pnr_number} updated to ${booking.booking_status}. Refund initiated: INR ${refundAmount.toFixed(2)}.`,
    });
  },

  /**
   * Returns recent emails captured in dev mode so learners can click verification links
   * right inside the UI without configuring external SMTP credentials.
   */
  getDevOutbox(emailFilter?: string): DevEmailPreview[] {
    if (!emailFilter) return devOutbox;
    const normalized = emailFilter.trim().toLowerCase();
    return devOutbox.filter((item) => item.to.toLowerCase() === normalized);
  },
};
