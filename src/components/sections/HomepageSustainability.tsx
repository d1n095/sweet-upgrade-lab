import { motion } from 'framer-motion';
import { Leaf, Droplets, Recycle } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { PageSection } from '@/hooks/usePageSections';

interface Props {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const HomepageSustainability = ({ getSection }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const section = getSection?.('sustainability');
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const title = section ? getLang(section.title_sv, section.title_en) : (lang === 'sv' ? 'Hållbarhet' : 'Sustainability');
  const content = section ? getLang(section.content_sv, section.content_en) : (lang === 'sv' ? 'Vi tror på en hållbar framtid.' : 'We believe in a sustainable future.');

  const items = lang === 'sv'
    ? [
        { icon: Leaf, label: 'Naturliga ingredienser' },
        { icon: Recycle, label: 'Återvinningsbar förpackning' },
        { icon: Droplets, label: 'Ingen djurtestning' },
      ]
    : [
        { icon: Leaf, label: 'Natural ingredients' },
        { icon: Recycle, label: 'Recyclable packaging' },
        { icon: Droplets, label: 'Cruelty-free' },
      ];

  return (
    <section className="py-28 md:py-36 border-t border-border/30 bg-secondary/20">
      <div className="container mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-semibold mb-4 text-foreground"
          >
            {title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-sm text-muted-foreground/80 leading-relaxed mb-12"
          >
            {content}
          </motion.p>
          <div className="grid grid-cols-3 gap-6">
            {items.map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-background border border-border flex items-center justify-center">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomepageSustainability;
