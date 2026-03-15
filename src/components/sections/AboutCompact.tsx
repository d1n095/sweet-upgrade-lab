import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

const AboutCompact = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const content = {
    sv: {
      title: 'Om 4thepeople',
      text: 'Vi grundades 2026 för att erbjuda noggrant utvalda, giftfria produkter. Varje artikel granskas mot internationella certifieringar innan den når vår butik.',
      footer: 'Kvalitet framför kvantitet.',
    },
    en: {
      title: 'About 4thepeople',
      text: 'Founded in 2026 to offer carefully curated, toxin-free products. Every item is reviewed against international certifications before it reaches our store.',
      footer: 'Quality over quantity.',
    },
  };

  const t = content[lang];

  return (
    <section id="about" className="py-16 md:py-24 border-t border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-lg mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold mb-4 text-foreground"
          >
            {t.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="text-sm text-muted-foreground leading-relaxed mb-6"
          >
            {t.text}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.16 }}
            className="text-xs font-medium text-muted-foreground"
          >
            {t.footer}
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default AboutCompact;
