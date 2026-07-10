-- Migration: Invoice Settings — Bank Name, GST, Payment Terms
-- Run this in Supabase SQL Editor

-- 1. New Provider settings needed for the redesigned invoice
alter table providers
  add column if not exists bank_name text,
  add column if not exists gst_rate numeric(5,2) default 10.00,
  add column if not exists invoice_days_due integer default 14;

-- 2. Store the GST breakdown on the invoice itself (not just the final total),
-- so it can be redisplayed later without recalculating from a possibly-changed
-- provider GST rate.
alter table invoices
  add column if not exists subtotal_amount numeric(10,2),
  add column if not exists gst_amount numeric(10,2);
