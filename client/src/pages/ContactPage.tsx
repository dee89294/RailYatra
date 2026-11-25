/**
 * ============================================================================
 * File: client/src/pages/ContactPage.tsx
 * Purpose: Contact Us & Passenger Support page.
 * Responsibilities:
 *   - Submits support inquiries via `POST /api/contact` (stored in `contact_messages`
 *     so Administrators can track and resolve them inside `/admin`).
 *   - Pre-fills Name and Email when a Registered User is logged in.
 * Used by: `App.tsx` (route `/contact`).
 * ============================================================================
 */

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Mail, MapPin, PhoneCall, Send } from 'lucide-react';
import { Footer } from '../components/layout/Footer';
import { PageHeader } from '../components/layout/PageHeader';
import { useAuth } from '../context/AuthContext';
import { contactService } from '../services/contactService';

export const ContactPage: React.FC = () => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [pnrReference, setPnrReference] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName((prev) => prev || user.full_name);
      setEmail((prev) => prev || user.email);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await contactService.submitInquiry({
        name,
        email,
        subject,
        pnr_reference: pnrReference,
        message,
      });
      setSubmitted(true);
      setSubject('');
      setPnrReference('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <PageHeader
        badge="24x7 Passenger Care"
        title="Contact RailYatra Support"
        subtitle="Need help with a PNR, ticket refund, special assistance, or route schedule? Our support team responds promptly."
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Contact Channels */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-extrabold text-rail-navy">Direct Helpline Desks</h2>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-rail-primary flex items-center justify-center shrink-0">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-rail-navy">All-India Railway Helpline</div>
                  <div className="text-xs text-slate-500 mt-0.5">139 / 1800-111-139 (Toll Free)</div>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-rail-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-rail-navy">Email Escalations</div>
                  <div className="text-xs text-slate-500 mt-0.5">care@railyatra.in</div>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-rail-primary flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-rail-navy">Average Response SLA</div>
                  <div className="text-xs text-slate-500 mt-0.5">Under 30 minutes for active PNRs</div>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-rail-primary flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-rail-navy">Headquarters</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    RailYatra Digital Hub, Connaught Place, New Delhi — 110001
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Inquiry Form */}
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4"
            >
              <h2 className="text-xl font-extrabold text-rail-navy">Send Us a Message</h2>

              {submitted && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Your inquiry has been logged! An administrator will review it shortly.
                </div>
              )}

              {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ticket refund / Assistance / Feedback"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    PNR Reference (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={pnrReference}
                    onChange={(e) => setPnrReference(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit PNR"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe how we can assist your journey..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rail-primary/30 focus:border-rail-primary"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-rail-primary hover:bg-rail-royal text-white font-bold text-sm shadow-md transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Submit Inquiry</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
