-- =====================================================================
-- MY MONEY MASTER — UPGRADE 06: DATAINTEGRITETS-GARANTIER
-- =====================================================================
-- Hårda DB-nivå-garantier så korrupt data blir omöjlig oavsett kodväg.
-- Idempotent (constraints via pg_constraint-koll).
-- =====================================================================

-- B1: ett pass måste sluta efter det börjar (ends_at > starts_at).
-- Pass över midnatt lagras redan med ends_at nästa dygn, så detta är alltid sant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_time_order_chk') THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_time_order_chk
      CHECK (ends_at > starts_at);
  END IF;
END $$;

-- Rimlighetsgräns: inget pass längre än 24h (fångar felinmatning).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_max_duration_chk') THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_max_duration_chk
      CHECK (ends_at <= starts_at + interval '24 hours');
  END IF;
END $$;

-- break_minutes kan inte vara negativt.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_break_nonneg_chk') THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_break_nonneg_chk
      CHECK (break_minutes >= 0);
  END IF;
END $$;

-- fx_rate måste vara positiv (ingen noll/negativ växelkurs).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tx_fx_positive_chk') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT tx_fx_positive_chk
      CHECK (fx_rate > 0);
  END IF;
END $$;

-- =====================================================================
-- KLART. Ogiltiga pass och belopp kan nu inte skrivas till DB alls.
-- =====================================================================
