-- Auto-cleanup orphan product_categories when a category is deleted
CREATE OR REPLACE FUNCTION public.cleanup_product_categories_on_category_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.product_categories WHERE category_id = OLD.id;
  -- Also move child categories to root
  UPDATE public.categories SET parent_id = NULL WHERE parent_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_product_categories ON public.categories;
CREATE TRIGGER trg_cleanup_product_categories
  BEFORE DELETE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_product_categories_on_category_delete();