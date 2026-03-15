import { motion } from 'framer-motion';
import { Leaf, Heart, Shield, Users, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';

const AboutUs = () => {
  const { t, contentLang } = useLanguage();
  const lang = contentLang;

  const getLang = (obj: { sv: string; en: string }) => obj[lang];

  const values = [
    {
      icon: Leaf,
      title: { sv: 'Hållbarhet', en: 'Sustainability' },
      description: { 
        sv: 'Produkter som respekterar både dig och planeten.',
        en: 'Products that respect both you and the planet.'
      },
    },
    {
      icon: Shield,
      title: { sv: 'Giftfritt', en: 'Toxin-free' },
      description: { 
        sv: 'Fria från skadliga kemikalier. Utan undantag.',
        en: 'Free from harmful chemicals. No exceptions.'
      },
    },
    {
      icon: Heart,
      title: { sv: 'Kvalitet', en: 'Quality' },
      description: { 
        sv: 'Noggrant utvalt. Aldrig kompromisser.',
        en: 'Carefully curated. Never compromised.'
      },
    },
    {
      icon: Users,
      title: { sv: 'Transparens', en: 'Transparency' },
      description: { 
        sv: 'Full insyn i hur vi väljer och granskar varje produkt.',
        en: 'Full visibility into how we select and review every product.'
      },
    },
  ];

  const timeline = [
    {
      year: '2024',
      title: { sv: 'Idén föds', en: 'The idea is born' },
      description: { 
        sv: 'Ett behov av renare alternativ – utan kompromisser på kvalitet.',
        en: 'A need for cleaner alternatives – without compromising quality.'
      },
    },
    {
      year: '2025',
      title: { sv: 'Första produkterna', en: 'First products' },
      description: { 
        sv: 'Lansering av våra första kategorier: teknik och kroppsvård.',
        en: 'Launch of our first categories: tech and body care.'
      },
    },
    {
      year: '2026',
      title: { sv: 'Expansion', en: 'Expansion' },
      description: { 
        sv: 'Fler kategorier. Fler certifieringar. Samma standard.',
        en: 'More categories. More certifications. Same standards.'
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t('about.page.ourstory')}
        description={t('about.page.intro')}
        keywords="om oss, hållbarhet, giftfritt, naturligt, europeiskt företag"
        canonical="/about"
      />
      <Header />
      
      <main className="pt-24 pb-20">
        <section className="container mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Leaf className="w-4 h-4" />
              {t('about.page.ourstory')}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {t('about.page.about')}{' '}
              <span className="text-gradient">4ThePeople</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {t('about.page.intro')}
            </p>
          </motion.div>
        </section>

        <section className="bg-card border-y border-border/50 py-20 mb-20">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl md:text-4xl font-semibold text-center mb-12"
            >
              {t('about.page.values')}
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {values.map((value, index) => (
                <motion.div
                  key={value.title.sv}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-semibold mb-2">
                    {getLang(value.title)}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {getLang(value.description)}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl font-semibold text-center mb-12"
          >
            {t('about.page.journey')}
          </motion.h2>

          <div className="max-w-2xl mx-auto">
            {timeline.map((item, index) => (
              <motion.div
                key={item.year}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex gap-6 mb-8 last:mb-0"
              >
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-display font-semibold text-primary">
                    {item.year.slice(-2)}
                  </div>
                  {index < timeline.length - 1 && (
                    <div className="w-px h-full bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-8">
                  <span className="text-sm text-primary font-medium">{item.year}</span>
                  <h3 className="font-display text-xl font-semibold mt-1 mb-2">
                    {getLang(item.title)}
                  </h3>
                  <p className="text-muted-foreground">
                    {getLang(item.description)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 md:p-12 text-center max-w-3xl mx-auto"
          >
            <Award className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-display text-2xl md:text-3xl font-semibold mb-4">
              {t('about.page.promise')}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {t('about.page.promisetext')}
            </p>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutUs;
