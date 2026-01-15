import { motion } from 'framer-motion';
import { Check, Rocket, Sparkles, Users, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

const ImpactSection = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      eyebrow: 'Vår Resa',
      title: 'Vi är i uppstartsfasen',
      titleHighlight: '– och det är vår styrka',
      description: 'Varje produkt du köper från oss är inte bara ett köp. Det är ett bidrag till något större.',
      promises: [
        { icon: Users, text: 'Ett steg mot fler jobb i Sverige' },
        { icon: Sparkles, text: 'Ett steg mot giftfria hem' },
        { icon: Check, text: 'Ett steg mot transparent handel' },
        { icon: Rocket, text: 'Ditt bidrag till vår gemensamma framtid' }
      ],
      footer: 'Just nu är vi små, men vi tänker stort.',
      cta: 'Din första order gör skillnad',
      ctaButton: 'Utforska produkter'
    },
    en: {
      eyebrow: 'Our Journey',
      title: "We're in the startup phase",
      titleHighlight: '– and that is our strength',
      description: 'Every product you buy from us is not just a purchase. It is a contribution to something bigger.',
      promises: [
        { icon: Users, text: 'A step towards more jobs in Sweden' },
        { icon: Sparkles, text: 'A step towards toxin-free homes' },
        { icon: Check, text: 'A step towards transparent trade' },
        { icon: Rocket, text: 'Your contribution to our shared future' }
      ],
      footer: "Right now we're small, but we think big.",
      cta: 'Your first order makes a difference',
      ctaButton: 'Explore products'
    }
  };

  const t = content[language];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Rocket className="w-4 h-4" />
            {t.eyebrow}
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-2">
            {t.title}
          </h2>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t.titleHighlight}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.description}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-2xl mx-auto mb-12"
        >
          <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-8">
            <div className="space-y-4">
              {t.promises.map((promise, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex items-center gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                    <promise.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-lg text-foreground/90">{promise.text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-6"
        >
          <p className="text-xl font-medium text-foreground italic">
            {t.footer}
          </p>
          <p className="text-primary font-semibold text-lg">
            {t.cta}
          </p>
          <Link to="/shop">
            <Button
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 text-primary-foreground font-semibold px-8 group"
            >
              {t.ctaButton}
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default ImpactSection;