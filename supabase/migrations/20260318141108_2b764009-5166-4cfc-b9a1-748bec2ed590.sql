
-- 1. Create an is_admin function that treats founder, it, admin as equivalent
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'founder', 'it')
  )
$$;

-- 2. Add condition columns to bundles table
ALTER TABLE public.bundles 
  ADD COLUMN IF NOT EXISTS requirement_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS first_purchase_discount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS repeat_discount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS min_level integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS requires_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_uses_per_user integer DEFAULT NULL;

-- 3. Update all RLS policies that use has_role(auth.uid(), 'admin') to use is_admin instead

-- bundles
DROP POLICY IF EXISTS "Admins can manage bundles" ON public.bundles;
CREATE POLICY "Admins can manage bundles" ON public.bundles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- bundle_items
DROP POLICY IF EXISTS "Admins can manage bundle items" ON public.bundle_items;
CREATE POLICY "Admins can manage bundle items" ON public.bundle_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- products
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO public
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
CREATE POLICY "Admins can view all products" ON public.products FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- orders
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders FOR UPDATE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- reviews
DROP POLICY IF EXISTS "Admins can delete any review" ON public.reviews;
CREATE POLICY "Admins can delete any review" ON public.reviews FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any review" ON public.reviews;
CREATE POLICY "Admins can update any review" ON public.reviews FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all reviews" ON public.reviews;
CREATE POLICY "Admins can view all reviews" ON public.reviews FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- donations
DROP POLICY IF EXISTS "Admins can view all donations" ON public.donations;
CREATE POLICY "Admins can view all donations" ON public.donations FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- Add admin delete policy for donations (for reset feature)
CREATE POLICY "Admins can delete donations" ON public.donations FOR DELETE TO public
  USING (public.is_admin(auth.uid()));

-- affiliates
DROP POLICY IF EXISTS "Admins can manage all payouts" ON public.affiliate_payouts;
CREATE POLICY "Admins can manage all payouts" ON public.affiliate_payouts FOR ALL TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all payout requests" ON public.affiliate_payout_requests;
CREATE POLICY "Admins can manage all payout requests" ON public.affiliate_payout_requests FOR ALL TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage affiliate applications" ON public.affiliate_applications;
CREATE POLICY "Admins can manage affiliate applications" ON public.affiliate_applications FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- site_updates
DROP POLICY IF EXISTS "Admins can create updates" ON public.site_updates;
CREATE POLICY "Admins can create updates" ON public.site_updates FOR INSERT TO public
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete updates" ON public.site_updates;
CREATE POLICY "Admins can delete updates" ON public.site_updates FOR DELETE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update updates" ON public.site_updates;
CREATE POLICY "Admins can update updates" ON public.site_updates FOR UPDATE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all updates" ON public.site_updates;
CREATE POLICY "Admins can view all updates" ON public.site_updates FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- donation_projects
DROP POLICY IF EXISTS "Admins can manage donation projects" ON public.donation_projects;
CREATE POLICY "Admins can manage donation projects" ON public.donation_projects FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- store_settings
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
CREATE POLICY "Admins can insert store settings" ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
CREATE POLICY "Admins can update store settings" ON public.store_settings FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- legal_documents
DROP POLICY IF EXISTS "Admins can manage all legal documents" ON public.legal_documents;
CREATE POLICY "Admins can manage all legal documents" ON public.legal_documents FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- legal_document_versions
DROP POLICY IF EXISTS "Admins can create document versions" ON public.legal_document_versions;
CREATE POLICY "Admins can create document versions" ON public.legal_document_versions FOR INSERT TO public
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view document versions" ON public.legal_document_versions;
CREATE POLICY "Admins can view document versions" ON public.legal_document_versions FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- email_templates
DROP POLICY IF EXISTS "Only admins can insert email templates" ON public.email_templates;
CREATE POLICY "Only admins can insert email templates" ON public.email_templates FOR INSERT TO public
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can update email templates" ON public.email_templates;
CREATE POLICY "Only admins can update email templates" ON public.email_templates FOR UPDATE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can view email templates" ON public.email_templates;
CREATE POLICY "Only admins can view email templates" ON public.email_templates FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- analytics_events
DROP POLICY IF EXISTS "Admins can view analytics events" ON public.analytics_events;
CREATE POLICY "Admins can view analytics events" ON public.analytics_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- feedback_surveys
DROP POLICY IF EXISTS "Admins can view all surveys" ON public.feedback_surveys;
CREATE POLICY "Admins can view all surveys" ON public.feedback_surveys FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- shipping_carriers
DROP POLICY IF EXISTS "Admins can manage shipping carriers" ON public.shipping_carriers;
CREATE POLICY "Admins can manage shipping carriers" ON public.shipping_carriers FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- product_translations
DROP POLICY IF EXISTS "Admins can manage product translations" ON public.product_translations;
CREATE POLICY "Admins can manage product translations" ON public.product_translations FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- recipe tables
DROP POLICY IF EXISTS "Admins can manage recipe ingredients" ON public.recipe_ingredients;
CREATE POLICY "Admins can manage recipe ingredients" ON public.recipe_ingredients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage recipe templates" ON public.recipe_templates;
CREATE POLICY "Admins can manage recipe templates" ON public.recipe_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- timeline
DROP POLICY IF EXISTS "Admins can manage timeline entries" ON public.timeline_entries;
CREATE POLICY "Admins can manage timeline entries" ON public.timeline_entries FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- page_sections
DROP POLICY IF EXISTS "Admins can manage page sections" ON public.page_sections;
CREATE POLICY "Admins can manage page sections" ON public.page_sections FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- product_sales
DROP POLICY IF EXISTS "Admins can manage product sales" ON public.product_sales;
CREATE POLICY "Admins can manage product sales" ON public.product_sales FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- referrals
DROP POLICY IF EXISTS "Admins can update referrals" ON public.referrals;
CREATE POLICY "Admins can update referrals" ON public.referrals FOR UPDATE TO public
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all referrals" ON public.referrals;
CREATE POLICY "Admins can view all referrals" ON public.referrals FOR SELECT TO public
  USING (public.is_admin(auth.uid()));

-- business_accounts
DROP POLICY IF EXISTS "Admins can manage all business accounts" ON public.business_accounts;
CREATE POLICY "Admins can manage all business accounts" ON public.business_accounts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()));

-- influencer_products
DROP POLICY IF EXISTS "Admins can manage influencer products" ON public.influencer_products;
CREATE POLICY "Admins can manage influencer products" ON public.influencer_products FOR ALL TO public
  USING (public.is_admin(auth.uid()));

-- Update admin_search_users to use is_admin
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text)
RETURNS TABLE(user_id uuid, email text, username text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::text,
    p.username,
    p.avatar_url
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE 
    p.username ILIKE '%' || p_query || '%'
    OR u.email::text ILIKE '%' || p_query || '%'
    OR u.phone::text ILIKE '%' || p_query || '%'
  LIMIT 10;
END;
$$;
