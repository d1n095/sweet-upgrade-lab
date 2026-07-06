-- Sprint 3: Relationship OS

CREATE TABLE public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_segments TO authenticated;
GRANT ALL ON public.customer_segments TO service_role;
ALTER TABLE public.customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read segments" ON public.customer_segments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage segments" ON public.customer_segments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage customer notes" ON public.customer_notes FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.customer_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  touchpoint_type TEXT NOT NULL,
  channel TEXT,
  subject TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_touchpoints_customer ON public.customer_touchpoints(customer_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_touchpoints TO authenticated;
GRANT ALL ON public.customer_touchpoints TO service_role;
ALTER TABLE public.customer_touchpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage touchpoints" ON public.customer_touchpoints FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read own touchpoints" ON public.customer_touchpoints FOR SELECT TO authenticated USING (auth.uid() = customer_id);

CREATE TABLE public.lifecycle_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE,
  stage TEXT NOT NULL DEFAULT 'lead',
  segment_code TEXT,
  rfm_recency INT,
  rfm_frequency INT,
  rfm_monetary NUMERIC,
  total_orders INT NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  churn_risk NUMERIC,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lifecycle_stages TO authenticated;
GRANT ALL ON public.lifecycle_stages TO service_role;
ALTER TABLE public.lifecycle_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read lifecycle" ON public.lifecycle_stages FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff manage lifecycle" ON public.lifecycle_stages FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Owners read own lifecycle" ON public.lifecycle_stages FOR SELECT TO authenticated USING (auth.uid() = customer_id);

CREATE TRIGGER update_customer_segments_updated_at BEFORE UPDATE ON public.customer_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_notes_updated_at BEFORE UPDATE ON public.customer_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lifecycle_stages_updated_at BEFORE UPDATE ON public.lifecycle_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deterministic RFM recompute function
CREATE OR REPLACE FUNCTION public.recompute_lifecycle_stage(_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recency INT;
  v_frequency INT;
  v_monetary NUMERIC;
  v_last_order TIMESTAMPTZ;
  v_stage TEXT;
  v_segment TEXT;
BEGIN
  SELECT COUNT(*)::int, COALESCE(SUM(total),0), MAX(created_at)
  INTO v_frequency, v_monetary, v_last_order
  FROM public.orders
  WHERE user_id = _customer_id
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled');

  v_recency := CASE WHEN v_last_order IS NULL THEN NULL ELSE EXTRACT(DAY FROM (now() - v_last_order))::int END;

  IF v_frequency = 0 THEN
    v_stage := 'lead';
    v_segment := 'new';
  ELSIF v_recency <= 30 AND v_frequency >= 3 THEN
    v_stage := 'active';
    v_segment := 'vip';
  ELSIF v_recency <= 90 THEN
    v_stage := 'active';
    v_segment := 'regular';
  ELSIF v_recency <= 180 THEN
    v_stage := 'at_risk';
    v_segment := 'at_risk';
  ELSE
    v_stage := 'lost';
    v_segment := 'lost';
  END IF;

  INSERT INTO public.lifecycle_stages (customer_id, stage, segment_code, rfm_recency, rfm_frequency, rfm_monetary, total_orders, total_spent, last_order_at, computed_at)
  VALUES (_customer_id, v_stage, v_segment, v_recency, v_frequency, v_monetary, v_frequency, v_monetary, v_last_order, now())
  ON CONFLICT (customer_id) DO UPDATE SET
    stage = EXCLUDED.stage,
    segment_code = EXCLUDED.segment_code,
    rfm_recency = EXCLUDED.rfm_recency,
    rfm_frequency = EXCLUDED.rfm_frequency,
    rfm_monetary = EXCLUDED.rfm_monetary,
    total_orders = EXCLUDED.total_orders,
    total_spent = EXCLUDED.total_spent,
    last_order_at = EXCLUDED.last_order_at,
    computed_at = now();
END;
$$;

-- Seed default segments
INSERT INTO public.customer_segments (code, name, description, color) VALUES
  ('new', 'Ny kund', 'Ingen köphistorik ännu', '#94A3B8'),
  ('regular', 'Återkommande', 'Köpt inom 90 dagar', '#0F172A'),
  ('vip', 'VIP', '3+ ordrar senaste 30 dagarna', '#10B981'),
  ('at_risk', 'I riskzon', 'Ingen aktivitet på 90–180 dagar', '#F59E0B'),
  ('lost', 'Förlorad', 'Ingen aktivitet 180+ dagar', '#EF4444')
ON CONFLICT (code) DO NOTHING;