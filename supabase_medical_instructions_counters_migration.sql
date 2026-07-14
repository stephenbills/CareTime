-- Migration: Medical Instructions & Counters
-- Run this in Supabase SQL Editor

-- 1. Client-defined reusable Medical Instructions (title + free-text)
create table if not exists medical_instructions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null,
  instructions text not null,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_medical_instructions_client on medical_instructions(client_id);

alter table medical_instructions enable row level security;
create policy "Auth users manage medical_instructions" on medical_instructions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 2. Medical Instructions attached to a specific Activity (per-occurrence, not cascaded)
create table if not exists activity_medical_instructions (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  medical_instruction_id uuid not null references medical_instructions(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (activity_id, medical_instruction_id)
);
create index if not exists idx_activity_medical_instructions_activity on activity_medical_instructions(activity_id);

alter table activity_medical_instructions enable row level security;
create policy "Auth users manage activity_medical_instructions" on activity_medical_instructions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 3. Client-defined Counters (unique per Client, title only)
create table if not exists client_counters (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  title varchar(30) not null,
  active boolean not null default true,
  created_at timestamptz default now(),
  unique (client_id, title)
);
create index if not exists idx_client_counters_client on client_counters(client_id);

alter table client_counters enable row level security;
create policy "Auth users manage client_counters" on client_counters
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. Per-activity counter tally — resets to 0 each shift, not a running total
create table if not exists activity_counter_values (
  id uuid primary key default uuid_generate_v4(),
  activity_id uuid not null references activities(id) on delete cascade,
  counter_id uuid not null references client_counters(id) on delete cascade,
  value integer not null default 0,
  updated_at timestamptz default now(),
  unique (activity_id, counter_id)
);
create index if not exists idx_activity_counter_values_activity on activity_counter_values(activity_id);

alter table activity_counter_values enable row level security;
create policy "Auth users manage activity_counter_values" on activity_counter_values
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
