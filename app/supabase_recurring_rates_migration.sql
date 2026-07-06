-- Migration: Recurring Schedules & Simplified NDIS Rates
-- Run this in Supabase SQL Editor

-- 1. Add rate percentage fields to providers
alter table providers
  add column if not exists client_charge_pct numeric(5,2) default 100.00,
  add column if not exists worker_pay_pct numeric(5,2) default 62.00;

-- 2. Add rate override columns to ndis_line_items
alter table ndis_line_items
  add column if not exists client_charge_pct_override numeric(5,2),
  add column if not exists worker_pay_pct_override numeric(5,2);

-- 3. Create recurring_schedules table
create table if not exists recurring_schedules (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  carer_id uuid references carers(id) on delete set null,
  ndis_line_item_id uuid references ndis_line_items(id) on delete set null,
  title text not null,
  description text,
  -- Recurrence pattern (RFC 5545 RRule string)
  rrule text,                      -- e.g. 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR'
  -- Legacy fields (kept for backwards compat, rrule takes precedence)
  days_of_week integer[],          -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time time not null,        -- time of day e.g. 09:00
  duration_minutes integer not null, -- length of each shift
  -- Date range
  valid_from date not null,
  valid_until date,                -- null = ongoing
  -- Locations (copied to each generated activity)
  pickup_address text,
  dropoff_address text,
  venue_address text,
  -- Status
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. Add recurring_schedule_id to activities
alter table activities
  add column if not exists recurring_schedule_id uuid references recurring_schedules(id) on delete set null;

-- 5. Add rrule column if table already exists (safe to run multiple times)
alter table recurring_schedules
  add column if not exists rrule text;

-- Make days_of_week nullable since rrule replaces it
alter table recurring_schedules
  alter column days_of_week drop not null;

-- 6. Index for fast lookup of instances
create index if not exists idx_activities_recurring_schedule
  on activities(recurring_schedule_id)
  where recurring_schedule_id is not null;

create index if not exists idx_recurring_schedules_provider
  on recurring_schedules(provider_id);

create index if not exists idx_recurring_schedules_client
  on recurring_schedules(client_id);
