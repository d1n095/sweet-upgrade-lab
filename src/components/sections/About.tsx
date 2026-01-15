import { motion } from 'framer-motion';
import { Check, X, Leaf, Heart, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const About = () => {
  const { language } = useLanguage();
  
  const content = {
    sv: {
      eyebrow: 'Om oss',
      title: 'Vi är i uppstartsfasen',
      titleHighlight: '– och det är vår fördel',
      description: '4thepeople startar 2026 med en enkel idé: göra det enklare att hitta giftfria alternativ utan att det kostar skjortan. Vi är inte stora. Vi är inte etablerade. Vi är noggranna i vår research.',
      transparency: {
        title: '🔍 Transparent affärsmodell',
        text: 'Vi är en dropshipping-butik – men vi är selektiva. Vi väljer leverantörer med spårbar kvalitet och granskar varje produkt noggrant innan den läggs upp.'
      },
      promises: {
        title: 'Vad vi gör:',
        items: [
          'Granskar ingredienser och certifieringar',
          'Väljer leverantörer med spårbar kvalitet',
          'Läser tusentals användarrecensioner',
          'Finns här om du har frågor'
        ]
      },
      notPromises: {
        title: 'Vad vi INTE gör och ALDRIG kommer göra:',
        items: [
          'Lovar mirakelprodukter som botar allt',
          'Påstår att vi testar varje produkt fysiskt (omöjligt i dropshipping)',
          'Använder falska omdömen eller fejkad social proof',
          'Lovar 2-dagars leverans från Kina (vi är ärliga om 5-10 dagar)',
          'Påstår att vi är ett stort etablerat företag',
          'Gömmer att vi är dropshipping'
        ]
      },
      footer: 'Vi är dropshipping – men vi är selektiva. Vi är små – men vi är ärliga.',
      footerSub: 'Din order gör skillnad – för dig, för miljön, för framtiden.'
    },
    en: {
      eyebrow: 'About us',
      title: "We're in the startup phase",
      titleHighlight: '– and that is our advantage',
      description: "4thepeople launches in 2026 with a simple idea: make it easier to find toxin-free alternatives without breaking the bank. We're not big. We're not established. We're thorough in our research.",
      transparency: {
        title: '🔍 Transparent business model',
        text: "We're a dropshipping store – but we're selective. We choose suppliers with traceable quality and carefully review every product before listing it."
      },
      promises: {
        title: 'What we do:',
        items: [
          'Review ingredients and certifications',
          'Choose suppliers with traceable quality',
          'Read thousands of user reviews',
          "We're here if you have questions"
        ]
      },
      notPromises: {
        title: 'What we do NOT and will NEVER do:',
        items: [
          'Promise miracle products that cure everything',
          'Claim we physically test every product (impossible in dropshipping)',
          'Use fake reviews or fake social proof',
          'Promise 2-day delivery from China (we\'re honest about 5-10 days)',
          'Pretend to be a large established company',
          'Hide that we\'re dropshipping'
        ]
      },
      footer: "We're dropshipping – but we're selective. We're small – but we're honest.",
      footerSub: 'Your order makes a difference – for you, for the environment, for the future.'
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  return (
    <section id="about" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <span className="inline-block text-sm font-medium text-primary uppercase tracking-wider mb-4">
              {t.eyebrow}
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-2">
              {t.title}
            </h2>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-primary">
              {t.titleHighlight}
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              {t.description}
            </p>
          </motion.div>

          {/* Transparency notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-accent/10 border border-accent/20 rounded-2xl p-6 mb-10 text-center"
          >
            <h3 className="font-semibold text-lg mb-2">{t.transparency.title}</h3>
            <p className="text-muted-foreground">{t.transparency.text}</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 mb-10">
            {/* What we do */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <Check className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{t.promises.title}</h3>
              </div>
              <ul className="space-y-4">
                {t.promises.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* What we don't do */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg">{t.notPromises.title}</h3>
              </div>
              <ul className="space-y-3">
                {t.notPromises.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-destructive/70 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center space-y-3"
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-secondary border border-border">
              <Leaf className="w-5 h-5 text-primary" />
              <p className="text-foreground font-semibold">{t.footer}</p>
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">{t.footerSub}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;