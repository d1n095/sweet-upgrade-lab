import { motion } from 'framer-motion';
import { Users, TrendingUp, Gift, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

const AffiliatePromo = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      badge: 'Bli en del av teamet',
      title: 'Tjäna pengar på att rekommendera produkter du älskar',
      description: 'Få din egen rabattkod och tjäna provision på varje försäljning. Ingen startavgift, ingen risk.',
      cta: 'Ansök nu',
      benefits: [
        { icon: Gift, text: '10-15% provision per order' },
        { icon: Users, text: 'Din egen unika rabattkod' },
        { icon: TrendingUp, text: 'Flexibel utbetalning' },
      ],
    },
    en: {
      badge: 'Join our team',
      title: 'Earn money recommending products you love',
      description: 'Get your own discount code and earn commission on every sale. No startup fee, no risk.',
      cta: 'Apply now',
      benefits: [
        { icon: Gift, text: '10-15% commission per order' },
        { icon: Users, text: 'Your own unique discount code' },
        { icon: TrendingUp, text: 'Flexible payouts' },
      ],
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <section className="relative py-16 md:py-24 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Users className="w-4 h-4" />
            {t.badge}
          </span>

          {/* Title */}
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t.title}
          </h2>

          {/* Description */}
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            {t.description}
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-10">
            {t.benefits.map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex items-center gap-2 text-foreground/80"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <benefit.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium">{benefit.text}</span>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <Link to="/affiliate">
            <Button size="lg" className="group">
              {t.cta}
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default AffiliatePromo;
