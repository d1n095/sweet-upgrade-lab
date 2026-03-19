import { useState, useEffect } from 'react';
import { Truck, Gift, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

interface ShippingProgressBarProps {
  cartTotal: number;
}

const ShippingProgressBar = ({ cartTotal }: ShippingProgressBarProps) => {
  const { language } = useLanguage();
  const [shippingCost, setShippingCost] = useState(39);
  const [freeThreshold, setFreeThreshold] = useState(500);

  // Fetch from DB on mount
  useEffect(() => {
    supabase
      .from('store_settings')
      .select('key, text_value')
      .in('key', ['shipping_cost', 'free_shipping_threshold'])
      .then(({ data }) => {
        if (data) {
          for (const row of data) {
            const val = Number(row.text_value);
            if (row.key === 'shipping_cost' && Number.isFinite(val)) setShippingCost(val);
            if (row.key === 'free_shipping_threshold' && Number.isFinite(val)) setFreeThreshold(val);
          }
        }
      });
  }, []);

  const isFreeShipping = cartTotal >= freeThreshold;
  const amountToFree = Math.max(0, freeThreshold - cartTotal);
  const progress = freeThreshold > 0 ? Math.min(100, (cartTotal / freeThreshold) * 100) : 100;

  const content = {
    sv: {
      freeShipping: 'Vi bjuder på frakten! 🎉',
      almostThere: `Bara ${amountToFree.toFixed(0)} kr kvar till gratis frakt!`,
      addMore: `Lägg till ${amountToFree.toFixed(0)} kr för gratis frakt`,
      shippingCostLabel: `Frakt: ${shippingCost} kr`,
    },
    en: {
      freeShipping: 'Free shipping on us! 🎉',
      almostThere: `Only ${amountToFree.toFixed(0)} kr left for free shipping!`,
      addMore: `Add ${amountToFree.toFixed(0)} kr for free shipping`,
      shippingCostLabel: `Shipping: ${shippingCost} kr`,
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
            <span className="font-semibold text-primary">{t.freeShipping}</span>
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
                {t.shippingCostLabel}
              </span>
            </div>
            
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>0 kr</span>
              <span className="text-primary font-medium">{freeThreshold} kr</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShippingProgressBar;
