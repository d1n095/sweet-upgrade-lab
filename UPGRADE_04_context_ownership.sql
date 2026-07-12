-- =====================================================================
-- MY MONEY MASTER — UPGRADE 04: KONTEXT-ÄGARSKAP PÅ ALLA OBJEKT (ADR-002)
-- =====================================================================
-- Lägger owner_context_id på alla objekt-tabeller, backfillar från
-- användarens personliga kontext, och byter RLS till kontext-baserad.
-- Genererad programmatiskt för konsistens. Idempotent.
-- OBS: user_id BEHÅLLS som "created_by" (audit), men ÄGARSKAP = kontext.
-- =====================================================================

-- ---- absences ----
ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.absences o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_absences_owner_ctx ON public.absences(owner_context_id);
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.absences;
DROP POLICY IF EXISTS "own absences all" ON public.absences;
DROP POLICY IF EXISTS "ctx access absences" ON public.absences;
CREATE POLICY "ctx access absences" ON public.absences FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- ai_memory ----
ALTER TABLE public.ai_memory ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.ai_memory o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_ai_memory_owner_ctx ON public.ai_memory(owner_context_id);
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.ai_memory;
DROP POLICY IF EXISTS "own ai_memory all" ON public.ai_memory;
DROP POLICY IF EXISTS "ctx access ai_memory" ON public.ai_memory;
CREATE POLICY "ctx access ai_memory" ON public.ai_memory FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- documents ----
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.documents o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_documents_owner_ctx ON public.documents(owner_context_id);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.documents;
DROP POLICY IF EXISTS "own documents all" ON public.documents;
DROP POLICY IF EXISTS "ctx access documents" ON public.documents;
CREATE POLICY "ctx access documents" ON public.documents FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- expenses ----
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.expenses o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_expenses_owner_ctx ON public.expenses(owner_context_id);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.expenses;
DROP POLICY IF EXISTS "own expenses all" ON public.expenses;
DROP POLICY IF EXISTS "ctx access expenses" ON public.expenses;
CREATE POLICY "ctx access expenses" ON public.expenses FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- holiday_rules ----
ALTER TABLE public.holiday_rules ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.holiday_rules o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_holiday_rules_owner_ctx ON public.holiday_rules(owner_context_id);
ALTER TABLE public.holiday_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.holiday_rules;
DROP POLICY IF EXISTS "own holiday_rules all" ON public.holiday_rules;
DROP POLICY IF EXISTS "ctx access holiday_rules" ON public.holiday_rules;
CREATE POLICY "ctx access holiday_rules" ON public.holiday_rules FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- import_batches ----
ALTER TABLE public.import_batches ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.import_batches o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_import_batches_owner_ctx ON public.import_batches(owner_context_id);
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.import_batches;
DROP POLICY IF EXISTS "own import_batches all" ON public.import_batches;
DROP POLICY IF EXISTS "ctx access import_batches" ON public.import_batches;
CREATE POLICY "ctx access import_batches" ON public.import_batches FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- ocr_fields ----
ALTER TABLE public.ocr_fields ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.ocr_fields o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_ocr_fields_owner_ctx ON public.ocr_fields(owner_context_id);
ALTER TABLE public.ocr_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.ocr_fields;
DROP POLICY IF EXISTS "own ocr_fields all" ON public.ocr_fields;
DROP POLICY IF EXISTS "ctx access ocr_fields" ON public.ocr_fields;
CREATE POLICY "ctx access ocr_fields" ON public.ocr_fields FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- pay_periods ----
ALTER TABLE public.pay_periods ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.pay_periods o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_pay_periods_owner_ctx ON public.pay_periods(owner_context_id);
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.pay_periods;
DROP POLICY IF EXISTS "own pay_periods all" ON public.pay_periods;
DROP POLICY IF EXISTS "ctx access pay_periods" ON public.pay_periods;
CREATE POLICY "ctx access pay_periods" ON public.pay_periods FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- pay_recompute_log ----
ALTER TABLE public.pay_recompute_log ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.pay_recompute_log o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_pay_recompute_log_owner_ctx ON public.pay_recompute_log(owner_context_id);
ALTER TABLE public.pay_recompute_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.pay_recompute_log;
DROP POLICY IF EXISTS "own pay_recompute_log all" ON public.pay_recompute_log;
DROP POLICY IF EXISTS "ctx access pay_recompute_log" ON public.pay_recompute_log;
CREATE POLICY "ctx access pay_recompute_log" ON public.pay_recompute_log FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- payslips ----
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.payslips o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_payslips_owner_ctx ON public.payslips(owner_context_id);
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.payslips;
DROP POLICY IF EXISTS "own payslips all" ON public.payslips;
DROP POLICY IF EXISTS "ctx access payslips" ON public.payslips;
CREATE POLICY "ctx access payslips" ON public.payslips FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- reminders ----
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.reminders o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_reminders_owner_ctx ON public.reminders(owner_context_id);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.reminders;
DROP POLICY IF EXISTS "own reminders all" ON public.reminders;
DROP POLICY IF EXISTS "ctx access reminders" ON public.reminders;
CREATE POLICY "ctx access reminders" ON public.reminders FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- rotations ----
ALTER TABLE public.rotations ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.rotations o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_rotations_owner_ctx ON public.rotations(owner_context_id);
ALTER TABLE public.rotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.rotations;
DROP POLICY IF EXISTS "own rotations all" ON public.rotations;
DROP POLICY IF EXISTS "ctx access rotations" ON public.rotations;
CREATE POLICY "ctx access rotations" ON public.rotations FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- shift_templates ----
ALTER TABLE public.shift_templates ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.shift_templates o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_shift_templates_owner_ctx ON public.shift_templates(owner_context_id);
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.shift_templates;
DROP POLICY IF EXISTS "own shift_templates all" ON public.shift_templates;
DROP POLICY IF EXISTS "ctx access shift_templates" ON public.shift_templates;
CREATE POLICY "ctx access shift_templates" ON public.shift_templates FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- shifts ----
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.shifts o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_shifts_owner_ctx ON public.shifts(owner_context_id);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.shifts;
DROP POLICY IF EXISTS "own shifts all" ON public.shifts;
DROP POLICY IF EXISTS "ctx access shifts" ON public.shifts;
CREATE POLICY "ctx access shifts" ON public.shifts FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- signals ----
ALTER TABLE public.signals ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.signals o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_signals_owner_ctx ON public.signals(owner_context_id);
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.signals;
DROP POLICY IF EXISTS "own signals all" ON public.signals;
DROP POLICY IF EXISTS "ctx access signals" ON public.signals;
CREATE POLICY "ctx access signals" ON public.signals FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- user_defaults ----
ALTER TABLE public.user_defaults ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.user_defaults o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_user_defaults_owner_ctx ON public.user_defaults(owner_context_id);
ALTER TABLE public.user_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.user_defaults;
DROP POLICY IF EXISTS "own user_defaults all" ON public.user_defaults;
DROP POLICY IF EXISTS "ctx access user_defaults" ON public.user_defaults;
CREATE POLICY "ctx access user_defaults" ON public.user_defaults FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- vacation_balance ----
ALTER TABLE public.vacation_balance ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.vacation_balance o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_vacation_balance_owner_ctx ON public.vacation_balance(owner_context_id);
ALTER TABLE public.vacation_balance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.vacation_balance;
DROP POLICY IF EXISTS "own vacation_balance all" ON public.vacation_balance;
DROP POLICY IF EXISTS "ctx access vacation_balance" ON public.vacation_balance;
CREATE POLICY "ctx access vacation_balance" ON public.vacation_balance FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- weekly_patterns ----
ALTER TABLE public.weekly_patterns ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.weekly_patterns o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_weekly_patterns_owner_ctx ON public.weekly_patterns(owner_context_id);
ALTER TABLE public.weekly_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.weekly_patterns;
DROP POLICY IF EXISTS "own weekly_patterns all" ON public.weekly_patterns;
DROP POLICY IF EXISTS "ctx access weekly_patterns" ON public.weekly_patterns;
CREATE POLICY "ctx access weekly_patterns" ON public.weekly_patterns FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- work_profiles ----
ALTER TABLE public.work_profiles ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.work_profiles o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_work_profiles_owner_ctx ON public.work_profiles(owner_context_id);
ALTER TABLE public.work_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.work_profiles;
DROP POLICY IF EXISTS "own work_profiles all" ON public.work_profiles;
DROP POLICY IF EXISTS "ctx access work_profiles" ON public.work_profiles;
CREATE POLICY "ctx access work_profiles" ON public.work_profiles FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- workplaces ----
ALTER TABLE public.workplaces ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.workplaces o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_workplaces_owner_ctx ON public.workplaces(owner_context_id);
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.workplaces;
DROP POLICY IF EXISTS "own workplaces all" ON public.workplaces;
DROP POLICY IF EXISTS "ctx access workplaces" ON public.workplaces;
CREATE POLICY "ctx access workplaces" ON public.workplaces FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---- timeline_events ----
ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE;
UPDATE public.timeline_events o SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = o.user_id AND cm.status = 'active'
    AND cm.role = 'owner'
    AND o.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');
CREATE INDEX IF NOT EXISTS idx_timeline_events_owner_ctx ON public.timeline_events(owner_context_id);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows only" ON public.timeline_events;
DROP POLICY IF EXISTS "own timeline_events all" ON public.timeline_events;
DROP POLICY IF EXISTS "ctx access timeline_events" ON public.timeline_events;
CREATE POLICY "ctx access timeline_events" ON public.timeline_events FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- =====================================================================
-- KLART. Alla objekt ägs nu av kontext. RLS accepterar antingen
-- kontext-medlemskap ELLER (bakåtsäkert) user_id = auth.uid() så inget
-- lås ut sker under övergången. När all kod satts att skriva
-- owner_context_id kan user_id-grenen tas bort (UPGRADE senare).
-- =====================================================================
