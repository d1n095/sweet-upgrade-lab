-- =====================================================================
-- MY MONEY MASTER — UPGRADE 05: ENHETLIG TRANSAKTIONSMODELL (ADR-003)
-- =====================================================================
-- Inkomst + utgift + valuta + kategorier-som-data i EN modell.
-- Löser: inkomst saknade hem, ingen valuta, hårdkodade kategorier,
-- fragmenterade penningflöden. Kontext-ägd (ADR-002). Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KATEGORIER — användardefinierade, per kontext (inte enum)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_context_id  UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'expense',  -- income/expense/both
  icon              TEXT,
  color             TEXT,
  parent_id         UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  is_system         BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT category_kind_chk CHECK (kind IN ('income','expense','both'))
);
CREATE INDEX IF NOT EXISTS idx_categories_ctx ON public.categories(owner_context_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ctx access categories" ON public.categories;
CREATE POLICY "ctx access categories" ON public.categories FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid() OR is_system = true)
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. TRANSACTIONS — all penningrörelse (in/ut), multi-valuta
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_context_id  UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  direction         TEXT NOT NULL,                    -- in/out
  amount            NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency          TEXT NOT NULL DEFAULT 'SEK',
  fx_rate           NUMERIC(12,6) NOT NULL DEFAULT 1, -- mot SEK vid tidpunkten
  amount_sek        NUMERIC(14,2) NOT NULL,           -- amount * fx_rate (fryst)
  category_id       UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description       TEXT,
  merchant          TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source            TEXT NOT NULL DEFAULT 'manual',   -- manual/salary/ocr/import/recurring
  source_table      TEXT,
  source_id         UUID,
  is_recurring      BOOLEAN NOT NULL DEFAULT false,
  recurrence_pattern TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT tx_direction_chk CHECK (direction IN ('in','out'))
);
CREATE INDEX IF NOT EXISTS idx_tx_ctx_date ON public.transactions(owner_context_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_category ON public.transactions(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tx_source ON public.transactions(source_table, source_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ctx access transactions" ON public.transactions;
CREATE POLICY "ctx access transactions" ON public.transactions FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());
DROP TRIGGER IF EXISTS tr_transactions_upd ON public.transactions;
CREATE TRIGGER tr_transactions_upd BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 3. SYSTEM-KATEGORIER (frö) — svenska standardkategorier, delade
-- ---------------------------------------------------------------------
INSERT INTO public.categories (name, kind, icon, is_system, sort_order) VALUES
  ('Lön','income','Wallet',true,1),
  ('Övrig inkomst','income','TrendingUp',true,2),
  ('Mat','expense','ShoppingCart',true,10),
  ('Transport','expense','Car',true,11),
  ('Boende','expense','Home',true,12),
  ('Nöje','expense','Sparkles',true,13),
  ('Prenumeration','expense','Repeat',true,14),
  ('Kläder','expense','Shirt',true,15),
  ('Hälsa','expense','Heart',true,16),
  ('Sparande','both','PiggyBank',true,17),
  ('Överföring','both','ArrowLeftRight',true,18),
  ('Annat','both','Circle',true,99)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. MIGRERA befintliga expenses → transactions (direction='out')
-- ---------------------------------------------------------------------
-- Mappa gamla enum-kategorier till nya system-kategorier via namn.
INSERT INTO public.transactions
  (owner_context_id, user_id, direction, amount, currency, fx_rate, amount_sek,
   category_id, description, merchant, occurred_at, source, source_table, source_id,
   is_recurring, recurrence_pattern, created_at)
SELECT
  e.owner_context_id, e.user_id, 'out', e.amount, 'SEK', 1, e.amount,
  (SELECT c.id FROM public.categories c WHERE c.is_system = true AND c.kind IN ('expense','both')
     AND lower(c.name) = CASE e.category::text
        WHEN 'mat' THEN 'mat' WHEN 'transport' THEN 'transport' WHEN 'boende' THEN 'boende'
        WHEN 'noje' THEN 'nöje' WHEN 'prenumeration' THEN 'prenumeration'
        WHEN 'klader' THEN 'kläder' WHEN 'halsa' THEN 'hälsa' WHEN 'sparande' THEN 'sparande'
        WHEN 'overforing' THEN 'överföring' ELSE 'annat' END
     LIMIT 1),
  e.description, e.merchant, e.occurred_at, COALESCE(e.source,'manual'), 'expenses', e.id,
  COALESCE(e.is_recurring,false), e.recurrence_pattern, e.created_at
FROM public.expenses e
WHERE NOT EXISTS (
  SELECT 1 FROM public.transactions t WHERE t.source_table = 'expenses' AND t.source_id = e.id
);

-- expenses behålls tills pengar.tsx flyttats till transactions, sen droppas den.
COMMENT ON TABLE public.expenses IS 'LEGACY — ersatt av transactions (ADR-003). Migreras, droppas när UI flyttat.';

-- =====================================================================
-- KLART. Enhetlig ekonomi: transactions + categories, multi-valuta,
-- inkomst har hem, kategorier som data. expenses migrerad (ej raderad).
-- =====================================================================
