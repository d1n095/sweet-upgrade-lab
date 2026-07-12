-- =====================================================================
-- MY MONEY MASTER — UPGRADE 07: EVENT-SYSTEM (nervsystem) — ADR-005
-- =====================================================================
-- Generaliserar timeline_events till OS:ets händelselager. Utökar för
-- ägarskap, audit, idempotens och framtida event-bus-reaktivitet.
-- Additivt, idempotent.
-- =====================================================================

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS owner_context_id UUID REFERENCES public.owner_contexts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,      -- för framtida automation/rules
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;               -- idempotens

-- Backfill ägarskap från user_id (personlig kontext).
UPDATE public.timeline_events te SET owner_context_id = cm.context_id
  FROM public.context_members cm
  WHERE cm.user_id = te.user_id AND cm.status = 'active' AND cm.role = 'owner'
    AND te.owner_context_id IS NULL
    AND EXISTS (SELECT 1 FROM public.owner_contexts oc WHERE oc.id = cm.context_id AND oc.type = 'personal');

-- Index: kontext-flöde (Life Feed) + oprocessade events (framtida event-bus).
CREATE INDEX IF NOT EXISTS idx_timeline_ctx ON public.timeline_events(owner_context_id, occurs_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_unprocessed ON public.timeline_events(processed_at) WHERE processed_at IS NULL;
-- Idempotens: samma dedupe_key per kontext får bara finnas en gång.
CREATE UNIQUE INDEX IF NOT EXISTS idx_timeline_dedupe
  ON public.timeline_events(owner_context_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- Kontext-baserad RLS (ersätter ev. user_id-only).
DROP POLICY IF EXISTS "own rows only" ON public.timeline_events;
DROP POLICY IF EXISTS "own timeline all" ON public.timeline_events;
DROP POLICY IF EXISTS "ctx access timeline_events" ON public.timeline_events;
CREATE POLICY "ctx access timeline_events" ON public.timeline_events FOR ALL
  USING (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid())
  WITH CHECK (owner_context_id IN (SELECT public.auth_context_ids()) OR user_id = auth.uid());

-- Valfri referenstabell: kända event-typer (för UI ikon/färg/etikett).
-- kind i timeline är nu fritext; denna beskriver de kända typerna.
CREATE TABLE IF NOT EXISTS public.event_types (
  kind         TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  icon         TEXT,
  color        TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.event_types TO authenticated;
GRANT ALL ON public.event_types TO service_role;
ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read event_types" ON public.event_types;
CREATE POLICY "read event_types" ON public.event_types FOR SELECT USING (true);

INSERT INTO public.event_types (kind, label, icon, color) VALUES
  ('shift','Arbetspass','Briefcase','oklch(0.85 0.12 85)'),
  ('income','Inkomst','TrendingUp','oklch(0.7 0.16 150)'),
  ('expense','Utgift','TrendingDown','oklch(0.7 0.16 25)'),
  ('reminder','Påminnelse','Bell','oklch(0.75 0.14 260)'),
  ('holiday','Helgdag','PartyPopper','oklch(0.8 0.14 40)'),
  ('nameday','Namnsdag','Star','oklch(0.8 0.1 90)'),
  ('signal','Insikt','Sparkles','oklch(0.78 0.14 300)'),
  ('note','Anteckning','StickyNote','oklch(0.7 0.02 260)'),
  ('health','Hälsa','Heart','oklch(0.72 0.16 10)'),
  ('travel','Resa','Plane','oklch(0.75 0.14 230)'),
  ('document','Dokument','FileText','oklch(0.7 0.05 260)')
ON CONFLICT (kind) DO NOTHING;

-- =====================================================================
-- KLART. timeline_events är nu ett generellt, kontext-ägt händelselager
-- redo för Life Feed (idag), och Automation/Rules/Notification (framtid)
-- via processed_at. Nästa (kod): core/events.ts emit() + koppla services.
-- =====================================================================
