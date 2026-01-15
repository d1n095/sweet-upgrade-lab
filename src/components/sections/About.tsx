import { motion } from 'framer-motion';
import { Check, X, Leaf, Heart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const About = () => {
  const { language } = useLanguage();
  
  const content = {
    sv: {
      eyebrow: 'Om oss',
      title: 'Vi är i uppstartsfasen',
      titleHighlight: '– och det är vår fördel',
      description: '4thepeople startar 2026 med en enkel idé: erbjuda giftfria alternativ utan att det kostar skjortan. Vi är inte stora. Vi är inte etablerade. Vi är noggranna.',
      promises: {
        title: 'Vad vi lovar:',
        items: [
          'Vi testar varje produkt själva',
          'Vi ger ärlig information',
          'Vi finns här om du har frågor',
          'Vi växer med ditt förtroende'
        ]
      },
      notPromises: {
        title: 'Vad vi ALDRIG kommer göra:',
        items: [
          'Sälja "mirakelkurer" – det finns inga genvägar',
          'Hitta på recensioner eller omdömen',
          'Överdriva produkters effekt för att sälja mer',
          'Dölja ursprung eller ingredienser'
        ]
      },
      footer: 'Din order gör skillnad – för dig, för miljön, för framtiden.'
    },
    en: {
      eyebrow: 'About us',
      title: "We're in the startup phase",
      titleHighlight: '– and that is our advantage',
      description: "4thepeople launches in 2026 with a simple idea: offer toxin-free alternatives without breaking the bank. We're not big. We're not established. We're careful.",
      promises: {
        title: 'What we promise:',
        items: [
          'We test every product ourselves',
          'We give honest information',
          "We're here if you have questions",
          'We grow with your trust'
        ]
      },
      notPromises: {
        title: 'What we will NEVER do:',
        items: [
          'Sell "miracle cures" – there are no shortcuts',
          'Make up reviews or testimonials',
          'Exaggerate product effects to sell more',
          'Hide origins or ingredients'
        ]
      },
      footer: 'Your order makes a difference – for you, for the environment, for the future.'
    }
  };

  const t = content[language];

  return (
    <section id="about" className="py-20 md:py-28 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
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

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* What we promise */}
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

            {/* What we don't promise */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-secondary border border-border rounded-2xl p-6 md:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{t.notPromises.title}</h3>
              </div>
              <ul className="space-y-4">
                {t.notPromises.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-accent/10 border border-accent/20">
              <Leaf className="w-5 h-5 text-accent" />
              <p className="text-foreground font-medium">{t.footer}</p>
              <Heart className="w-5 h-5 text-accent" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;