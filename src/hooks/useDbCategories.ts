import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Grid, Flame, Cpu, Shirt, Droplets, Sparkles, Gem, Bed, Leaf, Package, type LucideIcon } from 'lucide-react';

export interface FrontendCategory {
  id: string;
  name: { [key: string]: string };
  icon: LucideIcon;
  slug: string;
  query?: string;
  isBestsellerFilter?: boolean;
  parent_id?: string | null;
  is_visible: boolean;
}

// Map icon string names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  Grid, Flame, Cpu, Shirt, Droplets, Sparkles, Gem, Bed, Leaf, Package,
  grid: Grid, flame: Flame, cpu: Cpu, shirt: Shirt, droplets: Droplets,
  sparkles: Sparkles, gem: Gem, bed: Bed, leaf: Leaf, package: Package,
};

const resolveIcon = (iconName: string | null): LucideIcon => {
  if (!iconName) return Package;
  return iconMap[iconName] || iconMap[iconName.toLowerCase()] || Package;
};

// "All" virtual category — always first
const ALL_CATEGORY: FrontendCategory = {
  id: 'all',
  name: { sv: 'Alla', en: 'All', no: 'Alle', da: 'Alle', de: 'Alle', fi: 'Kaikki', nl: 'Alles', fr: 'Tout', es: 'Todo', pl: 'Wszystko' },
  icon: Grid,
  slug: 'all',
  is_visible: true,
};

/**
 * Load categories exclusively from the database.
 * Returns a list starting with "All" plus every visible DB category.
 * Empty categories (0 products) are hidden on the frontend unless adminView is true.
 */
export const useDbCategories = (adminView = false) => {
  const [categories, setCategories] = useState<FrontendCategory[]>([ALL_CATEGORY]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_visible', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Failed to load categories:', error);
        setLoading(false);
        return;
      }

      // Fetch product counts per category to hide empty ones on frontend
      let productCountMap: Record<string, number> = {};
      if (!adminView) {
        const { data: pcData } = await supabase
          .from('product_categories')
          .select('category_id');
        if (pcData) {
          pcData.forEach((r: any) => {
            productCountMap[r.category_id] = (productCountMap[r.category_id] || 0) + 1;
          });
        }
      }

      const dbCats: FrontendCategory[] = (data || [])
        .filter((c: any) => {
          // In admin view show all; on frontend hide categories with 0 products
          // Bestseller categories are always shown (they use a different data source)
          if (adminView || c.slug === 'bestsaljare') return true;
          return (productCountMap[c.id] || 0) > 0;
        })
        .map((c: any) => ({
          id: c.slug,
          name: { sv: c.name_sv, en: c.name_en || c.name_sv },
          icon: resolveIcon(c.icon),
          slug: c.slug,
          query: c.slug === 'bestsaljare' ? undefined : `product_type:${c.name_sv}`,
          isBestsellerFilter: c.slug === 'bestsaljare',
          parent_id: c.parent_id,
          is_visible: c.is_visible,
        }));

      setCategories([ALL_CATEGORY, ...dbCats]);
      setLoading(false);
    };

    load();
  }, [adminView]);

  return { categories, loading };
};
