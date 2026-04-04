-- ─── RBAC RLS Policies ───
-- Full row-level security for staff_permissions, role_templates,
-- role_module_permissions, and all key admin tables.

-- ══════════════════════════════════════════════
-- staff_permissions
-- ══════════════════════════════════════════════
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_permissions'
    AND policyname='Founders and admins can manage staff_permissions'
  ) THEN
    CREATE POLICY "Founders and admins can manage staff_permissions"
      ON public.staff_permissions FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_permissions'
    AND policyname='Staff can read own permissions'
  ) THEN
    CREATE POLICY "Staff can read own permissions"
      ON public.staff_permissions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- role_templates
-- ══════════════════════════════════════════════
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_templates'
    AND policyname='Founders can manage role_templates'
  ) THEN
    CREATE POLICY "Founders can manage role_templates"
      ON public.role_templates FOR ALL
      TO authenticated
      USING (public.is_founder(auth.uid()))
      WITH CHECK (public.is_founder(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_templates'
    AND policyname='Staff can read role_templates'
  ) THEN
    CREATE POLICY "Staff can read role_templates"
      ON public.role_templates FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- role_module_permissions
-- ══════════════════════════════════════════════
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_module_permissions'
    AND policyname='Founders can manage role_module_permissions'
  ) THEN
    CREATE POLICY "Founders can manage role_module_permissions"
      ON public.role_module_permissions FOR ALL
      TO authenticated
      USING (public.is_founder(auth.uid()))
      WITH CHECK (public.is_founder(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='role_module_permissions'
    AND policyname='Staff can read role_module_permissions'
  ) THEN
    CREATE POLICY "Staff can read role_module_permissions"
      ON public.role_module_permissions FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- work_items (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_items'
    AND policyname='Staff can read work_items'
  ) THEN
    CREATE POLICY "Staff can read work_items"
      ON public.work_items FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_items'
    AND policyname='Admins can manage work_items'
  ) THEN
    CREATE POLICY "Admins can manage work_items"
      ON public.work_items FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- work_item_history (admin audit table)
-- ══════════════════════════════════════════════
ALTER TABLE public.work_item_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_item_history'
    AND policyname='Staff can read work_item_history'
  ) THEN
    CREATE POLICY "Staff can read work_item_history"
      ON public.work_item_history FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='work_item_history'
    AND policyname='Admins can insert work_item_history'
  ) THEN
    CREATE POLICY "Admins can insert work_item_history"
      ON public.work_item_history FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- staff_tasks (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_tasks'
    AND policyname='Staff can read staff_tasks'
  ) THEN
    CREATE POLICY "Staff can read staff_tasks"
      ON public.staff_tasks FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_tasks'
    AND policyname='Admins can manage staff_tasks'
  ) THEN
    CREATE POLICY "Admins can manage staff_tasks"
      ON public.staff_tasks FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- staff_performance (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.staff_performance ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_performance'
    AND policyname='Staff can read own performance'
  ) THEN
    CREATE POLICY "Staff can read own performance"
      ON public.staff_performance FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='staff_performance'
    AND policyname='Admins can manage staff_performance'
  ) THEN
    CREATE POLICY "Admins can manage staff_performance"
      ON public.staff_performance FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- scan_runs (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.scan_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scan_runs'
    AND policyname='Staff can read scan_runs'
  ) THEN
    CREATE POLICY "Staff can read scan_runs"
      ON public.scan_runs FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scan_runs'
    AND policyname='Admins can manage scan_runs'
  ) THEN
    CREATE POLICY "Admins can manage scan_runs"
      ON public.scan_runs FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- scan_results (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scan_results'
    AND policyname='Staff can read scan_results'
  ) THEN
    CREATE POLICY "Staff can read scan_results"
      ON public.scan_results FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='scan_results'
    AND policyname='Admins can manage scan_results'
  ) THEN
    CREATE POLICY "Admins can manage scan_results"
      ON public.scan_results FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- automation_rules (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_rules'
    AND policyname='Admins can manage automation_rules'
  ) THEN
    CREATE POLICY "Admins can manage automation_rules"
      ON public.automation_rules FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- automation_logs (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='automation_logs'
    AND policyname='Admins can read automation_logs'
  ) THEN
    CREATE POLICY "Admins can read automation_logs"
      ON public.automation_logs FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- change_log (admin audit table)
-- ══════════════════════════════════════════════
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='change_log'
    AND policyname='Staff can read change_log'
  ) THEN
    CREATE POLICY "Staff can read change_log"
      ON public.change_log FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='change_log'
    AND policyname='Admins can insert change_log'
  ) THEN
    CREATE POLICY "Admins can insert change_log"
      ON public.change_log FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- activity_logs (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_logs'
    AND policyname='Staff can read activity_logs'
  ) THEN
    CREATE POLICY "Staff can read activity_logs"
      ON public.activity_logs FOR SELECT
      TO authenticated
      USING (public.is_staff(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_logs'
    AND policyname='Authenticated can insert activity_logs'
  ) THEN
    CREATE POLICY "Authenticated can insert activity_logs"
      ON public.activity_logs FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- access_audit_log (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.access_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='access_audit_log'
    AND policyname='Admins can read access_audit_log'
  ) THEN
    CREATE POLICY "Admins can read access_audit_log"
      ON public.access_audit_log FOR SELECT
      TO authenticated
      USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='access_audit_log'
    AND policyname='Authenticated can insert access_audit_log'
  ) THEN
    CREATE POLICY "Authenticated can insert access_audit_log"
      ON public.access_audit_log FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- store_settings (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings'
    AND policyname='Anyone can read store_settings'
  ) THEN
    CREATE POLICY "Anyone can read store_settings"
      ON public.store_settings FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings'
    AND policyname='Admins can manage store_settings'
  ) THEN
    CREATE POLICY "Admins can manage store_settings"
      ON public.store_settings FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- email_templates (admin table)
-- ══════════════════════════════════════════════
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='store_settings'
    AND policyname='Admins can manage email_templates'
  ) THEN
    CREATE POLICY "Admins can manage email_templates"
      ON public.email_templates FOR ALL
      TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;
