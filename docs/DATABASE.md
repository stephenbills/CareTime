# CareTime — Database Tables Reference

All tables are hosted in Supabase (PostgreSQL). Row Level Security (RLS) is enabled on all tables.
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
| admin_percentage | numeric | Optional administration percentage charged to Clients |
| admin_flat_fee | numeric | Optional administration flat fee charged to Clients |
| emergency_procedures | text | Emergency contact procedures |
| bank_account_name, bank_bsb, bank_account_number | text | Bank details for invoicing |
| next_invoice_number | integer | Auto-increments with each invoice generated |
| overall_client_rating | numeric | Calculated average rating from Clients |
| overall_carer_rating | numeric | Calculated average rating from Workers |
| active | boolean | Whether the Provider is active |

---

### `carers`
Stores details of Support Workers (referred to in the UI as "Workers") who provide care to Clients.
A Worker can be associated with one or more Providers and typically works with multiple Clients.

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
| comments | text | Free text notes |
| client_rating | numeric | Calculated average rating from Clients |
| provider_rating | numeric | Calculated average rating from Providers |
| active | boolean | Whether the Worker is active |

---

### `clients`
Stores details of the people receiving care. Clients are associated with one or more Providers
and have one or more Workers assigned to them via Activities.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Links to `auth.users` — the Client's login account |
| provider_id | uuid | Foreign key to `providers` |
| name | text | Full name |
| email | text | Used for login and notifications |
| phone, mobile | text | Contact numbers |
| address_line1, address_line2, suburb, state, postcode | text | Home address — used to pre-fill Activity addresses |
| ndis_number | text | NDIS participant number — printed on invoices and claims |
| comments | text | Free text notes |
| active | boolean | Whether the Client is active |

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
Many-to-many join table linking Providers to Workers.
A Worker can work for multiple Providers; a Provider can have many Workers.

| Column | Type | Notes |
|---|---|---|
| provider_id | uuid | Foreign key to `providers` |
| carer_id | uuid | Foreign key to `carers` |

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

## Billing & Payments Tables

### `billing_rates`
Stores the hourly billing rates for each Provider. Rates can vary by day of week, time
of day, and whether it is a public holiday. Used to calculate the cost of Activities.

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
Stores public holiday dates per Provider. Used in conjunction with `billing_rates`
to apply public holiday billing rates to Activities that fall on these dates.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| name | text | Holiday name (e.g. "Christmas Day") |
| date | date | Date of the holiday |

---

### `invoices`
Stores invoices generated by Providers for Clients. Invoices are NDIS-compliant and
include the Client's NDIS participant number. Generated monthly or on demand.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| provider_id | uuid | Foreign key to `providers` |
| client_id | uuid | Foreign key to `clients` |
| invoice_number | integer | Sequential invoice number from Provider settings |
| period_from | date | Start of the billing period |
| period_to | date | End of the billing period |
| total_amount | numeric | Total amount due |
| status | text | `draft`, `sent`, or `paid` |
| emailed_at | timestamptz | When the invoice was sent by email |

---

### `invoice_line_items`
Individual line items within an invoice. Each line item corresponds to one Activity
and includes the NDIS support item number for compliance purposes.

| Column | Type | Notes |
|---|---|---|
| id | uuid | Primary key |
| invoice_id | uuid | Foreign key to `invoices` |
| activity_id | uuid | Foreign key to `activities` |
| ndis_line_item_number | text | NDIS support catalogue item number |
| description | text | Description of the service |
| date | date | Date the service was provided |
| hours | numeric | Number of hours |
| rate | numeric | Hourly rate applied |
| amount | numeric | Total amount for this line item |

---

### `payment_history`
Immutable record of all payments made to Workers. Once created, records are never
modified. Providers can search and drill down into payment history by Worker, Client,
date, or amount.

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
| active | boolean | Whether this item is available for this Provider's activities |

---

## Ratings Table

### `ratings`
Stores individual 1–5 star ratings between roles. Ratings are given at the activity
level and aggregated to produce the overall ratings shown on Provider, Worker, and
Client detail screens.

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
| carers | 15 | Support Workers |
| clients | 5 | People receiving care |
| nominees | 5–10 | Client representatives |
| administrators | 1–2 | System administrators |
| provider_carers | 20–30 | Provider ↔ Worker relationships |
| client_nominees | 5–15 | Client ↔ Nominee relationships |
| activities | 400–500/year | Care activities (core table) |
| activity_status_history | 2,000+/year | Audit trail of status changes |
| billing_rates | 10–20 | Hourly rate definitions per Provider |
| public_holidays | 20–30 | Public holiday dates per Provider |
| invoices | 50–100/year | Monthly invoices to Clients |
| invoice_line_items | 400–500/year | Individual invoice lines |
| payment_history | 400–500/year | Immutable payment records |
| ndis_master_items | ~393 | Central NDIS support catalogue |
| ndis_line_items | 20–100 | Provider's selected NDIS items |
| ratings | 400–500/year | Activity-level ratings |
