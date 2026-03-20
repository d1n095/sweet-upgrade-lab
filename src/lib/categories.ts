import { supabase } from '@/integrations/supabase/client';

export interface DbCategory {
  id: string;
  parent_id: string | null;
  name_sv: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  children?: DbCategory[];
}

export const fetchCategories = async (adminView = false): Promise<DbCategory[]> => {
  let query = supabase.from('categories').select('*').order('display_order', { ascending: true });
  if (!adminView) {
    query = query.eq('is_visible', true);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DbCategory[];
};

export const buildCategoryTree = (categories: DbCategory[]): DbCategory[] => {
  const map = new Map<string, DbCategory>();
  const roots: DbCategory[] = [];
  
  categories.forEach(cat => map.set(cat.id, { ...cat, children: [] }));
  
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  
  return roots;
};

export const createCategory = async (data: {
  name_sv: string;
  name_en?: string | null;
  slug: string;
  icon?: string | null;
  parent_id?: string | null;
  display_order?: number;
  is_visible?: boolean;
}): Promise<DbCategory> => {
  const { data: result, error } = await supabase
    .from('categories')
    .insert([data])
    .select()
    .single();
  if (error) throw error;
  return result as DbCategory;
};

export const updateCategory = async (id: string, data: Partial<DbCategory>): Promise<DbCategory> => {
  const { data: result, error } = await supabase
    .from('categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return result as DbCategory;
};

export const deleteCategory = async (id: string): Promise<void> => {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
};

// Product-category relations
export const fetchProductCategoryIds = async (productId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('product_categories')
    .select('category_id')
    .eq('product_id', productId);
  if (error) throw error;
  return (data || []).map(r => r.category_id);
};

export const setProductCategories = async (productId: string, categoryIds: string[]): Promise<void> => {
  await supabase.from('product_categories').delete().eq('product_id', productId);
  if (categoryIds.length > 0) {
    const rows = categoryIds.map(cid => ({ product_id: productId, category_id: cid }));
    const { error } = await supabase.from('product_categories').insert(rows);
    if (error) throw error;
  }
};

export const fetchProductsInCategory = async (categoryId: string, includeChildren = true): Promise<string[]> => {
  // Get category + children IDs
  const categoryIds = [categoryId];
  if (includeChildren) {
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', categoryId);
    if (children) {
      categoryIds.push(...children.map(c => c.id));
    }
  }
  
  const { data, error } = await supabase
    .from('product_categories')
    .select('product_id')
    .in('category_id', categoryIds);
  if (error) throw error;
  return [...new Set((data || []).map(r => r.product_id))];
};
