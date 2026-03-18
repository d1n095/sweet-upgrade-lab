
-- Allow admins to manage volume_discounts
CREATE POLICY "Admins can manage volume discounts"
  ON public.volume_discounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anyone to read volume discounts (needed for cart calculations)
CREATE POLICY "Anyone can read volume discounts"
  ON public.volume_discounts FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow admins to manage bundles
CREATE POLICY "Admins can manage bundles"
  ON public.bundles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage bundle_items
CREATE POLICY "Admins can manage bundle items"
  ON public.bundle_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
