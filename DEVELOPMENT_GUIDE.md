# RailYatra — Full-Stack Developer & Learning Guide

Welcome to the **RailYatra Development Guide**! This document is written specifically so you can open any file in the codebase, trace how modules communicate, and understand key full-stack concepts without guessing.

---

## 1. End-to-End Architecture Overview

RailYatra uses a **clean 3-tier full-stack architecture**:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React + TypeScript + Vite + Tailwind CSS in `client/`)          │
│                                                                           │
│  Pages (Home, Search, Schedule, Tracking, PNR, Book, Dashboard, Admin)    │
│     │                                                                     │
│     ├── Context: AuthContext (global session user, login, logout)         │
│     ├── Guards:  ProtectedRoute (redirects guests / blocks non-admins)    │
│     └── Services: authService, trainService, bookingService, adminService │
│            │                                                              │
│            └── apiClient.ts (adds Bearer JWT, handles JSON & ApiError)    │
└──────────────────────────┬────────────────────────────────────────────────┘
                           │ HTTP / JSON (`/api/*`)
                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ BACKEND API (Node.js + Express + TypeScript in `server/`)                 │
│                                                                           │
│  Routers (`routes/*.ts`)                                                  │
│     │                                                                     │
│     ├── Middleware: requireAuth -> requireVerifiedEmail -> requireAdmin   │
│     ├── Services:   authService, trainService, bookingService,            │
│     │               paymentService, railwayApiService, emailService,      │
│     │               adminService                                          │
│     └── Repository (`db/repository.ts`)                                   │
│            │                                                              │
│            ├── Mode A: Supabase PostgreSQL (`supabaseClient.ts` + RLS)    │
│            └── Mode B: Local SQLite (`sqliteClient.ts` via `node:sqlite`) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Important Files & Module Dependencies

### Backend (`server/src/`)

| File | Purpose | Used By | External / DB Dependencies |
| :--- | :--- | :--- | :--- |
| `index.ts` | Bootstraps Express, security headers, CORS, mounts all routers | Startup (`npm run dev`), `tests/api.test.ts` | `config/env.ts`, `db/sqliteClient.ts`, `routes/*` |
| `config/env.ts` | Loads `.env` and chooses `supabase` vs `local` mode | All services & clients | `.env` (`SUPABASE_*`, `SMTP_*`, `RAILWAY_API_*`) |
| `db/supabaseClient.ts` | Creates Admin, Anon, and RLS-scoped User Supabase clients | `repository.ts`, `authService.ts`, `authMiddleware.ts` | Supabase Auth & PostgreSQL |
| `db/sqliteClient.ts` | Initializes `data/railyatra.db`, runs `schema.sql`, auto-seeds | `repository.ts`, `index.ts` | Built-in `node:sqlite` (`DatabaseSync`) |
| `db/repository.ts` | Unified data-access functions abstracting SQLite & Supabase | All services | All 11 database tables |
| `middleware/authMiddleware.ts` | Verifies Bearer token & checks `email_verified` | Protected routes | `supabaseClient.ts`, `crypto.ts`, `repository.ts` |
| `middleware/adminMiddleware.ts` | Enforces `req.user.role === 'admin'` | `routes/adminRoutes.ts` | Requires `requireAuth` first |
| `services/authService.ts` | Signup, email verification, login, password reset | `routes/authRoutes.ts` | `repository.ts`, `emailService.ts`, `crypto.ts` |
| `services/trainService.ts` | Route matching (`from` before `to`), proportional fares, availability | `routes/trainRoutes.ts`, `bookingService.ts` | `stations`, `trains`, `train_schedules`, `train_classes`, `bookings` |
| `services/bookingService.ts` | Seat/berth allocation, 10-digit PNR generation, cancellation & refunds | `routes/bookingRoutes.ts`, `routes/pnrRoutes.ts` | `paymentService.ts`, `emailService.ts`, `repository.ts` |
| `services/paymentService.ts` | GST (5% AC), convenience fee, payment validation, transaction IDs | `bookingService.ts`, `routes/paymentRoutes.ts` | `crypto.ts` |
| `services/railwayApiService.ts` | External Railway API call + live IST schedule-synced fallback | `routes/trackingRoutes.ts` | External Railway API (optional), `train_schedules` |
| `services/emailService.ts` | Sends verification, reset, ticket & cancellation emails | `authService.ts`, `bookingService.ts` | SMTP via `nodemailer` or Dev Outbox |

### Frontend (`client/src/`)

| File | Purpose | Connects To |
| :--- | :--- | :--- |
| `context/AuthContext.tsx` | Restores session on reload, stores JWT, provides `useAuth()` | `authService.ts`, `apiClient.ts` |
| `services/apiClient.ts` | Single `fetch` wrapper attaching `Authorization: Bearer <token>` | Express `/api/*` |
| `components/common/ProtectedRoute.tsx` | Guards `/book`, `/bookings`, `/dashboard`, and `/admin` | `AuthContext.tsx` |
| `components/common/TrainSearchWidget.tsx` | Floating search bar from Hero mockup (From/Swap/To/Date/Class/Pax + Booking Quota row) | `StationSelect.tsx`, `/search` route |
| `components/common/ETicketModal.tsx` | Printable E-Ticket slip with QR SVG & fare summary | `BookTicketPage.tsx`, `MyBookingsPage.tsx` |
| `pages/BookTicketPage.tsx` | Multi-passenger form, saved passengers autofill, payment & confirmation | `bookingService.ts`, `authService.ts` |
| `pages/AdminDashboardPage.tsx` | 5-tab Admin console (Analytics, Trains, Stations, Bookings, Users/Support) | `adminService.ts`, `trainService.ts` |

---

## 3. Complete Application Workflows (Step by Step)

### Workflow A: User Registration, Email Verification & Login
1. User fills `SignupPage.tsx` -> calls `authService.register()`.
2. Backend `authRoutes.ts` calls `authService.register()`.
   - In **Supabase Mode**: `supabase.auth.signUp()` creates the user in `auth.users`, and PostgreSQL trigger `handle_new_user()` automatically inserts a matching row in `public.profiles`.
   - In **Local Mode**: `crypto.hashPassword()` hashes the password with `scrypt` + random salt, inserts into `profiles`, stores a SHA-256 hashed `EMAIL_VERIFY` token in `auth_tokens`, and triggers `emailService.sendVerificationEmail()`.
3. User clicks the verification link (`/verify-email?token=...`) -> `VerifyEmailPage.tsx` calls `POST /api/auth/verify-email` -> `profiles.email_verified` becomes `true`.
4. User logs in via `LoginPage.tsx` -> `AuthContext.login()` saves the returned JWT in `localStorage` and sets `user` state across the app.

### Workflow B: Train Search & Ticket Reservation
1. On `HomePage.tsx`, user selects `From`, `To`, `Date`, `Class`, `Passengers`, and `Booking Quota` (`GN`, `TQ`, `PT`, `LD`, `SS`) inside `TrainSearchWidget.tsx` and clicks **Search Trains**.
2. Browser navigates to `/search?from=NDLS&to=MMCT&date=...`.
3. `SearchTrainsPage.tsx` calls `GET /api/trains/search`. Backend `trainService.searchTrains()` inspects `train_schedules` to find all trains where `from_stop.stop_order < to_stop.stop_order`, calculates segment distance & fare, and counts active booked passengers to return `AVL`, `RAC`, or `WL`.
4. Clicking a class navigates to `/book?...` (protected by `ProtectedRoute`).
5. User enters 1–6 passengers (or clicks a saved co-passenger), picks UPI/Card/NetBanking/Wallet, and clicks **Pay & Confirm Ticket**.
6. `POST /api/bookings` passes `requireAuth` + `requireVerifiedEmail`, computes exact fare + GST in `paymentService`, allocates non-overlapping coach & berth seats (`bookingService.createBooking`), inserts `bookings + passengers + payments` in a database transaction, and dispatches an E-Ticket confirmation email!

### Workflow C: Cancellation & Refund
1. Inside `/bookings` (`MyBookingsPage.tsx`), user clicks **Cancel Ticket** (full) or **Cancel** next to an individual passenger.
2. `POST /api/bookings/:id/cancel` verifies ownership (`booking.user_id === req.user.id` or `admin`), marks cancelled passenger(s) `CAN`, updates booking status (`CANCELLED` or `PARTIAL_CANCELLED`), calculates 90% base fare + GST refund, updates `payments.status`, and sends a cancellation email.

---

## 4. Key Learning Concepts Explained

- **Authentication vs. Authorization:**
  - *Authentication* (`requireAuth`) verifies **who you are** by validating your Bearer JWT.
  - *Authorization* (`requireVerifiedEmail`, `requireAdmin`) verifies **what you are allowed to do** (e.g., only admins can call `/api/admin/*`, returning HTTP `403 Forbidden` to regular users).
- **Row Level Security (RLS) in Supabase PostgreSQL:**
  - Located in `supabase/migrations/001_initial_schema.sql`, RLS policies attach security rules directly to database tables. For example, `CREATE POLICY "Users view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = user_id OR public.is_admin());` ensures PostgreSQL itself blocks user A from ever querying user B's tickets when queried with user A's JWT.
- **Foreign Keys & Cascading Integrity:**
  - `passengers.booking_id` references `bookings(id) ON DELETE CASCADE`, and `train_schedules.train_id` references `trains(id) ON DELETE CASCADE`, guaranteeing no orphaned passenger or schedule rows can exist.
- **Environment Variables & Security:**
  - Sensitive credentials (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASS`, `RAILWAY_API_KEY`) live only in `server/.env` (git-ignored) and are never bundled into `client/`.
