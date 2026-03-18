-- Allow founders to delete search_logs
CREATE POLICY "Founders can delete search_logs"
ON public.search_logs
FOR DELETE
TO authenticated
USING (is_founder(auth.uid()));

-- Allow founders to delete analytics_events
CREATE POLICY "Founders can delete analytics_events"
ON public.analytics_events
FOR DELETE
TO authenticated
USING (is_founder(auth.uid()));

-- Allow founders to delete product_sales (already has admin ALL, but ensure delete works)
-- product_sales already has admin ALL policy so it should work
