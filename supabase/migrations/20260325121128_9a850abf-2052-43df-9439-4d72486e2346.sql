-- Add receipt_url column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_url text;

-- Create private storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Staff can read receipts
CREATE POLICY "Staff can read receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND public.is_staff(auth.uid())
);

-- Service role can insert receipts (edge functions use service role, so this covers it)
CREATE POLICY "Service role can insert receipts"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'receipts');

-- Users can read their own receipts (folder = user_id)
CREATE POLICY "Users can read own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);