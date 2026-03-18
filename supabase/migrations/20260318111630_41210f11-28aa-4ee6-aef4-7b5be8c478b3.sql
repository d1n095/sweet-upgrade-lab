
-- Business accounts table
CREATE TABLE public.business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text NOT NULL,
  org_number text NOT NULL,
  vat_number text,
  company_address text,
  contact_person text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(org_number)
);

ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own business account
CREATE POLICY "Users can view own business account"
  ON public.business_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own business account
CREATE POLICY "Users can create own business account"
  ON public.business_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending business account
CREATE POLICY "Users can update own business account"
  ON public.business_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can manage all business accounts
CREATE POLICY "Admins can manage all business accounts"
  ON public.business_accounts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add search_logs SELECT for admins
CREATE POLICY "Admins can view search logs"
  ON public.search_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
