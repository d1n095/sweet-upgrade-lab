import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Gift, Sparkles, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/stores/cartStore';
import { useMemberPrices } from '@/hooks/useMemberPrices';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/context/LanguageContext';

interface PromoPopupProps {
  onOpenAuth?: () => void;
}

const PromoPopup = ({ onOpenAuth }: PromoPopupProps) => {
  const { language } = useLanguage();
  const { items } = useCartStore();
  const { checkBundleDiscount, getVolumeDiscount } = useMemberPrices();
  const { isMember, user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [promoType, setPromoType] = useState<'bundle' | 'volume' | 'member' | null>(null);
  const [promoData, setPromoData] = useState<any>(null);

  useEffect(() => {
    if (dismissed) return;

    const cartProductIds = items.map(item => item.product.node.id);
    
    // Check for bundle discount
    const bundle = checkBundleDiscount(cartProductIds);
    if (bundle) {
      setPromoType('bundle');
      setPromoData(bundle);
      setIsVisible(true);
      return;
    }

    // Check for volume discount opportunity
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    if (totalQuantity >= 2 && totalQuantity < 5) {
      const potentialDiscount = getVolumeDiscount(null, 5);
      if (potentialDiscount > 0) {
        setPromoType('volume');
        setPromoData({ 
          currentQty: totalQuantity, 
          targetQty: 5, 
          discount: potentialDiscount 
        });
        setIsVisible(true);
        return;
      }
    }

    // Suggest membership if not a member and has items
    if (!user && items.length > 0) {
      setPromoType('member');
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
  }, [items, dismissed, user, checkBundleDiscount, getVolumeDiscount]);

  const handleDismiss = () => {
    setDismissed(true);
    setIsVisible(false);
  };

  const handleAction = () => {
    if (promoType === 'member' && onOpenAuth) {
      onOpenAuth();
    }
    handleDismiss();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-40"
      >
        <div className="bg-card border border-border rounded-2xl shadow-elevated p-5 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/10 to-transparent rounded-bl-full" />
          
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-secondary transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="relative z-10">
            {promoType === 'bundle' && promoData && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">
                      {language === 'sv' ? 'Paketrabatt!' : 'Bundle Discount!'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {language === 'sv' ? 'Du kvalificerar för' : 'You qualify for'} {promoData.discount_percent}% {language === 'sv' ? 'rabatt' : 'off'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {promoData.name}: {promoData.description}
                </p>
              </>
            )}

            {promoType === 'volume' && promoData && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">
                      {language === 'sv' ? 'Mängdrabatt nära!' : 'Volume Discount Close!'}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === 'sv' 
                    ? `Lägg till ${promoData.targetQty - promoData.currentQty} till för att få ${promoData.discount}% rabatt!`
                    : `Add ${promoData.targetQty - promoData.currentQty} more to get ${promoData.discount}% off!`}
                </p>
              </>
            )}

            {promoType === 'member' && (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">
                      {language === 'sv' ? 'Bli medlem & spara!' : 'Join & Save!'}
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {language === 'sv' 
                    ? 'Medlemmar får exklusiva priser och automatiska rabatter på alla köp.'
                    : 'Members get exclusive prices and automatic discounts on all purchases.'}
                </p>
                <Button onClick={handleAction} className="w-full rounded-xl">
                  {language === 'sv' ? 'Bli medlem gratis' : 'Join for Free'}
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PromoPopup;
