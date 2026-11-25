/**
 * ============================================================================
 * File: client/src/services/contactService.ts
 * Purpose: Frontend API client for Contact Us inquiries.
 * Used by: `ContactPage.tsx`.
 * ============================================================================
 */

import type { ContactMessage } from '../types';
import { apiRequest } from './apiClient';

export const contactService = {
  submitInquiry(payload: {
    name: string;
    email: string;
    subject: string;
    pnr_reference?: string;
    message: string;
  }) {
    return apiRequest<ContactMessage>('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
