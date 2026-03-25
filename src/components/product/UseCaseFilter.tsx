import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Tag {
  id: string;
  name_sv: string;
  name_en: string | null;
  slug: string;
  color: string | null;
  display_order?: number | null;
}

interface Props {
  selectedTagId: string | null;
  onSelect: (tagId: string | null) => void;
}

const UseCaseFilter = ({ selectedTagId, onSelect }: Props) => {
  const { language } = useLanguage();
  const lang = language === 'no' || language === 'da' ? 'sv' : language;
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    const load = async () => {
      // Show only tags that are actually connected to visible + sellable products
      const { data: visibleProducts } = await supabase
        .from('products')
        .select('id')
        .eq('is_visible', true)
        .eq('is_sellable', true);

      const visibleProductIds = (visibleProducts || []).map((p: { id: string }) => p.id);
      if (visibleProductIds.length === 0) {
        setTags([]);
        return;
      }

      const { data: relations } = await supabase
        .from('product_tag_relations')
        .select('tag_id')
        .in('product_id', visibleProductIds);

      const tagIds = [...new Set((relations || []).map((r: { tag_id: string }) => r.tag_id))];
      if (tagIds.length === 0) {
        setTags([]);
        return;
      }

      const { data: tagRows } = await supabase
        .from('product_tags')
        .select('id, name_sv, name_en, slug, color, display_order')
        .in('id', tagIds)
        .order('display_order');

      setTags((tagRows || []) as Tag[]);
    };
    load();
  }, []);

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-4 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-[0.97]',
          !selectedTagId
            ? 'bg-foreground text-background border-foreground'
            : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
        )}
      >
        {lang === 'sv' ? 'Alla' : 'All'}
      </button>
      {tags.map(tag => {
        const name = lang === 'en' && tag.name_en ? tag.name_en : tag.name_sv;
        const isActive = selectedTagId === tag.id;
        return (
          <button
            key={tag.id}
            onClick={() => onSelect(isActive ? null : tag.id)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-[0.97]',
              isActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-muted-foreground border-border hover:border-foreground/30'
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
};

export default UseCaseFilter;
