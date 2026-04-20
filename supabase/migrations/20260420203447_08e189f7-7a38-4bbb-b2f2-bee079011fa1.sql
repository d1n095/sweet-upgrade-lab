-- Replace overly broad FOR ALL policies with operation-specific ones
DROP POLICY IF EXISTS "product_stats writable by admins" ON public.product_stats;
DROP POLICY IF EXISTS "price_history writable by admins" ON public.price_history;

-- product_stats: explicit per-operation admin policies
CREATE POLICY "product_stats insert by admins"
  ON public.product_stats FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "product_stats update by admins"
  ON public.product_stats FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "product_stats delete by admins"
  ON public.product_stats FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- price_history: append-only — admins can insert and delete, no updates
CREATE POLICY "price_history insert by admins"
  ON public.price_history FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "price_history delete by admins"
  ON public.price_history FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));