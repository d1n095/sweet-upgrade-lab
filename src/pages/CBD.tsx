import { useState } from 'react';
import { motion } from 'framer-motion';
import { Leaf, Mail, Bell, Check, ArrowRight, Shield, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/context/LanguageContext';
import { useInsightLogger } from '@/hooks/useInsightLogger';
import { toast } from 'sonner';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

const CBD = () => {
  const { language } = useLanguage();
  const { logInterest } = useInsightLogger();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    
    await logInterest('cbd_interest', {
      category: 'cbd',
      email: email.trim(),
      message: message.trim() || undefined,
    });

    setIsSubmitted(true);
    setIsLoading(false);
    toast.success(
      language === 'sv' 
        ? 'Tack! Vi meddelar dig när CBD-produkter finns tillgängliga.' 
        : 'Thanks! We\'ll notify you when CBD products are available.'
    );
  };

  const content = {
    sv: {
      hero: {
        badge: 'Kommer snart',
        title: 'CBD & Hampaprodukter',
        subtitle: 'Vi förbereder ett noggrant utvalt sortiment av högkvalitativa CBD- och hampaprodukter. Var först att få veta när de finns tillgängliga.',
      },
      benefits: [
        {
          icon: Shield,
          title: 'Labbtestade',
          description: 'Alla produkter är tredjepartsverifierade för renhet och styrka.',
        },
        {
          icon: Leaf,
          title: 'Ekologiskt odlat',
          description: 'Från hållbara europeiska odlingar med full spårbarhet.',
        },
        {
          icon: Sparkles,
          title: 'Premiumkvalitet',
          description: 'Endast de bästa extraktionsmetoderna för maximal effekt.',
        },
        {
          icon: Heart,
          title: 'Naturligt välmående',
          description: 'Produkter för balans, återhämtning och dagligt välbefinnande.',
        },
      ],
      form: {
        title: 'Bli notifierad',
        subtitle: 'Skriv upp dig för att få veta först när vi lanserar vårt CBD-sortiment.',
        emailPlaceholder: 'Din e-postadress',
        messagePlaceholder: 'Finns det något speciellt du letar efter? (valfritt)',
        button: 'Meddela mig',
        submitting: 'Skickar...',
      },
      success: {
        title: 'Tack för ditt intresse!',
        subtitle: 'Vi skickar ett mail när CBD-produkterna är tillgängliga.',
      },
      legal: 'Vi följer alla svenska och EU-regler för CBD-produkter. Alla produkter innehåller mindre än 0.2% THC.',
    },
    en: {
      hero: {
        badge: 'Coming Soon',
        title: 'CBD & Hemp Products',
        subtitle: 'We\'re preparing a carefully curated selection of high-quality CBD and hemp products. Be the first to know when they\'re available.',
      },
      benefits: [
        {
          icon: Shield,
          title: 'Lab Tested',
          description: 'All products are third-party verified for purity and potency.',
        },
        {
          icon: Leaf,
          title: 'Organically Grown',
          description: 'From sustainable European farms with full traceability.',
        },
        {
          icon: Sparkles,
          title: 'Premium Quality',
          description: 'Only the best extraction methods for maximum effectiveness.',
        },
        {
          icon: Heart,
          title: 'Natural Wellness',
          description: 'Products for balance, recovery, and daily wellbeing.',
        },
      ],
      form: {
        title: 'Get Notified',
        subtitle: 'Sign up to be the first to know when we launch our CBD range.',
        emailPlaceholder: 'Your email address',
        messagePlaceholder: 'Is there something specific you\'re looking for? (optional)',
        button: 'Notify me',
        submitting: 'Sending...',
      },
      success: {
        title: 'Thanks for your interest!',
        subtitle: 'We\'ll send you an email when CBD products are available.',
      },
      legal: 'We comply with all Swedish and EU regulations for CBD products. All products contain less than 0.2% THC.',
    },
  };

  const t = content[language] || content.en;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 md:pt-32">
        {/* Hero Section */}
        <section className="relative py-16 md:py-24 overflow-hidden">
          <div className="decorative-circle w-[600px] h-[600px] bg-primary/5 -top-48 -right-48" />
          <div className="decorative-circle w-[400px] h-[400px] bg-accent/5 bottom-0 -left-32" />
          
          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <Leaf className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-accent">{t.hero.badge}</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6">
                {t.hero.title}
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                {t.hero.subtitle}
              </p>
            </motion.div>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {t.benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="group bg-card border border-border rounded-2xl p-6 hover:shadow-elevated transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-lg mb-2">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Interest Form */}
        <section className="py-16 md:py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <div className="max-w-xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="bg-card border border-border rounded-2xl p-8 md:p-10 shadow-elevated"
              >
                {!isSubmitted ? (
                  <>
                    <div className="text-center mb-8">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Bell className="w-7 h-7 text-primary" />
                      </div>
                      <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
                        {t.form.title}
                      </h2>
                      <p className="text-muted-foreground">{t.form.subtitle}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <Input
                          type="email"
                          placeholder={t.form.emailPlaceholder}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-12 rounded-xl"
                        />
                      </div>
                      <div>
                        <Textarea
                          placeholder={t.form.messagePlaceholder}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={3}
                          className="rounded-xl resize-none"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
                      >
                        {isLoading ? t.form.submitting : t.form.button}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-500" />
                    </div>
                    <h3 className="text-xl font-display font-semibold mb-2">
                      {t.success.title}
                    </h3>
                    <p className="text-muted-foreground">{t.success.subtitle}</p>
                  </div>
                )}
              </motion.div>

              <p className="text-center text-xs text-muted-foreground mt-6 max-w-md mx-auto">
                {t.legal}
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CBD;
