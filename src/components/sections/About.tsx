import { motion } from 'framer-motion';
import { Award, Users, Leaf, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

const About = () => {
  const { t } = useLanguage();
  
  const stats = [
    { icon: Users, value: '1,000+', label: t('about.stat.customers') },
    { icon: Award, value: '100%', label: t('about.stat.natural') },
    { icon: Leaf, value: t('about.stat.toxinfree') === 'All products' ? 'Toxin-free' : 'Giftfritt', label: t('about.stat.toxinfree') },
    { icon: Clock, value: '24/7', label: t('about.stat.service') },
  ];

  return (
    <section id="about" className="py-20 md:py-32 bg-card">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1"
          >
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-6">
              {t('about.title')}{' '}
              <span className="text-gradient">PureLife?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t('about.description1')}
            </p>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
              {t('about.description2')}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-xl bg-secondary/50"
                >
                  <stat.icon className="w-6 h-6 text-primary mb-2" />
                  <div className="font-display text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Visual */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2 relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Decorative elements */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 to-transparent" />
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
              <div className="absolute -bottom-4 -left-4 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
              
              {/* Main image placeholder */}
              <div className="relative z-10 w-full h-full rounded-3xl bg-secondary border border-border overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
                    <Leaf className="w-12 h-12 text-primary" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">{t('about.visual.title')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('about.visual.description')}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
