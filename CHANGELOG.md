# CareTime Changelog

All notable changes to CareTime are documented here.

---

## Session 38 — 14 July 2026

### Medical Instructions & Counters

- New Client-managed lists: Medical Instructions (title + free-text "what to give") and Counters
  (title only, ≤30 chars, unique per Client) — `app/client/medical-instructions/page.tsx` and
  `app/client/counters/page.tsx`, linked from `/client/details`
- Client "Add"/"Edit Activity" gained a checkbox picker to attach none/one/many Medical
  Instructions to an Activity; for a new recurring Activity this attaches to every occurrence
  generated at creation time, but editing an existing occurrence's attachments only affects that
  one Activity — it does not cascade to the rest of the series like title/description edits do
- Worker's shift screen (`app/worker/activities/[id]/page.tsx`) now shows attached Medical
  Instructions as a checklist (tick to mark given, timestamped) and every one of the Client's
  Counters as a +/- stepper, both interactive only while the shift is `in_progress`; nothing
  blocks submitting the shift if items are left unchecked
- Counters are a per-shift tally (reset to 0 each Activity, not a running total) — the Client's
  Activity detail page shows a read-only summary of given/not-given instructions and each
  counter's value for that specific shift
- Schema: new `supabase_medical_instructions_counters_migration.sql` — `medical_instructions`,
  `activity_medical_instructions`, `client_counters`, `activity_counter_values`, RLS following
  the existing coarse "any authenticated user" policy style

## Session 37 — 10 July 2026

### Fix Persistent Mobile Zoom, Redesign Invoices (GST, Payment Details, Fixed Layout Bugs)

- Fixed the mobile sizing regression that survived Session 36's viewport fix: iOS Safari
  auto-zooms in on any input/select/textarea under 16px on focus, and the zoom can persist
  across client-side route changes (e.g. logging in) — many fields in this app use Tailwind's
  `text-sm` (14px). Added a global rule forcing 16px on form controls on small screens
  instead of hunting down every individual input.
- Redesigned the invoice PDF (`lib/invoice/pdf.ts`):
  - Smaller margins (50pt → 36pt)
  - Client address (if on file) shown under the Client's name, with email below that
  - Line items restructured to two lines each: Date/Start/End/Worker/Hours/Rate/Cost on the
    first line, NDIS item code + description indented under Worker on the second
  - Fixed the "amount unreadable" bug — the Hours and Amount columns' pixel ranges literally
    overlapped in the old layout; rebuilt all column positions to be strictly non-overlapping
    and verified by rendering a real PDF with sample data, not just by inspecting the code
  - Added a Subtotal / GST / Total breakdown and a Payment Details block (Bank Name, Account
    Name, BSB, Account Number) at the bottom, plus the payment due date
  - Mirrored the Subtotal/GST/Total breakdown and a Payment Details card onto the on-screen
    invoice detail page for consistency with the emailed PDF
- Schema: added `providers.bank_name`, `providers.gst_rate` (default 10%), and
  `providers.invoice_days_due` (default 14) — new `supabase_invoice_settings_migration.sql`,
  plus `invoices.subtotal_amount`/`gst_amount` to store the breakdown alongside the existing
  GST-inclusive `total_amount`
- Provider Settings → Details: added Bank Name, GST Rate, and Payment Due (days) fields, and
  a new "Billing Rates" section exposing Client Charge % / Worker Pay % — these were already
  driving every invoice calculation but had no UI to edit them at all before now

## Session 36 — 10 July 2026

### Fix Mobile Viewport Not Scaling to Device Width

The root layout had no `viewport` export, so mobile browsers (Worker and Client roles) were
rendering the page at a default desktop-width viewport and scaling it down to fit the physical
screen, rather than laying out at the phone's actual width. Added an explicit
`width: 'device-width', initialScale: 1` viewport export to `app/layout.tsx` and verified via
the dev server that `<meta name="viewport" content="width=device-width, initial-scale=1">` is
now actually present in the rendered `<head>`.

## Session 35 — 10 July 2026

### Fix Password-Reset Links Failing Immediately (Real Root Cause)

Session 34's reset-password fix correctly stopped trusting a stale pre-existing browser
session — but that removed the only thing that had ever produced *any* session on that page,
surfacing a deeper, pre-existing bug: `createBrowserClient` (`@supabase/ssr`) uses the PKCE
flow, so the recovery link redirects to `/auth/reset-password` with `?code=...` in the URL
rather than tokens in the hash fragment. That code was never being exchanged for a session —
so every link, valid or not, ended at "This password reset link is invalid or has expired,"
often within minutes of being sent despite the 24-hour expiry claimed in the email.

Fixed by explicitly calling `supabase.auth.exchangeCodeForSession(code)` when a `code` param
is present, alongside the existing `PASSWORD_RECOVERY` event listener (kept as a fallback path).
Verified `exchangeCodeForSession`'s signature and return shape directly against the installed
`@supabase/auth-js` type definitions before relying on it.

## Session 34 — 10 July 2026

### Recurring Activity Editing, Password-Reset Hang Fix, Calendar/UX Polish

- Client activity edit form: editing a recurring occurrence now cascades title/description/
  time-of-day changes to every not-yet-completed occurrence in the series (each keeps its own
  date), and adds a Recurrence editor (reusing `RecurrencePicker`) — changing the pattern adds
  any newly-implied future occurrences without deleting existing ones
- Fixed `/auth/reset-password`: the recovery flow trusted any pre-existing browser session via
  `getSession()` before the link's token was verified, so clicking a password-setup link while
  still logged in as another account showed (and would have reset) the wrong account. Now only
  trusts the `PASSWORD_RECOVERY` event, with a clear error if it never fires
- Fixed `/api/reset-password` and the login page's "Forgot password" flow hanging indefinitely
  if the Brevo API was slow/unreachable — added a server-side timeout around the email send and
  a client-side abort timeout
- Client "Add Activity": Worker dropdown sorted alphabetically; NDIS Support Type is now a
  searchable dropdown (new `components/SearchableSelect.tsx`) instead of a plain `<select>`,
  since a Provider's NDIS catalogue can be long
- Client header: Client's name now shown on the right with "CareTime" on the left, matching
  the Worker header layout
- Client calendar: selected day now persists through the URL, so returning from creating an
  activity (or navigating to one and back) lands on the same day instead of resetting to today

## Session 33 — 8 July 2026

### Recurring Provider Activities, Multi-Provider Client Requests, Notify-on-Details-Save

- Provider "Add Activity" now supports recurrence (new only) — creates a `recurring_schedules` definition plus the next 4 weeks of `activities`, same pattern as the Client request form
- Client "Add Activity" now shows a Provider dropdown when linked to more than one Provider (plain text if only one); Preferred Worker and NDIS Support Type are scoped to the selected Provider via `provider_carers`/`ndis_line_items`, replacing the legacy `clients.provider_id` lookup
- Client "Add Activity" layout: unified "Shift Time" (Start Date, Start Time, End Time) replaces the old one-off/recurring fork and the recurring "Duration" dropdown; overnight is auto-detected when End Time ≤ Start Time. Recurrence now sits below Shift Time
- `RecurrencePicker` now renders its own "current recurrence" summary internally, so every page using it gets the summary for free instead of duplicating the block
- Verified: Client and Worker calendars already show activities across every linked Provider (no `provider_id` filter existed) — no change needed
- Saving "My Details" (Client or Worker) now notifies linked Providers of the change (`details_updated` email). With 2+ Providers, a modal asks whether to notify all or a selection before saving — Cancel aborts the save entirely. With one Provider, it's notified automatically; with none, no notification is sent

## Session 32 — 8 July 2026

### Split Shared vs Provider-Specific Data for Clients and Workers

- `provider_clients` gains `notes`, `start_date`, `end_date` (in addition to existing `active`); `provider_carers` gains the same three (its `active` column already existed)
- New migration: `supabase_split_provider_data_migration.sql` — adds the columns only, does not drop anything from `clients`/`carers`
- Provider clients list and workers list now read `active` from the junction row (`provider_clients`/`provider_carers`), not from `clients.active`/`carers.active` — lists show every linked record with an Inactive badge rather than filtering it out, so a provider can still see and reactivate someone they've deactivated
- Provider client/worker edit pages split into a read-only "Personal Details" section (sourced from `clients`/`carers` — name, contact, address, payment info) and an editable "Your Notes" section (sourced from the junction row — Active toggle, Notes, Start Date, End Date). Providers can no longer edit a client's or worker's personal details; that now belongs to the person themselves
- "Add Client"/"Add Worker" forms write the initial comments into `provider_clients.notes`/`provider_carers.notes` instead of `clients.comments`/`carers.comments`
- Activity, schedule, and invoice-generation forms' client/worker pickers now query through `provider_clients`/`provider_carers` (scoped to the current provider, filtered to active links) instead of querying `clients`/`carers` directly — this also fixes a data-isolation gap where those pickers previously showed every client/worker across all providers, not just the current provider's
- New `/client/details` "My Details" page — lets a client edit their own name, email, phone, address, and NDIS number directly on the `clients` table
- Verified `/worker/details` already writes directly to the `carers` table — no change needed

### Known follow-ups (not in this session)
- `app/app/*` is a stale, unreferenced duplicate of the entire route tree (last touched Session pre-29, before junction tables existed) with no `provider_id` scoping at all. No links point to it, so it's dead code, but it should eventually be deleted.
- `app/provider/carers/[id]/page.tsx` and the worker's own `/worker/details` page don't cover the same field set — `work_phone`, `car_registration`, and `abn` are no longer editable by the provider but aren't yet editable on `/worker/details` either.
- `app/api/invoices/route.ts`'s activity query has no `provider_id` scoping — a separate pre-existing data-isolation gap on the `activities` table, outside the scope of this client/worker split.

## Session 31 — 8 July 2026

### Junction Table Consistency

- All Provider pages (dashboard, clients list, calendar, status, invoices, schedules) now query clients via `provider_clients` junction table, not `clients.provider_id`
- Adding an existing client or worker (by email) links them via the junction table instead of creating a duplicate row
- Client dashboard, calendar, and notes query ALL client records for the user, showing activities across all providers
- Recurring activity delete modal: "This activity only" or "This and all future activities"
- PDF invoice generation using pdf-lib, attached to Brevo email as A4 PDF

## Session 30 — 7 July 2026

### Multi-Provider Clients, PDF Invoices, Recurring Delete

- `provider_clients` junction table for clients across multiple providers
- PDF invoice generator with A4 layout, line items table, totals, provider/client details
- PDF attached to invoice email via Brevo attachment API
- Recurring delete modal with "this only" vs "this and all future" options
- Client/Worker add forms check for existing email before creating duplicates

## Session 29 — 7 July 2026

### Provider Data Isolation & Multi-Provider Workers

- `provider_carers` junction table for workers across multiple providers
- All Provider queries scoped by `provider_id` — dashboard, clients, workers, calendar, schedules, invoices, status
- `useProviderId()` hook for consistent provider context across all pages
- Multi-provider Worker login with provider selection
- Multi-role login with role picker (Administrator, Provider, Worker, Client, Nominee)

## Session 28 — 7 July 2026

### Multi-Role Login, Administrator, Client Editing, Status Management

- Multi-role login with role picker cards (coloured by role with descriptions)
- Administrator role with dark sidebar, dashboard (system-wide stats), provider management (add/edit/invite)
- `administrators` table and migration
- Client activity editing (inline edit form for title, description, start/end time)
- Client activity deletion for awaiting_acceptance/scheduled/rejected/cancelled activities
- Calendar date pass-through — selected date from calendar used as default in new activity form
- Provider Status management page — view all activities, filter by status, change status inline via dropdown
- Status settings page under Settings showing workflow with editable labels/descriptions

## Session 27 — 6 July 2026

### Full Invoicing System

- Invoice generation from approved activities with date range and client filter
- Preview screen showing activities grouped by client before generating
- `invoices` and `invoice_line_items` database tables
- HTML invoice email with line items table sent via Brevo
- Invoice list with Unpaid/All tabs, search, mark as paid
- Invoice detail view with summary cards (Total, Hours, Worker Cost, Margin), line items table, Print button
- Activities marked with `invoice_id` to prevent double-invoicing

## Session 26 — 6 July 2026

### RRule Recurrence Engine

- RecurrencePicker component with Google Calendar-style presets (Daily, Weekly, Monthly, Custom)
- Custom recurrence modal dialog with interval, day-of-week toggles, end condition (Never/On date/After N)
- `rrule` library (RFC 5545) for recurrence calculation
- Provider schedules and Client activity forms use RecurrencePicker
- 4-week activity auto-generation from rrule patterns

## Session 25 — 5 July 2026

### Client Activity Request with Recurrence

- Client new activity form with optional Worker and NDIS line item selection
- One-off vs Recurring toggle with recurrence pattern (days, time, duration, date range)
- Time entry via dropdowns (15-min increments, 12-hour format) — supports overnight shifts
- Duration list expanded to 30min–12hr in 30-min increments
- Separate start/end date fields for overnight shift support

## Session 24 — 5 July 2026

### Recurring Schedules, NDIS Percentage Rates, Optional Worker

- `recurring_schedules` table with days_of_week, start_time, duration, valid_from/until
- Provider schedules CRUD with Generate button (4-week lookahead, idempotent)
- Simplified NDIS billing rates: `client_charge_pct` / `worker_pay_pct` on providers table
- Per-item rate overrides on `ndis_line_items`
- Live margin example on rates page
- Schedules added to Provider sidebar
- Worker field explicitly labelled optional on activity form

---

## Session 23 — 5 July 2026

### Dashboard Navigation & Billing Rates Research

#### Dashboard stat cards now clickable
- Active Clients → `/provider/clients`
- Active Workers → `/provider/carers`
- Activities This Month → `/provider/calendar`
- Awaiting Client Approval → `/provider/reports`

---

## Session 22 — 3 July 2026

### Week View, Overnight Shifts & Calendar Improvements

#### Week view — 24 hours
All 24 hours now shown in the week grid (midnight to midnight). Hour labels on left axis for every hour. Grid lines at 6-hour intervals for orientation.

#### Week view — Worker name after Client name
Provider week view shows "Client · Worker" (first names). Worker week view shows Client name. Client week view shows Worker name.

#### Week view — overnight shifts
Shifts spanning midnight now appear in both day columns — running to midnight on the start day and from midnight on the next day.

#### Back button preserves week/month view
Selected view stored in URL (`?view=week`). Navigating to an activity and pressing back restores the exact view.

#### Approve for Payment — returns to previous page
After clicking Approve for Payment, `router.back()` returns to wherever the Provider came from.

---

## Session 21 — 3 July 2026

### Invite Status, Payment Approval & Unassigned Activities

#### Workers and Clients list pages
- Green "Invited" badge for users with login accounts
- Blue "Invite" button for uninvited users — sends invite directly from list
- Amber banner showing count of uninvited active users

#### Provider activity detail — Approve for Payment
Prominent indigo action panel when status is `awaiting_payment_approval`. One-click approval moves to Ready for Payment and notifies Worker.

#### Provider activity detail — Assign Worker panel
Amber panel appears on activities with no Worker assigned. Dropdown to assign immediately and notify Worker without scrolling to the form.

#### Provider dashboard rebuilt
- Clickable stat cards linking to relevant screens
- Unassigned Activities panel — lists activities needing a Worker
- Awaiting Payment Approval panel — shifts Client-approved but not yet Provider-processed
- Alert banners at top when either condition exists

---

## Session 20 — 3 July 2026

### Client Interface — Activity Request, Notes, Week Calendar

#### Client activity request (`/client/activities/new`)
- "Request" button in calendar header
- Pre-fills pickup/drop-off from Client's address record
- Notifies Provider on submit

#### Shift notes history (`/client/notes`)
- New Notes tab in Client bottom nav
- All Worker comments from completed shifts, descending date order
- Shows Worker name, date, start/end times, comment, Client rating

#### Client calendar — week view
- Month/Week toggle
- Week view uses shared WeekView component
- Shows Worker name in activity blocks

#### Client comments in approval email
- Star rating shown as ★★★★☆
- Client comments included in email to Worker and Provider

---

## Session 19 — 2 July 2026

### Client Role — Full Interface Built

#### Client interface at `/client/...`
- **Dashboard** — pending approvals shown prominently in orange, upcoming activities
- **Activity detail** — approve/reject with 1–5 star rating (required), optional comments, rejection reason
- **Calendar** — Client's own activities only, dot indicators, orange for needs approval

#### Email links by role
- Worker emails → `/worker/activities/[id]`
- Client emails → `/client/activities/[id]`

#### `/carer/` routes renamed to `/worker/`
All URL paths, navigation, email links, and auth routing use `/worker/` consistently.

---

## Session 12 — 1 July 2026

### User Invitation & Role-Based Login

#### Login
- Removed role selector buttons (Provider / Carer / Client / Nominee) — these were a testing helper only
- Login now auto-detects the user's role by querying all app tables after authentication
- Routes automatically to the correct dashboard (`/provider`, `/carer`, etc.)
- Shows a clear error if the logged-in user has no matching role record

#### Invitation Flow
- Adding a new Carer or Client now automatically sends a Supabase invitation email
- The invitation contains a magic link — the user clicks it, sets their own password, and is routed to their dashboard
- No dummy passwords — Supabase handles the "set password on first login" flow natively
- `/auth/confirm` page handles the post-invite redirect and role detection
- If a user already has a Supabase auth account (e.g. added via Admin), they are linked rather than re-invited

#### Email Changes
- Editing a Carer or Client's email address now updates Supabase Auth as well as the app table, keeping both in sync

#### New API Routes
- `POST /api/invite` — creates Supabase auth user and sends invite email (uses service role key, server-side only)
- `POST /api/update-email` — updates email in Supabase Auth when changed in the app

#### New Files
- `lib/supabase/admin.ts` — server-side Supabase admin client (service role key)
- `lib/auth/roles.ts` — role detection utility, queries all app tables to determine user role

#### Vercel Setup Required
- Add `SUPABASE_SERVICE_ROLE_KEY` to Vercel environment variables (Supabase → Project Settings → API → service_role secret)
- Add your Vercel URL to Supabase → Authentication → URL Configuration → Redirect URLs (e.g. `https://care-time-ecru.vercel.app/auth/confirm`)

---

## Session 11 — 1 July 2026

### Carer Role — Mobile-First Interface

#### New Carer screens at `/carer/...`
- **Layout** — mobile-first with sticky top header and fixed bottom navigation bar (Home, Calendar, History, My Details, Logout). No sidebar.
- **Dashboard** (`/carer/dashboard`) — personalised greeting, today's activity count, awaiting acceptance count (highlighted in yellow when non-zero), today's activities as cards with status badges and addresses, upcoming activities list
- **Activity Detail** (`/carer/activities/[id]`) — full activity workflow:
  - Awaiting Acceptance → Accept / Decline buttons (with notifications sent)
  - Scheduled → Start Shift button (records actual start time)
  - In Progress → End Shift button opens submit form for comments, mileage, and expenses
  - All addresses are tappable and open Google Maps
  - Shows shift summary once completed
- **Calendar** (`/carer/calendar`) — compact month view with coloured dot indicators per day, tap a day to see activities listed below
- **History** (`/carer/history`) — list of completed/submitted shifts with status badges
- **My Details** (`/carer/details`) — edit own profile (name, email, phone, address, bank details)

#### Email Notifications Updated
- All Carer-directed email links now point to `/carer/activities/[id]` instead of the Provider view

#### Bug Fixes
- Carer save error `invalid input syntax for type numeric: ""` — fixed by building an explicit payload that excludes `client_rating`, `provider_rating`, and system columns from the update call

---

## Session 10 — 30 June 2026

### Email Notifications (Resend)

#### New email system
- Integrated [Resend](https://resend.com) for transactional email
- `lib/email/resend.ts` — lazy Supabase client wrapper (missing API key skips silently at build time)
- `lib/email/templates.ts` — 15 HTML email templates with consistent CareTime branding:
  - Activity assigned, accepted, declined
  - Activity reminder (30 min before)
  - Shift submitted, approved, rejected
  - Payment approved
  - Unapproved shift reminder (7 days)
  - Activity changed/updated
  - Carer reallocated
  - Event report submitted
  - Invoice generated
  - Provider relationship request
  - Welcome email
- `app/api/notify/route.ts` — server-side API route; client components call this, never Resend directly
- `lib/email/notify.ts` — fire-and-forget client helper

#### Notifications wired up
- New Activity with Carer assigned → emails Carer
- Activity status changes → emails the appropriate party per status
- Admin creating a new user → sends welcome email

#### Vercel Setup Required
- `RESEND_API_KEY` — from resend.com → API Keys
- `NEXT_PUBLIC_APP_URL` — your live Vercel URL (e.g. `https://care-time-ecru.vercel.app`)

#### Note on test domain
Using `onboarding@resend.dev` (free Resend test domain) — emails only deliver to your own registered Resend email address. To send to real users, verify a custom domain in Resend and set `EMAIL_FROM` in Vercel environment variables.

---

## Session 9 — 30 June 2026

### Administrator Role & NDIS Master Catalogue

#### New Administrator role
- Added `administrator` as a fifth user role
- `administrators` table in database
- Admin screen now includes Administrator in role dropdown and user count

#### NDIS Master Catalogue
- New `ndis_master_items` table — central catalogue maintained by Administrators only
- Admin → NDIS Master Catalogue (`/admin/ndis-master`) — add, edit, deactivate, delete master items; search by line item number or description; grouped by support category
- Link from Admin home page to the master catalogue

#### Provider NDIS screen redesigned
- Provider's NDIS screen (`/provider/settings/ndis`) is now a subset selector with two tabs:
  - **My Catalogue** — items this Provider has selected, with active/inactive toggle and remove
  - **Browse Master List** — full master catalogue with checkboxes; items already added show a green tick; select multiple and click "Add to My Catalogue"
- Provider's local list (`ndis_line_items`) now links back to master via `master_item_id`

#### Settings page restructured
- `/provider/settings` is now a pure menu hub with cards for each sub-section
- Organisation Details form moved to `/provider/settings/details` (renamed "Provider Details")

#### Database migration required
- Run `migration_admin_ndis.sql` in Supabase SQL Editor

---

## Session 8 — 30 June 2026

### NDIS Support Catalogue Import

- Generated `ndis_master_import.sql` from the official NDIS Support Catalogue 2025-26 CSV
- 393 importable line items (229 skipped — quotable supports with no fixed NSW price)
- NSW pricing used throughout
- Uses `on conflict (line_item_number) do update` — safe to re-run when NDIA updates pricing
- Checked source CSV for duplicates — found 2 duplicates, both harmless (same item, different category or trailing space in name)

---

## Session 7 — 29 June 2026

### Settings Sub-Pages, Billing Rates & Public Holidays

#### Billing Rates (`/provider/settings/rates`)
- Add, edit, delete rates with name, hourly price, applicable days (toggle buttons), start/end time
- Checkbox to mark as Public Holiday rate (day selection hidden — applies to all defined holidays)
- Rates grouped as Standard Rates and Public Holiday Rates
- Delete confirmation modal

#### Public Holidays (`/provider/settings/holidays`)
- Quick import buttons for 2026 and 2027 Australian national public holidays
- Add custom holidays manually (name + date)
- Holidays grouped by year
- Delete individual holidays

#### NDIS Line Items (`/provider/settings/ndis`)
- Add, edit, delete Provider-specific line items
- Fields: line item number, description, support category, unit price
- Active/inactive toggle per item
- Items grouped by support category
- Delete confirmation modal

#### Settings Menu
- Settings page now shows quick-link cards for all sub-sections

---

## Session 6 — 29 June 2026

### Activity Calendar & Super Admin

#### Calendar (`/provider/calendar`)
- Activities sorted in time order within each day
- Day cells expanded to show up to 6 activities
- Clicking an activity pill navigates directly to the edit screen
- Saving a new activity returns to the calendar

#### Activity Form (`/provider/activities/new` and `/provider/activities/[id]`)
- Rejection Reason section appears when status is set to Rejected
- Status changes logged to `activity_status_history` audit table

#### Super Admin (`/admin`)
- PIN-protected (set `NEXT_PUBLIC_ADMIN_PIN` in Vercel environment variables)
- Create accounts for any role with name, email, and initial password
- Creates both the Supabase auth account and the matching app table record
- Lists all existing users with role and creation date
- Link to NDIS Master Catalogue (added later)

---

## Session 5 — 29 June 2026

### Provider Settings Fixes & Input Reliability

#### Bug Fix — numeric field error on save
- Fixed `invalid input syntax for type numeric: ""` on Provider Settings save
- Root cause: empty strings being sent to Postgres numeric columns
- Fix: explicit payload construction with `toNum()` and `toInt()` helpers; never spread raw form state

#### Bug Fix — fields not saving on edit
- Fixed Carer and Client edit forms not saving changes to email/phone
- Root cause: `onBlur`-based sync — if Save was clicked immediately after typing (without clicking elsewhere), the blur event never fired and the old value was saved
- Fix: switched all forms to fully controlled inputs (`value` + `onChange`), same pattern used in Provider Details and Activity form
- Applied across: Carer `[id]`, Carer `new`, Client `[id]`, Client `new`, `FormFields.tsx`

#### Required field indicators
- Provider Settings now shows `*` on required fields on first load (not just after first save)
- "Optional" placeholder text added to optional fields
- Error messages now name the specific invalid field

---

## Session 4 — 28 June 2026

### Client & Carer Detail Screens

#### Client Management
- `/provider/clients` — searchable list with Add Client button
- `/provider/clients/new` — add new client (name, NDIS number, email, phone, address, comments)
- `/provider/clients/[id]` — edit client details, view linked nominees, active/inactive toggle

#### Carer Management
- `/provider/carers` — searchable list with Add Carer button
- `/provider/carers/new` — add new carer (personal details, payment details)
- `/provider/carers/[id]` — edit carer details, view star ratings, active/inactive toggle

#### Shared
- `FormFields.tsx` — reusable Field, TextArea, Section, SaveBar components

---

## Session 3 — 28 June 2026

### Provider Dashboard & Settings

#### Provider Dashboard (`/provider/dashboard`)
- Active Clients, Active Carers, Activities This Month, Awaiting Approval stat cards
- Recent Activities and Pending Approvals panels

#### Provider Settings (`/provider/settings`)
- Organisation Details (name, ABN, address, phone, email, website, CEO, description, emergency procedures)
- Administration Fees (percentage and flat fee)
- Bank Details for Invoicing (account name, BSB, account number, next invoice number)

#### Navigation
- Sidebar with links to Dashboard, Clients, Carers, Calendar, Invoices, Reports, Settings
- Logout button

---

## Session 2 — 28 June 2026

### Project Setup & Deployment

#### Tech Stack
- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL + Row Level Security)
- **Hosting:** Vercel (auto-deploy on push to `main`)
- **Email:** Resend (transactional email)

#### Database Schema (`supabase_schema.sql`)
Tables created:
- `providers` — care agencies and fund administrators
- `clients` — people receiving care (includes NDIS number)
- `carers` — support workers
- `nominees` — client representatives (typically parents/guardians)
- `provider_carers` — many-to-many Provider ↔ Carer
- `client_nominees` — many-to-many Client ↔ Nominee
- `billing_rates` — per-Provider hourly rates by day/time
- `public_holidays` — per-Provider holiday dates for billing
- `ndis_line_items` — Provider's selected NDIS support items
- `ndis_master_items` — Administrator-maintained master NDIS catalogue
- `administrators` — Administrator role users
- `activities` — care activities with full status workflow
- `activity_status_history` — immutable audit trail of status changes
- `invoices` and `invoice_line_items` — NDIS-compliant invoices
- `payment_history` — immutable payment records
- `ratings` — 1–5 star ratings between roles

#### Authentication
- Supabase Auth with email/password
- Role-based routing after login (queries app tables to detect role)
- Invite flow for new users (Supabase `inviteUserByEmail`)
- Row Level Security enabled on all tables

#### Environment Variables (Vercel)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `RESEND_API_KEY` | Resend API key for email |
| `NEXT_PUBLIC_APP_URL` | Live app URL (e.g. `https://care-time-ecru.vercel.app`) |
| `EMAIL_FROM` | Sender address (e.g. `CareTime <noreply@yourdomain.com>`) |
| `NEXT_PUBLIC_ADMIN_PIN` | PIN to access `/admin` screen |

---

## Session 1 — 27 June 2026

### Specification

- Reviewed original CareTime design document
- Conducted stakeholder Q&A to clarify scope, roles, NDIS requirements, notification preferences, and technical constraints
- Produced `CareTime_Specification_v1.0.docx` — 13-section requirements document covering all four user roles, activity workflow, NDIS compliance, notifications, ratings, data relationships, and non-functional requirements
- Confirmed Version 1 scope and deferred items (recurring activities, payment gateway, BAS reporting, SMS, document uploads)
