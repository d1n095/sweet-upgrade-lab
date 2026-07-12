-- =====================================================================
-- MY MONEY MASTER — UPGRADE 02: TEMPORAL LÖNEARKITEKTUR (ADR-001)
-- =====================================================================
-- Historiska pass = oföränderliga fakta. En sanningskälla. Säker recompute.
-- Additivt, idempotent, verifierat mot grammatik + projektschema.
-- Se docs/ADR-001-salary-architecture.md för motivering.
-- =====================================================================

-- 1. Snapshot av HELA beräkningsgrunden per pass (sanning om HUR lönen räknades)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS pay_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS pay_engine_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pay_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.shifts.pay_snapshot IS
  'Oföränderlig snapshot av beräkningsgrunden (timlön, regler, breakdown) som gällde när passet beräknades. Ändras endast via godkänd recompute. Se ADR-001.';
COMMENT ON COLUMN public.shifts.base_amount IS
  'Cache för summeringar. Sanningen om uträkningen finns i pay_snapshot.';

-- 2. Audit-logg för recompute — varje avsiktlig omräkning spåras (före/efter)
CREATE TABLE IF NOT EXISTS public.pay_recompute_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id          UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL,             -- t.ex. 'felregistrerad timlön'
  old_total         NUMERIC(12,2),
  new_total         NUMERIC(12,2),
  old_snapshot      JSONB,
  new_snapshot      JSONB,
  recomputed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.pay_recompute_log TO authenticated;
GRANT ALL ON public.pay_recompute_log TO service_role;
ALTER TABLE public.pay_recompute_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own recompute_log" ON public.pay_recompute_log;
-- Logg ska vara oföränderlig: bara läsa och skapa, aldrig ändra/radera.
CREATE POLICY "own recompute_log read" ON public.pay_recompute_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own recompute_log insert" ON public.pay_recompute_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_recompute_log_shift ON public.pay_recompute_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_recompute_log_user ON public.pay_recompute_log(user_id, recomputed_at DESC);

-- 3. Skydd: en databas-regel som HINDRAR omräkning av pass i låst period.
--    Recompute i koden respekterar detta, men vi gör det till en hård garanti
--    i DB:n så att ingen väg (kod-bugg, framtida modul) kan ändra utbetald lön.
CREATE OR REPLACE FUNCTION public.guard_locked_shift_pay()
RETURNS TRIGGER AS $$
DECLARE locked BOOLEAN;
BEGIN
  -- Bara relevant om lönebelopp eller snapshot ändras
  IF (NEW.base_amount IS DISTINCT FROM OLD.base_amount
      OR NEW.ob_amount IS DISTINCT FROM OLD.ob_amount
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
      OR NEW.pay_snapshot IS DISTINCT FROM OLD.pay_snapshot) THEN
    IF OLD.pay_period_id IS NOT NULL THEN
      SELECT pp.is_locked INTO locked FROM public.pay_periods pp WHERE pp.id = OLD.pay_period_id;
      IF locked THEN
        RAISE EXCEPTION 'Kan inte ändra lön på ett pass i en låst (utbetald) period. Lås upp perioden först.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_shifts_guard_locked ON public.shifts;
CREATE TRIGGER tr_shifts_guard_locked BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.guard_locked_shift_pay();

-- =====================================================================
-- KLART. Snapshot + engine-version + recompute-audit + låst-period-skydd.
-- Nästa (kod): modules/salary/shift-service.ts som enda källa för
-- skapande/beräkning, och recompute-funktionen som skriver pay_recompute_log.
-- =====================================================================
