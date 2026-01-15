import { motion } from 'framer-motion';
import { Hammer, Home, Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const BuilderSection = () => {
  const { language } = useLanguage();

  const content = {
    sv: {
      eyebrow: 'Bli en del av rörelsen',
      title: 'Vi Bygger Inte Bara Produkter',
      titleHighlight: 'Vi Bygger Samhället',
      description: 'Är du hantverkare, tekniker, städare, eller bara någon som vill vara med och bygga ett bättre system? Vi skapar jobb där människor räknas, där varje timme har värde, och där du kan växa.',
      cta: 'Bli en Byggare',
      footer: 'Inga mellanhänder. Inga jättekoncern-vinster. Bara ärligt arbete för ärlig lön.',
      categories: [
        {
          icon: Hammer,
          emoji: '🔨',
          title: 'Hantverkare',
          description: 'Snickare, målare, elektriker - vi behöver dig!'
        },
        {
          icon: Home,
          emoji: '🏠',
          title: 'Fastighet & Städ',
          description: 'Skapa hem med värdighet och rena miljöer'
        },
        {
          icon: Lightbulb,
          emoji: '💡',
          title: 'Innovatörer',
          description: 'Har du idéer för samhällsförbättring?'
        }
      ]
    },
    en: {
      eyebrow: 'Join the movement',
      title: "We Don't Just Build Products",
      titleHighlight: 'We Build Society',
      description: "Are you a craftsman, technician, cleaner, or just someone who wants to help build a better system? We create jobs where people matter, where every hour has value, and where you can grow.",
      cta: 'Become a Builder',
      footer: 'No middlemen. No corporate mega-profits. Just honest work for honest pay.',
      categories: [
        {
          icon: Hammer,
          emoji: '🔨',
          title: 'Craftsmen',
          description: 'Carpenters, painters, electricians - we need you!'
        },
        {
          icon: Home,
          emoji: '🏠',
          title: 'Property & Cleaning',
          description: 'Create homes with dignity and clean environments'
        },
        {
          icon: Lightbulb,
          emoji: '💡',
          title: 'Innovators',
          description: 'Do you have ideas for societal improvement?'
        }
      ]
    }
  };

  const t = content[language];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-background via-accent/5 to-background">
      {/* Animated background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            className="w-full h-full rounded-full border border-accent/10"
          />
        </div>
        <div className="absolute top-20 right-20 w-4 h-4 bg-primary/30 rounded-full blur-sm" />
        <div className="absolute bottom-40 left-20 w-6 h-6 bg-accent/30 rounded-full blur-sm" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            {t.eyebrow}
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-2">
            {t.title}
          </h2>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
            {t.titleHighlight}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            {t.description}
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mb-12"
        >
          {t.categories.map((category, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative"
            >
              <div className="bg-card/50 backdrop-blur-sm border border-border rounded-2xl p-8 text-center h-full transition-all duration-300 hover:border-accent/50 hover:shadow-xl hover:shadow-accent/10 hover:-translate-y-1">
                <div className="text-5xl mb-4">{category.emoji}</div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-accent transition-colors">
                  {category.title}
                </h3>
                <p className="text-muted-foreground">
                  {category.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-6"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white font-semibold px-8 py-6 text-lg group"
          >
            {t.cta}
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-muted-foreground text-sm italic max-w-md mx-auto"
          >
            {t.footer}
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default BuilderSection;
