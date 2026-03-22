
-- Module-based permissions system
-- Maps roles to modules with granular access control

CREATE TABLE IF NOT EXISTS public.role_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_read boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, module)
);

ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins/founders can read permissions
CREATE POLICY "Staff can read permissions"
ON public.role_module_permissions FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Only founders can modify permissions
CREATE POLICY "Founders can manage permissions"
ON public.role_module_permissions FOR ALL
TO authenticated
USING (public.is_founder(auth.uid()))
WITH CHECK (public.is_founder(auth.uid()));

-- Seed default permissions
INSERT INTO public.role_module_permissions (role, module, can_read, can_create, can_update, can_delete) VALUES
-- founder: full access everywhere
('founder', 'orders', true, true, true, true),
('founder', 'inventory', true, true, true, true),
('founder', 'statistics', true, true, true, true),
('founder', 'donations', true, true, true, true),
('founder', 'affiliate', true, true, true, true),
('founder', 'users', true, true, true, true),
('founder', 'system', true, true, true, true),
('founder', 'finance', true, true, true, true),
('founder', 'reviews', true, true, true, true),
('founder', 'content', true, true, true, true),

-- admin: nearly full
('admin', 'orders', true, true, true, true),
('admin', 'inventory', true, true, true, true),
('admin', 'statistics', true, true, true, true),
('admin', 'donations', true, true, true, true),
('admin', 'affiliate', true, true, true, true),
('admin', 'users', true, true, true, false),
('admin', 'system', true, true, true, false),
('admin', 'finance', true, true, true, false),
('admin', 'reviews', true, true, true, true),
('admin', 'content', true, true, true, true),

-- support: customer-facing
('support', 'orders', true, false, true, false),
('support', 'inventory', false, false, false, false),
('support', 'statistics', false, false, false, false),
('support', 'donations', false, false, false, false),
('support', 'affiliate', false, false, false, false),
('support', 'users', true, false, false, false),
('support', 'system', false, false, false, false),
('support', 'finance', false, false, false, false),
('support', 'reviews', true, false, true, false),
('support', 'content', false, false, false, false),

-- warehouse: stock + packing
('warehouse', 'orders', true, false, true, false),
('warehouse', 'inventory', true, false, true, false),
('warehouse', 'statistics', false, false, false, false),
('warehouse', 'donations', false, false, false, false),
('warehouse', 'affiliate', false, false, false, false),
('warehouse', 'users', false, false, false, false),
('warehouse', 'system', false, false, false, false),
('warehouse', 'finance', false, false, false, false),
('warehouse', 'reviews', false, false, false, false),
('warehouse', 'content', false, false, false, false),

-- marketing: growth + data
('marketing', 'orders', false, false, false, false),
('marketing', 'inventory', true, false, false, false),
('marketing', 'statistics', true, false, false, false),
('marketing', 'donations', true, true, true, false),
('marketing', 'affiliate', true, false, true, false),
('marketing', 'users', false, false, false, false),
('marketing', 'system', false, false, false, false),
('marketing', 'finance', false, false, false, false),
('marketing', 'reviews', true, false, false, false),
('marketing', 'content', true, true, true, false),

-- finance: money
('finance', 'orders', true, false, false, false),
('finance', 'inventory', false, false, false, false),
('finance', 'statistics', true, false, false, false),
('finance', 'donations', true, false, false, false),
('finance', 'affiliate', true, false, true, false),
('finance', 'users', false, false, false, false),
('finance', 'system', false, false, false, false),
('finance', 'finance', true, true, true, false),
('finance', 'reviews', false, false, false, false),
('finance', 'content', false, false, false, false),

-- moderator: content + reviews
('moderator', 'orders', true, false, true, false),
('moderator', 'inventory', true, false, false, false),
('moderator', 'statistics', false, false, false, false),
('moderator', 'donations', false, false, false, false),
('moderator', 'affiliate', false, false, false, false),
('moderator', 'users', true, false, false, false),
('moderator', 'system', false, false, false, false),
('moderator', 'finance', false, false, false, false),
('moderator', 'reviews', true, true, true, true),
('moderator', 'content', true, true, true, false),

-- manager
('manager', 'orders', true, true, true, false),
('manager', 'inventory', true, true, true, false),
('manager', 'statistics', true, false, false, false),
('manager', 'donations', true, true, true, false),
('manager', 'affiliate', true, true, true, false),
('manager', 'users', true, false, true, false),
('manager', 'system', false, false, false, false),
('manager', 'finance', true, false, false, false),
('manager', 'reviews', true, true, true, false),
('manager', 'content', true, true, true, false),

-- it
('it', 'orders', true, false, false, false),
('it', 'inventory', true, false, false, false),
('it', 'statistics', true, false, false, false),
('it', 'donations', false, false, false, false),
('it', 'affiliate', false, false, false, false),
('it', 'users', true, true, true, false),
('it', 'system', true, true, true, true),
('it', 'finance', false, false, false, false),
('it', 'reviews', false, false, false, false),
('it', 'content', false, false, false, false);

-- Helper function to check module permission
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid,
  _module text,
  _action text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_module_permissions rmp ON rmp.role = ur.role::text
    WHERE ur.user_id = _user_id
      AND rmp.module = _module
      AND (
        (_action = 'read' AND rmp.can_read) OR
        (_action = 'create' AND rmp.can_create) OR
        (_action = 'update' AND rmp.can_update) OR
        (_action = 'delete' AND rmp.can_delete)
      )
  )
$$;
