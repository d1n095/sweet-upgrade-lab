import { motion } from 'framer-motion';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

const AboutCompact = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);

  const content = {
    sv: {
      title: 'Om 4thepeople',
      text: 'Grundat 2026 med en enkel idé: göra det enklare att hitta giftfria alternativ. Vi är en selektiv dropshipping-butik som granskar varje produkt noggrant innan den säljs.',
      footer: 'Små – men ärliga.',
    },
    en: {
      title: 'About 4thepeople',
      text: 'Founded in 2026 with a simple idea: make it easier to find toxin-free alternatives. We're a selective dropshipping store that carefully reviews every product before listing it.',
      footer: 'Small – but honest.',
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
