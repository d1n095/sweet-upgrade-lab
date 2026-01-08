import { motion } from 'framer-motion';
import { Shield, Leaf, RotateCcw, Truck } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const TrustBadges = () => {
  const { language } = useLanguage();

  const badges = [
    {
      icon: Shield,
      title: { sv: 'Säker betalning', en: 'Secure payment' },
      description: { sv: 'Krypterad checkout', en: 'Encrypted checkout' }
    },
    {
      icon: Leaf,
      title: { sv: '100% Naturligt', en: '100% Natural' },
      description: { sv: 'Inga gifter eller kemikalier', en: 'No toxins or chemicals' }
    },
    {
      icon: RotateCcw,
      title: { sv: '30 dagars öppet köp', en: '30-day returns' },
      description: { sv: 'Enkelt & smidigt', en: 'Easy & hassle-free' }
    },
    {
      icon: Truck,
      title: { sv: 'Snabb leverans', en: 'Fast delivery' },
      description: { sv: 'Direkt till din dörr', en: 'Straight to your door' }
    }
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            {language === 'sv' ? 'Varför välja ' : 'Why choose '}
            <span className="text-gradient">4thepeople</span>?
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {badges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-6 text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <badge.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="font-semibold text-sm md:text-base mb-1">
                {badge.title[language]}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {badge.description[language]}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustBadges;
