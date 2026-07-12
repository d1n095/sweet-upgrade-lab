-- =====================================================================
-- LIFE OS / MY MONEY MASTER — LAGER 1: KANONISKT ALPHA-SCHEMA
-- =====================================================================
-- Bygger mot spec Del 65 (en sanning för kärnan).
-- Kör detta i Supabase SQL Editor. Ordningen är beroendeordning.
-- Allt: RLS på (auth.uid() = user_id), soft delete där relevant,
-- tider i UTC (TIMESTAMPTZ). Idempotent: IF NOT EXISTS överallt.
--
-- Denna fil är verifierad mot PostgreSQL-grammatiken innan leverans.
-- =====================================================================

-- Hjälpfunktion: sätt updated_at automatiskt vid UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 1. PROFILES — identitet. INGEN lön (Del 65, Beslut 1).
-- =====================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  language    TEXT DEFAULT 'sv',
  timezone    TEXT DEFAULT 'Europe/Stockholm',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 2. WORK_PROFILES — anställning. All lön bor här (Del 65, Beslut 1+2).
-- =====================================================================
CREATE TABLE IF NOT EXISTS work_profiles (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name                  TEXT NOT NULL,
  employer              TEXT,
  role                  TEXT,
  hourly_rate           DECIMAL(10,2),
  monthly_salary        DECIMAL(10,2),
  tax_column            INTEGER DEFAULT 33,
  vacation_pay_percent  DECIMAL(5,2) DEFAULT 12.0,
  pay_period_start_day  INTEGER DEFAULT 1
                        CHECK (pay_period_start_day BETWEEN 1 AND 31),
  payday_day            INTEGER CHECK (payday_day BETWEEN 1 AND 31),
  payday_offset_months  INTEGER DEFAULT 1,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- =====================================================================
-- 3. WORKPLACES — arbetsplats under en anställning.
-- =====================================================================
CREATE TABLE IF NOT EXISTS workplaces (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id  UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  address          TEXT,
  travel_minutes   INTEGER,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- =====================================================================
-- 4. PAY_PERIODS — explicit löneperiod (Del 65, Beslut 2).
-- =====================================================================
CREATE TABLE IF NOT EXISTS pay_periods (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id  UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  payday_date      DATE,
  is_locked        BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  CHECK (period_end >= period_start)
);

-- =====================================================================
-- 5. BREAK_RULES — rastregler per profil (data, inte hårdkod).
-- =====================================================================
CREATE TABLE IF NOT EXISTS break_rules (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id  UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  after_hours      DECIMAL(4,2) NOT NULL,
  break_minutes    INTEGER NOT NULL,
  is_paid          BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 6. OB_RULES — ALLA löneregler (kanoniskt schema, Del 62B/65).
-- =====================================================================
CREATE TABLE IF NOT EXISTS ob_rules (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id      UUID REFERENCES work_profiles(id) ON DELETE CASCADE NOT NULL,
  name                 TEXT NOT NULL,
  rule_type            TEXT NOT NULL,   -- base_hourly/base_monthly/ob/overtime/
                                        -- additional_hours/on_call/standby/night/
                                        -- weekend/holiday/vacation_pay/deduction/custom
  applies_to_category  TEXT,            -- NULL=alla pass, annars ordinary/extra/...
  valid_from           DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_to             DATE,
  day_of_week          INTEGER[],       -- 0=sön ... 6=lör
  start_time           TIME,
  end_time             TIME,
  holiday_type         TEXT,            -- red_day/eve/special
  rate_type            TEXT NOT NULL,   -- multiplier/fixed_addition/fixed_amount
  multiplier           DECIMAL(5,3),
  fixed_amount         DECIMAL(10,2),
  priority             INTEGER DEFAULT 10,
  stacking_allowed     BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 7. HOLIDAY_RULES — röda dagar som påverkar OB.
-- =====================================================================
CREATE TABLE IF NOT EXISTS holiday_rules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date          DATE NOT NULL,
  name          TEXT NOT NULL,
  holiday_type  TEXT DEFAULT 'red_day',  -- red_day/eve/special
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 8. IMPORT_BATCHES — spårar hela scan-importen (skapas före work_shifts
--    pga FK, men refererar documents som skapas senare → FK läggs efter).
-- =====================================================================
CREATE TABLE IF NOT EXISTS import_batches (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id          UUID,            -- FK läggs efter documents skapats
  detected_type        TEXT,
  type_confidence      DECIMAL(4,3),
  confirmed_type       TEXT,
  status               TEXT DEFAULT 'classified',
                       -- classified/previewing/imported/reverted/failed
  items_proposed       INTEGER DEFAULT 0,
  items_imported       INTEGER DEFAULT 0,
  items_skipped_dupe   INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  reverted_at          TIMESTAMPTZ
);

-- =====================================================================
-- 9. WORK_SHIFTS — pass. EN rad även över midnatt (Del 65, Beslut 3).
-- =====================================================================
CREATE TABLE IF NOT EXISTS work_shifts (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id   UUID REFERENCES work_profiles(id) ON DELETE SET NULL,
  workplace_id      UUID REFERENCES workplaces(id) ON DELETE SET NULL,
  pay_period_id     UUID REFERENCES pay_periods(id) ON DELETE SET NULL,
  date              DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  crosses_midnight  BOOLEAN DEFAULT false,
  end_date          DATE,
  break_minutes     INTEGER DEFAULT 0,
  break_paid        BOOLEAN DEFAULT false,
  is_on_call        BOOLEAN DEFAULT false,
  is_standby        BOOLEAN DEFAULT false,
  overtime_minutes  INTEGER DEFAULT 0,
  shift_category    TEXT DEFAULT 'ordinary',
                    -- ordinary/extra/overtime/on_call/standby/inbeordrad
  status            TEXT DEFAULT 'planned',
                    -- planned/worked/sick/vacation/vab/cancelled
  shift_code        TEXT,
  notes             TEXT,
  source            TEXT DEFAULT 'manual',   -- manual/ocr/import
  import_batch_id   UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- =====================================================================
-- 10. DOCUMENTS — vault + enkel OCR (Del 65, Beslut 4).
-- =====================================================================
CREATE TABLE IF NOT EXISTS documents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  document_type   TEXT,   -- payslip/schema/receipt/invoice/contract/warranty/
                          -- insurance/id_document/other
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  mime_type       TEXT,
  ocr_text        TEXT,
  ocr_confidence  DECIMAL(4,2),
  ocr_status      TEXT DEFAULT 'pending',  -- pending/processing/completed/failed
  ai_summary      TEXT,
  metadata        JSONB DEFAULT '{}',
  tags            TEXT[],
  expires_at      DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- Nu kan import_batches.document_id få sin FK.
ALTER TABLE import_batches
  DROP CONSTRAINT IF EXISTS import_batches_document_fk;
ALTER TABLE import_batches
  ADD CONSTRAINT import_batches_document_fk
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- =====================================================================
-- 11. OCR_FIELDS — detaljerad OCR per fält (Del 65, Beslut 4).
-- =====================================================================
CREATE TABLE IF NOT EXISTS ocr_fields (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id       UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  field_name        TEXT NOT NULL,
  raw_value         TEXT,
  normalized_value  TEXT,
  confidence        DECIMAL(4,3),
  bounding_box      JSONB,
  is_verified       BOOLEAN DEFAULT false,
  corrected_value   TEXT,
  correction_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- 12. PAYSLIPS — importerad lönespec, kopplad till rätt period.
-- =====================================================================
CREATE TABLE IF NOT EXISTS payslips (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  work_profile_id   UUID REFERENCES work_profiles(id) ON DELETE SET NULL,
  pay_period_id     UUID REFERENCES pay_periods(id) ON DELETE SET NULL,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  gross_salary      DECIMAL(10,2),
  net_salary        DECIMAL(10,2),
  tax_amount        DECIMAL(10,2),
  ob_amount         DECIMAL(10,2),
  on_call_amount    DECIMAL(10,2),
  vacation_pay      DECIMAL(10,2),
  overtime_amount   DECIMAL(10,2),
  total_hours       DECIMAL(6,2),
  document_id       UUID REFERENCES documents(id) ON DELETE SET NULL,
  ocr_raw           TEXT,
  verified_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

-- =====================================================================
-- 13. EXPENSES — utgifter.
-- =====================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount               DECIMAL(10,2) NOT NULL,
  currency             TEXT DEFAULT 'SEK',
  category             TEXT NOT NULL,
  subcategory          TEXT,
  description          TEXT,
  date                 DATE NOT NULL,
  expense_type         TEXT DEFAULT 'expense',
                       -- expense/bill/subscription/debt_payment
  is_recurring         BOOLEAN DEFAULT false,
  recurrence_interval  TEXT,   -- monthly/weekly/yearly
  receipt_id           UUID REFERENCES documents(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

-- =====================================================================
-- 14. DEBTS — skulder.
-- =====================================================================
CREATE TABLE IF NOT EXISTS debts (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name             TEXT NOT NULL,
  debt_type        TEXT NOT NULL,
                   -- mortgage/personal_loan/csn/credit_card/private/installment
  original_amount  DECIMAL(10,2) NOT NULL,
  current_amount   DECIMAL(10,2) NOT NULL,
  interest_rate    DECIMAL(5,2),
  monthly_payment  DECIMAL(10,2),
  minimum_payment  DECIMAL(10,2),
  start_date       DATE,
  end_date         DATE,
  lender           TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- =====================================================================
-- INDEX (kritiska, partial där soft delete finns)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_work_profiles_user   ON work_profiles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workplaces_profile   ON workplaces(work_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pay_periods_profile  ON pay_periods(work_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_break_rules_profile  ON break_rules(work_profile_id);
CREATE INDEX IF NOT EXISTS idx_ob_rules_profile     ON ob_rules(work_profile_id);
CREATE INDEX IF NOT EXISTS idx_holiday_rules_user   ON holiday_rules(user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_shifts_user_date ON work_shifts(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_shifts_profile  ON work_shifts(work_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_shifts_period   ON work_shifts(pay_period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_work_shifts_batch    ON work_shifts(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_documents_user       ON documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_type       ON documents(user_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ocr_fields_document  ON ocr_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_payslips_period      ON payslips(pay_period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_user_date   ON expenses(user_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category    ON expenses(user_id, category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_debts_user           ON debts(user_id) WHERE deleted_at IS NULL;

-- =====================================================================
-- UPDATED_AT-TRIGGERS (för tabeller med updated_at)
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','work_profiles','workplaces','pay_periods','ob_rules',
    'work_shifts','documents','payslips','expenses','debts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated ON %1$s;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_updated BEFORE UPDATE ON %1$s
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t);
  END LOOP;
END $$;

-- =====================================================================
-- ROW LEVEL SECURITY — på ALLA tabeller, USING (auth.uid() = user_id)
-- =====================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','work_profiles','workplaces','pay_periods','break_rules',
    'ob_rules','holiday_rules','import_batches','work_shifts','documents',
    'ocr_fields','payslips','expenses','debts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "own rows only" ON %I;', t);
    EXECUTE format(
      'CREATE POLICY "own rows only" ON %I
       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', t);
  END LOOP;
END $$;

-- =====================================================================
-- KLART. 14 tabeller, index, updated_at-triggers, RLS överallt.
-- =====================================================================
