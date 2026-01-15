import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Truck, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { Link } from 'react-router-dom';

const Hero = () => {
  const { language } = useLanguage();
  
  const content = {
    sv: {
      badge: '🇸🇪 Svensk Startup 2026',
      title: 'Giftfria Produkter för Sverige',
      subtitle: 'Vi är inte det största företaget. Vi är det noggrannaste. Varje produkt vi säljer är testad och godkänd av oss själva. Inga mirakel. Inga löften. Bara ärliga produkter till ärliga priser.',
      features: [
        { icon: '🇸🇪', text: 'Svensk uppstart' },
        { icon: '✅', text: 'Noggrant utvalt' },
        { icon: '🚚', text: 'Snabb leverans' },
      ],
      ctaPrimary: 'Shoppa giftfritt nu',
      ctaSecondary: 'Läs vår story',
    },
    en: {
      badge: '🇸🇪 Swedish Startup 2026',
      title: 'Toxin-Free Products for Sweden',
      subtitle: "We're not the biggest company. We're the most careful. Every product we sell is tested and approved by us. No miracles. No promises. Just honest products at honest prices.",
      features: [
        { icon: '🇸🇪', text: 'Swedish startup' },
        { icon: '✅', text: 'Carefully selected' },
        { icon: '🚚', text: 'Fast delivery' },
      ],
      ctaPrimary: 'Shop toxin-free now',
      ctaSecondary: 'Read our story',
    }
  };

  const t = content[language as 'sv' | 'en'] || content.en;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/30 via-background to-background">
      {/* Subtle decorative elements */}
      <div className="absolute top-20 right-[10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-[10%] w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 py-20 md:py-28 relative z-10">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-8"
          >
            <Leaf className="w-4 h-4" />
            <span>{t.badge}</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] mb-6 text-foreground"
          >
            {t.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            {t.subtitle}
          </motion.p>

          {/* Features list - simplified */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-6 mb-10"
          >
            {t.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm font-medium text-foreground/90 px-4 py-2 bg-secondary/50 rounded-full">
                <span>{feature.icon}</span>
                <span>{feature.text}</span>
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="h-14 px-10 text-base font-semibold gap-2 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 group"
              onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.ctaPrimary}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Link to="/about">
              <Button
                variant="outline"
                size="lg"
                className="h-14 px-10 text-base rounded-xl border-2 hover:bg-secondary/50"
              >
                {t.ctaSecondary}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;