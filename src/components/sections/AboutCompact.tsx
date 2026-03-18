import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { PageSection } from '@/hooks/usePageSections';

interface AboutCompactProps {
  sections?: PageSection[];
  getSection?: (key: string) => PageSection | undefined;
  isSectionVisible?: (key: string) => boolean;
}

const AboutCompact = ({ getSection, isSectionVisible }: AboutCompactProps) => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const getLang = (sv: string | null | undefined, en: string | null | undefined) =>
    (lang === 'sv' ? sv : en) || sv || '';

  const section = getSection?.('about_compact');

  if (isSectionVisible && !isSectionVisible('about_compact')) return null;

  const title = section
    ? getLang(section.title_sv, section.title_en)
    : (lang === 'sv' ? 'Om 4thepeople' : 'About 4thepeople');

  const text = section
    ? getLang(section.content_sv, section.content_en)
    : (lang === 'sv'
      ? 'Giftfria produkter, granskade mot internationella certifieringar.'
      : 'Toxin-free products, reviewed against international certifications.');

  return (
    <section id="about" className="py-28 md:py-36 border-t border-border/30">
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
            className="text-sm text-muted-foreground/80 leading-[1.8] mb-6"
          >
            {text}
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default AboutCompact;
