import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/context/LanguageContext';

const STORAGE_KEY = 'exit_popup_shown';
const DISCOUNT_CODE = 'STANNA10';

const ExitIntentPopup = () => {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    // Check if popup was already shown
    const hasShown = sessionStorage.getItem(STORAGE_KEY);
    if (hasShown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse leaves through the top of the viewport
      if (e.clientY <= 0) {
        setIsVisible(true);
        sessionStorage.setItem(STORAGE_KEY, 'true');
        // Remove listener after showing
        document.removeEventListener('mouseleave', handleMouseLeave);
      }
    };

    // Add a delay before activating the exit intent
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 5000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Here you could send the email to your backend
    setIsSubmitted(true);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(DISCOUNT_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
          />

          {/* Popup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md mx-4"
          >
            <div className="glass-card p-8 relative overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative z-10 text-center">
                {!isSubmitted ? (
                  <>
                    {/* Icon */}
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                      <Gift className="w-8 h-8 text-primary-foreground" />
                    </div>

                    {/* Content */}
                    <h3 className="font-display text-2xl font-bold mb-2">
                      {language === 'sv' ? 'Vänta! Missa inte detta!' : 'Wait! Don\'t miss this!'}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {language === 'sv' 
                        ? 'Ange din e-post och få 10% rabatt på din första beställning!'
                        : 'Enter your email and get 10% off your first order!'
                      }
                    </p>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <Input
                        type="email"
                        placeholder={language === 'sv' ? 'Din e-postadress' : 'Your email address'}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 text-center"
                        required
                      />
                      <Button type="submit" className="w-full h-12 text-base font-semibold">
                        <Sparkles className="w-4 h-4 mr-2" />
                        {language === 'sv' ? 'Hämta min rabatt' : 'Get my discount'}
                      </Button>
                    </form>

                    <p className="text-xs text-muted-foreground mt-4">
                      {language === 'sv' 
                        ? 'Inga spam, bara bra erbjudanden!'
                        : 'No spam, just great deals!'
                      }
                    </p>
                  </>
                ) : (
                  <>
                    {/* Success state */}
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-accent-foreground" />
                    </div>

                    <h3 className="font-display text-2xl font-bold mb-2">
                      {language === 'sv' ? 'Tack!' : 'Thank you!'}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {language === 'sv' 
                        ? 'Här är din rabattkod:'
                        : 'Here\'s your discount code:'
                      }
                    </p>

                    {/* Discount code */}
                    <div 
                      onClick={handleCopyCode}
                      className="cursor-pointer bg-secondary/50 border-2 border-dashed border-primary/50 rounded-lg p-4 mb-4 hover:bg-secondary transition-colors"
                    >
                      <p className="font-mono text-2xl font-bold text-primary tracking-wider">
                        {DISCOUNT_CODE}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {codeCopied 
                          ? (language === 'sv' ? 'Kopierad!' : 'Copied!')
                          : (language === 'sv' ? 'Klicka för att kopiera' : 'Click to copy')
                        }
                      </p>
                    </div>

                    <Button onClick={handleClose} variant="outline" className="w-full">
                      {language === 'sv' ? 'Fortsätt handla' : 'Continue shopping'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ExitIntentPopup;
