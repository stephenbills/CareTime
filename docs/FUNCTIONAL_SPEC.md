# CareTime — Functional Specification

**Version:** 2.0
**Date:** 1 July 2026
**Status:** Active Development — Trial Phase

---

## Table of Contents

1. [Overview](#1-overview)
2. [User Roles](#2-user-roles)
3. [Authentication & Access](#3-authentication--access)
4. [Provider Module](#4-provider-module)
5. [Worker Module](#5-worker-module)
6. [Client Module](#6-client-module)
7. [Nominee Module](#7-nominee-module)
8. [Administrator Module](#8-administrator-module)
9. [NDIS Compliance](#9-ndis-compliance)
10. [Notifications](#10-notifications)
11. [Ratings](#11-ratings)
12. [Technical Architecture](#12-technical-architecture)
13. [Deployment](#13-deployment)
14. [Version 1 Scope & Deferred Items](#14-version-1-scope--deferred-items)

---

## 1. Overview

CareTime is a browser-based care management platform connecting Providers (care agencies),
Workers (support workers), Clients (people receiving care), and Nominees (client
representatives). It manages activity scheduling, time-keeping, approval workflows,
NDIS billing, and payments.

All data is stored in a cloud-based database. The application runs on desktop, tablet,
and mobile browsers. Changes made on one device are immediately reflected on all others.
All data is encrypted in transit and at rest.

### Design Principles
- **Provider and Administrator interfaces** are desktop-optimised with a sidebar navigation
- **Worker, Client, and Nominee interfaces** are mobile-first with bottom navigation, designed
  for use on phones in the field
- **Email is the primary notification channel** for all roles (SMS deferred to a later version)
- **NDIS compliance** is built into the billing and invoicing workflow

---

## 2. User Roles

| Role | Description | Primary Device |
|---|---|---|
| **Provider** | Care agency or individual fund administrator. Manages Workers, Clients, activities, billing, and payments. | Desktop |
| **Worker** | Support worker providing care to Clients. Records shift times and expenses. | Mobile |
| **Client** | Person receiving care. Approves shifts and rates Workers. | Mobile |
| **Nominee** | Representative acting on behalf of a Client (typically a parent or guardian). | Mobile |
| **Administrator** | System administrator. Maintains the master NDIS catalogue and manages all user accounts. | Desktop |

---

## 3. Authentication & Access

### Login
- Single login screen at `/auth/login` with email and password
- After login, the system determines the user's role by querying the `providers`, `carers`,
  `clients`, `nominees`, and `administrators` tables for a matching `user_id`
- Each role is routed to its own dashboard automatically — no manual role selection required
- If no matching role record is found, the user sees an error message

### User Invitation
- When a Provider adds a new Worker, Client, or Nominee, the system automatically sends
  a Supabase invitation email to the person's email address
- The invitation contains a magic link — the recipient clicks it, sets their own password,
  and is routed to their role-appropriate dashboard
- Existing accounts (e.g. created via the Admin screen) are linked rather than re-invited
- Clicking "Send Invite" or "Resend Invite" on the Worker or Client edit screen triggers
  a fresh invitation at any time

### Email Changes
- If a Worker or Client's email address is changed in the app, the system automatically
  updates the corresponding Supabase Auth account to keep them in sync

### Admin Access
- The Admin panel at `/admin` is protected by a PIN (set via `NEXT_PUBLIC_ADMIN_PIN`
  environment variable in Vercel)
- The Admin URL is kept private — it is not linked from any other part of the application

---

## 4. Provider Module

Accessible at `/provider/...`. Desktop layout with sidebar navigation.

### 4.1 Dashboard (`/provider/dashboard`)
Displays summary statistics:
- Number of active Clients
- Number of active Workers
- Number of Activities this month
- Number of Activities awaiting approval

### 4.2 Settings (`/provider/settings`)

The Settings page is a menu hub linking to five sub-sections:

#### Provider Details (`/provider/settings/details`)
Organisation information including name, ABN, address, contact details, CEO details,
service description, emergency procedures, administration fees (percentage or flat),
and bank details for invoicing. The Next Invoice Number auto-increments with each invoice.

#### NDIS Line Items (`/provider/settings/ndis`)
A two-tab interface:
- **My Catalogue** — the Provider's selected subset of NDIS line items, with active/inactive
  toggle and remove. Items are grouped by support category.
- **Browse Master List** — the full administrator-maintained master catalogue. Providers
  select items using checkboxes and click "Add to My Catalogue" to copy them into their
  own list. Items already added show a green tick.

#### Billing Rates (`/provider/settings/rates`)
Defines hourly billing rates for the Provider. Each rate has a name, dollar amount per hour,
applicable days of the week, start/end time window, and a public holiday flag. Rates are
grouped as Standard Rates and Public Holiday Rates.

#### Public Holidays (`/provider/settings/holidays`)
Defines public holiday dates used to trigger public holiday billing rates. Includes a
quick-import feature to populate 2026 and 2027 Australian national public holidays in
one click. State-specific holidays can be added manually.

#### User Management (`/provider/settings/users`)
Manages staff login accounts for the Provider. *(Placeholder — full implementation pending.)*

### 4.3 Client Management (`/provider/clients`)
- Searchable list of all Clients with name and email
- Add new Client — automatically sends an invitation email on save
- Edit existing Client — full details form including NDIS number, address, contact details
- **App Access section** — shows whether the Client has been invited; "Send Invite" /
  "Resend Invite" button to send or resend the Supabase invitation email
- Active/Inactive toggle — deactivates without deleting
- Linked Nominees displayed as read-only

### 4.4 Worker Management (`/provider/carers`)
- Searchable list of all Workers with name and email
- Add new Worker — automatically sends an invitation email on save
- Edit existing Worker — personal details, payment details (BSB/account), ABN, star ratings
- **App Access section** — "Send Invite" / "Resend Invite" button
- Active/Inactive toggle

### 4.5 Calendar (`/provider/calendar`)
Month-view calendar showing all activities across all Clients and Workers. Features:
- Activities displayed in time order within each day; up to 6 per day cell
- Colour-coded by status
- Filter by Client and/or Worker
- Click a day to see full activity list for that day in the side panel
- Click any activity to edit it
- "Add Activity" button and per-day shortcut link
- Status legend at the bottom

### 4.6 Activity Management

#### Adding an Activity (`/provider/activities/new`)
Fields:
- Activity Title (required)
- Client (required) — selecting a Client automatically pre-fills pickup and drop-off
  addresses from the Client's address record
- Worker (optional at scheduling time)
- NDIS Line Item — selected from the Provider's own NDIS catalogue
- Status (defaults to "Awaiting Acceptance")
- Start Date & Time / End Date & Time
- Pickup Address, Drop-off Address, Venue Address

On save, the activity appears in the calendar and the assigned Worker receives
an invitation email. Status history is logged.

#### Editing an Activity (`/provider/activities/[id]`)
Same fields as above. If the status changes, the appropriate notification is sent
to the relevant party and the change is logged to the audit trail.

A Rejection Reason text field appears when status is set to "Rejected".

#### Activity Status Workflow
| Status | Meaning |
|---|---|
| Awaiting Acceptance | Assigned to a Worker, waiting for them to accept |
| Scheduled | Worker has accepted the activity |
| In Progress | Worker has clicked Start Shift |
| Awaiting Client Approval | Worker has submitted the shift report |
| Awaiting Payment Approval | Client has approved; Provider reviewing |
| Ready for Payment | Provider approved; invoice generated |
| Paid | Payment processed |
| Rejected | Client has rejected the shift |
| Cancelled | Activity cancelled |

Status labels and descriptions are customisable per Provider via the Activity Statuses
settings screen. The underlying workflow logic is fixed.

### 4.7 Approval Workflow
When a shift reaches Awaiting Client Approval, the Provider can monitor progress.
If no Client approval is received within 7 days, a reminder notification is sent
to the Provider. The Provider may approve on the Client's behalf as a last resort.

### 4.8 Process Payments
Shows all activities at Ready for Payment with a total. On confirmation, all activities
move to Paid and entries are written to Payment History. *(Bank transfer integration
deferred to Version 2 — currently a manual reconciliation step.)*

### 4.9 Invoicing

#### Generate Invoices
Select a date range to generate NDIS-compliant invoices for all Clients with approved
activities in that period. Invoices are displayed for review before sending. Can be
emailed to the Client and all associated Nominees, or printed.

NDIS-compliant invoices include:
- Provider name, ABN, and bank details
- Client name and NDIS participant number
- Each activity's date, description, NDIS line item number, hours, rate, and amount
- Invoice number and period

#### Generate Statements
A summary statement of all activities and costs for a selected period, for all or
selected Clients.

### 4.10 Reports

#### Non-Approved Activities Report
Lists all activities awaiting Client approval within a date range, sorted by Client,
Worker, and Date. Allows bulk email reminders to be sent to selected Clients.

#### Worker Hours Summary
Total hours worked by each Worker for a selected date range, with breakdown by Client.

#### Cost Summary per Client
Total care costs per Client for a selected date range, with breakdown by Worker.

#### Activities by Date Range
Full listing of all activities within a date range, filterable by Client and Worker,
showing all details including status, hours, expenses, NDIS line item, and cost.

---

## 5. Worker Module

Accessible at `/carer/...`. Mobile-first layout with bottom navigation bar
(Home, Calendar, History, My Details, Logout).

### 5.1 Dashboard (`/carer/dashboard`)
- Personalised greeting with Worker's name and time of day
- Today's activity count and awaiting acceptance count (highlighted in amber when non-zero)
- Today's activities as cards — showing status, time, Client name, and pickup address
- Activities awaiting acceptance show a "View & Accept" prompt
- Upcoming activities list (next 2 months, scheduled only)

### 5.2 Activity Detail (`/carer/activities/[id]`)
Shows full activity details and presents the appropriate action buttons based on status:

**Awaiting Acceptance:**
- Accept button — moves to Scheduled, notifies Client and Provider
- Decline button — notifies Provider to reassign

**Scheduled:**
- Start Shift button — records actual start time and moves to In Progress

**In Progress:**
- Shows the recorded start time
- End Shift & Submit button — opens the submission form

**Submission Form:**
- Actual Start datetime (pre-filled, editable — allows retrospective submission)
- Actual End datetime (pre-filled to now, editable)
- Comments (required)
- Mileage in km (optional)
- Expenses in dollars (optional)
- On submit — moves to Awaiting Client Approval, notifies Client and Provider

**Post-submission:** Displays status message showing current state.
**Rejected:** Shows rejection reason from Client.

**Location buttons:** Pickup, Venue, and Drop-off addresses are tappable and open
Google Maps navigation directly.

**Shift Summary:** Once submitted, shows actual start/end times, mileage, expenses,
and Worker's comments.

### 5.3 Calendar (`/carer/calendar`)
Compact month view showing the Worker's own activities only. Each day with activities
shows coloured dot indicators (one per activity, colour-coded by status). Tapping a
day shows a list of that day's activities below the calendar. Tapping an activity
opens the Activity Detail screen.

### 5.4 History (`/carer/history`)
List of all submitted and completed shifts, sorted newest first, with status badges.
Includes: Awaiting Client Approval, Awaiting Payment Approval, Ready for Payment,
Paid, Rejected, Cancelled.

### 5.5 My Details (`/carer/details`)
Allows the Worker to view and update their own personal details, address, and bank
account details. Saving updates only the editable fields — rating columns and system
columns are never overwritten.

---

## 6. Client Module

*(Placeholder — Client interface screens to be built in a future session.)*

Currently, Clients log in and are routed to the Provider dashboard as a temporary
placeholder. The Client-specific screens will include:
- Dashboard with upcoming activities and pending approvals
- Calendar showing their own scheduled activities
- Shift approval screen (approve/reject with rating and comments)
- Invoice viewing

---

## 7. Nominee Module

*(Placeholder — Nominee interface screens to be built in a future session.)*

Nominees act on behalf of Clients. A Nominee associated with more than one Client
sees a dropdown on their initial screen to select which Client's context to operate in.
All actions taken by a Nominee are recorded under the Nominee's own login.

---

## 8. Administrator Module

Accessible at `/admin`. Protected by a PIN. No sidebar — standalone screen.

### 8.1 User Management
- Displays total counts of each role (Providers, Workers, Clients, Nominees, Administrators)
- Lists all users across all tables with name, email, role, and creation date
- **Add User form** — creates a Supabase auth account and the corresponding app table
  record simultaneously. Roles: Provider, Worker, Client, Nominee, Administrator.
  The new user receives a welcome email.

### 8.2 NDIS Master Catalogue (`/admin/ndis-master`)
The definitive source of NDIS support line items, maintained by Administrators only.

Features:
- Add, edit, deactivate, and delete master line items
- Fields: line item number (e.g. `01_011_0107_1_1`), description, support category
  (dropdown of all 15 NDIS support categories), unit price (NSW rate)
- Search by line item number or description
- Items grouped by support category
- Active/inactive toggle without deletion
- Duplicate line item numbers are rejected at the database level (unique constraint)

**Current data:** 393 line items imported from the official NDIS Support Catalogue
2025-26 v1.1 (NSW pricing, effective 24 November 2025). 229 quotable items with no
fixed price were excluded. Safe to re-import when the NDIA updates pricing — uses
`on conflict do update`.

---

## 9. NDIS Compliance

### Participant Number
Each Client record stores an NDIS participant number. This is included on all
invoices and claims.

### Support Catalogue
- **Master catalogue** (`ndis_master_items`) — maintained by Administrators, sourced
  from the official NDIA price guide
- **Provider catalogue** (`ndis_line_items`) — each Provider selects a subset of the
  master catalogue relevant to their services. Unit prices are copied from the master
  but can be overridden per Provider.

### Line Item Assignment
Each Activity is assigned exactly one NDIS line item by the Provider at scheduling time.
The line item number and description appear on all invoices and reports.

### NDIS-Compliant Invoices
Invoices include all fields required for NDIS claiming:
- Provider name and ABN
- Client name and NDIS participant number
- Activity date, description, and duration
- NDIS support line item number and description
- Unit price and total amount

### Not Yet in Scope
- NDIS service agreement reference tracking (Version 2)
- NDIS funding budget tracking and alerts (Version 2)
- BAS statements and NDIA reporting (Version 2)

---

## 10. Notifications

All notifications are sent by email via [Resend](https://resend.com).
SMS notifications are deferred to a later version.

The app uses a server-side API route (`POST /api/notify`) so the Resend API key
is never exposed to the browser.

| Trigger | Recipients | Notes |
|---|---|---|
| Activity assigned to Worker | Worker | Includes accept/decline link to Worker interface |
| Worker accepts activity | Client/Nominee, Provider | |
| Worker declines activity | Client/Nominee, Provider | Provider must reassign |
| 30 min before activity start | Worker | Reminder |
| Worker submits shift | Client/Nominee, Provider | Includes actual times and expenses |
| Client approves shift | Worker, Provider | |
| Client rejects shift | Worker, Provider | Includes rejection reason |
| Provider approves shift for payment | Worker | |
| Activity updated by Provider | Worker, Client/Nominee | |
| Activity updated by Worker | Provider, Client/Nominee | |
| Worker reallocated | Old Worker, New Worker, Client/Nominee | |
| Event report submitted | Nominees, Provider | High priority |
| Invoice generated | Client, all Nominees | |
| Provider relationship request | Client or Nominee | Approve-link email |
| New user created | New user | Welcome email with login link |
| Shift unapproved after 7 days | Provider | Reminder to follow up |

### Email Sender
- **Test/trial:** `onboarding@resend.dev` (Resend free test domain — delivers only to the Resend account owner's email)
- **Production:** Requires a verified custom domain configured in Resend and set via the `EMAIL_FROM` environment variable

---

## 11. Ratings

1–5 star ratings between roles, given at the activity level.

| Who Rates | Who Is Rated | When |
|---|---|---|
| Client / Nominee | Worker | At shift approval time |
| Provider | Worker | From Worker record at any time |
| Worker | Client | From Client details at any time |
| Worker | Provider | From Provider details at any time |

Overall ratings are calculated averages displayed as read-only fields on each entity's
detail screen.

---

## 12. Technical Architecture

### Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Email | Resend |
| Hosting | Vercel |

### Repository Structure
```
app/
  admin/                    # Administrator panel (PIN-protected)
    ndis-master/            # NDIS master catalogue management
  api/
    invite/                 # Server: send Supabase invite email
    notify/                 # Server: send transactional email via Resend
    update-email/           # Server: sync email change to Supabase Auth
  auth/
    login/                  # Login screen
    confirm/                # Post-invite redirect handler
  carer/                    # Worker mobile interface
    dashboard/
    calendar/
    activities/[id]/
    history/
    details/
  provider/                 # Provider desktop interface
    dashboard/
    calendar/
    activities/[id] & new/
    clients/[id] & new/
    carers/[id] & new/
    invoices/
    reports/
    settings/
      details/
      ndis/
      rates/
      holidays/
      users/
components/
  Sidebar.tsx               # Provider sidebar navigation
  CarerBottomNav.tsx        # Worker bottom navigation (mobile)
  FormFields.tsx            # Shared form components
lib/
  auth/roles.ts             # Role detection after login
  email/
    resend.ts               # Resend client (lazy-initialised)
    templates.ts            # All 15 HTML email templates
    notify.ts               # Client-side fire-and-forget helper
  supabase/
    client.ts               # Browser Supabase client
    server.ts               # Server Supabase client
    admin.ts                # Admin Supabase client (service role key)
docs/
  FUNCTIONAL_SPEC.md        # This document
  DATABASE.md               # Database tables reference
supabase_schema.sql         # Full database schema
CHANGELOG.md                # Session-by-session change log
```

### Security Notes
- Row Level Security (RLS) enabled on all tables
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used server-side only — never in the browser
- Admin panel protected by PIN — URL kept private
- Resend API key server-side only via `/api/notify` route
- All auth handled by Supabase — passwords never stored or handled by the application

---

## 13. Deployment

### Environment Variables (Vercel)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `RESEND_API_KEY` | Yes | Resend API key for transactional email |
| `NEXT_PUBLIC_APP_URL` | Yes | Live app URL (e.g. `https://care-time-ecru.vercel.app`) |
| `EMAIL_FROM` | No | Sender address (defaults to `onboarding@resend.dev`) |
| `NEXT_PUBLIC_ADMIN_PIN` | Yes | PIN to access `/admin` (keep private) |

### Supabase Configuration
- **Site URL:** Set to the live Vercel URL in Authentication → URL Configuration
- **Redirect URLs:** Add `https://your-app.vercel.app/auth/confirm`
- **Custom SMTP:** Configure Resend SMTP to remove the 2 emails/hour rate limit
  (Host: `smtp.resend.com`, Port: `465`, Username: `resend`, Password: Resend API key)

### Database Setup
1. Run `supabase_schema.sql` in Supabase SQL Editor to create all tables
2. Run `ndis_master_import.sql` to populate the master NDIS catalogue (393 items)

---

## 14. Version 1 Scope & Deferred Items

### In Version 1
- ✅ Provider, Worker, Administrator interfaces
- ✅ Activity scheduling and workflow (all 9 statuses)
- ✅ NDIS master catalogue (Administrator-maintained)
- ✅ Provider NDIS subset selection
- ✅ Billing rates and public holidays
- ✅ Email notifications (15 notification types)
- ✅ User invitation flow (Supabase magic link)
- ✅ Role-based login routing
- ✅ NDIS-compliant invoice generation (UI placeholder — logic to be wired)
- ✅ Ratings system (data model in place)
- ✅ Audit trail (activity_status_history)

### Placeholder — To Be Built
- ⬜ Client interface screens (approval, calendar, invoices)
- ⬜ Nominee interface screens
- ⬜ Invoice generation wired to activity data
- ⬜ Reports wired to live data
- ⬜ Event Report screen (Worker)
- ⬜ Unscheduled Activity (Worker)
- ⬜ Work Summary (Worker)

### Deferred to Version 2
- ⬜ Payment gateway integration (bank transfers to Workers)
- ⬜ Recurring Activities
- ⬜ NDIS service agreement reference tracking
- ⬜ NDIS funding budget tracking and alerts
- ⬜ BAS statements and NDIA government reporting
- ⬜ SMS notifications
- ⬜ Worker-generated invoices to Providers
- ⬜ Document uploads (NDIS plan documents etc.)
- ⬜ Criminal history check recording
- ⬜ Client-specific Worker orientation/training records
- ⬜ Friends / shared calendar visibility between Clients
- ⬜ Provider branding/personalisation (logo, colours)
- ⬜ Payroll export
