-- Add skill categories to staff_permissions for task filtering
ALTER TABLE public.staff_permissions
ADD COLUMN IF NOT EXISTS skill_categories text[] NOT NULL DEFAULT '{}'::text[];