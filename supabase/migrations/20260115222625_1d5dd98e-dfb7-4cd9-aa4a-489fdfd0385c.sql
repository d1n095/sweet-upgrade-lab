-- Create donations table for tracking user contributions
CREATE TABLE public.donations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'general',
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'round_up',
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Users can view their own donations
CREATE POLICY "Users can view their own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own donations
CREATE POLICY "Users can create donations"
  ON public.donations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all donations
CREATE POLICY "Admins can view all donations"
  ON public.donations FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create donation projects table
CREATE TABLE public.donation_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  goal_amount NUMERIC NOT NULL DEFAULT 5000,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  families_helped INTEGER NOT NULL DEFAULT 0,
  trees_planted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donation_projects ENABLE ROW LEVEL SECURITY;

-- Everyone can view projects
CREATE POLICY "Anyone can view donation projects"
  ON public.donation_projects FOR SELECT
  USING (true);

-- Admins can manage projects
CREATE POLICY "Admins can manage donation projects"
  ON public.donation_projects FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default projects
INSERT INTO public.donation_projects (name, name_en, description, description_en, goal_amount, current_amount, families_helped)
VALUES 
  ('Giftfria produkter till behövande familjer', 'Toxin-free products for families in need', 'Vi donerar giftfria produkter till familjer som behöver dem mest.', 'We donate toxin-free products to families who need them most.', 5000, 1247, 8),
  ('Trädplantering i lokala områden', 'Tree planting in local areas', 'Vi planterar träd för en grönare framtid.', 'We plant trees for a greener future.', 2000, 847, 0),
  ('Utbildning om giftfria alternativ', 'Education about toxin-free alternatives', 'Vi utbildar skolor och samhällen om giftfria alternativ.', 'We educate schools and communities about toxin-free alternatives.', 3000, 654, 0);

-- Update trees_planted for tree project
UPDATE public.donation_projects SET trees_planted = 5 WHERE name = 'Trädplantering i lokala områden';