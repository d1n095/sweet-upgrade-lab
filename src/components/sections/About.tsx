import { motion } from 'framer-motion';
import { Check, X, Leaf, Heart, AlertTriangle, TrendingUp } from 'lucide-react';
import { useLanguage, getContentLang } from '@/context/LanguageContext';
import { useDonationStats } from '@/hooks/useDonationStats';

const About = () => {
  const { language } = useLanguage();
  const lang = getContentLang(language);
  const donationStats = useDonationStats();
  
  const content = {
    sv: {
      eyebrow: 'Om oss',
      title: 'Vi är i uppstartsfasen',
      titleHighlight: '– och det är vår fördel',
      description: '4thepeople grundades 2026 med en enkel idé: göra det enklare att hitta giftfria alternativ utan att det kostar skjortan. Vi är inte stora. Vi är inte etablerade. Vi är noggranna.',
      transparency: {
        title: 'Transparent affärsmodell',
        text: 'Vi är en dropshipping-butik – men vi är selektiva. Vi väljer leverantörer med spårbar kvalitet och granskar internationella certifieringar noggrant innan produkter läggs upp.'
      },
      promises: {
        title: 'Vad vi gör',
        items: [
          'Granskar internationella certifieringar',
          'Väljer leverantörer med spårbar kvalitet',
          'Analyserar globala användarrecensioner',
          'Finns här om du har frågor'
        ]
      },
      notPromises: {
        title: 'Vad vi aldrig gör',
        items: [
          'Lovar mirakelprodukter',
          'Använder falska omdömen',
          'Lovar blixtsnabb leverans',
          'Gömmer att vi är dropshipping'
        ]
      },
      footer: 'Dropshipping – men selektiva. Små – men ärliga.',
      impact: 'Vår gemensamma påverkan',
      impactSub: 'Totalt insamlat',
    },
    en: {
      eyebrow: 'About us',
      title: "We're in the startup phase",
      titleHighlight: '– and that is our advantage',
      description: "4thepeople was founded in 2026 with a simple idea: make it easier to find toxin-free alternatives without breaking the bank. We're not big. We're not established. We're thorough.",
      transparency: {
        title: 'Transparent business model',
        text: "We're a dropshipping store – but we're selective. We choose suppliers with traceable quality and carefully review international certifications before listing products."
      },
      promises: {
        title: 'What we do',
        items: [
          'Review international certifications',
          'Choose suppliers with traceable quality',
          'Analyze global user reviews',
          "Here if you have questions"
        ]
      },
      notPromises: {
        title: 'What we never do',
        items: [
          'Promise miracle products',
          'Use fake reviews',
          "Promise instant delivery",
          "Hide that we're dropshipping"
        ]
      },
      footer: "Dropshipping – but selective. Small – but honest.",
      impact: 'Our Collective Impact',
      impactSub: 'Total collected',
    }
  };

  const t = content[lang];

  return (
    <section id="about" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-xs font-semibold text-accent uppercase tracking-widest mb-4 block">
              {t.eyebrow}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
              {t.title}
              <span className="text-accent"> {t.titleHighlight}</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t.description}
            </p>
          </motion.div>

          {/* Transparency notice */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-accent/5 border border-accent/15 rounded-2xl p-5 md:p-6 mb-10 text-center"
          >
            <p className="font-semibold text-sm mb-1">{t.transparency.title}</p>
            <p className="text-muted-foreground text-sm">{t.transparency.text}</p>
          </motion.div>

          {/* Promises grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-accent" />
                </div>
                {t.promises.title}
              </h3>
              <ul className="space-y-2.5">
                {t.promises.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-foreground/80">
                    <Check className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6"
            >
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-destructive/15 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-destructive" />
                </div>
                {t.notPromises.title}
              </h3>
              <ul className="space-y-2.5">
                {t.notPromises.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <X className="w-3.5 h-3.5 text-destructive/60 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* Impact */}
          {donationStats.totalDonated > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-card border border-border rounded-2xl p-6 mb-10 text-center"
            >
              <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">{t.impact}</p>
              <p className="text-3xl font-bold text-foreground">{donationStats.totalDonated} kr</p>
              <p className="text-xs text-muted-foreground mt-1">{t.impactSub}</p>
            </motion.div>
          )}

          {/* Footer line */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-sm font-medium text-muted-foreground"
          >
            {t.footer}
          </motion.p>
        </div>
      </div>
    </section>
  );
};

export default About;
