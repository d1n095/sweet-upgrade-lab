import { supabase } from '@/integrations/supabase/client';

export type ProductStatus = 'active' | 'draft' | 'archived' | 'coming_soon' | 'info' | 'hidden';

export interface DbProduct {
  id: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  price: number;
  original_price: number | null;
  category: string | null;
  tags: string[] | null;
  is_visible: boolean;
  stock: number;
  reserved_stock: number;
  allow_overselling: boolean;
  image_urls: string[] | null;
  handle: string | null;
  badge: 'new' | 'bestseller' | 'sale' | null;
  vendor: string | null;
  display_order: number;
  ingredients_sv: string | null;
  ingredients_en: string | null;
  certifications: string[] | null;
  currency: string;
  recipe_sv: string | null;
  recipe_en: string | null;
  feeling_sv: string | null;
  feeling_en: string | null;
  effects_sv: string | null;
  effects_en: string | null;
  usage_sv: string | null;
  usage_en: string | null;
  extended_description_sv: string | null;
  extended_description_en: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  weight_grams: number | null;
  status: ProductStatus;
  is_sellable: boolean;
  low_stock_threshold: number;
  restock_amount: number;
  units_sold_7d: number;
  units_sold_30d: number;
  last_sold_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DbProductInsert = Omit<DbProduct, 'id' | 'created_at' | 'updated_at' | 'handle' | 'ingredients_sv' | 'ingredients_en' | 'certifications' | 'reserved_stock' | 'currency' | 'recipe_sv' | 'recipe_en' | 'feeling_sv' | 'feeling_en' | 'effects_sv' | 'effects_en' | 'usage_sv' | 'usage_en' | 'extended_description_sv' | 'extended_description_en' | 'meta_title' | 'meta_description' | 'meta_keywords' | 'weight_grams' | 'status' | 'is_sellable'> & {
  handle?: string;
  ingredients_sv?: string | null;
  ingredients_en?: string | null;
  certifications?: string[] | null;
  reserved_stock?: number;
  currency?: string;
  recipe_sv?: string | null;
  recipe_en?: string | null;
  feeling_sv?: string | null;
  feeling_en?: string | null;
  effects_sv?: string | null;
  effects_en?: string | null;
  usage_sv?: string | null;
  usage_en?: string | null;
  extended_description_sv?: string | null;
  extended_description_en?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  weight_grams?: number | null;
  status?: ProductStatus;
  is_sellable?: boolean;
};

export const fetchDbProducts = async (adminView = false): Promise<DbProduct[]> => {
  let query = supabase.from('products').select('*').order('display_order', { ascending: true });
  if (!adminView) {
    query = query.eq('is_visible', true).eq('status', 'active');
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as DbProduct[];
};

export const createDbProduct = async (product: DbProductInsert): Promise<DbProduct> => {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();
  if (error) throw error;
  return data as DbProduct;
};

export const updateDbProduct = async (id: string, product: Partial<DbProductInsert>): Promise<DbProduct> => {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DbProduct;
};

export const deleteDbProduct = async (id: string): Promise<void> => {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
};

export const fetchDbProductByHandle = async (handle: string): Promise<DbProduct | null> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('handle', handle)
    .eq('is_visible', true)
    .in('status', ['active', 'coming_soon', 'info'])
    .maybeSingle();
  if (error) throw error;
  return data as DbProduct | null;
};

// Fetch product ingredients (many-to-many)
export const fetchProductIngredients = async (productId: string) => {
  const { data, error } = await supabase
    .from('product_ingredients')
    .select('*, recipe_ingredients(*)')
    .eq('product_id', productId)
    .order('display_order');
  if (error) throw error;
  return data || [];
};

// Set product ingredients (replace all)
export const setProductIngredients = async (productId: string, ingredientIds: string[]) => {
  await supabase.from('product_ingredients').delete().eq('product_id', productId);
  if (ingredientIds.length > 0) {
    const rows = ingredientIds.map((id, i) => ({
      product_id: productId,
      ingredient_id: id,
      display_order: i,
    }));
    const { error } = await supabase.from('product_ingredients').insert(rows);
    if (error) throw error;
  }
};
