# CareTime — Database Tables Reference

All tables are hosted in Supabase (PostgreSQL). Row Level Security (RLS) is enabled on every
table — `nominees`, `client_nominees`, `billing_rates`, `public_holidays`, `ndis_line_items`,
`activity_status_history`, `payment_history`, `ratings`, and `recurring_schedules` only gained
RLS via `supabase_security_fixes_migration.sql`; **run that migration if it hasn't been applied
yet**, or those tables are readable/writable by anyone with the public API key, logged in or not.

Almost every policy in this app is "any authenticated user" rather than owner/relationship-scoped
— see the Security Notes in `FUNCTIONAL_SPEC.md` for what that does and doesn't protect against.
`administrators` is the one table with a stricter policy (read-only, own row) after that same
migration fixed a self-escalation hole where any logged-in user could insert themselves as an
administrator.

The `auth.users` table is managed by Supabase Auth and is not listed here.

---

## Core User Tables

### `providers`
Stores details of care agencies or individual fund administrators who use the platform.
Each Provider has one or more Carers and one or more Clients. A Provider user logs in and
manages activities, invoicing, and payments through the Provider interface.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Provider's login account |
| name | text | Organisation name |
| abn | text | Australian Business Number — printed on invoices |
| address_line1, address_line2, suburb, state, postcode | text | Mailing address |
| phone, fax, email, website | text | Contact details |
| ceo_details | text | Name/details of CEO |
| description | text | Description of the Provider and its services |
| admin_percentage, admin_flat_fee | numeric | **Legacy — unused.** Superseded by `client_charge_pct`/`worker_pay_pct` below |
| client_charge_pct | numeric | % of each NDIS line item's unit price charged to the Client. Default 100 |
| worker_pay_pct | numeric | % of each NDIS line item's unit price paid to the Worker. Default 62. Overridable per line item (`ndis_line_items.worker_pay_pct_override`) |
| emergency_procedures | text | Emergency contact procedures |
| bank_name, bank_account_name, bank_bsb, bank_account_number | text | Bank details printed on invoices |
| gst_rate | numeric | GST % applied to the invoice subtotal. Default 10 |
| invoice_days_due | integer | Payment terms in days, printed on invoices as the due date. Default 14 |
| next_invoice_number | integer | **Legacy — unused.** Invoice numbers are generated from the period date instead (see `invoices.invoice_number`) |
| overall_client_rating | numeric | Calculated average rating from Clients |
| overall_carer_rating | numeric | Calculated average rating from Workers |
| active | boolean | Whether the Provider is active |

---

### `carers`
Stores the personal details of Support Workers (referred to in the UI as "Workers") — name,
contact info, address, and payment details. A Worker can be linked to multiple Providers via
`provider_carers`, and is a single shared record across all of them: personal details are
edited by the Worker themselves (`/worker/details`), never by a Provider.

`active` and `comments` still exist on this table for backward compatibility but are no longer
read or written by the app — provider-specific active status and notes now live on
`provider_carers` instead, since a Worker linked to multiple Providers can be active for one
and inactive for another.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Worker's login account |
| name | text | Full name |
| email | text | Used for login and notifications |
| mobile, home_phone, work_phone | text | Contact numbers |
| address_line1, suburb, state, postcode | text | Home address |
| car_registration | text | Vehicle registration number |
| abn | text | ABN if the Worker operates as a sole trader |
| bank_bsb, bank_account_number | text | Bank details for payment |
| comments | text | **Legacy — unused.** Superseded by `provider_carers.notes` |
| client_rating | numeric | Calculated average rating from Clients |
| provider_rating | numeric | Calculated average rating from Providers |
| active | boolean | **Legacy — unused.** Superseded by `provider_carers.active` |
| provider_id | uuid | **Legacy — unused.** Predates `provider_carers`; a Worker's real Provider links are the `provider_carers` rows |

---

### `clients`
Stores the personal details of the people receiving care — name, contact info, address, and
NDIS number. A Client can be linked to multiple Providers via `provider_clients`, and is a
single shared record across all of them: personal details are edited by the Client themselves
(`/client/details`), never by a Provider.

`active`, `comments`, and `provider_id` still exist on this table for backward compatibility but
are no longer read or written by the app — see `provider_clients` below, which holds the
per-Provider active status and notes instead.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Client's login account |
| name | text | Full name |
| email | text | Used for login and notifications |
| phone, mobile | text | Contact numbers |
| address_line1, address_line2, suburb, state, postcode | text | Home address — used to pre-fill Activity addresses |
| ndis_number | text | NDIS participant number — printed on invoices and claims |
| comments | text | **Legacy — unused.** Superseded by `provider_clients.notes` |
| active | boolean | **Legacy — unused.** Superseded by `provider_clients.active` |
| provider_id | uuid | **Legacy — unused.** Predates `provider_clients`; a Client's real Provider links are the `provider_clients` rows |

---

### `nominees`
Stores details of people who act on behalf of Clients, typically parents or guardians.
A Nominee can represent one or more Clients and can approve shifts and invoices on their behalf.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Nominee's login account |
| name | text | Full name |
| email | text | Used for login and notifications |
| phone | text | Contact number |

---

### `administrators`
Stores details of system administrators who have access to the Admin panel.
Administrators maintain the master NDIS support catalogue and can create accounts for all roles.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Administrator's login account |
| name | text | Full name |
| email | text | Contact email |

---

## Relationship Tables

### `provider_carers`
Many-to-many join table linking Providers to Workers, and the home of every
**provider-specific** fact about that relationship — a Worker can work for multiple
Providers, be active for one and inactive for another, and have different notes/dates
with each.

Unlike `provider_clients`, this table has a **composite primary key** (`provider_id`,
`carer_id`) rather than a synthetic `id` column — code that needs to update or reference
a specific link must match on both columns together, not a single row id.

| Column | Type | Notes |
|---|---|---|
| provider_id | uuid | Part of the composite primary key. Foreign key to `providers` |
| carer_id | uuid | Part of the composite primary key. Foreign key to `carers` |
| active | boolean | Whether this Worker is active **for this Provider** — drives the Workers list, dashboard counts, and Worker pickers in Activities/Schedules |
| notes | text | Provider's private notes about this Worker |
| start_date, end_date | date | When this Worker started/finished working with this Provider |

---

### `provider_clients`
Many-to-many join table linking Providers to Clients, and the home of every
**provider-specific** fact about that relationship — a Client can be linked to multiple
Providers, be active for one and inactive for another, and have different notes/dates
with each. Has a synthetic `id` primary key (unlike `provider_carers`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| client_id | uuid | Foreign key to `clients` |
| active | boolean | Whether this Client is active **for this Provider** — drives the Clients list, dashboard counts, and Client pickers in Activities/Schedules |
| notes | text | Provider's private notes about this Client |
| start_date, end_date | date | When this Client started/finished with this Provider |
| created_at | timestamptz | When the link was created |

---

### `client_nominees`
Many-to-many join table linking Clients to Nominees.
A Client can have multiple Nominees; a Nominee can represent multiple Clients.

| Column | Type | Notes |
|---|---|---|
| client_id | uuid | Foreign key to `clients` |
| nominee_id | uuid | Foreign key to `nominees` |

---

## Activity & Scheduling Tables

### `activities`
The central table of the application. Each row represents a care activity — a scheduled
or completed shift where a Worker provides care to a Client. Activities move through a
defined status workflow from scheduling through to payment.

**Status workflow:**
`awaiting_acceptance` → `scheduled` → `in_progress` → `awaiting_client_approval` →
`awaiting_payment_approval` → `ready_for_payment` → `paid`

Terminal statuses: `rejected`, `cancelled`

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| client_id | uuid | Foreign key to `clients` |
| carer_id | uuid | Foreign key to `carers` (nullable — can be unassigned) |
| ndis_line_item_id | uuid | Foreign key to `ndis_line_items` — the NDIS billing code |
| recurring_schedule_id | uuid | Foreign key to `recurring_schedules` (nullable) — set when this occurrence was generated from a recurring pattern rather than created as a one-off |
| invoice_id | uuid | Foreign key to `invoices` (nullable) — set once this activity has been billed, to prevent double-invoicing |
| title | text | Name of the activity |
| status | text | Current workflow status (see above) |
| start_time | timestamptz | Scheduled start date and time |
| end_time | timestamptz | Scheduled end date and time |
| actual_start_time | timestamptz | Recorded when Worker clicks Start Shift (can be overridden) |
| actual_end_time | timestamptz | Recorded when Worker submits shift (can be overridden) |
| pickup_address | text | Address where Worker picks up the Client |
| dropoff_address | text | Address where Worker drops off the Client |
| venue_address | text | Optional address of the activity venue |
| description | text | Notes about the activity |
| carer_comments | text | Comments submitted by the Worker at end of shift |
| client_comments | text | Comments from Client at approval time |
| rejection_reason | text | Reason provided when Client rejects a shift |
| mileage | numeric | Kilometres travelled — submitted by Worker |
| expenses | numeric | Out-of-pocket expenses — submitted by Worker |
| hourly_rate | numeric | Rate applied to this activity |
| total_cost | numeric | Calculated total cost including any surcharges |
| client_rating | integer | 1–5 star rating given by Client for this activity |
| provider_rating | integer | 1–5 star rating given by Provider |

---

### `activity_status_history`
Immutable audit trail recording every status change for every Activity.
Used for compliance, dispute resolution, and reporting.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| activity_id | uuid | Foreign key to `activities` |
| from_status | text | Previous status (null for initial creation) |
| to_status | text | New status |
| changed_by | uuid | Links to `auth.users` — who made the change |
| notes | text | Optional notes about the change |
| created_at | timestamptz | Timestamp of the change |

---

### `recurring_schedules`
A recurring pattern (e.g. "every Wednesday at 9am") that generates `activities` rows.
Created either from a Provider's or Client's "Add Activity" screen when a recurrence is set,
or from the Provider's dedicated Schedules feature. Once created, generating occurrences
inserts up to 4 weeks of `activities` rows at a time (each with `recurring_schedule_id` set
back to this row), rather than the schedule itself representing a live occurrence.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| client_id | uuid | Foreign key to `clients` |
| carer_id | uuid | Foreign key to `carers` (nullable — can be unassigned) |
| ndis_line_item_id | uuid | Foreign key to `ndis_line_items` |
| title, description | text | Copied onto every generated activity |
| rrule | text | RFC 5545 recurrence rule string (e.g. `RRULE:FREQ=WEEKLY;BYDAY=WE`), generated by the `rrule` library |
| days_of_week | integer[] | Legacy alternative to `rrule` for simple weekly patterns (0=Sunday..6=Saturday); `rrule` is used when present |
| start_time | time | Time of day each occurrence starts |
| duration_minutes | integer | Length of each occurrence |
| valid_from, valid_until | date | Date range the pattern applies to (`valid_until` nullable — no end date) |
| pickup_address, dropoff_address, venue_address | text | Copied onto every generated activity |
| active | boolean | Whether this schedule is still generating new occurrences |

---

## Billing & Payments Tables

### `billing_rates` — legacy, unused
Originally intended to store hourly billing rates per Provider varying by day/time/public
holiday. **Not read or written anywhere in the current app** — invoice line item pricing now
comes from `ndis_line_items.unit_price` combined with the percentage split described under
`invoices` below. Left in place in case day/time-varying rates are revisited later.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| name | text | Rate name (e.g. "Standard Weekday", "Weekend Rate") |
| rate_per_hour | numeric | Dollar amount per hour |
| days | text[] | Array of applicable days (e.g. ["Monday","Tuesday"]) |
| start_time | time | Start of the time window |
| end_time | time | End of the time window |
| is_public_holiday | boolean | If true, applies to all defined public holidays |

---

### `public_holidays`
Stores public holiday dates per Provider, managed from Provider Settings (with a one-click
import of common Australian national holidays for a given year). Currently informational —
not yet wired into invoice pricing (see `billing_rates` above).

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| name | text | Holiday name (e.g. "Christmas Day") |
| date | date | Date of the holiday |

---

### `invoices`
Stores invoices generated by Providers for Clients, via `POST /api/invoices`. One invoice is
created per Client covering all their billable (client-approved, not yet invoiced) activities
in the selected date range. A PDF is generated (`lib/invoice/pdf.ts`) and emailed to the Client,
and every included activity is stamped with `invoice_id` so it can't be double-invoiced.

Pricing has no separate "billing rate" concept — each activity's cost is
`ndis_line_items.unit_price × duration_hours`, split between what the Client is charged and
what the Worker is paid using `client_charge_pct`/`worker_pay_pct` (from `providers`, or
overridden per NDIS line item — see `ndis_line_items` below).

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| client_id | uuid | Foreign key to `clients` |
| invoice_number | text | Generated as `INV-{YYMMDD}-{seq}` from the period start date, not a stored running counter |
| period_start, period_end | date | Billing period covered |
| total_hours | numeric | Sum of billable hours across all line items |
| subtotal_amount | numeric | Sum of line item charges before GST (nullable — null on invoices generated before GST support was added) |
| gst_amount | numeric | GST charged, calculated from the Provider's `gst_rate` at generation time |
| total_amount | numeric | Total charged to the Client, **GST-inclusive** (`subtotal_amount + gst_amount`) |
| total_worker_cost | numeric | Total paid out to Workers for this invoice (Provider-facing margin figure, not shown to the Client) |
| status | text | `draft`, `sent`, or `paid` |
| paid_at | timestamptz | When marked paid |
| sent_at | timestamptz | When the invoice email was sent |
| notes | text | Free text |

---

### `invoice_line_items`
Individual line items within an invoice, one per billed Activity — full detail is copied in
at invoice time (not just a pointer to the Activity) so the invoice stays accurate even if the
underlying Activity or NDIS line item is later edited.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| invoice_id | uuid | Foreign key to `invoices` |
| activity_id | uuid | Foreign key to `activities` (nullable — survives activity deletion) |
| activity_title | text | Copied from the Activity |
| activity_date | date | Date the service was provided |
| start_time, end_time | timestamptz | Copied from the Activity's actual (or scheduled) times |
| duration_hours | numeric | Billable hours for this line |
| worker_name | text | Copied from the assigned Worker |
| ndis_line_item_number, ndis_description, ndis_unit_price | text/text/numeric | Copied from the NDIS line item used |
| client_charge_pct, worker_pay_pct | numeric | The percentages actually applied to this line (post-override) |
| charge_amount | numeric | What the Client is charged for this line |
| worker_amount | numeric | What the Worker is paid for this line |

---

### `payment_history` — legacy, unused
Intended as an immutable record of payments made to Workers. **Not read or written anywhere
in the current app** — `activities.status = 'paid'` (set from the Invoices screen) is currently
the only payment record. Left in place for when Worker payment tracking is built out.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| carer_id | uuid | Foreign key to `carers` |
| activity_id | uuid | Foreign key to `activities` |
| amount | numeric | Amount paid |
| paid_at | timestamptz | When the payment was processed |

---

## NDIS Tables

### `ndis_master_items`
The central NDIS support catalogue maintained by Administrators only. Contains all
active NDIS line items with pricing based on the NDIS Pricing Arrangements and Price
Limits (currently 2025-26 v1.1, NSW rates). Updated manually when the NDIA releases
a new price guide. Providers select items from this list to build their own catalogue.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| line_item_number | text | NDIS support item number (unique, e.g. `01_011_0107_1_1`) |
| description | text | Full description of the support item |
| support_category | text | NDIS support category name |
| unit_price | numeric | Price per hour (NSW rate) |
| active | boolean | Whether the item is available for Providers to select |

---

### `ndis_line_items`
Each Provider's selected subset of the master NDIS catalogue. Providers browse the
master list and add the items relevant to their services. These are the items available
when scheduling Activities. Providers can activate/deactivate items without removing them.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| master_item_id | uuid | Foreign key to `ndis_master_items` — source item |
| line_item_number | text | NDIS item number (copied from master) |
| description | text | Description (copied from master, editable) |
| support_category | text | Support category (copied from master) |
| unit_price | numeric | Price (copied from master, editable) |
| client_charge_pct_override | numeric | Overrides `providers.client_charge_pct` for this specific line item, if set |
| worker_pay_pct_override | numeric | Overrides `providers.worker_pay_pct` for this specific line item, if set |
| active | boolean | Whether this item is available for this Provider's activities |

---

## Ratings Table

### `ratings` — legacy, unused
Intended as a normalised store of individual 1–5 star ratings between roles. **Not read or
written anywhere in the current app** — ratings are instead stored directly as columns on the
entity being rated: `activities.client_rating`/`provider_rating` (per-shift) and
`carers.client_rating`/`provider_rating` (running average). Left in place in case per-rating
history/comments are needed later.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| activity_id | uuid | Foreign key to `activities` |
| rated_by_role | text | Role of the person giving the rating (e.g. `client`, `provider`) |
| rated_entity | text | What is being rated (e.g. `carer`, `provider`, `client`) |
| rated_entity_id | uuid | ID of the entity being rated |
| score | integer | Rating score 1–5 |
| comments | text | Optional comments |

---

## Summary

| Table | Rows (approx. trial) | Purpose |
|---|---|---|
| providers | 5 | Care agencies / fund administrators |
| carers | 15 | Support Workers (personal details only) |
| clients | 5 | People receiving care (personal details only) |
| nominees | 5–10 | Client representatives |
| administrators | 1–2 | System administrators |
| provider_carers | 20–30 | Provider ↔ Worker relationships + per-Provider active/notes/dates |
| provider_clients | 10–20 | Provider ↔ Client relationships + per-Provider active/notes/dates |
| client_nominees | 5–15 | Client ↔ Nominee relationships |
| activities | 400–500/year | Care activities (core table) |
| activity_status_history | 2,000+/year | Audit trail of status changes |
| recurring_schedules | 10–30 | Recurring activity patterns |
| billing_rates | 10–20 | Hourly rate definitions per Provider |
| public_holidays | 20–30 | Public holiday dates per Provider |
| invoices | 50–100/year | Monthly invoices to Clients |
| invoice_line_items | 400–500/year | Individual invoice lines |
| payment_history | 400–500/year | Immutable payment records |
| ndis_master_items | ~393 | Central NDIS support catalogue |
| ndis_line_items | 20–100 | Provider's selected NDIS items |
| ratings | 400–500/year | Activity-level ratings |
