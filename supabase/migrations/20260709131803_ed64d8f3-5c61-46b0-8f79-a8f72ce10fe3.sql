
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_prebuy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prebuy_release_date date,
  ADD COLUMN IF NOT EXISTS prebuy_note_sv text,
  ADD COLUMN IF NOT EXISTS prebuy_note_en text;

CREATE TABLE IF NOT EXISTS public.prebuy_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text,
  phone text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 20),
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prebuy_reservations TO authenticated;
GRANT ALL ON public.prebuy_reservations TO service_role;

ALTER TABLE public.prebuy_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage prebuy reservations" ON public.prebuy_reservations;
CREATE POLICY "Staff can manage prebuy reservations"
  ON public.prebuy_reservations FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Users read own prebuy reservations" ON public.prebuy_reservations;
CREATE POLICY "Users read own prebuy reservations"
  ON public.prebuy_reservations FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prebuy_reservations_product ON public.prebuy_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_prebuy_reservations_email ON public.prebuy_reservations(email);
