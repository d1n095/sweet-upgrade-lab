import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Heart, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';

interface RoundUpDonationProps {
  cartTotal: number;
  currencyCode: string;
  onDonationChange: (amount: number) => void;
}

const RoundUpDonation = ({ cartTotal, currencyCode, onDonationChange }: RoundUpDonationProps) => {
  const { language } = useLanguage();
  const [isEnabled, setIsEnabled] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number>(10);

  const content = {
    sv: {
      title: 'Runda upp för miljön',
      description: 'Hjälp oss plantera träd och stödja giftfria initiativ',
      amounts: [10, 20, 50],
      enabled: 'Tack för ditt bidrag!',
      impact: 'bidrar till en grönare framtid',
    },
    en: {
      title: 'Round up for the environment',
      description: 'Help us plant trees and support toxin-free initiatives',
      amounts: [10, 20, 50],
      enabled: 'Thank you for your contribution!',
      impact: 'contributes to a greener future',
    },
  };

  const t = content[language as keyof typeof content] || content.en;

  const handleToggle = () => {
    const newValue = !isEnabled;
    setIsEnabled(newValue);
    onDonationChange(newValue ? selectedAmount : 0);
  };

  const handleAmountChange = (amount: number) => {
    setSelectedAmount(amount);
    if (isEnabled) {
      onDonationChange(amount);
    }
  };

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
                onClick={handleToggle}
              >
                {isEnabled ? (
                  <>
                    <Check className="w-3 h-3 mr-1" />
                    {formatPrice(selectedAmount, currencyCode)}
                  </>
                ) : (
                  <>
                    <Heart className="w-3 h-3 mr-1" />
                    {language === 'sv' ? 'Lägg till' : 'Add'}
                  </>
                )}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-0.5">
              {t.description}
            </p>

            <AnimatePresence>
              {!isEnabled && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 mt-2">
                    {t.amounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleAmountChange(amount)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          selectedAmount === amount
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:border-primary/50'
                        }`}
                      >
                        {formatPrice(amount, currencyCode)}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
