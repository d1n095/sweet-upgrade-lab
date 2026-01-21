import { motion } from 'framer-motion';
import { Check, X, Leaf, Heart, AlertTriangle, TrendingUp, Users, TreePine } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useDonationStats } from '@/hooks/useDonationStats';

const About = () => {
  const { language } = useLanguage();
  const donationStats = useDonationStats();
  
  const content = {
    sv: {
      eyebrow: 'Om oss',
      title: 'Vi är i uppstartsfasen',
      titleHighlight: '– och det är vår fördel',
      description: '4thepeople grundades 2026 med en enkel idé: göra det enklare att hitta giftfria alternativ utan att det kostar skjortan. Vi är inte stora. Vi är inte etablerade. Vi är noggranna.',
      transparency: {
        title: '🔍 Transparent affärsmodell',
        text: 'Vi är en dropshipping-butik – men vi är selektiva. Vi väljer leverantörer med spårbar kvalitet och granskar internationella certifieringar noggrant innan produkter läggs upp.'
      },
      promises: {
        title: 'Vad vi gör:',
        items: [
          'Granskar internationella certifieringar',
          'Väljer leverantörer med spårbar kvalitet',
          'Analyserar globala användarrecensioner',
          'Finns här om du har frågor (på svenska och engelska)'
        ]
      },
      notPromises: {
        title: 'Vad vi INTE gör och ALDRIG kommer göra:',
        items: [
          'Lovar mirakelprodukter som botar allt',
          'Påstår att vi testar varje produkt fysiskt',
          'Använder falska omdömen eller fejkad social proof',
          'Lovar blixtsnabb leverans (vi är ärliga om 7-10 arbetsdagar)',
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
      description: "4thepeople was founded in 2026 with a simple idea: make it easier to find toxin-free alternatives without breaking the bank. We're not big. We're not established. We're thorough.",
      transparency: {
        title: '🔍 Transparent business model',
        text: "We're a dropshipping store – but we're selective. We choose suppliers with traceable quality and carefully review international certifications before listing products."
      },
      promises: {
        title: 'What we do:',
        items: [
          'Review international certifications',
          'Choose suppliers with traceable quality',
          'Analyze global user reviews',
          "We're here if you have questions (in Swedish and English)"
        ]
      },
      notPromises: {
        title: 'What we do NOT and will NEVER do:',
        items: [
          'Promise miracle products that cure everything',
          'Claim we physically test every product',
          'Use fake reviews or fake social proof',
          "Promise lightning-fast delivery (we're honest about 7-10 business days)",
          'Pretend to be a large established company',
          "Hide that we're dropshipping"
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

          {/* Donation Impact Section */}
          {(donationStats.totalDonated > 0 || donationStats.familiesHelped > 0 || donationStats.treesPlanted > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-10"
            >
              <div className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 border border-primary/20 rounded-2xl p-6 md:p-8">
                <div className="text-center mb-6">
                  <h3 className="font-display text-xl font-semibold mb-2">
                    {language === 'sv' ? '🌱 Vår gemensamma påverkan' : '🌱 Our Collective Impact'}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {language === 'sv' 
                      ? 'Tack vare er har vi tillsammans bidragit till:' 
                      : 'Thanks to you, together we have contributed to:'}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-xl bg-background/50">
                    <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-primary">{donationStats.totalDonated} kr</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'sv' ? 'Totalt donerat' : 'Total donated'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-background/50">
                    <Users className="w-6 h-6 text-accent mx-auto mb-2" />
                    <p className="text-2xl font-bold text-accent">{donationStats.familiesHelped}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'sv' ? 'Familjer hjälpta' : 'Families helped'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-background/50">
                    <TreePine className="w-6 h-6 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-600">{donationStats.treesPlanted}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'sv' ? 'Träd planterade' : 'Trees planted'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

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