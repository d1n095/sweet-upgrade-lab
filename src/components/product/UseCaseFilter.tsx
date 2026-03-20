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
      const { data } = await supabase
        .from('product_tags')
        .select('id, name_sv, name_en, slug, color')
        .order('display_order');
      setTags((data || []) as Tag[]);
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
