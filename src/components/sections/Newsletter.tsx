import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';

const Newsletter = () => {
  const { t } = useLanguage();
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
    toast.success(t('newsletter.success'));
  };

  return (
    <section id="newsletter" className="py-16 md:py-20 bg-secondary/30 border-t border-border/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto text-center"
        >
          <Bell className="w-5 h-5 text-accent mx-auto mb-4" />
          
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            {t('newsletter.title')}
          </h2>
          
          <p className="text-sm text-muted-foreground mb-6">
            {t('newsletter.description')}
          </p>

          {isSubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              {t('newsletter.successmessage')}
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder={t('newsletter.placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10 bg-background border-border rounded-xl text-sm"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="h-10 px-5 rounded-xl text-sm"
                disabled={isLoading}
              >
                {isLoading ? '...' : t('newsletter.subscribe')}
              </Button>
            </form>
          )}
          
          <p className="text-[10px] text-muted-foreground mt-4">
            {t('newsletter.terms')}
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Newsletter;
