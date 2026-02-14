import { motion } from 'framer-motion';
import { Sparkles, Send, Heart, Users, Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import { toast } from 'sonner';

const BuilderSection = () => {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = {
    sv: {
      eyebrow: 'Framtidsvisionen',
      title: 'Vi drömmer om',
      dreams: [
        {
          icon: Users,
          text: 'Ett nätverk av hantverkare som inte behöver vänta på nästa jobb'
        },
        {
          icon: Heart,
          text: 'Donationer där du ser vart varje krona går'
        },
        {
          icon: Lightbulb,
          text: 'Att göra giftfritt till normen, inte lyxen'
        }
      ],
      question: 'Drömmer du med oss?',
      cta: 'Prenumerera på uppdateringar',
      placeholder: 'Din e-postadress',
      submit: 'Följ resan',
      submitting: 'Skickar...',
      success: 'Välkommen ombord! Du får våra uppdateringar nu.',
      footer: 'Var med från början. Bli en del av förändringen.'
    },
    en: {
      eyebrow: 'The Vision',
      title: 'We dream of',
      dreams: [
        {
          icon: Users,
          text: "A network of craftsmen who don't have to wait for the next job"
        },
        {
          icon: Heart,
          text: 'Donations where you see where every penny goes'
        },
        {
          icon: Lightbulb,
          text: 'Making toxin-free the norm, not the luxury'
        }
      ],
      question: 'Do you dream with us?',
      cta: 'Subscribe to updates',
      placeholder: 'Your email address',
      submit: 'Follow the journey',
      submitting: 'Sending...',
      success: 'Welcome aboard! You will receive our updates now.',
      footer: 'Be there from the start. Be part of the change.'
    }
  };

  const t = content[language] || content.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSubmitting(false);
    setEmail('');
    toast.success(t.success);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section className="relative py-24 overflow-hidden bg-gradient-to-b from-background via-secondary/20 to-background">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
            className="w-full h-full rounded-full border border-primary/5"
          />
        </div>
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-20 right-[20%] w-3 h-3 bg-primary/20 rounded-full"
        />
        <motion.div
          animate={{ y: [0, 15, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-32 left-[15%] w-4 h-4 bg-accent/20 rounded-full"
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            {t.eyebrow}
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t.title}
          </h2>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="space-y-6">
            {t.dreams.map((dream, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="flex items-start gap-4 p-6 rounded-2xl bg-card/40 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <dream.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-lg md:text-xl text-foreground/90 leading-relaxed pt-2">
                  {dream.text}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center space-y-8"
        >
          <h3 className="text-2xl md:text-3xl font-display font-semibold text-primary">
            {t.question}
          </h3>

          <div className="max-w-md mx-auto">
            <p className="text-muted-foreground mb-4">{t.cta}</p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="email"
                placeholder={t.placeholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-12 bg-card/50 border-border/50 focus:border-primary"
                required
              />
              <Button 
                type="submit" 
                size="lg" 
                className="h-12 px-6 bg-gradient-to-r from-accent to-accent/80"
                disabled={isSubmitting}
              >
                {isSubmitting ? t.submitting : t.submit}
                <Send className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </div>

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