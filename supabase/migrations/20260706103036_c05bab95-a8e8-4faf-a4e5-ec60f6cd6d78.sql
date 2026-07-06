
-- ============================================================
-- SPRINT 2 - KUNSKAP (Del 9)
-- ============================================================

CREATE TABLE public.knowledge_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_categories TO authenticated;
GRANT ALL ON public.knowledge_categories TO service_role;
ALTER TABLE public.knowledge_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published categories" ON public.knowledge_categories
  FOR SELECT USING (is_published = true OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manages categories" ON public.knowledge_categories
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_knowledge_categories_updated_at BEFORE UPDATE ON public.knowledge_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.knowledge_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  body_md TEXT,
  body_html TEXT,
  hero_image_url TEXT,
  category_id UUID REFERENCES public.knowledge_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  reading_time_minutes INT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads published articles" ON public.knowledge_articles
  FOR SELECT USING (is_published = true OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manages articles" ON public.knowledge_articles
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_knowledge_articles_updated_at BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_knowledge_articles_published ON public.knowledge_articles(is_published, published_at DESC);
CREATE INDEX idx_knowledge_articles_category ON public.knowledge_articles(category_id);
CREATE INDEX idx_knowledge_articles_tags ON public.knowledge_articles USING GIN(tags);

CREATE TABLE public.article_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_md TEXT,
  edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  edit_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, version_number)
);
GRANT SELECT, INSERT ON public.article_versions TO authenticated;
GRANT ALL ON public.article_versions TO service_role;
ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads article versions" ON public.article_versions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff writes article versions" ON public.article_versions
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_article_versions_article ON public.article_versions(article_id, version_number DESC);

CREATE TABLE public.article_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  body_md TEXT,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, language_code)
);
GRANT SELECT ON public.article_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_translations TO authenticated;
GRANT ALL ON public.article_translations TO service_role;
ALTER TABLE public.article_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads translations of published articles" ON public.article_translations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.knowledge_articles a WHERE a.id = article_id AND (a.is_published = true OR public.is_staff(auth.uid())))
  );
CREATE POLICY "Staff manages translations" ON public.article_translations
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_article_translations_updated_at BEFORE UPDATE ON public.article_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_knowledge_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'related' CHECK (relation_type IN ('related','how_to_use','ingredient','science','story')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, article_id, relation_type)
);
GRANT SELECT ON public.product_knowledge_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_knowledge_links TO authenticated;
GRANT ALL ON public.product_knowledge_links TO service_role;
ALTER TABLE public.product_knowledge_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads product knowledge links" ON public.product_knowledge_links
  FOR SELECT USING (true);
CREATE POLICY "Staff manages product knowledge links" ON public.product_knowledge_links
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));
CREATE INDEX idx_pkl_product ON public.product_knowledge_links(product_id);
CREATE INDEX idx_pkl_article ON public.product_knowledge_links(article_id);
