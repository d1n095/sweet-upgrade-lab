CREATE POLICY "Admins can delete orders"
ON public.orders
FOR DELETE
USING (is_admin(auth.uid()));