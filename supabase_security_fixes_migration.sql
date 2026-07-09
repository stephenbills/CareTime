-- Migration: Security Fixes — Admin Privilege Escalation + Missing RLS
-- Run this in Supabase SQL Editor
--
-- Found during a full codebase review. Two issues:
--
-- 1. `administrators` had TWO policies from two different migrations:
--    supabase_schema.sql's owner-scoped one, and supabase_admin_migration.sql's
--    "Authenticated users can do everything" one. Postgres OR's applicable RLS
--    policies together, so the broad one let ANY authenticated user — any
--    client, worker, or provider — insert a row into `administrators` linking
--    their own user_id, self-granting full admin access. This migration drops
--    both existing policies and replaces them with a read-only-own-row policy.
--    New admins must be provisioned by inserting directly via the Supabase SQL
--    Editor (as the existing migration comment already describes) — there is
--    no in-app self-service path, so nothing else needs INSERT/UPDATE/DELETE.
--
-- 2. These tables had RLS enabled nowhere in the schema at all, meaning any
--    request using the anon/public key — authenticated or not — could read
--    and write them directly via the Supabase REST API, bypassing the app
--    entirely: nominees, client_nominees, billing_rates, public_holidays,
--    ndis_line_items, activity_status_history, payment_history, ratings,
--    recurring_schedules. payment_history and ratings hold financial/rating
--    data; recurring_schedules holds client addresses.
--
--    This migration adds RLS matching the same "any authenticated user" policy
--    already used on every other table in this app (clients, carers,
--    activities, invoices, provider_clients, provider_carers, etc.) — this is
--    a floor, not a redesign: it closes off completely-anonymous access
--    without changing any existing app behaviour, since the app already
--    assumes any logged-in user can reach these tables. Tightening further to
--    real per-provider/per-relationship scoping is a larger follow-up, not
--    attempted here.

-- 1. Fix administrators self-escalation
drop policy if exists "Authenticated users can do everything" on administrators;
drop policy if exists "Administrators manage own record" on administrators;

create policy "Administrators read own record" on administrators
  for select using (auth.uid() = user_id);

-- 2. Add RLS to previously-unprotected tables

alter table nominees enable row level security;
create policy "Auth users manage nominees" on nominees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table client_nominees enable row level security;
create policy "Auth users manage client_nominees" on client_nominees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table billing_rates enable row level security;
create policy "Auth users manage billing_rates" on billing_rates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table public_holidays enable row level security;
create policy "Auth users manage public_holidays" on public_holidays
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table ndis_line_items enable row level security;
create policy "Auth users manage ndis_line_items" on ndis_line_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table activity_status_history enable row level security;
create policy "Auth users manage activity_status_history" on activity_status_history
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table payment_history enable row level security;
create policy "Auth users manage payment_history" on payment_history
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table ratings enable row level security;
create policy "Auth users manage ratings" on ratings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table recurring_schedules enable row level security;
create policy "Auth users manage recurring_schedules" on recurring_schedules
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
