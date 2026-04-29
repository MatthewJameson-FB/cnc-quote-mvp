-- Lightweight commercial tracking for quotes and supplier lead fees.
-- Notes:
-- - Kept additive and nullable to avoid breaking existing flows.
-- - `supplier_id` is text because no `suppliers` table/reference was found in this project.
-- - Suggested `quote_status` values:
--   submitted, estimate_accepted, sent_to_supplier, supplier_accepted,
--   customer_accepted, invoice_sent, paid, completed, lost
-- - Suggested `supplier_fee_status` values:
--   not_due, due, invoiced, paid, waived

alter table public.quotes
  add column if not exists quote_status text,
  add column if not exists supplier_id text,
  add column if not exists supplier_fee_status text,
  add column if not exists supplier_fee_amount numeric,
  add column if not exists customer_estimate_min numeric,
  add column if not exists customer_estimate_max numeric,
  add column if not exists final_quote_amount numeric,
  add column if not exists invoice_reference text,
  add column if not exists paid_at timestamp with time zone;
