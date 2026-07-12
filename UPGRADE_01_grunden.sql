-- =====================================================================
-- MY MONEY MASTER — UPPGRADERINGSMIGRATION 01: GRUNDEN (v2, härdad)
-- =====================================================================
-- Bygger VIDARE på befintlig app. Additivt och säkert.
-- v2-rättningar efter kritisk granskning:
--   - Alla CREATE TRIGGER föregås nu av DROP TRIGGER IF EXISTS (idempotent)
--   - Datamigrering profiles→work_profiles: uppdaterar ÄVEN tomma default-
--     profiler, inte bara skapar ny; rör aldrig profiler med egen lön
--   - CHECK-constraints på alla enum-lika textfält (validering)
--   - Storage-bucket 'documents' (PRIVAT) + storage-policies per användare
--   - file_url dokumenteras som storage-PATH, ej publik URL
--
-- Verifierad mot projektets EXAKTA schema + PostgreSQL-grammatiken.
-- Idempotent: kan köras om utan fel. Kör i Supabase SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- DEL A — STÄDA "LÖN PÅ TVÅ STÄLLEN" (One Source of Truth, Lag 8)
-- ---------------------------------------------------------------------
-- Lön hör till work_profiles. profiles.hourly_rate/tax_rate/ob_rules = legacy.
-- Två fall hanteras säkert och idempotent:
--   1) Användare UTAN någon work_profile och MED lön på profiles → skapa en.
--   2) Användare med en default-profil som saknar lön men vars profiles BÄR
--      lön → fyll i default-profilen (uppdatera bara NULL/0-värden).
-- Rör ALDRIG en work_profile som redan har egen lön (skriver inte över).

-- Fall 1: ingen work_profile alls → skapa default som bär över profiles-lönen
INSERT INTO public.work_profiles (user_id, name, is_default, hourly_rate, tax_rate, ob_rules)
SELECT p.id, 'Standard', true,
       COALESCE(p.hourly_rate, 0), COALESCE(p.tax_rate, 30), COALESCE(p.ob_rules, '[]'::jsonb)
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.work_profiles wp WHERE wp.user_id = p.id)
  AND (COALESCE(p.hourly_rate,0) > 0 OR p.ob_rules IS DISTINCT FROM '[]'::jsonb);

-- Fall 2: default-profil finns men saknar lön → fyll från profiles (bara tomma fält)
UPDATE public.work_profiles wp
SET hourly_rate = COALESCE(NULLIF(wp.hourly_rate,0), p.hourly_rate, 0),
    ob_rules    = CASE WHEN wp.ob_rules IS DISTINCT FROM '[]'::jsonb
                       THEN wp.ob_rules ELSE COALESCE(p.ob_rules,'[]'::jsonb) END
FROM public.profiles p
WHERE wp.user_id = p.id
  AND wp.is_default = true
  AND COALESCE(wp.hourly_rate,0) = 0
  AND COALESCE(p.hourly_rate,0) > 0;

COMMENT ON COLUMN public.profiles.hourly_rate IS 'LEGACY — lön bor på work_profiles. Läs ej. Droppas i senare migration.';
COMMENT ON COLUMN public.profiles.tax_rate     IS 'LEGACY — se work_profiles.tax_rate.';
COMMENT ON COLUMN public.profiles.ob_rules     IS 'LEGACY — se work_profiles.ob_rules.';

-- ---------------------------------------------------------------------
-- DEL B — LÖNEPERIODER (intjänat ≠ utbetalt)
-- ---------------------------------------------------------------------
ALTER TABLE public.work_profiles
  ADD COLUMN IF NOT EXISTS pay_period_start_day INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payday_day INTEGER,
  ADD COLUMN IF NOT EXISTS payday_offset_months INTEGER DEFAULT 1;

-- CHECK-constraints (idempotent via DO-block, undviker duplicerad constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wp_pay_period_start_day_chk') THEN
    ALTER TABLE public.work_profiles ADD CONSTRAINT wp_pay_period_start_day_chk
      CHECK (pay_period_start_day BETWEEN 1 AND 31);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wp_payday_day_chk') THEN
    ALTER TABLE public.work_profiles ADD CONSTRAINT wp_payday_day_chk
      CHECK (payday_day IS NULL OR payday_day BETWEEN 1 AND 31);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pay_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_profile_id  UUID NOT NULL REFERENCES public.work_profiles(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  payday_date      DATE,
  is_locked        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pay_periods_range_chk CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_periods TO authenticated;
GRANT ALL ON public.pay_periods TO service_role;
ALTER TABLE public.pay_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own pay_periods" ON public.pay_periods;
CREATE POLICY "own pay_periods" ON public.pay_periods FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tr_pay_periods_upd ON public.pay_periods;
CREATE TRIGGER tr_pay_periods_upd BEFORE UPDATE ON public.pay_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_pay_periods_profile
  ON public.pay_periods(work_profile_id, period_start);

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS pay_period_id UUID REFERENCES public.pay_periods(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_pay_period ON public.shifts(pay_period_id);

-- ---------------------------------------------------------------------
-- DEL C — DOKUMENTVAULT + enkel OCR + PRIVAT storage-bucket
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  document_type   TEXT,
  storage_path    TEXT NOT NULL,   -- PATH i privata bucketen, EJ publik URL
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       TEXT,
  ocr_text        TEXT,
  ocr_confidence  NUMERIC(4,2),
  ocr_status      TEXT NOT NULL DEFAULT 'pending',
  ai_summary      TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags            TEXT[],
  expires_at      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  CONSTRAINT documents_type_chk CHECK (document_type IS NULL OR document_type IN
    ('payslip','schema','receipt','invoice','contract','warranty','insurance','id_document','other')),
  CONSTRAINT documents_ocr_status_chk CHECK (ocr_status IN
    ('pending','processing','completed','failed'))
);
COMMENT ON COLUMN public.documents.storage_path IS 'Path i privata storage-bucketen "documents". Hämtas via signed URL — aldrig publik.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own documents" ON public.documents;
CREATE POLICY "own documents" ON public.documents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tr_documents_upd ON public.documents;
CREATE TRIGGER tr_documents_upd BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_documents_user
  ON public.documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type
  ON public.documents(user_id, document_type) WHERE deleted_at IS NULL;

-- PRIVAT storage-bucket för dokument (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage-policies: användaren når bara sin egen mapp (prefix = user_id).
-- Mönster: filer läggs som "<user_id>/<filnamn>".
DROP POLICY IF EXISTS "docs read own" ON storage.objects;
CREATE POLICY "docs read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "docs insert own" ON storage.objects;
CREATE POLICY "docs insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "docs update own" ON storage.objects;
CREATE POLICY "docs update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "docs delete own" ON storage.objects;
CREATE POLICY "docs delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.ocr_fields (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id       UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  field_name        TEXT NOT NULL,
  raw_value         TEXT,
  normalized_value  TEXT,
  confidence        NUMERIC(4,3),
  bounding_box      JSONB,
  is_verified       BOOLEAN NOT NULL DEFAULT false,
  corrected_value   TEXT,
  correction_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocr_fields TO authenticated;
GRANT ALL ON public.ocr_fields TO service_role;
ALTER TABLE public.ocr_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own ocr_fields" ON public.ocr_fields;
CREATE POLICY "own ocr_fields" ON public.ocr_fields FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ocr_fields_document ON public.ocr_fields(document_id);

-- ---------------------------------------------------------------------
-- DEL D — IMPORT-BATCHER (ångra hel import + spökpass-spårning)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_batches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id         UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  detected_type       TEXT,
  type_confidence     NUMERIC(4,3),
  confirmed_type      TEXT,
  status              TEXT NOT NULL DEFAULT 'classified',
  items_proposed      INTEGER NOT NULL DEFAULT 0,
  items_imported      INTEGER NOT NULL DEFAULT 0,
  items_skipped_dupe  INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reverted_at         TIMESTAMPTZ,
  CONSTRAINT import_batches_status_chk CHECK (status IN
    ('classified','previewing','imported','reverted','failed'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own import_batches" ON public.import_batches;
CREATE POLICY "own import_batches" ON public.import_batches FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_source_chk') THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_source_chk
      CHECK (source IN ('manual','ocr','import'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_shifts_import_batch ON public.shifts(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_active
  ON public.shifts(user_id, starts_at DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- DEL E — LÖNESPEC
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payslips (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_profile_id   UUID REFERENCES public.work_profiles(id) ON DELETE SET NULL,
  pay_period_id     UUID REFERENCES public.pay_periods(id) ON DELETE SET NULL,
  document_id       UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  gross_salary      NUMERIC(12,2),
  net_salary        NUMERIC(12,2),
  tax_amount        NUMERIC(12,2),
  ob_amount         NUMERIC(12,2),
  on_call_amount    NUMERIC(12,2),
  vacation_pay      NUMERIC(12,2),
  overtime_amount   NUMERIC(12,2),
  total_hours       NUMERIC(8,2),
  ocr_raw           TEXT,
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT payslips_range_chk CHECK (period_end >= period_start)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;
GRANT ALL ON public.payslips TO service_role;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own payslips" ON public.payslips;
CREATE POLICY "own payslips" ON public.payslips FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tr_payslips_upd ON public.payslips;
CREATE TRIGGER tr_payslips_upd BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_payslips_period
  ON public.payslips(pay_period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payslips_user
  ON public.payslips(user_id, period_start DESC) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- DEL F — ARBETSPLATSER + extrapass-kategori
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workplaces (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_profile_id  UUID NOT NULL REFERENCES public.work_profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  address          TEXT,
  travel_minutes   INTEGER,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workplaces TO authenticated;
GRANT ALL ON public.workplaces TO service_role;
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workplaces" ON public.workplaces;
CREATE POLICY "own workplaces" ON public.workplaces FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tr_workplaces_upd ON public.workplaces;
CREATE TRIGGER tr_workplaces_upd BEFORE UPDATE ON public.workplaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_workplaces_profile
  ON public.workplaces(work_profile_id) WHERE deleted_at IS NULL;

ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shift_category TEXT NOT NULL DEFAULT 'ordinary';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_category_chk') THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_category_chk
      CHECK (shift_category IN ('ordinary','extra','overtime','on_call','standby','inbeordrad'));
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- DEL G — RÖDA DAGAR
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.holiday_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  name          TEXT NOT NULL,
  holiday_type  TEXT NOT NULL DEFAULT 'red_day',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT holiday_type_chk CHECK (holiday_type IN ('red_day','eve','special'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holiday_rules TO authenticated;
GRANT ALL ON public.holiday_rules TO service_role;
ALTER TABLE public.holiday_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own holiday_rules" ON public.holiday_rules;
CREATE POLICY "own holiday_rules" ON public.holiday_rules FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_holiday_rules_user ON public.holiday_rules(user_id, date);

-- =====================================================================
-- KLART (v2). Idempotent, CHECK-validering, privat storage + policies.
-- OBS för koden (ej DB): befintliga shifts-queries måste nu filtrera
-- .is('deleted_at', null) — hanteras i kod-steget, se ledger REQ-SHIFT-SOFTDEL.
-- =====================================================================
