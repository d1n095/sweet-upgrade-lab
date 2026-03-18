
-- Staff permissions table: controls which admin modules each user can access
CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed_modules text[] NOT NULL DEFAULT '{}',
  notes text,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Helper: check if user is founder
CREATE OR REPLACE FUNCTION public.is_founder(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'founder'
  )
$$;

-- Only founders can manage staff permissions
CREATE POLICY "Founders can do everything on staff_permissions"
  ON public.staff_permissions FOR ALL
  USING (public.is_founder(auth.uid()))
  WITH CHECK (public.is_founder(auth.uid()));

-- Admins (non-founder) can view their own permissions
CREATE POLICY "Users can view own staff permissions"
  ON public.staff_permissions FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_staff_permissions_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
