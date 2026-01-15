import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

const Newsletter = () => {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const content = {
    sv: {
      title: 'Bli först med erbjudanden',
      description: 'Prenumerera på vårt nyhetsbrev och få exklusiva erbjudanden och nyheter direkt i din inkorg.',
      placeholder: 'Din e-postadress',
      button: 'Prenumerera',
      loading: 'Skickar...',
      success: 'Tack för din prenumeration!',
      successMessage: 'Du får snart ett välkomstmail.',
      terms: 'Genom att prenumerera godkänner du våra villkor. Avsluta när som helst.'
    },
    en: {
      title: 'Be first with offers',
      description: 'Subscribe to our newsletter and get exclusive offers and news delivered straight to your inbox.',
      placeholder: 'Your email address',
      button: 'Subscribe',
      loading: 'Sending...',
      success: 'Thanks for subscribing!',
      successMessage: "You'll receive a welcome email soon.",
      terms: 'By subscribing you agree to our terms. Unsubscribe at any time.'
    }
  };

  const t = content[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    setIsSubscribed(true);
    setEmail('');
    toast.success(t.success);
  };

  return (
    <section className="py-16 md:py-20 bg-primary/5 border-t border-border">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Bell className="w-7 h-7 text-primary" />
          </div>
          
          <h2 className="font-display text-2xl md:text-3xl font-semibold mb-3">
            {t.title}
          </h2>
          
          <p className="text-muted-foreground mb-8">
            {t.description}
          </p>

          {isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-primary/10 border border-primary/20 text-primary font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              {t.successMessage}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t.placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 h-12 bg-background border-border rounded-lg"
                  required
                />
              </div>
              <Button 
                type="submit" 
                size="lg" 
                className="h-12 px-6 rounded-lg"
                disabled={isLoading}
              >
                {isLoading ? t.loading : t.button}
              </Button>
            </form>
          )}
          
          <p className="text-xs text-muted-foreground mt-6">
            {t.terms}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Newsletter;