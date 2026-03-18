import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { PageSection } from '@/hooks/usePageSections';

interface Props {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

interface TimelineEntry {
  id: string;
  year: string;
  title_sv: string;
  title_en: string | null;
  description_sv: string | null;
  description_en: string | null;
}

const HomepageTimeline = ({ getSection }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const section = getSection?.('timeline');
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const title = section ? getLang(section.title_sv, section.title_en) : (lang === 'sv' ? 'Vår resa' : 'Our journey');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('timeline_entries')
        .select('id, year, title_sv, title_en, description_sv, description_en')
        .eq('is_visible', true)
        .order('display_order', { ascending: true })
        .limit(5);
      if (data) setEntries(data);
    };
    load();
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="py-28 md:py-36 border-t border-border/30">
      <div className="container mx-auto px-5">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-2xl md:text-3xl font-semibold text-center mb-16 text-foreground"
        >
          {title}
        </motion.h2>

        <div className="max-w-2xl mx-auto relative">
          {/* Vertical line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2" />

          <div className="space-y-10">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative flex items-start gap-6 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
              >
                <div className="absolute left-4 md:left-1/2 w-3 h-3 rounded-full bg-foreground border-2 border-background -translate-x-1/2 mt-1.5 z-10" />
                <div className={`ml-10 md:ml-0 md:w-[calc(50%-2rem)] ${i % 2 === 0 ? 'md:text-right md:pr-8' : 'md:text-left md:pl-8'}`}>
                  <span className="text-xs font-bold text-primary">{entry.year}</span>
                  <h3 className="text-sm font-semibold text-foreground mt-1">
                    {getLang(entry.title_sv, entry.title_en)}
                  </h3>
                  {(entry.description_sv || entry.description_en) && (
                    <p className="text-[13px] text-muted-foreground/70 mt-1 leading-relaxed">
                      {getLang(entry.description_sv, entry.description_en)}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomepageTimeline;
