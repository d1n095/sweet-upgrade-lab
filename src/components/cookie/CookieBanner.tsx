import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

const COOKIE_CONSENT_KEY = 'cookie_consent';

const CookieBanner = () => {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay before showing banner
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: true,
      marketing: false,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    }));
    setIsVisible(false);
  };

  const content = {
    sv: {
      title: 'Vi använder cookies',
      description: 'Vi använder cookies för att förbättra din upplevelse och analysera hur webbplatsen används. Endast nödvändiga cookies krävs för att sidan ska fungera.',
      acceptAll: 'Acceptera alla',
      essentialOnly: 'Endast nödvändiga',
      learnMore: 'Läs mer',
    },
    en: {
      title: 'We use cookies',
      description: 'We use cookies to improve your experience and analyze how the website is used. Only essential cookies are required for the site to function.',
      acceptAll: 'Accept all',
      essentialOnly: 'Essential only',
      learnMore: 'Learn more',
    },
  };

  const t = content[language] || content.en;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6"
        >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-card border border-border rounded-2xl shadow-elevated p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cookie className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-semibold text-lg mb-1">{t.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t.description}{' '}
                      <a href="/policies/privacy" className="text-primary hover:underline">
                        {t.learnMore}
                      </a>
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 md:flex-shrink-0">
                  <Button
                    variant="outline"
                    onClick={handleEssentialOnly}
                    className="rounded-full"
                  >
                    {t.essentialOnly}
                  </Button>
                  <Button
                    onClick={handleAccept}
                    className="rounded-full bg-primary hover:bg-primary/90"
                  >
                    {t.acceptAll}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieBanner;
