-- ============================================================
-- STEG 1: Återkalla anon EXECUTE på interna funktioner
-- ============================================================
-- Behåller: has_role, is_admin, is_staff, is_founder, has_module_permission
--           (används i RLS-policies)
--           validate_affiliate_code, validate_influencer_code,
--           track_affiliate_click, mark_affiliate_click_converted,
--           check_review_eligibility, generate_referral_code
--           (kallas från publika landningssidor)

REVOKE EXECUTE ON FUNCTION public.activate_campaign(uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_user_xp(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_search_users(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_assign_task(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_assign_work_item(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_affiliate_commission(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_observability_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_work_items() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_product_categories_on_category_delete() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_work_item_from_bug() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_work_item_from_incident() FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.emit_ecommerce_event(ecommerce_event_type, uuid, uuid, ecommerce_event_severity, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.end_campaign(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_order_defaults() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_campaigns(timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_affiliate_performance(uuid, timestamp with time zone, timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(timestamp with time zone, timestamp with time zone) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_order_shipping_profiles(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_support_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_product_price_range() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_profile_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_structure_map_scan(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_work_item_occurrence(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.init_product_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_product_price_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_product_stock_change() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_work_item_created() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_work_item_updated() FROM anon;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_incident() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_on_refund_request() FROM anon;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.read_emails(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.run_campaign_scheduler() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_work_item_to_source() FROM anon;
REVOKE EXECUTE ON FUNCTION public.system_health_check() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_staff_performance() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_staff_performance_from_work_items() FROM anon;

-- ============================================================
-- STEG 2: Stäng anon-listning på public-assets bucket
-- ============================================================
-- Direkt URL-läsning fungerar fortfarande (bucket förblir public),
-- men anon kan inte längre lista alla filer.

DO $$
BEGIN
  -- Ta bort befintliga breda SELECT-policies på public-assets om de finns
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for public-assets'
  ) THEN
    DROP POLICY "Public read access for public-assets" ON storage.objects;
  END IF;
END $$;

-- Filer förblir åtkomliga via getPublicUrl() eftersom bucket.public = true
-- (Supabase serverar dem via /storage/v1/object/public/... utan policy-check)