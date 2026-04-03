-- ─── RBAC Enterprise Upgrade ───
-- Adds granular permissions jsonb, audit_logs table, and RLS hardening
-- Additive only — no existing columns are removed or changed

-- 1. Add granular permissions jsonb to role_templates (additive)
ALTER TABLE public.role_templates
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed permissions jsonb from existing default_modules for all existing templates
-- Format: { module: { read, write, delete, approve } }
UPDATE public.role_templates SET permissions = (
  SELECT jsonb_object_agg(
    m,
    CASE
      WHEN role_key = 'founder' THEN '{"read":true,"write":true,"delete":true,"approve":true}'::jsonb
      WHEN role_key IN ('admin','it') THEN '{"read":true,"write":true,"delete":false,"approve":true}'::jsonb
      WHEN role_key = 'manager' THEN '{"read":true,"write":true,"delete":false,"approve":false}'::jsonb
      ELSE '{"read":true,"write":false,"delete":false,"approve":false}'::jsonb
    END
  )
  FROM unnest(default_modules) AS m
)
WHERE permissions = '{}'::jsonb OR permissions IS NULL;

-- 2. Add granular permissions jsonb to staff_permissions (additive)
ALTER TABLE public.staff_permissions
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed from existing allowed_modules (read-only for existing records)
UPDATE public.staff_permissions SET permissions = (
  SELECT jsonb_object_agg(m, '{"read":true,"write":false,"delete":false,"approve":false}'::jsonb)
  FROM unnest(allowed_modules) AS m
)
WHERE permissions = '{}'::jsonb OR permissions IS NULL;

-- 3. Create audit_logs table for RBAC-specific audit trail
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only founders/admins can read audit logs
CREATE POLICY IF NOT EXISTS "Staff can read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- Any authenticated user can insert (for frontend writes)
CREATE POLICY IF NOT EXISTS "Authenticated can insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

-- 4. Ensure RLS is enabled on all sensitive tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- 5. user_roles: add missing policies if not present
-- Founders and admins can manage all roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Founders and admins can manage user_roles'
  ) THEN
    CREATE POLICY "Founders and admins can manage user_roles"
      ON public.user_roles FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'founder')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'founder')
        )
      );
  END IF;
END $$;

-- Staff can view their own role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users can view own role'
  ) THEN
    CREATE POLICY "Users can view own role"
      ON public.user_roles FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
