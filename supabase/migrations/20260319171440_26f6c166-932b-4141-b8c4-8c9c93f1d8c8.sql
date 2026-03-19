-- Add soft-delete column to orders
ALTER TABLE public.orders ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for filtering active orders
CREATE INDEX idx_orders_deleted_at ON public.orders (deleted_at) WHERE deleted_at IS NULL;

-- Allow employees (moderators/support) to view orders (read-only)
CREATE POLICY "Staff can view all orders"
ON public.orders
FOR SELECT
USING (is_staff(auth.uid()));

-- Allow staff to view activity logs for audit
CREATE POLICY "Staff can view order activity logs"
ON public.activity_logs
FOR SELECT
USING (is_staff(auth.uid()));