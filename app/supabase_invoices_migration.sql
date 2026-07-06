-- Migration: Invoicing
-- Run this in Supabase SQL Editor

-- 1. Invoices table
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null,
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  -- Date range covered
  period_start date not null,
  period_end date not null,
  -- Totals
  total_hours numeric(8,2) default 0,
  total_amount numeric(10,2) default 0,
  total_worker_cost numeric(10,2) default 0,
  -- Status
  status text not null default 'draft', -- draft, sent, paid
  paid_at timestamptz,
  sent_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Invoice line items
create table if not exists invoice_line_items (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid references invoices(id) on delete cascade,
  activity_id uuid references activities(id) on delete set null,
  -- Copied from activity at invoice time
  activity_title text,
  activity_date date,
  start_time timestamptz,
  end_time timestamptz,
  duration_hours numeric(6,2),
  -- Worker
  worker_name text,
  -- NDIS line item details
  ndis_line_item_number text,
  ndis_description text,
  ndis_unit_price numeric(8,2),
  -- Rates applied
  client_charge_pct numeric(5,2),
  worker_pay_pct numeric(5,2),
  charge_amount numeric(8,2),  -- what client pays
  worker_amount numeric(8,2),  -- what worker gets paid
  created_at timestamptz default now()
);

-- 3. Track which activities have been invoiced
alter table activities
  add column if not exists invoice_id uuid references invoices(id) on delete set null;

-- 4. Indexes
create index if not exists idx_invoices_provider on invoices(provider_id);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoice_line_items_invoice on invoice_line_items(invoice_id);
create index if not exists idx_activities_invoice on activities(invoice_id) where invoice_id is not null;

-- 5. RLS
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;

create policy "Authenticated users can do everything" on invoices
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can do everything" on invoice_line_items
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
