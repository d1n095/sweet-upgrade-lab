import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const COOKIE_CONSENT_KEY = 'cookie_consent';

const CookieBanner = () => {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      accepted: false,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4"
        >
          <div className="container mx-auto max-w-2xl">
            <div className="bg-card border border-border rounded-2xl shadow-elevated p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Cookie className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t('cookie.text')}{' '}
                  <a href="/policies/privacy" className="text-primary hover:underline">
                    {t('cookie.learnmore')}
                  </a>
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" onClick={handleReject} className="rounded-full text-xs px-4">
                  {t('cookie.reject')}
                </Button>
                <Button size="sm" onClick={handleAccept} className="rounded-full text-xs px-4">
                  {t('cookie.accept')}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
