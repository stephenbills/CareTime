-- CareTime Database Schema v1.0
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROVIDERS
create table if not exists providers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  abn text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  phone text,
  fax text,
  email text,
  website text,
  ceo_details text,
  description text,
  admin_percentage numeric(5,2),
  admin_flat_fee numeric(10,2),
  emergency_procedures text,
  bank_account_name text,
  bank_bsb text,
  bank_account_number text,
  next_invoice_number integer default 1001,
  overall_client_rating numeric(3,2),
  overall_carer_rating numeric(3,2),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CLIENTS
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  mobile text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  ndis_number text,
  comments text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- CARERS
create table if not exists carers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  mobile text,
  home_phone text,
  work_phone text,
  address_line1 text,
  suburb text,
  state text,
  postcode text,
  car_registration text,
  abn text,
  bank_bsb text,
  bank_account_number text,
  comments text,
  client_rating numeric(3,2),
  provider_rating numeric(3,2),
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PROVIDER <-> CARER relationship
create table if not exists provider_carers (
  provider_id uuid references providers(id) on delete cascade,
  carer_id uuid references carers(id) on delete cascade,
  primary key (provider_id, carer_id)
);

-- NOMINEES
create table if not exists nominees (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  created_at timestamptz default now()
);

-- CLIENT <-> NOMINEE relationship
create table if not exists client_nominees (
  client_id uuid references clients(id) on delete cascade,
  nominee_id uuid references nominees(id) on delete cascade,
  primary key (client_id, nominee_id)
);

-- BILLING RATES
create table if not exists billing_rates (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  name text not null,
  rate_per_hour numeric(10,2) not null,
  days text[] not null,
  start_time time not null,
  end_time time not null,
  is_public_holiday boolean default false,
  created_at timestamptz default now()
);

-- PUBLIC HOLIDAYS
create table if not exists public_holidays (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  name text not null,
  date date not null,
  created_at timestamptz default now()
);

-- NDIS SUPPORT CATALOGUE
create table if not exists ndis_line_items (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  line_item_number text not null,
  description text not null,
  support_category text,
  unit_price numeric(10,2) not null,
  active boolean default true,
  created_at timestamptz default now()
);

-- ACTIVITIES
create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  carer_id uuid references carers(id) on delete set null,
  ndis_line_item_id uuid references ndis_line_items(id) on delete set null,
  title text not null,
  status text not null default 'awaiting_acceptance',
  -- statuses: awaiting_acceptance, scheduled, in_progress, awaiting_client_approval,
  --           awaiting_payment_approval, ready_for_payment, paid, rejected, cancelled
  start_time timestamptz not null,
  end_time timestamptz not null,
  actual_start_time timestamptz,
  actual_end_time timestamptz,
  pickup_address text,
  dropoff_address text,
  venue_address text,
  description text,
  carer_comments text,
  client_comments text,
  rejection_reason text,
  mileage numeric(8,2),
  expenses numeric(10,2),
  hourly_rate numeric(10,2),
  total_cost numeric(10,2),
  client_rating integer check (client_rating between 1 and 5),
  provider_rating integer check (provider_rating between 1 and 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ACTIVITY STATUS HISTORY (audit trail)
create table if not exists activity_status_history (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid references activities(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id),
  notes text,
  created_at timestamptz default now()
);

-- INVOICES
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  invoice_number integer not null,
  period_from date not null,
  period_to date not null,
  total_amount numeric(10,2) not null,
  status text default 'draft',
  -- statuses: draft, sent, paid
  emailed_at timestamptz,
  created_at timestamptz default now()
);

-- INVOICE LINE ITEMS
create table if not exists invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  ndis_line_item_number text,
  description text not null,
  date date,
  hours numeric(6,2),
  rate numeric(10,2),
  amount numeric(10,2) not null
);

-- PAYMENT HISTORY
create table if not exists payment_history (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id),
  carer_id uuid references carers(id),
  activity_id uuid references activities(id),
  amount numeric(10,2) not null,
  paid_at timestamptz default now()
);

-- RATINGS
create table if not exists ratings (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid references activities(id) on delete cascade,
  rated_by_role text not null,  -- 'client', 'nominee', 'provider', 'carer'
  rated_entity text not null,   -- 'carer', 'client', 'provider'
  rated_entity_id uuid not null,
  score integer not null check (score between 1 and 5),
  comments text,
  created_at timestamptz default now()
);

-- Row Level Security
alter table providers enable row level security;
alter table clients enable row level security;
alter table carers enable row level security;
alter table activities enable row level security;

-- Providers can see their own data
create policy "Providers manage own data" on providers
  for all using (auth.uid() = user_id);

-- For now, authenticated users can read all (tighten in production)
create policy "Auth users read clients" on clients
  for all using (auth.role() = 'authenticated');

create policy "Auth users read carers" on carers
  for all using (auth.role() = 'authenticated');

create policy "Auth users read activities" on activities
  for all using (auth.role() = 'authenticated');

-- -------------------------------------------------------
-- FIX: Provider RLS policies (run if settings won't save)
-- -------------------------------------------------------

-- Drop existing policy and recreate with full permissions
drop policy if exists "Providers manage own data" on providers;

create policy "Providers insert own data" on providers
  for insert with check (auth.uid() = user_id);

create policy "Providers select own data" on providers
  for select using (auth.uid() = user_id);

create policy "Providers update own data" on providers
  for update using (auth.uid() = user_id);
