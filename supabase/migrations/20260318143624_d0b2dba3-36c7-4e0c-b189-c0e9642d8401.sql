
ALTER TABLE public.volume_discounts
  ADD COLUMN requires_account boolean NOT NULL DEFAULT false,
  ADD COLUMN requirement_type text NOT NULL DEFAULT 'none',
  ADD COLUMN first_purchase_discount numeric DEFAULT NULL,
  ADD COLUMN repeat_discount numeric DEFAULT NULL,
  ADD COLUMN min_level integer DEFAULT NULL,
  ADD COLUMN max_uses_per_user integer DEFAULT NULL;
