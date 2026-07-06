# CareTime Changelog

All notable changes to CareTime are documented here.

---

# Session 23 — 5 July 2026

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
