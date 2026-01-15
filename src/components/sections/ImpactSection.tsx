import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { TrendingUp, Users, Heart, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

interface CounterProps {
  value: number;
  suffix?: string;
  duration?: number;
}

const AnimatedCounter = ({ value, suffix = '', duration = 2 }: CounterProps) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString('sv-SE'));

  useEffect(() => {
    const controls = animate(count, value, { duration });
    return controls.stop;
  }, [count, value, duration]);

  return (
    <motion.span className="tabular-nums">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </motion.span>
  );
};

const ImpactSection = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      title: 'Dina Köp Bygger Framtiden',
      subtitle: 'Varje krona du spenderar skapar verklig förändring i samhället',
      cta: 'Se Vår Transparensrapport',
      stats: [
        { value: 47, label: 'Nya Jobb Skapade', sublabel: 'Senaste året', icon: TrendingUp },
        { value: 1234, label: 'Familjer Hjälpta', sublabel: 'Bytt till giftfritt', icon: Users },
        { value: 89250, suffix: ' kr', label: 'Donerat till Samhället', sublabel: 'Transparent redovisning', icon: Heart },
        { value: 3, label: 'Projekt Genomförda', sublabel: 'Se dem alla ↓', icon: Lightbulb }
      ]
    },
    en: {
      title: 'Your Purchases Build the Future',
      subtitle: 'Every penny you spend creates real change in society',
      cta: 'View Our Transparency Report',
      stats: [
        { value: 47, label: 'New Jobs Created', sublabel: 'Last year', icon: TrendingUp },
        { value: 1234, label: 'Families Helped', sublabel: 'Switched to toxin-free', icon: Users },
        { value: 89250, suffix: ' kr', label: 'Donated to Society', sublabel: 'Transparent reporting', icon: Heart },
        { value: 3, label: 'Projects Completed', sublabel: 'See them all ↓', icon: Lightbulb }
      ]
    }
  };

  const t = content[language];

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
          className="text-center mb-16"
        >
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t.title}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          {t.stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative group"
            >
              <div className="bg-card/50 backdrop-blur-sm border border-primary/20 rounded-2xl p-6 text-center h-full transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10">
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </div>
                <p className="font-medium text-foreground/90 mb-1">{stat.label}</p>
                <p className="text-sm text-muted-foreground">{stat.sublabel}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Button
            size="lg"
            variant="outline"
            className="border-primary/50 hover:bg-primary/10 hover:border-primary"
          >
            {t.cta}
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default ImpactSection;
