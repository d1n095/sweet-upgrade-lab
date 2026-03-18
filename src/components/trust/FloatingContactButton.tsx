import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Mail, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { useLocation } from 'react-router-dom';

const FloatingContactButton = () => {
  const { language } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  // Hide on checkout, delay show on other pages
  const isCheckout = location.pathname === '/checkout';

  useEffect(() => {
    if (isCheckout) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [isCheckout]);

  const contactOptions = [
    {
      icon: Mail,
      label: { sv: 'E-post', en: 'Email' },
      value: 'support@4thepeople.se',
      href: 'mailto:support@4thepeople.se',
    },
    {
      icon: HelpCircle,
      label: { sv: 'Vanliga frågor', en: 'FAQ' },
      value: language === 'sv' ? 'Läs våra FAQ' : 'Read our FAQ',
      href: '#faq',
    },
  ];

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="absolute bottom-16 left-0 glass-card p-4 min-w-[250px] mb-2"
          >
            <h4 className="font-semibold text-sm mb-3">
              {language === 'sv' ? 'Hur kan vi hjälpa?' : 'How can we help?'}
            </h4>
            <div className="space-y-2">
              {contactOptions.map((option) => (
                <a
                  key={option.label.en}
                  href={option.href}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                  onClick={() => option.href.startsWith('#') && setIsOpen(false)}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <option.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{option.label[language]}</p>
                    <p className="text-xs text-muted-foreground">{option.value}</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
              >
                <MessageCircle className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    </div>
  );
};

export default FloatingContactButton;
