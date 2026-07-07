-- Migration: Provider Data Isolation & Multi-Provider Workers
-- Run this in Supabase SQL Editor

-- 1. Junction table for workers belonging to multiple providers
create table if not exists provider_carers (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  carer_id uuid references carers(id) on delete cascade,
  active boolean default true,
  created_at timestamptz default now(),
  unique(provider_id, carer_id)
);

alter table provider_carers enable row level security;
create policy "Authenticated users can do everything" on provider_carers
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_provider_carers_provider on provider_carers(provider_id);
create index if not exists idx_provider_carers_carer on provider_carers(carer_id);

-- 2. Ensure provider_id exists on carers (for the "primary" provider / backwards compat)
alter table carers add column if not exists provider_id uuid references providers(id);

-- 3. Backfill: link existing carers to existing providers via provider_carers
-- Run this ONLY if you have existing data and a single provider:
-- INSERT INTO provider_carers (provider_id, carer_id)
-- SELECT p.id, c.id FROM providers p, carers c
-- ON CONFLICT DO NOTHING;

-- 4. Backfill carers.provider_id from the first provider (single-provider setups):
-- UPDATE carers SET provider_id = (SELECT id FROM providers LIMIT 1)
-- WHERE provider_id IS NULL;

-- 5. Ensure clients.provider_id exists (should already be there)
alter table clients add column if not exists provider_id uuid references providers(id);

-- Backfill clients:
-- UPDATE clients SET provider_id = (SELECT id FROM providers LIMIT 1)
-- WHERE provider_id IS NULL;

-- 6. Junction table for clients belonging to multiple providers
create table if not exists provider_clients (
  id uuid primary key default uuid_generate_v4(),
  provider_id uuid references providers(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  active boolean default true,
  created_at timestamptz default now(),
  unique(provider_id, client_id)
);

alter table provider_clients enable row level security;
create policy "Authenticated users can do everything" on provider_clients
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create index if not exists idx_provider_clients_provider on provider_clients(provider_id);
create index if not exists idx_provider_clients_client on provider_clients(client_id);

-- Backfill existing clients into junction:
-- INSERT INTO provider_clients (provider_id, client_id)
-- SELECT provider_id, id FROM clients WHERE provider_id IS NOT NULL
-- ON CONFLICT DO NOTHING;
