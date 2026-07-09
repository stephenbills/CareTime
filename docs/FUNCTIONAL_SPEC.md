# CareTime — Functional Specification

**Version:** 3.0
**Date:** 9 July 2026
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
- **A Client or Worker can belong to more than one Provider** — see
  [Multi-Provider Architecture](#multi-provider-architecture) in §3
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
| **Administrator** | System administrator. Maintains the master NDIS catalogue and manages Provider accounts. | Desktop |

---

## 3. Authentication & Access

### Login
- Single login screen at `/auth/login` with email and password
- After login, the system checks which role tables have a record matching the user's `user_id`
  (`providers`, `carers`, `clients`, `nominees`, `administrators`)
- If the user matches exactly one role, they're routed straight to that role's dashboard
- If the user matches more than one role (e.g. someone who is both a Client and a Nominee),
  a role picker screen shows a coloured card per available role with a short description —
  the user picks which context to enter
- A Worker linked to more than one Provider (via `provider_carers`) additionally sees a
  Provider picker after selecting the Worker role, so all Worker screens know which
  Provider's activities to show — the choice is remembered in `localStorage`
  (`caretime_worker_provider`) so it isn't asked again on the same device
- If no matching role record is found at all, the user sees an error message

### User Invitation
- When a Provider adds a new Worker or Client, the system creates (or links to an existing)
  Supabase Auth account and sends a "set your password" email via Brevo
- Existing people (matched by email) are linked to the new Provider via `provider_carers`/
  `provider_clients` rather than creating a duplicate `carers`/`clients` row — see
  [Multi-Provider Architecture](#multi-provider-architecture) below
- Clicking "Send Invite" or "Resend Invite" on the Worker or Client edit screen triggers
  a fresh invitation at any time
- **Authorization:** `POST /api/invite` verifies the calling Provider is actually linked to
  the record they're inviting (via `provider_clients`/`provider_carers`) before linking a new
  auth account to it — Administrators may invite any record

### Email Changes
- If a Worker or Client's email address is changed in the app, the system automatically
  updates the corresponding Supabase Auth account to keep them in sync

### Admin Access
- The Admin panel at `/admin` requires a normal login (email/password) **and** a matching
  row in the `administrators` table for that `user_id` — checked server-side in
  `app/admin/layout.tsx`, which redirects to `/auth/login` if either check fails
- There is no PIN and no separate admin login screen — a Provider, Worker, or Client account
  simply has no `administrators` row and is refused entry
- New administrators are provisioned by inserting a row directly via the Supabase SQL Editor
  (see `supabase_admin_migration.sql`) — there is no in-app "create an admin" flow

### Multi-Provider Architecture

A Client or Worker can be linked to more than one Provider — a single person's personal
details (name, contact info, address, payment details) live in exactly one `clients`/`carers`
row, shared across every Provider they're linked to. Each relationship to a Provider is a
separate row in the `provider_clients`/`provider_carers` junction table, holding everything
that's specific to *that* relationship: active status, private notes, start/end dates.

This means:
- **Personal details are edited once, by the person themselves** — Providers see them
  read-only. A Provider can never overwrite another Provider's Client's contact details.
- **Active status is per-relationship** — a Provider deactivating a Client/Worker only
  affects that Provider's own lists, counts, and pickers. It has no effect on the person's
  standing with any other Provider they're linked to.
- **Every Provider-facing list, dashboard count, and picker (Clients, Workers, Activities,
  Schedules, Invoices, Reports) is scoped through the junction table**, not by querying
  `clients`/`carers` directly — a query that reads `clients`/`carers` without going through
  `provider_clients`/`provider_carers` is a bug (either shows the wrong active status, or
  leaks another Provider's people).
- **Clients and Workers see activities/notifications from every Provider they're linked to**
  in one place — the Client Calendar, Worker Calendar, and Worker Dashboard are not
  scoped to a single Provider (a Worker does pick which Provider's context to schedule/accept
  *shifts* in, per the login flow above, but sees their own past/upcoming shifts across all
  Providers).
- **Saving "My Details" as a Client/Worker linked to 2+ Providers** prompts to notify all
  linked Providers or a selection of them (`details_updated` email) — see §5.5 and §6.5.

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
- List of every Client linked to this Provider (via `provider_clients`), with an Inactive
  badge for links the Provider has deactivated — deactivating a Client hides them from
  active-only pickers (Activities, Schedules, dashboard counts) without removing the link
  or affecting their standing with any other Provider
- Add — either creates a brand-new Client and sends an invitation email, or, if a Client
  with that email already exists (linked to another Provider), links the existing person
  to this Provider instead of creating a duplicate
- Edit (`/provider/clients/[id]`) is split into a **read-only Personal Details** section
  (name, contact, address, NDIS number — owned by the Client, edited only from the
  Client's own My Details screen) and an editable **Your Notes** section scoped to this
  Provider's relationship: Active toggle, Notes, Start Date, End Date
- **App Access section** — shows whether the Client has been invited; "Send Invite" /
  "Resend Invite" button
- Linked Nominees displayed as read-only

### 4.4 Worker Management (`/provider/carers`)
- List of every Worker linked to this Provider (via `provider_carers`), with an Inactive
  badge for links the Provider has deactivated — same active-per-relationship model as
  Clients above
- Add — creates a brand-new Worker or links an existing one by email, same as Clients
- Edit (`/provider/carers/[id]`) is split the same way: read-only Personal Details
  (name, contact, address, payment details, ABN — owned by the Worker) plus a Ratings
  section, and an editable Your Notes section (Active, Notes, Start Date, End Date)
  scoped to this Provider
- **App Access section** — "Send Invite" / "Resend Invite" button

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
- Client (required, scoped to this Provider via `provider_clients`) — selecting a Client
  automatically pre-fills pickup and drop-off addresses from the Client's address record
- Worker (optional at scheduling time, scoped to this Provider via `provider_carers`)
- NDIS Line Item — selected from the Provider's own NDIS catalogue
- Status (defaults to "Awaiting Acceptance")
- Start Date & Time / End Date & Time
- Pickup Address, Drop-off Address, Venue Address
- **Recurrence** — optional, using the same recurrence picker as the Client's own request
  form (see §6.2). Setting a recurrence creates a `recurring_schedules` row and generates
  the next 4 weeks of `activities` in one save, instead of a single activity. Only available
  when adding a new activity — not offered when editing an existing one (use the
  Schedules feature at §4.6b to manage an existing recurring pattern)

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

### 4.8 Payment Approval
There is no separate "Process Payments" screen — moving an activity to Ready for Payment /
Paid happens inline from wherever the Provider is already looking at it: the Dashboard's
"Approve Payment" action on activities awaiting payment approval, the Status page's status
dropdown, or the Invoices screen's "Mark as Paid" (which also flips every activity on that
invoice to Paid). Bank transfer integration is out of scope — payment is a manual
reconciliation step outside the app.

### 4.9 Invoicing

#### Generate Invoices (`/provider/invoices/generate`)
Select a date range (and optionally a single Client) to generate invoices from every
billable activity in that period — approved by the Client (`awaiting_payment_approval` or
`ready_for_payment`) and not already invoiced. One invoice per Client is created, a PDF is
generated and attached, and both are emailed to the Client. Every included activity is
stamped with the invoice's id so it can't be billed twice. See §9 for how each line's
amount is calculated.

#### Invoices List (`/provider/invoices`)
Unpaid/All tabs, search, and per-invoice "Mark as Paid". Invoice detail
(`/provider/invoices/[id]`) shows summary cards (Total, Hours, Worker Cost, Margin), the
full line item table, and a Print button.

### 4.10 Reports (`/provider/reports`)

#### Awaiting Client Approval
The only report currently built. Lists all activities awaiting Client approval, grouped by
Client, with days-waiting shown and an overdue flag at 7+ days. Filterable by Client and
date range. Supports sending a reminder email to one Client or all Clients with pending
approvals at once.

Worker Hours Summary, Cost Summary per Client, and Activities by Date Range are not yet
built — see §14.

---

## 5. Worker Module

Accessible at `/worker/...`. Mobile-first layout with a top header (showing the Worker's
name on the right) and bottom navigation bar (Home, Calendar, History, My Details, Logout).

### 5.1 Dashboard (`/worker/dashboard`)
- Personalised greeting with Worker's name and time of day
- Today's activity count and awaiting-acceptance count — the count covers every
  `awaiting_acceptance` activity regardless of date (today or any future occurrence), not
  just today's
- **Awaiting Acceptance list** — every activity needing a response, styled like Upcoming
  (title, date/time, Client, tap to open), so nothing needing action gets missed just
  because it's not scheduled for today
- Today's activities as cards — showing status, time, Client name, and pickup address
- Upcoming list (next 2 months, `scheduled` only — awaiting-acceptance items live in the
  dedicated list above instead, so the two don't overlap)

### 5.2 Activity Detail (`/worker/activities/[id]`)
Shows full activity details and presents the appropriate action buttons based on status.
If the activity belongs to a recurring schedule, a "Recurring" badge is shown along with
the human-readable pattern (e.g. "every week on Wednesday"), and the linked Provider's
name is displayed.

**Awaiting Acceptance:**
- Accept button — moves this activity to Scheduled, notifies the Client. If the activity is
  part of a recurring schedule, **every other occurrence in that schedule still awaiting
  acceptance is accepted at the same time** — accepting one occurrence accepts the series
- Decline button — notifies the Provider to reassign

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

### 5.3 Calendar (`/worker/calendar`)
Compact month view showing the Worker's own activities **across every linked Provider** —
not scoped to the Provider selected at login. Each day with activities shows coloured dot
indicators (one per activity, colour-coded by status). Tapping a day shows a list of that
day's activities below the calendar. Tapping an activity opens the Activity Detail screen.

### 5.4 History (`/worker/history`)
List of all submitted and completed shifts, sorted newest first, with status badges.
Includes: Awaiting Client Approval, Awaiting Payment Approval, Ready for Payment,
Paid, Rejected, Cancelled.

### 5.5 My Details (`/worker/details`)
Allows the Worker to view and update their own personal details, address, and bank
account details directly on the `carers` table. Saving updates only the editable fields —
rating columns and system columns are never overwritten.

If the Worker is linked to more than one Provider, saving prompts with a modal — notify
**All Providers** or **Selected Providers** (checkboxes, all linked Providers pre-checked) —
before the save goes through; Cancel aborts the save entirely, nothing is written until a
choice is confirmed. Each selected Provider receives a `details_updated` email. If the
Worker has only one Provider, that Provider is notified automatically with no prompt; with
none, no notification is sent.

---

## 6. Client Module

Accessible at `/client/...`. Mobile-first layout with a top header and bottom navigation
bar (Home, Calendar, Notes, My Details, Logout).

### 6.1 Dashboard (`/client/dashboard`)
- Personalised greeting with Client's name and time of day
- Shifts pending the Client's own approval (`awaiting_client_approval`), shown prominently
- Upcoming scheduled activities list
- Activities are pulled across every linked Provider, not just one

### 6.2 Request Activity (`/client/activities/new`)
Reached either from the "Request" button or by tapping a date on the Calendar (which
pre-fills that date as the start date). Fields:
- Title, Description
- **Provider** — a dropdown if the Client is linked to more than one Provider, otherwise
  just shown as text (nothing to choose)
- Preferred Worker (optional, "No preference — Provider will assign") — scoped to whichever
  Provider is selected above, via `provider_carers`
- NDIS Support Type (optional) — scoped to the selected Provider
- **Shift Time** — Start Date, Start Time, End Time. If End Time is at or before Start Time
  the shift is treated as overnight, ending the next day automatically
- **Recurrence** (below Shift Time) — reuses the same recurrence picker as the Provider's
  own Add Activity screen (daily/weekly/monthly presets or a custom RFC 5545 pattern), with
  a live summary of the chosen pattern shown once set. Setting a recurrence creates a
  `recurring_schedules` row and generates the next 4 weeks of `activities` in one request,
  each starting as `awaiting_acceptance`
  - A start date in the past is rejected outright — it doesn't make sense to request
    something that's already happened
- Pickup Address, Venue Address, Drop-off Address (pre-filled from the Client's own address)

On submit, the selected Provider is notified. The Provider still reviews/assigns/accepts
the request the same way as if they'd created it themselves.

### 6.3 Activity Detail (`/client/activities/[id]`)
- Shows full shift details, the assigned Worker, and Provider
- Editable while the activity hasn't progressed past `awaiting_client_approval`-adjacent
  states — Title, Description, Start/End time
- Deleting an activity that's part of a recurring schedule prompts **"This activity only"**
  vs **"This and all future activities"**
- **Shift approval** — when a Worker has submitted a shift (`awaiting_client_approval`),
  the Client rates the Worker (1–5 stars, required) and adds optional comments, then
  Approves (moves to `awaiting_payment_approval`, notifies Worker and Provider) or Rejects
  with a required reason (notifies Worker and Provider)

### 6.4 Calendar (`/client/calendar`)
Month and week views showing the Client's own activities **across every linked Provider**.
Tapping a day shows that day's activities below the calendar; tapping an activity opens
the Activity Detail screen. A "Request" shortcut is available from both views.

### 6.5 Notes (`/client/notes`)
A feed of Worker comments (`carer_comments`) left on completed/submitted shifts, newest
first — lets a Client (or someone reviewing on their behalf) catch up on what happened
during recent visits without opening each activity individually.

### 6.6 My Details (`/client/details`)
Allows the Client to view and update their own personal details, address, and NDIS number
directly on the `clients` table.

If the Client is linked to more than one Provider, saving prompts with a modal — notify
**All Providers** or **Selected Providers** (checkboxes, all linked Providers pre-checked) —
before the save goes through; Cancel aborts the save entirely, nothing is written until a
choice is confirmed. Each selected Provider receives a `details_updated` email. If the
Client has only one Provider, that Provider is notified automatically with no prompt; with
none, no notification is sent.

---

## 7. Nominee Module

*(Placeholder — Nominee interface screens to be built in a future session.)*

Nominees act on behalf of Clients. A Nominee associated with more than one Client
sees a dropdown on their initial screen to select which Client's context to operate in.
All actions taken by a Nominee are recorded under the Nominee's own login.

---

## 8. Administrator Module

Accessible at `/admin`. Requires login plus a matching `administrators` row (see §3,
Admin Access) — no PIN. Own dark sidebar layout (Dashboard, Providers), not the Provider
sidebar.

### 8.1 Dashboard (`/admin`)
Total counts of Providers, Clients, Workers, and Activities across the whole system, each
linking through to the relevant management screen.

### 8.2 Provider Management (`/admin/providers`)
- List of every Provider with name, email, phone, and invite status
- Add / edit a Provider — organisation details, address, and the default
  `client_charge_pct`/`worker_pay_pct` billing split (see §9)
- "Invite" button sends a Provider their account-setup email

### 8.3 NDIS Master Catalogue (`/admin/ndis-master`)
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

### Pricing
Each Activity's cost is `ndis_line_items.unit_price × billable hours`, then split between
what the Client is charged and what the Worker is paid using a percentage on each side:
- `providers.client_charge_pct` (default 100%) / `providers.worker_pay_pct` (default 62%)
  apply by default
- Either percentage can be overridden for a specific NDIS line item via
  `ndis_line_items.client_charge_pct_override` / `worker_pay_pct_override`

There is no day/time-varying rate table in the current pricing model (`billing_rates` exists
in the schema but isn't used — see `docs/DATABASE.md`).

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

All notifications are sent by email via [Brevo](https://brevo.com) (formerly Sendinblue) —
`lib/email/resend.ts` is named after the provider it originally used, but was switched to
Brevo's transactional API for easier testing (delivers to real addresses without domain
verification, 300/day free tier). SMS notifications are deferred to a later version.

The app uses a server-side API route (`POST /api/notify`) so the Brevo API key is never
exposed to the browser, and to authorize each notification — see §3's User Invitation note
and the row-level checks below. `type`, `to`, and `data` describe *what* to send; the route
verifies the caller actually has a relationship to what's being described before sending.

| Trigger | Recipients | Authorization | Status |
|---|---|---|---|
| Activity assigned to Worker | Worker | Caller must be that activity's Client, Worker, or Provider | Wired |
| Worker accepts activity | Client, Provider | Same | Wired |
| Worker declines activity | Provider | Same | Wired |
| 30 min before activity start | Worker | Same (would need a scheduled job to trigger it — not built) | Defined, not triggered |
| Worker submits shift | Client, Provider | Same | Wired |
| Client approves shift | Worker, Provider | Same | Wired |
| Client rejects shift | Worker, Provider | Same | Wired |
| Provider approves shift for payment | Worker | Same | Wired |
| Activity updated (by either side) | The other party | Same | Wired |
| Worker reallocated | Old/new Worker, Client | Same | Defined, not triggered |
| Event report submitted | Provider | Same | Defined, not triggered |
| Invoice generated | Client | Caller must be a Provider or Administrator | Sent directly from `/api/invoices`, not via `/api/notify` |
| Provider relationship request | Client | Caller must be a Provider or Administrator | Defined, not triggered |
| New user created | New user | Sent directly from `/api/invite`, not via `/api/notify` | Wired |
| Shift unapproved after 7 days | Provider | Caller must be a Provider or Administrator | Defined, not triggered (would need a scheduled job) |
| Client/Worker details updated | Linked Provider(s) | Caller must be the Client/Worker in `data.personId` | Wired — see §5.5/§6.6 |

"Defined, not triggered" means the email template and `/api/notify` type both exist and work
if called, but nothing in the app currently calls them — they'd need a scheduled job (for the
time-based reminders) or a UI flow that doesn't exist yet (Provider relationship requests,
Worker reallocation, Event reports).

### Email Sender
- **Env vars:** `BREVO_API_KEY` (required to actually send — logs a warning and no-ops if
  missing) and `EMAIL_FROM_ADDRESS` (defaults to `noreply@caretime.app`)
- Password-setup links use Supabase Auth's `generateLink` API, but the email itself is sent
  via Brevo directly rather than Supabase's built-in SMTP

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
| Email | Brevo |
| PDF generation | pdf-lib (invoices) |
| Recurrence | `rrule` (RFC 5545) |
| Hosting | Vercel |

### Repository Structure
```
app/
  admin/                    # Administrator panel (requires an administrators row)
    providers/[id] & new/   # Provider management
    ndis-master/            # NDIS master catalogue management
  api/
    invite/                 # Server: create/link auth account, send setup email
    invoices/                # Server: generate + email invoices (PDF attached)
    notify/                 # Server: authorize + send transactional email
    reset-password/         # Server: password reset link
    update-email/           # Server: sync email change to Supabase Auth
  auth/
    login/                  # Login — role picker if multiple roles match
    confirm/                # Post-invite redirect handler
    reset-password/
  provider/                 # Provider desktop interface
    dashboard/
    calendar/
    activities/[id] & new/  # Includes recurrence support
    schedules/[id] & new/   # Recurring schedule management
    clients/[id] & new/     # [id]: read-only personal + editable Provider notes
    carers/[id] & new/      # [id]: read-only personal + editable Provider notes
    status/                 # Inline status-change list
    invoices/[id] & generate/
    reports/
    settings/
      details/, ndis/, rates/, holidays/, users/
  worker/                   # Worker mobile interface
    dashboard/, calendar/, activities/[id]/, history/, details/
  client/                   # Client mobile interface
    dashboard/, calendar/, activities/[id] & new/, notes/, details/
components/
  Sidebar.tsx               # Provider sidebar navigation
  AdminSidebar.tsx          # Admin sidebar navigation
  WorkerBottomNav.tsx       # Worker bottom navigation (mobile)
  ClientBottomNav.tsx       # Client bottom navigation (mobile)
  RecurrencePicker.tsx      # Shared recurrence UI (presets + custom RRULE + summary)
  FormFields.tsx            # Shared form components (incl. ReadOnlyField)
  WeekView.tsx              # Shared week-view calendar grid
lib/
  api/auth.ts               # requireUser() / requireProvider() server-side auth helpers
  auth/roles.ts             # Role detection after login
  hooks/useProvider.ts      # useProviderId() / useWorkerContext() client hooks
  email/
    resend.ts               # Brevo client (file kept its old name — see §10)
    templates.ts            # HTML email templates
    notify.ts               # Client-side fire-and-forget helper
  invoice/pdf.ts             # Invoice PDF generation (pdf-lib)
  supabase/
    client.ts               # Browser Supabase client
    server.ts               # Server Supabase client
    admin.ts                # Admin Supabase client (service role key)
docs/
  FUNCTIONAL_SPEC.md        # This document
  DATABASE.md               # Database tables reference
supabase_schema.sql                         # Base schema
supabase_*_migration.sql                    # Incremental migrations — run in date order,
                                             # see §13 Database Setup
CHANGELOG.md                # Session-by-session change log
```

### Security Notes
- Row Level Security (RLS) is enabled on every table, but almost every policy is
  "any authenticated user" rather than owner/relationship-scoped — RLS is a floor against
  fully-anonymous access, not real per-tenant isolation. Real isolation is enforced in
  application code (every Provider-facing query scoped through `provider_clients`/
  `provider_carers`/`provider_id`) and in the API routes below
- `administrators` is the exception: read-only, own row only (`auth.uid() = user_id`) —
  fixed from a broad policy that let any authenticated user self-insert as an admin
- Service role key (`SUPABASE_SERVICE_ROLE_KEY`) used server-side only — never in the browser
- `/admin` requires login + an `administrators` row, checked server-side in the layout —
  not PIN-protected, not "security by obscure URL"
- `POST /api/notify` authorizes each notification against a real relationship (the caller
  must be the referenced activity's Client/Worker/Provider, or a Provider/Admin for
  Provider-only types) — without this, any logged-in user could send any of the branded
  email templates to any address with arbitrary content
- `POST /api/invite` verifies the calling Provider is actually linked (via
  `provider_clients`/`provider_carers`) to the record before linking a new auth account to
  it, to prevent one Provider hijacking login access to another Provider's Client/Worker
- `POST /api/invoices` is scoped to the caller's own `provider_id` — a Provider can only
  generate invoices from their own activities/clients
- Brevo API key server-side only, via `lib/email/resend.ts` (never exposed to the browser)
- All auth handled by Supabase — passwords never stored or handled by the application

---

## 13. Deployment

### Environment Variables (Vercel)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only) |
| `BREVO_API_KEY` | Yes | Brevo API key for transactional email — without it, `sendEmail()` logs a warning and no-ops rather than failing |
| `NEXT_PUBLIC_APP_URL` | Yes | Live app URL, used to build links in emails |
| `EMAIL_FROM_ADDRESS` | No | Sender address (defaults to `noreply@caretime.app`) |

`NEXT_PUBLIC_ADMIN_PIN` is no longer used — Admin access is gated by the `administrators`
table instead (see §3).

### Supabase Configuration
- **Site URL:** Set to the live Vercel URL in Authentication → URL Configuration
- **Redirect URLs:** Add `https://your-app.vercel.app/auth/confirm`

### Database Setup
Run these in the Supabase SQL Editor, in order:
1. `supabase_schema.sql` — base tables
2. `supabase_admin_migration.sql` — `administrators` table
3. `supabase_invoices_migration.sql` — `invoices`, `invoice_line_items`, `activities.invoice_id`
4. `supabase_provider_isolation_migration.sql` — `provider_carers`, `provider_clients` junction tables
5. `supabase_recurring_rates_migration.sql` — `recurring_schedules`, NDIS percentage-split pricing columns
6. `supabase_split_provider_data_migration.sql` — provider-specific `active`/`notes`/`start_date`/`end_date` columns on the junction tables
7. `supabase_security_fixes_migration.sql` — fixes the `administrators` self-escalation hole and adds RLS to tables that had none (see §12 Security Notes and `docs/DATABASE.md`)

Then populate the NDIS master catalogue (393 line items from the 2025-26 v1.1 NSW price
guide) — the import script used isn't checked into this repo; re-derive it from the NDIA
price guide if the catalogue needs to be seeded again.

---

## 14. Version 1 Scope & Deferred Items

### Implemented
- ✅ Provider, Worker, Client, Administrator interfaces — all four fully built, not placeholders
- ✅ Multi-provider architecture — Clients and Workers can belong to multiple Providers,
  with personal details shared and provider-specific state (active/notes/dates) per link
- ✅ Activity scheduling and workflow (all 9 statuses)
- ✅ **Recurring activities** — Provider and Client can both set a recurrence when
  creating an activity (daily/weekly/monthly presets or custom RFC 5545 pattern);
  generates the next 4 weeks of occurrences per save. Accepting one occurrence of a
  recurring series accepts the whole series
- ✅ NDIS master catalogue (Administrator-maintained) + Provider subset selection
- ✅ Percentage-split NDIS pricing (`client_charge_pct`/`worker_pay_pct`, per-line-item override)
- ✅ Email notifications, authorized per-relationship (not just "is logged in")
- ✅ User invitation flow, multi-role and multi-provider login routing
- ✅ NDIS invoice generation wired to real activity data, with PDF attachment
- ✅ Ratings — stored directly on `activities`/`carers`, not the separate `ratings` table
- ✅ Audit trail (`activity_status_history`)
- ✅ Admin authorization actually enforced (see §3, §12) — previously undocumented as a gap

### Partially Built
- 🟡 Reports — only "Awaiting Client Approval" exists; Worker Hours Summary, Cost Summary
  per Client, and Activities by Date Range are not built (§4.10)
- 🟡 Nominee module — a Client's Nominees can be viewed (read-only) from the Provider's
  Client edit screen and are involved in login role-detection, but there's no Nominee
  dashboard, calendar, or approval screen yet — a Nominee account currently has nowhere to go
- 🟡 Provider Settings → User Management (`/provider/settings/users`) — placeholder page only

### Deferred
- ⬜ Payment gateway integration (bank transfers to Workers) — `payment_history` table
  exists but is unused; payment status is tracked via `activities.status`/`invoices.status` only
- ⬜ Day/time-varying billing rates (`billing_rates` table exists but is unused —
  superseded by the flat percentage-split model)
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
- ⬜ Scheduled/cron-triggered notifications (30-min activity reminder, 7-day unapproved
  reminder) — the email templates and authorization exist, nothing triggers them yet
