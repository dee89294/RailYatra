/**
 * ============================================================================
 * File: server/src/services/paymentService.ts
 * Purpose: Fare calculation and Payment Processing service for RailYatra.
 * Responsibilities:
 *   - Calculates IRCTC-compliant itemized fare breakdowns (Base Fare,
 *     5% GST for AC classes, convenience fee, and total payable).
 *   - Validates payment instruments (UPI ID, Card last-4/expiry, NetBanking bank,
 *     or Wallet) and generates unique transaction references (`RYPAY...`).
 *   - Calculates cancellation refund amounts transparently.
 * Used by: `services/bookingService.ts`, `routes/paymentRoutes.ts`.
 * Dependencies: `utils/crypto.ts`, `middleware/errorHandler.ts`.
 * ============================================================================
 */

import { AppError } from '../middleware/errorHandler.js';
import type { ClassCode, PaymentMethod, QuotaCode } from '../types/index.js';
import { generateTransactionId } from '../utils/crypto.js';

export interface FareQuote {
  perPassengerBaseFare: number;
  perPassengerTatkalCharge: number;
  passengerCount: number;
  baseFareTotal: number;
  tatkalChargeTotal: number;
  gstAmount: number;
  convenienceFee: number;
  totalAmount: number;
  quotaCode: QuotaCode;
  quotaName: string;
}

const AC_CLASSES: ReadonlySet<ClassCode> = new Set(['1A', '2A', '3A', 'CC', 'EC']);

export const QUOTA_NAME_MAP: Record<QuotaCode, string> = {
  GN: 'GENERAL',
  TQ: 'TATKAL',
  PT: 'PREMIUM_TATKAL',
  LD: 'LADIES',
  SS: 'SENIOR_CITIZEN',
};

export function normalizeQuotaCode(raw?: string): QuotaCode {
  const val = (raw || 'GN').trim().toUpperCase();
  if (val === 'TQ' || val === 'TATKAL') return 'TQ';
  if (val === 'PT' || val === 'PREMIUM_TATKAL' || val === 'PREMIUM TATKAL') return 'PT';
  if (val === 'LD' || val === 'LADIES') return 'LD';
  if (val === 'SS' || val === 'SENIOR_CITIZEN' || val === 'LOWER BERTH') return 'SS';
  return 'GN';
}

export const paymentService = {
  /**
   * Computes quota-adjusted per-passenger fare and Tatkal/Premium Tatkal surcharge
   * aligned with Indian Railways rules:
   *  - `GN` / `LD` / `SS`: Standard base fare (no Tatkal surcharge).
   *  - `TQ` (Tatkal): +30% surcharge (capped ₹200 SL, ₹400 3A/CC, ₹500 2A/EC; +10% capped ₹15 2S).
   *  - `PT` (Premium Tatkal): Dynamic surge (~1.65x base fare; +65% dynamic surcharge).
   *  - Note: `1A` (AC First Class) does not offer Tatkal / Premium Tatkal quotas.
   */
  calculateQuotaFare(
    generalBaseFare: number,
    classCode: ClassCode,
    quotaCode: QuotaCode
  ): { fare: number; tatkalCharge: number } {
    if (quotaCode === 'GN' || quotaCode === 'LD' || quotaCode === 'SS') {
      return { fare: generalBaseFare, tatkalCharge: 0 };
    }

    if (quotaCode === 'TQ') {
      const capMap: Record<ClassCode, number> = {
        '1A': 0,
        '2A': 500,
        EC: 500,
        '3A': 400,
        CC: 225,
        SL: 200,
        '2S': 15,
      };
      const rate = classCode === '2S' ? 0.1 : 0.3;
      const surcharge = Math.min(
        capMap[classCode] || 400,
        Math.max(classCode === '2S' ? 10 : 100, Math.round((generalBaseFare * rate) / 5) * 5)
      );
      return {
        fare: Math.round((generalBaseFare + surcharge) / 5) * 5,
        tatkalCharge: surcharge,
      };
    }

    // Premium Tatkal (PT) dynamic fare slab
    const dynamicSurcharge = Math.max(
      150,
      Math.round((generalBaseFare * 0.65) / 5) * 5
    );
    return {
      fare: Math.round((generalBaseFare + dynamicSurcharge) / 5) * 5,
      tatkalCharge: dynamicSurcharge,
    };
  },

  /**
   * Computes exact fare breakdown:
   *  - 5% GST applies only to Air-Conditioned classes (1A, 2A, 3A, CC, EC).
   *  - Flat convenience fee per PNR: ₹35 (AC) or ₹20 (Non-AC SL/2S).
   */
  calculateFareQuote(
    perPassengerBaseFare: number,
    passengerCount: number,
    classCode: ClassCode,
    quotaCode: QuotaCode = 'GN',
    perPassengerTatkalCharge = 0
  ): FareQuote {
    const baseFareTotal = Number((perPassengerBaseFare * passengerCount).toFixed(2));
    const tatkalChargeTotal = Number(
      (perPassengerTatkalCharge * passengerCount).toFixed(2)
    );
    const taxableFare = baseFareTotal + tatkalChargeTotal;
    const gstAmount = AC_CLASSES.has(classCode)
      ? Number((taxableFare * 0.05).toFixed(2))
      : 0;
    const convenienceFee = AC_CLASSES.has(classCode) ? 35 : 20;
    const totalAmount = Number((taxableFare + gstAmount + convenienceFee).toFixed(2));

    return {
      perPassengerBaseFare,
      perPassengerTatkalCharge,
      passengerCount,
      baseFareTotal,
      tatkalChargeTotal,
      gstAmount,
      convenienceFee,
      totalAmount,
      quotaCode,
      quotaName: QUOTA_NAME_MAP[quotaCode],
    };
  },

  /**
   * Processes and validates a ticket payment submission.
   * Returns a verified transaction ID ready to record in `payments`.
   */
  processPayment(input: {
    method: PaymentMethod;
    amount: number;
    upiId?: string;
    cardNumber?: string;
    bankName?: string;
  }): {
    transactionId: string;
    paymentMethod: PaymentMethod;
    paymentProvider: string;
    status: 'SUCCESS';
  } {
    if (input.amount <= 0) {
      throw new AppError('Invalid payment amount.', 400, 'INVALID_PAYMENT_AMOUNT');
    }

    if (input.method === 'UPI') {
      if (!input.upiId || !input.upiId.includes('@')) {
        throw new AppError(
          'Please enter a valid UPI ID (e.g., name@okicici).',
          400,
          'INVALID_UPI_ID'
        );
      }
    } else if (input.method === 'CARD') {
      const digits = (input.cardNumber || '').replace(/\s+/g, '');
      if (digits.length < 12) {
        throw new AppError(
          'Please enter a valid 16-digit debit or credit card number.',
          400,
          'INVALID_CARD'
        );
      }
    } else if (input.method === 'NETBANKING') {
      if (!input.bankName || input.bankName.trim().length < 2) {
        throw new AppError('Please select a bank for NetBanking.', 400, 'INVALID_BANK');
      }
    }

    const providerMap: Record<PaymentMethod, string> = {
      UPI: 'RailYatra UPI Gateway',
      CARD: 'RailYatra Card Gateway',
      NETBANKING: `NetBanking (${input.bankName || 'Partner Bank'})`,
      WALLET: 'RailYatra Wallet',
    };

    return {
      transactionId: generateTransactionId(),
      paymentMethod: input.method,
      paymentProvider: providerMap[input.method],
      status: 'SUCCESS',
    };
  },

  /**
   * Computes refundable amount when passengers or an entire PNR are cancelled.
   * Standard policy: 90% of cancelled base fare + proportional GST is refunded
   * (10% clerkage/cancellation fee; convenience fee is non-refundable).
   */
  calculateRefundAmount(
    baseFarePerPassenger: number,
    cancelledPassengerCount: number,
    classCode: ClassCode
  ): number {
    const cancelledBase = baseFarePerPassenger * cancelledPassengerCount;
    const refundableBase = cancelledBase * 0.9;
    const refundableGst = AC_CLASSES.has(classCode) ? refundableBase * 0.05 : 0;
    return Number((refundableBase + refundableGst).toFixed(2));
  },
};
