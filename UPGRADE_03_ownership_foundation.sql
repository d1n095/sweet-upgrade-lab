-- =====================================================================
-- MY MONEY MASTER — UPGRADE 03: ÄGARSKAPS- & TENANCY-GRUND (ADR-002)
-- =====================================================================
-- Den viktigaste migrationen: inför owner_contexts + roller + capabilities.
-- Bär privatperson → hushåll → organisation → kommun UTAN framtida ombyggnad.
-- Dev-kopia: vi bygger det RÄTT, ingen bakåtkompatibilitet krävs.
-- Verifierad mot grammatik + projektschema. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ÄGARSKAPSKONTEXTER — VEM som äger data
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.owner_contexts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL DEFAULT 'personal',  -- personal/household/organization
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.owner_contexts(id) ON DELETE SET NULL, -- org-hierarki
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CONSTRAINT owner_context_type_chk CHECK (type IN ('personal','household','organization'))
);

-- ---------------------------------------------------------------------
-- 2. MEDLEMSKAP — vilka användare hör till en kontext + roll
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.context_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id  UUID NOT NULL REFERENCES public.owner_contexts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'owner',
              -- owner/admin/member/staff/viewer/subject
  status      TEXT NOT NULL DEFAULT 'active',   -- active/invited/suspended
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT context_role_chk CHECK (role IN ('owner','admin','member','staff','viewer','subject')),
  CONSTRAINT context_status_chk CHECK (status IN ('active','invited','suspended')),
  UNIQUE (context_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_context_members_user ON public.context_members(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_context_members_context ON public.context_members(context_id);

-- ---------------------------------------------------------------------
-- 3. CAPABILITIES — roll → förmågor (data, inte hårdkod)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role         TEXT NOT NULL,
  capability   TEXT NOT NULL,   -- t.ex. 'shifts.read','salary.write','documents.read'
  UNIQUE (role, capability)
);

-- Standard-capabilities (privatperson-owner får allt; övriga graderat).
INSERT INTO public.role_capabilities (role, capability) VALUES
  ('owner','*'),
  ('admin','shifts.read'),('admin','shifts.write'),('admin','salary.read'),('admin','salary.write'),
  ('admin','documents.read'),('admin','documents.write'),('admin','finance.read'),('admin','finance.write'),
  ('admin','members.manage'),
  ('member','shifts.read'),('member','shifts.write'),('member','salary.read'),
  ('member','documents.read'),('member','finance.read'),('member','finance.write'),
  ('staff','shifts.read'),('staff','shifts.write'),('staff','subject.care.read'),('staff','subject.care.write'),
  ('viewer','shifts.read'),('viewer','salary.read'),('viewer','documents.read'),('viewer','finance.read'),
  ('subject','self.read'),('subject','self.privacy.manage')
ON CONFLICT (role, capability) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. HJÄLPFUNKTIONER — kontext-uppslag för RLS (SECURITY DEFINER, cachebar)
-- ---------------------------------------------------------------------
-- Vilka kontexter tillhör inloggad användare?
CREATE OR REPLACE FUNCTION public.auth_context_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT context_id FROM public.context_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- Har inloggad användare en viss capability i den kontext som äger raden?
CREATE OR REPLACE FUNCTION public.auth_has_capability(ctx UUID, cap TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.context_members cm
    JOIN public.role_capabilities rc ON rc.role = cm.role
    WHERE cm.context_id = ctx
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND (rc.capability = cap OR rc.capability = '*')
  );
$$;

-- ---------------------------------------------------------------------
-- 5. RLS PÅ SJÄLVA KONTEXT-TABELLERNA
-- ---------------------------------------------------------------------
ALTER TABLE public.owner_contexts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "member reads context" ON public.owner_contexts;
CREATE POLICY "member reads context" ON public.owner_contexts FOR SELECT
  USING (id IN (SELECT public.auth_context_ids()));
DROP POLICY IF EXISTS "owner writes context" ON public.owner_contexts;
CREATE POLICY "owner writes context" ON public.owner_contexts FOR ALL
  USING (public.auth_has_capability(id, 'members.manage') OR id IN (
    SELECT context_id FROM public.context_members
    WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'))
  WITH CHECK (true);

ALTER TABLE public.context_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read own memberships" ON public.context_members;
CREATE POLICY "read own memberships" ON public.context_members FOR SELECT
  USING (user_id = auth.uid() OR context_id IN (SELECT public.auth_context_ids()));
DROP POLICY IF EXISTS "manage memberships" ON public.context_members;
CREATE POLICY "manage memberships" ON public.context_members FOR ALL
  USING (public.auth_has_capability(context_id, 'members.manage')
         OR user_id = auth.uid())
  WITH CHECK (true);

ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read capabilities" ON public.role_capabilities;
CREATE POLICY "read capabilities" ON public.role_capabilities FOR SELECT USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_contexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.context_members TO authenticated;
GRANT SELECT ON public.role_capabilities TO authenticated;
GRANT ALL ON public.owner_contexts, public.context_members, public.role_capabilities TO service_role;

DROP TRIGGER IF EXISTS tr_owner_contexts_upd ON public.owner_contexts;
CREATE TRIGGER tr_owner_contexts_upd BEFORE UPDATE ON public.owner_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- 6. GE VARJE BEFINTLIG ANVÄNDARE EN PERSONLIG KONTEXT (deterministiskt)
-- ---------------------------------------------------------------------
-- Vi använder en temporär koppling via metadata.seed_user_id så att
-- kontext och medlemskap matchas exakt, även om migrationen körs om.
INSERT INTO public.owner_contexts (type, name, metadata)
SELECT 'personal', COALESCE(p.display_name, 'Min data'),
       jsonb_build_object('seed_user_id', p.id::text)
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.context_members cm WHERE cm.user_id = p.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.owner_contexts oc
  WHERE oc.metadata->>'seed_user_id' = p.id::text
);

-- Koppla varje användare som owner till EXAKT sin seed-kontext.
INSERT INTO public.context_members (context_id, user_id, role, status)
SELECT oc.id, (oc.metadata->>'seed_user_id')::uuid, 'owner', 'active'
FROM public.owner_contexts oc
WHERE oc.type = 'personal'
  AND oc.metadata ? 'seed_user_id'
  AND NOT EXISTS (
    SELECT 1 FROM public.context_members cm
    WHERE cm.context_id = oc.id
      AND cm.user_id = (oc.metadata->>'seed_user_id')::uuid
  )
ON CONFLICT (context_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- 7. NY FUNKTION: auto-skapa personlig kontext för NYA användare
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_personal_context()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_ctx UUID;
BEGIN
  INSERT INTO public.owner_contexts (type, name)
  VALUES ('personal', COALESCE(NEW.display_name, 'Min data'))
  RETURNING id INTO new_ctx;
  INSERT INTO public.context_members (context_id, user_id, role, status)
  VALUES (new_ctx, NEW.id, 'owner', 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_personal_context ON public.profiles;
CREATE TRIGGER tr_profiles_personal_context AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_personal_context();

-- =====================================================================
-- KLART. Ägarskapsgrunden finns. NÄSTA migration (UPGRADE_04) lägger
-- owner_context_id på alla 23 objekt-tabeller, backfillar från user_id,
-- och byter RLS till kontext-baserad. Delas upp för testbarhet.
-- =====================================================================
