
INSERT INTO public.page_sections (page, section_key, title_sv, title_en, content_sv, content_en, is_visible, display_order)
VALUES ('home', 'hero_badges', 'Hero Trust Badges', 'Hero Trust Badges', 'Certifierade ingredienser, Fri frakt info', 'Certified ingredients, Free shipping info', false, 1)
ON CONFLICT DO NOTHING;
