-- Migration: Split Shared vs Provider-Specific Data for Clients and Workers
-- Run this in Supabase SQL Editor
--
-- clients/carers hold both personal details (name, contact, address, payment info)
-- and provider-specific settings (active, comments/notes). Since a client or worker
-- can now belong to multiple providers via the junction tables, those provider-specific
-- fields must live on the junction row instead — otherwise one provider deactivating
-- a worker deactivates them everywhere.
--
-- This migration does NOT drop clients.active / clients.comments / carers.comments —
-- application code simply stops reading/writing them. They can be dropped in a later
-- migration once all historical data has been reviewed.

-- 1. Provider-specific columns for the client relationship
alter table provider_clients add column if not exists active boolean default true;
alter table provider_clients add column if not exists notes text;
alter table provider_clients add column if not exists start_date date;
alter table provider_clients add column if not exists end_date date;

-- 2. Provider-specific columns for the worker relationship (active already exists)
alter table provider_carers add column if not exists notes text;
alter table provider_carers add column if not exists start_date date;
alter table provider_carers add column if not exists end_date date;

-- 3. Backfill provider_clients.notes / provider_carers.notes from the legacy
-- clients.comments / carers.comments columns for existing single-provider data.
-- Run ONLY if you want to carry forward existing comments as the initial notes:
-- UPDATE provider_clients pc SET notes = c.comments
-- FROM clients c WHERE c.id = pc.client_id AND pc.notes IS NULL AND c.comments IS NOT NULL;
--
-- UPDATE provider_carers pc SET notes = c.comments
-- FROM carers c WHERE c.id = pc.carer_id AND pc.notes IS NULL AND c.comments IS NOT NULL;
