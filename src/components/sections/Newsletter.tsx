import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Gift, Check } from 'lucide-react';
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
    // Simulate API call
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
    <section className="py-16 md:py-24 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 mb-6">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="font-display text-2xl md:text-4xl font-bold mb-4">
            {language === 'sv' ? 'Få 10% rabatt' : 'Get 10% off'}
            <span className="text-gradient block md:inline"> {language === 'sv' ? 'på din första order!' : 'your first order!'}</span>
          </h2>
          
          <p className="text-muted-foreground mb-8">
            {language === 'sv' 
              ? 'Prenumerera på vårt nyhetsbrev och få exklusiva erbjudanden, tips och nyheter direkt i din inkorg.'
              : 'Subscribe to our newsletter and get exclusive offers, tips and news delivered straight to your inbox.'
            }
          </p>

          {isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 text-primary font-medium"
            >
              <Check className="w-5 h-5" />
              {language === 'sv' ? 'Du är nu prenumerant!' : 'You\'re now subscribed!'}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={language === 'sv' ? 'Din e-postadress' : 'Your email address'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-12 bg-card border-border"
                  required
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                className="h-12 px-8"
                disabled={isLoading}
              >
                {isLoading 
                  ? (language === 'sv' ? 'Skickar...' : 'Sending...') 
                  : (language === 'sv' ? 'Prenumerera' : 'Subscribe')
                }
              </Button>
            </form>
          )}
          
          <p className="text-xs text-muted-foreground mt-4">
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
