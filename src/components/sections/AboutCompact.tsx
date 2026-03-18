import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

const AboutCompact = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const content = {
    sv: {
      title: 'Om 4thepeople',
      text: 'Giftfria produkter, granskade mot internationella certifieringar.',
      footer: 'Kvalitet framför kvantitet.',
    },
    en: {
      title: 'About 4thepeople',
      text: 'Toxin-free products, reviewed against international certifications.',
      footer: 'Quality over quantity.',
    },
  };

  const t = content[lang];

  return (
    <section id="about" className="py-24 md:py-32 border-t border-border/30">
      <div className="container mx-auto px-5">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-semibold mb-4 text-foreground"
          >
            {t.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-sm text-muted-foreground leading-[1.8] mb-5"
          >
            {t.text}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-xs font-medium text-muted-foreground/70"
          >
            {t.footer}
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default AboutCompact;
