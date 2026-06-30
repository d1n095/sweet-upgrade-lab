
-- =====================================================================
-- DONATIONS + PERMISSIONS HARDENING
-- =====================================================================

-- 1. Helper: finance OR founder
CREATE OR REPLACE FUNCTION public.is_finance_or_founder(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('founder','finance')
  )
$$;

-- 2. donations: add project_id
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.donation_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_donations_project_id ON public.donations(project_id);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON public.donations(created_at DESC);

-- 3. Trigger: anonymous donations must not store user_id
CREATE OR REPLACE FUNCTION public.enforce_donation_anonymity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_anonymous = true THEN
    NEW.user_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_donation_anonymity ON public.donations;
CREATE TRIGGER trg_enforce_donation_anonymity
  BEFORE INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_donation_anonymity();

-- 4. Trigger: auto-update donation_projects.current_amount
CREATE OR REPLACE FUNCTION public.recalc_project_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project uuid;
BEGIN
  v_project := COALESCE(NEW.project_id, OLD.project_id);
  IF v_project IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.donation_projects
    SET current_amount = COALESCE((
      SELECT SUM(amount) FROM public.donations WHERE project_id = v_project
    ), 0),
    updated_at = now()
    WHERE id = v_project;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_project_amount ON public.donations;
CREATE TRIGGER trg_recalc_project_amount
  AFTER INSERT OR UPDATE OR DELETE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.recalc_project_amount();

-- 5. Audit trigger on donation_projects
CREATE OR REPLACE FUNCTION public.log_donation_project_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (log_type, category, message, details, user_id)
  VALUES (
    'audit', 'donation_project',
    TG_OP || ': ' || COALESCE(NEW.name, OLD.name),
    jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW)),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_donation_project_change ON public.donation_projects;
CREATE TRIGGER trg_log_donation_project_change
  AFTER INSERT OR UPDATE OR DELETE ON public.donation_projects
  FOR EACH ROW EXECUTE FUNCTION public.log_donation_project_change();

-- 6. Retention: anonymise donations older than 7 years
CREATE OR REPLACE FUNCTION public.anonymise_old_donations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.donations
     SET user_id = NULL, is_anonymous = true
   WHERE created_at < now() - INTERVAL '7 years'
     AND (user_id IS NOT NULL OR is_anonymous = false);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 7. Tighten donations RLS: founder + finance only
DROP POLICY IF EXISTS "Admins can view all donations" ON public.donations;
DROP POLICY IF EXISTS "Admins can delete donations" ON public.donations;

CREATE POLICY "Finance & founder can view donations"
  ON public.donations FOR SELECT
  USING (is_finance_or_founder(auth.uid()));

CREATE POLICY "Founder can delete donations"
  ON public.donations FOR DELETE
  USING (is_founder(auth.uid()));

CREATE POLICY "Founder can update donations"
  ON public.donations FOR UPDATE
  USING (is_founder(auth.uid()))
  WITH CHECK (is_founder(auth.uid()));

-- 8. Tighten donation_projects RLS
DROP POLICY IF EXISTS "Admins can manage donation projects" ON public.donation_projects;

CREATE POLICY "Finance & founder can manage projects"
  ON public.donation_projects FOR ALL
  USING (is_finance_or_founder(auth.uid()))
  WITH CHECK (is_finance_or_founder(auth.uid()));

-- 9. Privilege escalation guard on user_roles
DROP POLICY IF EXISTS "Founders can manage all user_roles" ON public.user_roles;

CREATE POLICY "Founder full access on user_roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (is_founder(auth.uid()))
  WITH CHECK (is_founder(auth.uid()));

-- Audit any role mutation
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (log_type, category, message, details, user_id)
  VALUES (
    'audit', 'user_role',
    TG_OP || ': ' || COALESCE(NEW.role::text, OLD.role::text),
    jsonb_build_object(
      'target_user', COALESCE(NEW.user_id, OLD.user_id),
      'before', to_jsonb(OLD), 'after', to_jsonb(NEW)
    ),
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_user_role_change ON public.user_roles;
CREATE TRIGGER trg_log_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();
