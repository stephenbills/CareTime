-- Migration: Administrators table
-- Run this in Supabase SQL Editor

create table if not exists administrators (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  active boolean default true,
  created_at timestamptz default now()
);

alter table administrators enable row level security;

create policy "Authenticated users can do everything" on administrators
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- To make yourself an admin, run:
-- INSERT INTO administrators (user_id, name, email)
-- SELECT id, 'Your Name', email FROM auth.users WHERE email = 'your@email.com';
