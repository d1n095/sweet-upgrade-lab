import { supabase } from '@/integrations/supabase/client';

export interface DbTag {
  id: string;
  name_sv: string;
  name_en: string | null;
  slug: string;
  color: string;
  display_order: number;
  created_at: string;
}

export const fetchTags = async (): Promise<DbTag[]> => {
  const { data, error } = await supabase
    .from('product_tags')
    .select('*')
    .order('display_order', { ascending: true });
  if (error) throw error;
  return (data || []) as DbTag[];
};

export const createTag = async (tag: { name_sv: string; slug: string; color?: string; name_en?: string | null }): Promise<DbTag> => {
  const { data, error } = await supabase
    .from('product_tags')
    .insert([tag])
    .select()
    .single();
  if (error) throw error;
  return data as DbTag;
};

export const updateTag = async (id: string, tag: Partial<DbTag>): Promise<DbTag> => {
  const { data, error } = await supabase
    .from('product_tags')
    .update(tag)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTag;
};

export const deleteTag = async (id: string): Promise<void> => {
  const { error } = await supabase.from('product_tags').delete().eq('id', id);
  if (error) throw error;
};

// Product-tag relations
export const fetchProductTagIds = async (productId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from('product_tag_relations')
    .select('tag_id')
    .eq('product_id', productId);
  if (error) throw error;
  return (data || []).map(r => r.tag_id);
};

export const setProductTags = async (productId: string, tagIds: string[]): Promise<void> => {
  await supabase.from('product_tag_relations').delete().eq('product_id', productId);
  if (tagIds.length > 0) {
    const rows = tagIds.map(tid => ({ product_id: productId, tag_id: tid }));
    const { error } = await supabase.from('product_tag_relations').insert(rows);
    if (error) throw error;
  }
};
