import { Truck, Gift, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { storeConfig } from '@/config/storeConfig';
import { useLanguage } from '@/context/LanguageContext';

interface ShippingProgressBarProps {
  cartTotal: number;
}

const ShippingProgressBar = ({ cartTotal }: ShippingProgressBarProps) => {
  const { language } = useLanguage();
  const { shipping } = storeConfig;
  
  // Smart shipping logic
  const isFreeShipping = cartTotal >= shipping.generousFreeMin;
  const isGenerous = cartTotal >= shipping.generousFreeMin && cartTotal < shipping.freeShippingThreshold;
  const amountToFree = Math.max(0, shipping.generousFreeMin - cartTotal);
  const progress = Math.min(100, (cartTotal / shipping.generousFreeMin) * 100);

  const content = {
    sv: {
      freeShipping: 'Vi bjuder på frakten! 🎉',
      generous: 'Nära nog! Vi bjuder på frakten!',
      almostThere: `Bara ${amountToFree.toFixed(0)} kr kvar till gratis frakt!`,
      addMore: `Lägg till ${amountToFree.toFixed(0)} kr för gratis frakt`,
      shippingCost: `Frakt: ${shipping.cost} kr`,
    },
    en: {
      freeShipping: 'Free shipping on us! 🎉',
      generous: 'Close enough! Free shipping on us!',
      almostThere: `Only ${amountToFree.toFixed(0)} kr left for free shipping!`,
      addMore: `Add ${amountToFree.toFixed(0)} kr for free shipping`,
      shippingCost: `Shipping: ${shipping.cost} kr`,
    }
  };

  const t = content[language as keyof typeof content] || content.en;

  return (
    <div className="bg-secondary/50 rounded-lg p-3 mb-3">
      <AnimatePresence mode="wait">
        {isFreeShipping ? (
          <motion.div
            key="free"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-center gap-2"
          >
            <PartyPopper className="w-5 h-5 text-primary" />
            <span className="font-semibold text-primary">
              {isGenerous ? t.generous : t.freeShipping}
            </span>
            <Gift className="w-5 h-5 text-primary" />
          </motion.div>
        ) : (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {amountToFree <= 100 ? t.almostThere : t.addMore}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {t.shippingCost}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            
            {/* Milestones */}
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>0 kr</span>
              <span className="text-primary font-medium">{shipping.generousFreeMin} kr</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShippingProgressBar;
