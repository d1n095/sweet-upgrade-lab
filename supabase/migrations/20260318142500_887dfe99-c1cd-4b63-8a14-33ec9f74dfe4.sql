
DROP POLICY IF EXISTS "Admins can manage volume discounts" ON public.volume_discounts;
DROP POLICY IF EXISTS "Anyone can view volume discounts" ON public.volume_discounts;

CREATE POLICY "Admins can manage volume discounts"
  ON public.volume_discounts
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view volume discounts"
  ON public.volume_discounts
  FOR SELECT
  TO anon, authenticated
  USING (true);
