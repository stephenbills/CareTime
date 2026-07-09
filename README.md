# CareTime

CareTime is a browser-based care coordination platform for NDIS support providers. It
connects **Providers** (care agencies), **Workers** (support workers), **Clients** (people
receiving care), and **Nominees** (client representatives) around a single shared record of
scheduled activities — from booking a shift through acceptance, delivery, client approval,
and NDIS-compliant invoicing.

A Client or Worker can belong to more than one Provider. Personal details (name, contact
info, address, payment details) live in one shared record per person; everything specific to
a particular Provider relationship — active status, notes, start/end dates — lives separately,
so one Provider's changes never affect another Provider's relationship with the same person.

## What it does

- **Activity scheduling** — one-off or recurring (daily/weekly/monthly presets, or a custom
  RFC 5545 pattern) — with a 9-status workflow from *Awaiting Acceptance* through to *Paid*
- **Role-specific interfaces** — a desktop, sidebar-driven Provider console; mobile-first,
  bottom-nav interfaces for Workers and Clients; a PIN-free, table-gated Administrator panel
- **NDIS billing** — a Provider-maintained subset of the NDIS support catalogue, with
  percentage-split pricing (client charge % / worker pay %, overridable per line item) and
  PDF invoice generation emailed directly to Clients
- **Email notifications** — every status change, assignment, and approval triggers an email
  via Brevo, authorized so a notification can only be sent by someone with a real
  relationship to what it's about
- **Multi-provider support** — Clients and Workers can be linked to multiple Providers
  simultaneously, each with independent active status and notes

See [`docs/FUNCTIONAL_SPEC.md`](docs/FUNCTIONAL_SPEC.md) for the full feature spec and
[`docs/DATABASE.md`](docs/DATABASE.md) for the schema reference.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Brevo
(transactional email) · pdf-lib (invoices) · rrule (recurrence) · Vercel (hosting)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You'll need a Supabase project and the environment variables listed in
[`docs/FUNCTIONAL_SPEC.md`](docs/FUNCTIONAL_SPEC.md#13-deployment) (`.env.local`, not
committed). Run the SQL migrations in the order listed there — `supabase_schema.sql` first,
then each `supabase_*_migration.sql` file — before starting the app against a fresh project.

## Project structure

- `app/` — routes, grouped by role (`provider/`, `worker/`, `client/`, `admin/`) plus shared
  `auth/` and `api/` (server-side routes: invites, invoicing, notifications)
- `components/` — shared UI (navigation shells, form fields, the recurrence picker, calendar
  week view)
- `lib/` — Supabase clients, auth helpers, email templates/sending, invoice PDF generation
- `docs/` — functional spec and database reference (kept up to date each session)
- `supabase_*.sql` — schema and incremental migrations, run in date order
- `CHANGELOG.md` — session-by-session change log

## Deploying

Connected to Vercel — pushing to `main` triggers an automatic build and deploy.
