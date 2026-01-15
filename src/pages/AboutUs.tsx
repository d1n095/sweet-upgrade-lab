import { motion } from 'framer-motion';
import { Leaf, Heart, Shield, Truck, Users, Award } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import SEOHead from '@/components/seo/SEOHead';

const AboutUs = () => {
  const { language } = useLanguage();

  const values = [
    {
      icon: Leaf,
      title: { sv: 'Hållbarhet', en: 'Sustainability' },
      description: { 
        sv: 'Vi väljer produkter som är skonsamma mot miljön och tillverkade med hållbara material.',
        en: 'We choose products that are gentle on the environment and made with sustainable materials.'
      },
    },
    {
      icon: Shield,
      title: { sv: 'Giftfritt', en: 'Toxin-free' },
      description: { 
        sv: 'Alla våra produkter är fria från skadliga kemikalier och tillsatser.',
        en: 'All our products are free from harmful chemicals and additives.'
      },
    },
    {
      icon: Heart,
      title: { sv: 'Kvalitet', en: 'Quality' },
      description: { 
        sv: 'Vi kompromissar aldrig med kvaliteten. Varje produkt är noggrant utvald.',
        en: 'We never compromise on quality. Every product is carefully selected.'
      },
    },
    {
      icon: Users,
      title: { sv: 'Gemenskap', en: 'Community' },
      description: { 
        sv: 'Vi bygger en gemenskap av människor som bryr sig om sin hälsa och planeten.',
        en: 'We build a community of people who care about their health and the planet.'
      },
    },
  ];

  const timeline = [
    {
      year: '2024',
      title: { sv: 'Idén föds', en: 'The idea is born' },
      description: { 
        sv: 'Vi såg ett behov av hållbara produkter som inte kompromissar med kvalitet.',
        en: 'We saw a need for sustainable products that don\'t compromise on quality.'
      },
    },
    {
      year: '2025',
      title: { sv: 'Första produkterna', en: 'First products' },
      description: { 
        sv: 'Vi lanserade våra första produkter inom teknik och kroppsvård.',
        en: 'We launched our first products in tech and body care.'
      },
    },
    {
      year: '2026',
      title: { sv: 'Expansion', en: 'Expansion' },
      description: { 
        sv: 'Vi utökar sortimentet med hampa-kläder och fler naturliga produkter.',
        en: 'We expand our range with hemp clothing and more natural products.'
      },
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={language === 'sv' ? 'Om Oss - Vår Historia' : 'About Us - Our Story'}
        description={language === 'sv' 
          ? 'Lär känna 4thepeople - ett svenskt företag med passion för hållbara och naturliga produkter.'
          : 'Get to know 4thepeople - a Swedish company with a passion for sustainable and natural products.'}
        keywords="om oss, hållbarhet, giftfritt, naturligt, svenskt företag"
        canonical="/about"
      />
      <Header />
      
      <main className="pt-24 pb-20">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Leaf className="w-4 h-4" />
              {language === 'sv' ? 'Vår Historia' : 'Our Story'}
            </span>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6">
              {language === 'sv' ? 'Om ' : 'About '}
              <span className="text-gradient">4ThePeople</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {language === 'sv' 
                ? 'Vi är ett svenskt företag med en passion för hållbara och naturliga produkter. Vår vision är att göra det enkelt för alla att leva ett renare liv – utan att kompromissa med kvalitet eller stil.'
                : 'We are a Swedish company with a passion for sustainable and natural products. Our vision is to make it easy for everyone to live a cleaner life – without compromising on quality or style.'}
            </p>
          </motion.div>
        </section>

        {/* Values Section */}
        <section className="bg-card border-y border-border/50 py-20 mb-20">
          <div className="container mx-auto px-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-display text-3xl md:text-4xl font-semibold text-center mb-12"
            >
              {language === 'sv' ? 'Våra Värderingar' : 'Our Values'}
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
                    {value.title[language]}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {value.description[language]}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Story/Timeline Section */}
        <section className="container mx-auto px-4 mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl font-semibold text-center mb-12"
          >
            {language === 'sv' ? 'Vår Resa' : 'Our Journey'}
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
                    {item.title[language]}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description[language]}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Mission Statement */}
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 md:p-12 text-center max-w-3xl mx-auto"
          >
            <Award className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-display text-2xl md:text-3xl font-semibold mb-4">
              {language === 'sv' ? 'Vårt Löfte' : 'Our Promise'}
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {language === 'sv'
                ? 'Vi lovar att alltid prioritera kvalitet, hållbarhet och din hälsa. Varje produkt i vårt sortiment har valts med omsorg för att ge dig det bästa – för dig och för planeten.'
                : 'We promise to always prioritize quality, sustainability and your health. Every product in our range has been chosen with care to give you the best – for you and for the planet.'}
            </p>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AboutUs;
