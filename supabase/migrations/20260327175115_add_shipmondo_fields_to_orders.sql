-- Add Shipmondo shipment fields to orders
-- shipment_id returned by Shipmondo API
-- label_url for the printable shipping label (PDF data URI or file URL)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipmondo_shipment_id text,
  ADD COLUMN IF NOT EXISTS label_url text;
