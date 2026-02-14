import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Heart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

interface RoundUpDonationProps {
  cartTotal: number;
  currencyCode: string;
  onDonationChange: (amount: number) => void;
}

const RoundUpDonation = ({ cartTotal, currencyCode, onDonationChange }: RoundUpDonationProps) => {
  const { language } = useLanguage();
  const [isEnabled, setIsEnabled] = useState(true); // Auto-enabled by default

  const content = {
    sv: {
      title: 'Avrundning för miljön',
      description: 'Vi avrundar automatiskt till närmaste 10-tal',
      enabled: 'Tack för ditt bidrag!',
      disabled: 'Avrundat belopp borttaget',
    },
    en: {
      title: 'Round up for the environment',
      description: 'We automatically round up to the nearest 10',
      enabled: 'Thank you for your contribution!',
      disabled: 'Round-up removed',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  // Calculate round-up amount to nearest 10
  const roundUpAmount = Math.ceil(cartTotal / 10) * 10 - cartTotal;
  // If already even, round up by 10
  const donationAmount = roundUpAmount === 0 ? 0 : roundUpAmount;

  useEffect(() => {
    onDonationChange(isEnabled ? donationAmount : 0);
  }, [isEnabled, donationAmount]);

  // Don't show if cart total is already a multiple of 10
  if (donationAmount === 0) return null;

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border transition-all ${
        isEnabled 
          ? 'bg-success/5 border-success/30' 
          : 'bg-muted/30 border-border/50'
      }`}
    >
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isEnabled ? 'bg-success/10' : 'bg-primary/10'
          }`}>
            <Leaf className={`w-4 h-4 ${isEnabled ? 'text-success' : 'text-primary'}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm">{t.title}</h4>
              <Button
                variant={isEnabled ? 'default' : 'outline'}
                size="sm"
                className={`h-7 px-3 text-xs ${isEnabled ? 'bg-success hover:bg-success/90' : ''}`}
                onClick={() => setIsEnabled(!isEnabled)}
              >
                {isEnabled ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    +{formatPrice(donationAmount, currencyCode)}
                  </>
                ) : (
                  <>
                    <Heart className="w-3 h-3 mr-1" />
                    +{formatPrice(donationAmount, currencyCode)}
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.description} ({formatPrice(cartTotal, currencyCode)} → {formatPrice(cartTotal + donationAmount, currencyCode)})
            </p>

            <AnimatePresence>
              {isEnabled && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-success font-medium mt-1.5 flex items-center gap-1"
                >
                  <Heart className="w-3 h-3 fill-success" />
                  {t.enabled}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default RoundUpDonation;
