import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Gift, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

const Newsletter = () => {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    setIsSubscribed(true);
    setEmail('');
    toast.success(
      language === 'sv' 
        ? 'Tack för din prenumeration! Kolla din e-post för rabattkoden.' 
        : 'Thanks for subscribing! Check your email for the discount code.'
    );
  };

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background with gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent" />
      <div className="decorative-circle w-[400px] h-[400px] bg-primary/10 top-0 right-0" />
      <div className="decorative-circle w-[300px] h-[300px] bg-accent/10 bottom-0 left-0" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.div 
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-18 h-18 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-8"
          >
            <Gift className="w-9 h-9 text-primary" />
          </motion.div>
          
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold mb-5">
            {language === 'sv' ? 'Få ' : 'Get '}
            <span className="text-gradient">10% rabatt</span>
            {language === 'sv' ? ' på din första order!' : ' on your first order!'}
          </h2>
          
          <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
            {language === 'sv' 
              ? 'Prenumerera på vårt nyhetsbrev och få exklusiva erbjudanden, tips och nyheter direkt i din inkorg.'
              : 'Subscribe to our newsletter and get exclusive offers, tips and news delivered straight to your inbox.'
            }
          </p>

          {isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-accent/10 border border-accent/20 text-accent font-semibold"
            >
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              {language === 'sv' ? 'Du är nu prenumerant!' : 'You\'re now subscribed!'}
              <Sparkles className="w-5 h-5" />
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={language === 'sv' ? 'Din e-postadress' : 'Your email address'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-14 bg-card border-border/60 rounded-2xl text-base focus:border-primary/50"
                  required
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                className="h-14 px-8 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                disabled={isLoading}
              >
                {isLoading 
                  ? (language === 'sv' ? 'Skickar...' : 'Sending...') 
                  : (language === 'sv' ? 'Prenumerera' : 'Subscribe')
                }
              </Button>
            </form>
          )}
          
          <p className="text-xs text-muted-foreground mt-6">
            {language === 'sv' 
              ? 'Genom att prenumerera godkänner du våra villkor. Avsluta när som helst.'
              : 'By subscribing you agree to our terms. Unsubscribe at any time.'
            }
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Newsletter;