
-- Add auto-review flag to reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_auto_review boolean NOT NULL DEFAULT false;

-- Add review_reminder_sent and delivered_at to orders for review timing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS review_reminder_sent boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone;

-- Create feedback_surveys table
CREATE TABLE IF NOT EXISTS public.feedback_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  overall_satisfaction integer NOT NULL CHECK (overall_satisfaction BETWEEN 1 AND 5),
  delivery_rating integer CHECK (delivery_rating BETWEEN 1 AND 5),
  packaging_rating integer CHECK (packaging_rating BETWEEN 1 AND 5),
  would_recommend boolean,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own surveys" ON public.feedback_surveys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own surveys" ON public.feedback_surveys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all surveys" ON public.feedback_surveys
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_email text,
  referred_user_id uuid,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  reward_granted boolean NOT NULL DEFAULT false,
  order_id uuid REFERENCES public.orders(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  converted_at timestamp with time zone
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Users can create referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);
CREATE POLICY "Admins can view all referrals" ON public.referrals
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update referrals" ON public.referrals
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Add referral_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- Function to generate referral code from username
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.referral_code IS NULL AND NEW.username IS NOT NULL THEN
    NEW.referral_code := lower(regexp_replace(NEW.username, '[^a-zA-Z0-9]', '', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 4);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_referral_code
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Generate referral codes for existing profiles
UPDATE public.profiles SET referral_code = lower(regexp_replace(COALESCE(username, 'user'), '[^a-zA-Z0-9]', '', 'g')) || '-' || substring(gen_random_uuid()::text, 1, 4) WHERE referral_code IS NULL;
