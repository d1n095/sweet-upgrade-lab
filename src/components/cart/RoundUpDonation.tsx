import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaf, Heart, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage, getContentLang } from '@/context/LanguageContext';

interface RoundUpDonationProps {
  cartTotal: number;
  currencyCode: string;
  onDonationChange: (amount: number) => void;
}

const CUSTOM_AMOUNTS = [5, 10, 15, 20, 25];

const RoundUpDonation = ({ cartTotal, currencyCode, onDonationChange }: RoundUpDonationProps) => {
  const { language } = useLanguage();
  const cl = getContentLang(language);

  const [roundUpEnabled, setRoundUpEnabled] = useState(true);
  const [customAmount, setCustomAmount] = useState<number | null>(null);

  const content = {
    sv: {
      title: 'Donera till miljön',
      roundUp: 'Avrunda till närmaste 10-tal',
      addExtra: 'Eller lägg till ett eget belopp:',
      thanks: 'Tack för ditt bidrag!',
      remove: 'Ta bort',
    },
    en: {
      title: 'Donate to the environment',
      roundUp: 'Round up to nearest 10',
      addExtra: 'Or add a custom amount:',
      thanks: 'Thank you for your contribution!',
      remove: 'Remove',
    },
  };

  const t = content[cl];

  // Calculate round-up amount to nearest 10
  const rawRoundUp = Math.ceil(cartTotal / 10) * 10 - cartTotal;
  const roundUpAmount = rawRoundUp === 0 ? 0 : rawRoundUp;

  // Total donation = round-up (if enabled) + custom amount (if selected)
  const totalDonation = (roundUpEnabled && roundUpAmount > 0 ? roundUpAmount : 0) + (customAmount || 0);

  useEffect(() => {
    onDonationChange(totalDonation);
  }, [totalDonation]);

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
        totalDonation > 0
          ? 'bg-success/5 border-success/30'
          : 'bg-muted/30 border-border/50'
      }`}
    >
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
            totalDonation > 0 ? 'bg-success/10' : 'bg-primary/10'
          }`}>
            <Leaf className={`w-3.5 h-3.5 ${totalDonation > 0 ? 'text-success' : 'text-primary'}`} />
          </div>
          <h4 className="font-medium text-sm">{t.title}</h4>
        </div>

        {/* Round-up toggle */}
        {roundUpAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t.roundUp}</span>
            <Button
              variant={roundUpEnabled ? 'default' : 'outline'}
              size="sm"
              className={`h-7 px-3 text-xs ${roundUpEnabled ? 'bg-success hover:bg-success/90' : ''}`}
              onClick={() => setRoundUpEnabled(!roundUpEnabled)}
            >
              {roundUpEnabled ? (
                <>
                  <Check className="w-3 h-3 mr-1" />
                  +{formatPrice(roundUpAmount, currencyCode)}
                </>
              ) : (
                <>+{formatPrice(roundUpAmount, currencyCode)}</>
              )}
            </Button>
          </div>
        )}

        {/* Custom donation amounts */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t.addExtra}</p>
          <div className="flex flex-wrap gap-1.5">
            {CUSTOM_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                variant={customAmount === amount ? 'default' : 'outline'}
                size="sm"
                className={`h-7 px-3 text-xs ${customAmount === amount ? 'bg-success hover:bg-success/90' : ''}`}
                onClick={() => setCustomAmount(customAmount === amount ? null : amount)}
              >
                +{amount} kr
              </Button>
            ))}
          </div>
        </div>

        {/* Total donation feedback */}
        <AnimatePresence>
          {totalDonation > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between"
            >
              <p className="text-xs text-success font-medium flex items-center gap-1">
                <Heart className="w-3 h-3 fill-success" />
                {t.thanks} (+{formatPrice(totalDonation, currencyCode)})
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setRoundUpEnabled(false);
                  setCustomAmount(null);
                }}
              >
                <X className="w-3 h-3 mr-1" />
                {t.remove}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default RoundUpDonation;
