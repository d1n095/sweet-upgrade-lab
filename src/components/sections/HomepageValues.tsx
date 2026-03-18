import { motion } from 'framer-motion';
import { Heart, Eye, Shield, Sparkles } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { PageSection } from '@/hooks/usePageSections';

interface Props {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const HomepageValues = ({ getSection }: Props) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const section = getSection?.('values');
  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const title = section ? getLang(section.title_sv, section.title_en) : (lang === 'sv' ? 'Våra värderingar' : 'Our values');
  const content = section ? getLang(section.content_sv, section.content_en) : '';

  const values = lang === 'sv'
    ? [
        { icon: Eye, title: 'Transparens', desc: 'Full insyn i ingredienser och ursprung.' },
        { icon: Shield, title: 'Kvalitet', desc: 'Noggrant utvalda och testade produkter.' },
        { icon: Heart, title: 'Ärlighet', desc: 'Inga dolda tillsatser eller falska löften.' },
        { icon: Sparkles, title: 'Innovation', desc: 'Ständig jakt på bättre alternativ.' },
      ]
    : [
        { icon: Eye, title: 'Transparency', desc: 'Full insight into ingredients and origin.' },
        { icon: Shield, title: 'Quality', desc: 'Carefully selected and tested products.' },
        { icon: Heart, title: 'Honesty', desc: 'No hidden additives or false promises.' },
        { icon: Sparkles, title: 'Innovation', desc: 'Constant pursuit of better alternatives.' },
      ];

  return (
    <section className="py-28 md:py-36 border-t border-border/30">
      <div className="container mx-auto px-5">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-semibold text-center mb-4 text-foreground"
          >
            {title}
          </motion.h2>
          {content && (
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-sm text-muted-foreground/80 text-center mb-16"
            >
              {content}
            </motion.p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {values.map(({ icon: Icon, title: t, desc }, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-5 h-5 text-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5 text-foreground">{t}</h3>
                <p className="text-[13px] text-muted-foreground/70 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomepageValues;
