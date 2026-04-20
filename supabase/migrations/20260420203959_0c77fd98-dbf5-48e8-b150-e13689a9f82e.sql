-- Enums
DO $$ BEGIN
  CREATE TYPE public.campaign_type AS ENUM (
    'seasonal',
    'clearance',
    'product_launch',
    'visibility_boost',
    'conversion_opt'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM (
    'draft',
    'scheduled',
    'active',
    'paused',
    'ended',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  campaign_type public.campaign_type NOT NULL,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  priority integer NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  discount_pct numeric(5,4) NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 1),
  override_pricing boolean NOT NULL DEFAULT true,
  trigger_event_type public.ecommerce_event_type,
  trigger_event_id uuid REFERENCES public.ecommerce_events(id) ON DELETE SET NULL,
  target_product_ids uuid[] NOT NULL DEFAULT '{}',
  target_variant_ids uuid[] NOT NULL DEFAULT '{}',
  target_category_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_dates
  ON public.campaigns(status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_window
  ON public.campaigns(start_at, end_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_campaigns_type
  ON public.campaigns(campaign_type, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_target_products
  ON public.campaigns USING GIN(target_product_ids);

-- Activation log (append-only)
CREATE TABLE IF NOT EXISTS public.campaign_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('activated', 'deactivated', 'paused', 'resumed', 'ended', 'expired')),
  reason text NOT NULL,
  triggered_by_event_id uuid REFERENCES public.ecommerce_events(id) ON DELETE SET NULL,
  triggered_by_user uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_activations_campaign
  ON public.campaign_activations(campaign_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_activations ENABLE ROW LEVEL SECURITY;

-- Public read for active campaigns (storefront needs them)
CREATE POLICY "campaigns readable by everyone"
  ON public.campaigns FOR SELECT
  USING (true);

CREATE POLICY "campaigns insert by admins"
  ON public.campaigns FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "campaigns update by admins"
  ON public.campaigns FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "campaigns delete by admins"
  ON public.campaigns FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Activation log: admin-only
CREATE POLICY "campaign_activations readable by admins"
  ON public.campaign_activations FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "campaign_activations insert by admins"
  ON public.campaign_activations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- updated_at trigger
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: get active campaigns at "now" (or a given moment)
CREATE OR REPLACE FUNCTION public.get_active_campaigns(p_at timestamptz DEFAULT now())
RETURNS SETOF public.campaigns
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.campaigns
  WHERE status = 'active'
    AND start_at <= p_at
    AND end_at   >  p_at
  ORDER BY priority ASC, start_at ASC;
$$;

-- Helper: activate a scheduled/draft campaign
CREATE OR REPLACE FUNCTION public.activate_campaign(
  p_campaign_id uuid,
  p_reason text DEFAULT 'manual',
  p_event_id uuid DEFAULT NULL
)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.campaigns;
BEGIN
  IF NOT is_admin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.campaigns
  SET status = 'active',
      trigger_event_id = COALESCE(p_event_id, trigger_event_id),
      updated_at = now()
  WHERE id = p_campaign_id
    AND status IN ('draft','scheduled','paused')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found or not in activatable state', p_campaign_id;
  END IF;

  INSERT INTO public.campaign_activations (campaign_id, action, reason, triggered_by_event_id, triggered_by_user)
  VALUES (v_row.id, 'activated', p_reason, p_event_id, auth.uid());

  RETURN v_row;
END;
$$;

-- Helper: end a campaign (manual or expired)
CREATE OR REPLACE FUNCTION public.end_campaign(
  p_campaign_id uuid,
  p_reason text DEFAULT 'manual'
)
RETURNS public.campaigns
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.campaigns;
  v_action text;
BEGIN
  IF NOT is_admin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.campaigns
  SET status = 'ended',
      updated_at = now()
  WHERE id = p_campaign_id
    AND status IN ('active','paused','scheduled')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Campaign % not found or already ended', p_campaign_id;
  END IF;

  v_action := CASE WHEN p_reason = 'expired' THEN 'expired' ELSE 'ended' END;

  INSERT INTO public.campaign_activations (campaign_id, action, reason, triggered_by_user)
  VALUES (v_row.id, v_action, p_reason, auth.uid());

  RETURN v_row;
END;
$$;

-- Scheduler: auto-activate due scheduled campaigns + expire past-end ones
CREATE OR REPLACE FUNCTION public.run_campaign_scheduler()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activated int := 0;
  v_expired int := 0;
  v_now timestamptz := now();
  r record;
BEGIN
  IF NOT is_admin(auth.uid()) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Activate due scheduled campaigns
  FOR r IN
    SELECT id FROM public.campaigns
    WHERE status = 'scheduled' AND start_at <= v_now AND end_at > v_now
  LOOP
    UPDATE public.campaigns SET status = 'active', updated_at = v_now WHERE id = r.id;
    INSERT INTO public.campaign_activations (campaign_id, action, reason)
    VALUES (r.id, 'activated', 'scheduler:start_at_reached');
    v_activated := v_activated + 1;
  END LOOP;

  -- Expire campaigns past end_at
  FOR r IN
    SELECT id FROM public.campaigns
    WHERE status IN ('active','paused','scheduled') AND end_at <= v_now
  LOOP
    UPDATE public.campaigns SET status = 'ended', updated_at = v_now WHERE id = r.id;
    INSERT INTO public.campaign_activations (campaign_id, action, reason)
    VALUES (r.id, 'expired', 'scheduler:end_at_reached');
    v_expired := v_expired + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'activated', v_activated,
    'expired', v_expired,
    'ran_at', v_now
  );
END;
$$;